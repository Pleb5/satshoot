import { NDKEvent, NDKNutzap, type CashuPaymentInfo, type Hexpubkey } from '@nostr-dev-kit/ndk';
import { type Proof } from '@cashu/cashu-ts';
import ndk from '$lib/stores/session';
import { wallet } from '$lib/wallet/wallet';
import { broadcastEvent, getCashuPaymentInfo } from '$lib/utils/helpers';
import { SatShootPubkey } from '$lib/utils/misc';
import { CashuMint } from '@cashu/cashu-ts';
import { get } from 'svelte/store';
import { BidEvent } from '$lib/events/BidEvent';
import { ServiceEvent } from '$lib/events/ServiceEvent';
import { JobEvent } from '$lib/events/JobEvent';
import { OrderEvent } from '$lib/events/OrderEvent';

export enum UserEnum {
    Satshoot = 'satshoot',
    Freelancer = 'freelancer',
}

export type NutZapErrorData = {
    mint: string;
    proofs: Proof[];
};

export class NutZapError extends Error {
    constructor(
        message: string,
        public readonly data: NutZapErrorData
    ) {
        super(message);
        this.name = this.constructor.name;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

/**
 * Service for Cashu/Ecash payment operations
 */
export class CashuPaymentService {
    private freelancerCashuInfo: CashuPaymentInfo | null = $state(null);
    private readonly safety = 3; // 3 sats safety for balance calculations
    private freelancerPubkey: string;

    constructor(
        private targetEntity: JobEvent | ServiceEvent,
        private secondaryEntity: BidEvent | OrderEvent
    ) {
        this.freelancerPubkey =
            this.secondaryEntity instanceof BidEvent
                ? this.secondaryEntity.pubkey
                : this.targetEntity.pubkey;

        this.initializeCashuInfo();
    }

    /**
     * Initialize Cashu payment info for the freelancer
     */
    private async initializeCashuInfo() {
        this.freelancerCashuInfo = (await getCashuPaymentInfo(
            this.freelancerPubkey
        )) as CashuPaymentInfo | null;
    }

    /**
     * Check if sender has ecash setup
     */
    get hasSenderEcashSetup(): boolean {
        return !!get(wallet);
    }

    /**
     * Check if there's a mint with sufficient balance
     */
    checkMintBalance(totalAmount: number): boolean {
        const walletInstance = get(wallet);
        if (!walletInstance) return false;

        return walletInstance.getMintsWithBalance(totalAmount + this.safety).length > 0;
    }

    /**
     * Check if payment with ecash is possible
     */
    get canPayWithEcash(): boolean {
        return this.hasSenderEcashSetup && !!this.freelancerCashuInfo && this.checkMintBalance(0); // Will be checked with actual amount later
    }

    /**
     * Get ecash tooltip text for UI
     */
    get ecashTooltipText(): string {
        if (!this.hasSenderEcashSetup) {
            return 'Setup Wallet to pay with Cashu!';
        }
        if (!this.freelancerCashuInfo) {
            return 'Could not find Freelancer Cashu Info';
        }
        return '';
    }

    /**
     * Process Cashu payment for both freelancer and satshoot
     */
    async processPayment(
        freelancerShareMillisats: number,
        satshootSumMillisats: number
    ): Promise<Map<UserEnum, boolean>> {
        const paid = new Map<UserEnum, boolean>([
            [UserEnum.Freelancer, false],
            [UserEnum.Satshoot, false],
        ]);

        const freelancerPaymentPromise = this.processCashuPayment(
            UserEnum.Freelancer,
            this.freelancerPubkey,
            freelancerShareMillisats
        );

        const satshootPaymentPromise = this.processCashuPayment(
            UserEnum.Satshoot,
            SatShootPubkey,
            satshootSumMillisats
        );

        const results = await Promise.allSettled([
            freelancerPaymentPromise,
            satshootPaymentPromise,
        ]);

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                if (index === 0) {
                    paid.set(UserEnum.Freelancer, true);
                } else {
                    paid.set(UserEnum.Satshoot, true);
                }
            } else {
                // Error will be handled by the caller
                throw result.reason;
            }
        });

