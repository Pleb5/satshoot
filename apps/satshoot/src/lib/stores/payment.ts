import type { BidEvent } from '$lib/events/BidEvent';
import { JobEvent } from '$lib/events/JobEvent';
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
    job: JobEvent;
    bid: BidEvent;
} | null>(null);

export const createPaymentFilters = (
    bid: BidEvent,
    type: 'freelancer' | 'satshoot'
): NDKFilter[] => {
    if (type === 'freelancer') {
        return [
            { kinds: [NDKKind.Zap], '#e': [bid.id] },
            { kinds: [NDKKind.Nutzap], '#a': [bid.bidAddress] },
        ];
    } else {
        return [
            {
                kinds: [NDKKind.Zap],
                '#p': [SatShootPubkey],
                '#a': [bid.referencedJobAddress],
            },
            {
                kinds: [NDKKind.Nutzap],
                '#p': [SatShootPubkey],
                '#a': [bid.referencedJobAddress],
            },
        ];
    }
};

export interface PaymentStore {
    paymentStore: NDKEventStore<ExtendedBaseType<NDKEvent>>;
    totalPaid: Readable<number>;
}

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
        });
        return total;
    });

    return { paymentStore, totalPaid };
};
