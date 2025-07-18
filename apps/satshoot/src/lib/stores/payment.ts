import { BidEvent } from '$lib/events/BidEvent';
import { derived, get, type Readable } from 'svelte/store';
import ndk from '$lib/stores/session';
import {
    NDKKind,
    NDKNutzap,
    zapInvoiceFromEvent,
    type NDKEvent,
    type NDKFilter,
} from '@nostr-dev-kit/ndk';
import { wot } from './wot';
import { SatShootPubkey } from '$lib/utils/misc';
import type { ExtendedBaseType, NDKEventStore } from '@nostr-dev-kit/ndk-svelte';
import type { OrderEvent } from '$lib/events/OrderEvent';
import { nip19 } from 'nostr-tools';

export interface PaymentStore {
    paymentStore: NDKEventStore<ExtendedBaseType<NDKEvent>>;
    totalPaid: Readable<number>;
}

export const createPaymentFilters = (
    event: BidEvent | OrderEvent,
    type: 'freelancer' | 'satshoot' | 'sponsored'
): NDKFilter[] => {
    if (type === 'freelancer') {
        let taggedFreelancerPubkey: string | undefined = event.author.pubkey;
        if (event.kind === NDKKind.FreelanceOrder) {
            taggedFreelancerPubkey = (event as OrderEvent).referencedServiceProvider
            if (!taggedFreelancerPubkey) throw new Error(
                'Error: Cannot get Freelancer pubkey from Bid or Order get payments for freelancer'
            )
        }
        return [
            { kinds: [NDKKind.Zap, NDKKind.Nutzap],
                '#a': [event.tagAddress()],
                '#p': [taggedFreelancerPubkey]
            },
        ];
    } else if (type == 'satshoot') {
        return [
            {
                kinds: [NDKKind.Zap, NDKKind.Nutzap],
                '#a': [event.tagAddress()],
                '#p': [SatShootPubkey],
            },
        ];
    } else {
        const bidEvent = event as BidEvent;
        if (bidEvent) {
            try {
                const decodedNpubResult = nip19.decode(bidEvent.sponsoredNpub);
                const sponsoredPubkey = decodedNpubResult.type == 'npub' ? decodedNpubResult.data : undefined;
                if (sponsoredPubkey) {
                    return [
                        {
                            kinds: [NDKKind.Zap, NDKKind.Nutzap],
                            '#p': [sponsoredPubkey],
                            '#a': [bidEvent.referencedJobAddress],
                        },
                    ];
                } else 
                    return [];
            } catch(error) {
                return [];
            }
        } else {
            //TODO (rodant): handle the OrderEvent case
            return [];
        }
    }
};

export const createPaymentStore = (filters: NDKFilter[]): PaymentStore => {
    const $ndk = get(ndk);
    const paymentStore = $ndk.storeSubscribe(filters, {
        closeOnEose: false,
        groupable: true,
        groupableDelay: 1500,
        autoStart: false,
    });

    const $wot = get(wot);

    // Derived store to calculate totalPaid
    const totalPaid = derived(paymentStore, ($paymentStore) => {
        let total = 0;
        $paymentStore.forEach((zap: NDKEvent) => {
            if (zap.signatureVerified) {
                if (zap.kind === NDKKind.Zap) {
                    const zapInvoice = zapInvoiceFromEvent(zap);
                    if (zapInvoice && $wot.has(zapInvoice.zappee)) {
                        total += Math.round(zapInvoice.amount / 1000);
                    }
                } else if (zap.kind === NDKKind.Nutzap) {
                    const nutzap = NDKNutzap.from(zap);
                    if (nutzap && $wot.has(nutzap.pubkey)) {
                        total += Math.round(nutzap.amount);
                    }
                }
            }
        });
        return total;
    });

    return { paymentStore, totalPaid };
};
