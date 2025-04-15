import type { OfferEvent } from '$lib/events/OfferEvent';
import { TicketEvent } from '$lib/events/TicketEvent';
import { derived, get, writable, type Readable } from 'svelte/store';
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

export interface PaymentStore {
    paymentStore: NDKEventStore<ExtendedBaseType<NDKEvent>>;
    totalPaid: Readable<number>;
}

export const paymentDetail = writable<{
    ticket: TicketEvent;
    offer: OfferEvent;
} | null>(null);

export const createPaymentFilters = (
    offer: OfferEvent,
    type: 'freelancer' | 'satshoot'
): NDKFilter[] => {
    if (type === 'freelancer') {
        return [
            { kinds: [NDKKind.Zap], '#e': [offer.id] },
            { kinds: [NDKKind.Nutzap], '#a': [offer.offerAddress] },
        ];
    } else {
        return [
            {
                kinds: [NDKKind.Zap],
                '#p': [SatShootPubkey],
                '#a': [offer.referencedTicketAddress],
            },
            {
                kinds: [NDKKind.Nutzap],
                '#p': [SatShootPubkey],
                '#a': [offer.referencedTicketAddress],
            },
        ];
    }
};

export const createPaymentStore = (filters: NDKFilter[]) => {
    const $ndk = get(ndk);
    const paymentStore = $ndk.storeSubscribe(filters, {
        closeOnEose: false,
        groupable: true,
        groupableDelay: 1500,
        autoStart: true,
    });

    const $wot = get(wot);

    // Derived store to calculate totalPaid
    const totalPaid = derived(paymentStore, ($paymentStore) => {
        let total = 0;
        $paymentStore.forEach((zap: NDKEvent) => {
            if (zap.kind === NDKKind.Zap) {
                const zapInvoice = zapInvoiceFromEvent(zap);
                if (zapInvoice && $wot.has(zapInvoice.zappee)) {
                    total += Math.round(zapInvoice.amount / 1000);
                }
            } else if (zap.kind === NDKKind.Nutzap) {
                const nutzap = NDKNutzap.from(zap);
                if (nutzap && $wot.has(nutzap.pubkey)) {
                    total += Math.round(nutzap.amount / 1000);
                }
            }
        });
        return total;
    });

    return { paymentStore, totalPaid };
};
