import { BidEvent } from '$lib/events/BidEvent';
import { JobEvent } from '$lib/events/JobEvent';
import type { OrderEvent } from '$lib/events/OrderEvent';
import { ServiceEvent } from '$lib/events/ServiceEvent';
import ndk from '$lib/stores/session';
import currentUser from '$lib/stores/user';
import { getZapConfiguration } from '$lib/utils/helpers';
import { SatShootPubkey } from '$lib/utils/misc';
import {
    generateZapRequest,
    NDKEvent,
    NDKKind,
    NDKRelaySet,
    NDKSubscriptionCacheUsage,
    NDKZapper,
    type NDKLnUrlData,
    type NDKZapperOptions,
} from '@nostr-dev-kit/ndk';
import { get } from 'svelte/store';
import { UserEnum } from './UserEnum';
import { nip19 } from 'nostr-tools';

export interface InvoiceDetails {
    paymentRequest: string;
    receiver: string;
    eventId: string;
    zapper?: string;
}

/**
 * Service for Lightning Network payment operations
 */
export class LightningPaymentService {
    private freelancerPubkey: string;

    constructor(
        private primaryEntity: JobEvent | ServiceEvent,
        private secondaryEntity: BidEvent | OrderEvent
    ) {
        this.freelancerPubkey =
            this.secondaryEntity instanceof BidEvent
                ? this.secondaryEntity.pubkey
                : this.primaryEntity.pubkey;
    }


    /**
     * Process Lightning Network payment
     */
    async processPayment(
        freelancerShareMillisats: number,
        satshootSumMillisats: number,
        sponsoredSumMillisats: number
    ): Promise<Map<UserEnum, boolean>> {
        const zapRequestRelays = new Map<UserEnum, string[]>();
        const invoices = new Map<UserEnum, InvoiceDetails>();
        const paid = new Map<UserEnum, boolean>([
            [UserEnum.Freelancer, false],
            [UserEnum.Satshoot, false],
        ]);

        // Fetch payment info for freelancer
        if (freelancerShareMillisats > 0) {
            await this.fetchPaymentInfo(
                UserEnum.Freelancer,
                this.freelancerPubkey,
                freelancerShareMillisats,
                zapRequestRelays,
                invoices,
                this.secondaryEntity
            );
        }

        // Fetch payment info for satshoot
        if (satshootSumMillisats > 0) {
            await this.fetchPaymentInfo(
                UserEnum.Satshoot,
                SatShootPubkey,
                satshootSumMillisats,
                zapRequestRelays,
                invoices,
                this.primaryEntity instanceof ServiceEvent ? this.secondaryEntity : this.primaryEntity
            );
        }

        // Fetch payment info for the sponsored npub
        if (sponsoredSumMillisats > 0) {
            let sponsoredPubkey = undefined;
            if (this.secondaryEntity instanceof BidEvent) {
                if (nip19.decode(this.secondaryEntity.sponsoredNpub).type === "npub") {
                    sponsoredPubkey = nip19.decode(this.secondaryEntity.sponsoredNpub).data as string;
                    await this.fetchPaymentInfo(
                        UserEnum.Sponsored,
                        sponsoredPubkey,
                        sponsoredSumMillisats,
                        zapRequestRelays,
                        invoices,
                        this.primaryEntity instanceof ServiceEvent ? this.secondaryEntity : this.primaryEntity
                    );
                }
            }
        }

        // Launch payment modals and process payments
        const { init, launchPaymentModal, closeModal, onModalClosed } = await import(
            '@getalby/bitcoin-connect'
        );
        init({ appName: 'SatShoot' });

        for (const [key, invoice] of invoices.entries()) {
            if (!invoice) continue;

            launchPaymentModal({
                invoice: invoice.paymentRequest,
                onPaid: () => paid.set(key, true),
            });

            const filter = {
                kinds: [NDKKind.Zap],
                since: Math.floor(Date.now() / 1000),
                '#p': [invoice.receiver],
                authors: invoice.zapper ? [invoice.zapper] : undefined,
            };

            try {
                const subscription = get(ndk).subscribe(
                    filter,
                    { cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY },
                    NDKRelaySet.fromRelayUrls(zapRequestRelays.get(key)!, get(ndk))
                );

                subscription.on('event', async (event) => {
                    if (event.tagValue('bolt11') === invoice.paymentRequest && !paid.get(key)) {
                        paid.set(key, true);
                        closeModal();
                    }
                });

                await new Promise<void>((resolve) => {
                    const unsub = onModalClosed(() => {
                        subscription.stop();
                        resolve();
                        unsub();// TODO (rodant): weird recursion, is this correct?
                    });
                });
            } catch (error) {
                console.error('An error occurred in payment process', error);
                let payee;
                switch(key) {
                    case UserEnum.Freelancer:
                        payee = "Freelancer's";
                        break;
                    case UserEnum.Satshoot:
                        payee = "Satshoot's";
                        break;
                    default:
                        payee = "Sponsored Npub's";
                }
                throw new Error(
                    `Could not fetch ${payee} zap receipt: ${error}`
                );
            }
        }

        return paid;
    }

    /**
     * Fetch payment information for a user
     */
    private async fetchPaymentInfo(
        userEnum: UserEnum,
        pubkey: string,
        amountMillisats: number,
        zapRequestRelays: Map<UserEnum, string[]>,
        invoices: Map<UserEnum, InvoiceDetails>,
        event: NDKEvent
    ) {
        const zapConfig = await getZapConfiguration(pubkey);
        if (zapConfig) {
            const invoice = await this.generateInvoice(
                event,
                amountMillisats,
                zapConfig,
                pubkey,
                {
                    nutzapAsFallback: false,
                    comment: 'satshoot',
                    tags: [['P', get(currentUser)!.pubkey]],
                },
                userEnum,
                zapRequestRelays
            );

            invoices.set(userEnum, {
                paymentRequest: invoice,
                receiver: pubkey,
                eventId: event.id,
                zapper: zapConfig.nostrPubkey,// TODO (rodant): not the current user?
            });
        } else {
            throw new Error(`Could not fetch ${userEnum}'s zap config!`);
        }
    }

    /**
     * Generate Lightning invoice
     */
    private async generateInvoice(
        target: NDKEvent,
        amount: number,
        zapConfig: NDKLnUrlData,
        receiver: string,
        opts: NDKZapperOptions,
        user: UserEnum,
        zapRequestRelays: Map<UserEnum, string[]>
    ): Promise<string> {
        const zapper = new NDKZapper(target, amount, 'msat', opts);
        const relays = await zapper.relays(receiver);

        const zapRequest = await generateZapRequest(
            target,
            get(ndk),
            zapConfig,
            receiver,
            amount,
            relays,
            opts.comment,
            opts.tags
        ).catch((err) => {
            console.log('Error: An error occurred in generating zap request!', err);
            return null;
        });

        if (!zapRequest) throw new Error('Failed to generate zap request');

        const relayUrls = zapRequest.tags.find((t) => t[0] === 'relays')?.slice(1) || [];
        zapRequestRelays.set(user, relayUrls);

        const invoice = await zapper.getLnInvoice(zapRequest, amount, zapConfig).catch((err) => {
            console.log('Error: An error occurred in getting LnInvoice!', err);
            return null;
        });

        if (!invoice) throw new Error('Failed to get LNInvoice');

        return invoice;
    }
}
