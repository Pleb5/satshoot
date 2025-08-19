import { NDKNutzap, type CashuPaymentInfo } from '@nostr-dev-kit/ndk';
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
import { UserEnum } from './UserEnum';
import { nip19 } from 'nostr-tools';

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
    private satshootCashuInfo: CashuPaymentInfo | null = $state(null);
    private sponsoredCashuInfo: CashuPaymentInfo | null = $state(null);
    private readonly safety = 3; // 3 sats safety for balance calculations
    private freelancerPubkey: string;
    private sponsoredPubkey: string = '';

    constructor(
        private primaryEntity: JobEvent | ServiceEvent,
        private secondaryEntity: BidEvent | OrderEvent
    ) {
        this.freelancerPubkey =
            this.secondaryEntity instanceof BidEvent
                ? this.secondaryEntity.pubkey
                : this.primaryEntity.pubkey;

        const sponsoredNpub =
            this.secondaryEntity instanceof BidEvent
                ? this.secondaryEntity.sponsoredNpub
                : (this.primaryEntity as ServiceEvent).sponsoredNpub;
        if (sponsoredNpub) {
            try {
                const { type, data } = nip19.decode(sponsoredNpub);
                if (type === "npub") {
                    this.sponsoredPubkey = data;
                }
            } catch (error) {
                console.error("Error decoding sponsored npub: ", sponsoredNpub);
            }
        }

        this.initializeCashuInfo();
    }

    /**
     * Initialize Cashu payment info for the freelancer
     */
    private async initializeCashuInfo() {
        this.freelancerCashuInfo = (await getCashuPaymentInfo(
            this.freelancerPubkey
        )) as CashuPaymentInfo | null;

        if (this.primaryEntity instanceof ServiceEvent && this.primaryEntity.pledgeSplit) {
            this.satshootCashuInfo = (await getCashuPaymentInfo(
                SatShootPubkey
            )) as CashuPaymentInfo | null;
        } else if (this.secondaryEntity instanceof BidEvent && this.secondaryEntity.pledgeSplit) {
            this.satshootCashuInfo = (await getCashuPaymentInfo(
                SatShootPubkey
            )) as CashuPaymentInfo | null;
        }

        if (this.sponsoredPubkey) {
            this.sponsoredCashuInfo = (await getCashuPaymentInfo(
                this.sponsoredPubkey
            )) as CashuPaymentInfo | null;
        }
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
    canPayWithEcash(userType: UserEnum): boolean {
        const cashuInfo = this.cashuInfoFromUserType(userType);
        return this.hasSenderEcashSetup && !!cashuInfo && this.checkMintBalance(0); // Will be checked with actual amount later
    }

    /**
     * Process Cashu payment for both freelancer and satshoot
     */
    async processPayment(
        freelancerShareMillisats: number,
        satshootSumMillisats: number,
        sponsoredSumMillisats: number
    ): Promise<Map<UserEnum, boolean>> {
        const paid = new Map<UserEnum, boolean>([
            [UserEnum.Freelancer, false],
            [UserEnum.Satshoot, false],
            [UserEnum.Sponsored, false]
        ]);

        const freelancerPaymentPromise = freelancerShareMillisats ? this.processCashuPayment(
            UserEnum.Freelancer,
            this.freelancerPubkey,
            freelancerShareMillisats
        ) : undefined;

        const satshootPaymentPromise = satshootSumMillisats ? this.processCashuPayment(
            UserEnum.Satshoot,
            SatShootPubkey,
            satshootSumMillisats
        ) : undefined;

        let sponsoredPubkey: string | undefined = undefined;
        if (sponsoredSumMillisats > 0) {
            const decodingResult = this.secondaryEntity instanceof BidEvent ? nip19.decode(this.secondaryEntity.sponsoredNpub)
                : nip19.decode((this.primaryEntity as ServiceEvent).sponsoredNpub);
            if (decodingResult.type === "npub") {
                sponsoredPubkey = decodingResult.data;
            } else {
                throw new Error('Expecting an npub but got something else!');
            }
        }
        const sponsoredPaymentPromise = sponsoredSumMillisats && sponsoredPubkey ? this.processCashuPayment(
            UserEnum.Sponsored,
            sponsoredPubkey,
            sponsoredSumMillisats
        ) : undefined;

        const results = await Promise.allSettled([
            freelancerPaymentPromise,
            satshootPaymentPromise,
            sponsoredPaymentPromise
        ]);

        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                if (index === 0) {
                    paid.set(UserEnum.Freelancer, true);
                } else if (index === 1) {
                    paid.set(UserEnum.Satshoot, true);
                } else {
                    paid.set(UserEnum.Sponsored, true);
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
        userType: UserEnum,
        pubkey: string,
        amountMillisats: number
    ): Promise<void> {
        if (amountMillisats === 0) return;

        const cashuInfo = this.cashuInfoFromUserType(userType);
        if (!cashuInfo || !cashuInfo.mints) {
            throw new Error(`Could not fetch cashu payment info for ${userType}!`);
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
        const compatibleMints = await this.findCompatibleMints(userType);
        if (compatibleMints.length === 0) {
            throw new Error(`Could not find a mint for ${userType} that support sats!`);
        }

        // Process the payment
        cashuInfo.allowIntramintFallback = false;

        const cashuResult = await walletInstance
            .cashuPay({
                ...cashuInfo,
                mints: compatibleMints,
                target: this.secondaryEntity,
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
        await this.createAndPublishNutZap(cashuResult, pubkey, userType);
    }

    /**
     * Find mints that are compatible with the freelancer's requirements
     */
    private async findCompatibleMints(userType: UserEnum): Promise<string[]> {
        const cashuInfo = this.cashuInfoFromUserType(userType);
        if (!cashuInfo?.mints) return [];

        const mintPromises = cashuInfo.mints.map(async (mintUrl) => {
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
        pubkey: string,
        userEnum: UserEnum
    ): Promise<void> {
        const nutzapEvent = new NDKNutzap(get(ndk));
        nutzapEvent.mint = cashuResult.mint;
        nutzapEvent.proofs = cashuResult.proofs;
        nutzapEvent.unit = 'sat';

        // Add reference tags
        nutzapEvent.tags.push([
            'a', this.secondaryEntity.tagAddress()
        ]);

        nutzapEvent.tags.push([
            'e', this.secondaryEntity.id
        ]);

        nutzapEvent.recipientPubkey = pubkey;

        const explicitRelays = [...(this.cashuInfoFromUserType(userEnum)?.relays ?? [])];

        await this.trySignAndPublishNutZap(nutzapEvent, explicitRelays);
    }

    private cashuInfoFromUserType(userType: UserEnum) {
        switch (userType) {
            case UserEnum.Freelancer:
                return this.freelancerCashuInfo;
            case UserEnum.Satshoot:
                return this.satshootCashuInfo;
            default:
                return this.sponsoredCashuInfo;
        }
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
            console.log("Mint and Proofs: \n" + rawNutzap);
            throw new NutZapError(message, rawNutzap);
        }
    }
}
