import { BidEvent } from '$lib/events/BidEvent';
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
import type { ServiceEvent } from '$lib/events/ServiceEvent';
import type { OrderEvent } from '$lib/events/OrderEvent';

export interface PaymentStore {
    paymentStore: NDKEventStore<ExtendedBaseType<NDKEvent>>;
    totalPaid: Readable<number>;
}

export const paymentDetail = writable<{
    targetEntity: JobEvent | OrderEvent;
    secondaryEntity: BidEvent | ServiceEvent;
} | null>(null);

export const createPaymentFilters = (
    event: BidEvent | ServiceEvent,
    type: 'freelancer' | 'satshoot'
): NDKFilter[] => {
    if (type === 'freelancer') {
        return [
            { kinds: [NDKKind.Zap], '#e': [event.id] },
            {
                kinds: [NDKKind.Nutzap],
                '#a': [event instanceof BidEvent ? event.bidAddress : event.serviceAddress],
            },
        ];
    } else {
        return [
            {
                kinds: [NDKKind.Zap],
                '#p': [SatShootPubkey],
                '#a': [
                    event instanceof BidEvent ? event.referencedJobAddress : event.serviceAddress,
                ],
            },
            {
                kinds: [NDKKind.Nutzap],
                '#p': [SatShootPubkey],
                '#a': [
                    event instanceof BidEvent ? event.referencedJobAddress : event.serviceAddress,
                ],
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
