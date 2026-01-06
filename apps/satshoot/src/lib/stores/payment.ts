import { BidEvent } from '$lib/events/BidEvent';
import { derived, get, type Readable, writable } from 'svelte/store';
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
import { ServiceEvent } from '$lib/events/ServiceEvent';
import type { JobEvent } from '$lib/events/JobEvent';
import { ExtendedNDKKind } from '$lib/types/ndkKind';

export interface PaymentStore {
    paymentStore: NDKEventStore<ExtendedBaseType<NDKEvent>>;
    totalPaid: Readable<number>;
}

function createEmptyPaymentEventStore(): NDKEventStore<ExtendedBaseType<NDKEvent>> {
    const store = writable<ExtendedBaseType<NDKEvent>[]>([]);

    return {
        ...store,
        id: 'empty-payment-store',
        filters: undefined,
        refCount: 0,
        subscription: undefined,
        eosed: true,
        skipDeleted: true,
        startSubscription: () => {},
        unsubscribe: () => {},
        onEose: (cb) => cb(),
        onEvent: (_cb) => {},
        ref: () => 0,
        unref: () => 0,
        empty: () => store.set([]),
        changeFilters: (_filters) => {},
    };
}

export const createPaymentFilters = (
    targetEvent: BidEvent | OrderEvent,
    sponsoredEntity: ServiceEvent | JobEvent,
    type: 'freelancer' | 'satshoot' | 'sponsored'
): NDKFilter[] => {
    if (type === 'freelancer') {
        let taggedFreelancerPubkey: string | undefined = targetEvent.author.pubkey;
        if (targetEvent.kind === ExtendedNDKKind.FreelanceOrder) {
            taggedFreelancerPubkey = (targetEvent as OrderEvent).referencedServiceProvider;
            if (!taggedFreelancerPubkey)
                throw new Error(
                    'Error: Cannot get Freelancer pubkey from Bid or Order get payments for freelancer'
                );
        }
        return [
            {
                kinds: [NDKKind.Zap, NDKKind.Nutzap],
                '#a': [targetEvent.tagAddress()],
                '#p': [taggedFreelancerPubkey],
            },
        ];
    } else if (type == 'satshoot') {
        return [
            {
                kinds: [NDKKind.Zap, NDKKind.Nutzap],
                '#a': [targetEvent.tagAddress()],
                '#p': [SatShootPubkey],
            },
        ];
    } else {
        let decodedNpubResult;
        let targetEventAddr;
        try {
            if (targetEvent instanceof BidEvent) {
                decodedNpubResult = nip19.decode(targetEvent.sponsoredNpub);
                targetEventAddr = targetEvent.tagAddress();
            } else if (sponsoredEntity instanceof ServiceEvent) {
                decodedNpubResult = nip19.decode(sponsoredEntity.sponsoredNpub);
                targetEventAddr = targetEvent.tagAddress();
            } else {
                console.error('Unexpected case!!!');
                throw new Error('Unexpected combination of target and sponsored events!!!');
            }
            const sponsoredPubkey =
                decodedNpubResult.type == 'npub' ? decodedNpubResult.data : undefined;
            if (sponsoredPubkey) {
                return [
                    {
                        kinds: [NDKKind.Zap, NDKKind.Nutzap],
                        '#p': [sponsoredPubkey],
                        '#a': [targetEventAddr],
                    },
                ];
            } else {
                console.warn(
                    'Unexpected case, the sponsored event received contains' +
                        ' something different to an npub'
                );
            }
            return [];
        } catch (error) {
            console.warn('The sponsored event contains a wrong or no npub');
            return [];
        }
    }
};

export const createPaymentStore = (filters: NDKFilter[]): PaymentStore => {
    const $ndk = get(ndk);
    const paymentStore =
        filters.length > 0
            ? $ndk.storeSubscribe(filters, {
                  closeOnEose: false,
                  groupable: true,
                  groupableDelay: 1500,
                  autoStart: false,
              })
            : createEmptyPaymentEventStore();

    const $wot = get(wot);

    // Derived store to calculate totalPaid
    const totalPaid = derived(paymentStore, ($paymentStore) => {
        let total = 0;
        $paymentStore.forEach((zap: NDKEvent) => {
            if (zap.verifySignature(true)) {
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