        return paid;
    }

    /**
     * Process individual Cashu payment
     */
    private async processCashuPayment(
        userEnum: UserEnum,
        pubkey: string,
        amountMillisats: number
    ): Promise<void> {
        if (amountMillisats === 0) return;

        if (!this.freelancerCashuInfo || !this.freelancerCashuInfo.mints) {
            throw new Error(`Could not fetch cashu payment info for ${userEnum}!`);
        }

        const walletInstance = get(wallet);
        if (!walletInstance) {
            throw new Error('Wallet is not initialized!');
        }

        const mintsWithBalance = walletInstance.getMintsWithBalance(
            Math.floor(amountMillisats / 1000) + this.safety
        );

        if (mintsWithBalance.length === 0) {
            throw new Error(`No Mint with enough balance to complete the payment!`);
        }

        // Find compatible mints
        const compatibleMints = await this.findCompatibleMints();
        if (compatibleMints.length === 0) {
            throw new Error(`Could not find a mint for ${userEnum} that support sats!`);
        }

        // Process the payment
        this.freelancerCashuInfo.allowIntramintFallback = false;

        const cashuResult = await walletInstance
            .cashuPay({
                ...this.freelancerCashuInfo,
                mints: compatibleMints,
                target:
                    userEnum === UserEnum.Freelancer
                        ? this.secondaryEntity
                        : this.targetEntity instanceof ServiceEvent
                          ? this.secondaryEntity
                          : this.targetEntity,
                recipientPubkey: pubkey,
                amount: amountMillisats,
                unit: 'msat',
                comment: 'satshoot',
            })
            .catch((err) => {
                throw new Error(`Failed to pay: ${err?.message || err}`);
            });

        if (!cashuResult) {
            throw new Error('Unknown error occurred while minting Proofs for NutZap!');
        }

        // Create and publish NutZap event
        await this.createAndPublishNutZap(cashuResult, userEnum, pubkey);
    }

    /**
     * Find mints that are compatible with the freelancer's requirements
     */
    private async findCompatibleMints(): Promise<string[]> {
        if (!this.freelancerCashuInfo?.mints) return [];

        const mintPromises = this.freelancerCashuInfo.mints.map(async (mintUrl) => {
            const mint = new CashuMint(mintUrl);
            return mint
                .getInfo()
                .then((info) => {
                    if (info.nuts[4].methods.some((method) => method.unit === 'sat')) {
                        return mintUrl;
                    }
                    return null;
                })
                .catch((err) => {
                    console.error('Error while retrieving candidate Mint info', mintUrl, err);
                    return null;
                });
        });

        const mintInfoResults = await Promise.allSettled(mintPromises);
        const mints: string[] = [];

        mintInfoResults.forEach((result) => {
            if (result.status === 'fulfilled' && result.value) {
                mints.push(result.value);
            }
        });

        return mints;
    }

    /**
     * Create and publish NutZap event
     */
    private async createAndPublishNutZap(
        cashuResult: { mint: string; proofs: Proof[] },
        userEnum: UserEnum,
        pubkey: string
    ): Promise<void> {
        const nutzapEvent = new NDKNutzap(get(ndk));
        nutzapEvent.mint = cashuResult.mint;
        nutzapEvent.proofs = cashuResult.proofs;
        nutzapEvent.unit = 'sat';

        // Add reference tags
        nutzapEvent.tags.push([
            'a',
            userEnum === UserEnum.Freelancer
                ? this.secondaryEntity.tagAddress()
                : this.targetEntity instanceof ServiceEvent
                  ? this.secondaryEntity.tagAddress()
                  : this.targetEntity.tagAddress(),
        ]);

        nutzapEvent.tags.push([
            'e',
            userEnum === UserEnum.Freelancer
                ? this.secondaryEntity.id
                : this.targetEntity instanceof ServiceEvent
                  ? this.secondaryEntity.id
                  : this.targetEntity.id,
        ]);

        nutzapEvent.recipientPubkey = pubkey;

        const explicitRelays = [...(this.freelancerCashuInfo?.relays ?? [])];

        await this.trySignAndPublishNutZap(nutzapEvent, explicitRelays);
    }

    /**
     * Sign and publish NutZap event with error handling
     */
    private async trySignAndPublishNutZap(
        nutzapEvent: NDKNutzap,
        explicitRelays: string[]
    ): Promise<void> {
        try {
            await nutzapEvent.sign();

            const publishedRelaySet = await broadcastEvent(get(ndk), nutzapEvent, {
                explicitRelays,
                includePoolRelays: true,
                includeOutboxPoolRelays: true,
                includeBlastUrl: true,
            });

            console.log('publishedRelaySet :>> ', publishedRelaySet);
        } catch (err) {
            const rawNutzap: NutZapErrorData = {
                mint: nutzapEvent.mint,
                proofs: nutzapEvent.proofs,
            };
            const message = `Copy the minted NutZap Proofs and save somewhere safe then try to send to recipient manually`;
            throw new NutZapError(message, rawNutzap);
        }
    }
}
