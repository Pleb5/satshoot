<script lang="ts">
import ndk from "$lib/stores/ndk";
import { OfferEvent } from "$lib/events/OfferEvent";
import { 
    NDKKind,
    NDKSubscriptionCacheUsage,
    zapInvoiceFromEvent,
    type NDKEvent,
    type NDKUserProfile,
    type NDKZapInvoice,
} from "@nostr-dev-kit/ndk";

import { onMount } from "svelte";

import { Avatar } from '@skeletonlabs/skeleton';
import OfferCard from "../Cards/OfferCard.svelte";
import { insertThousandSeparator } from '$lib/utils/misc';


export let zapEvent: NDKEvent;

const zapInvoice:NDKZapInvoice|null = zapInvoiceFromEvent(zapEvent);

const zapperUser = zapEvent.kind === NDKKind.Zap
                    ? $ndk.getUser({pubkey: zapEvent.tagValue('P')})
                    : $ndk.getUser({pubkey: zapEvent.pubkey});

let zapperName = zapperUser.npub.substring(0,8);
const zapDate = new Date(zapEvent.created_at as number * 1000);
const zapTimestamp = zapDate.toLocaleString();
let zapperImage = `https://robohash.org/${zapperUser.pubkey}`;
let zapperProfile: NDKUserProfile | null;

let zappedOffer: OfferEvent | null = null;
let amount: number|null = null;

onMount(async() => {
    zapperProfile = await zapperUser.fetchProfile(); 
    if (zapperProfile) {
        if (zapperProfile.name) {
            zapperName = zapperProfile.name;
        }
        if (zapperProfile.image) {
            zapperImage = zapperProfile.image;
        }
    }
    if (zapInvoice) {
        // LN zap
        if (zapInvoice.zappedEvent) {
            const offerEvent = await $ndk.fetchEvent(
                zapInvoice.zappedEvent,
                {
                    groupable: true,
                    groupableDelay: 400,
                    cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST
                },
            );
            if (offerEvent) {
                zappedOffer = OfferEvent.from(offerEvent);
            }
        }
        if (zapInvoice.amount) {
            amount = Math.round(zapInvoice.amount / 1000);
        }
    } else if (zapEvent.kind === NDKKind.Nutzap) {
        // Nutzap
        const nutZapAmount = zapEvent.tagValue('amount');
        if (nutZapAmount) {
            amount = Math.round(parseInt(nutZapAmount) / 1000);
        }
        const zappedOfferID = zapEvent.tagValue("e");
        if (zappedOfferID) {
            const offerEvent = await $ndk.fetchEvent(
                zappedOfferID,
                {
                    groupable: true,
                    groupableDelay: 400,
                    cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST
                },
            );
            if (offerEvent) {
                zappedOffer = OfferEvent.from(offerEvent);
            }
        }
    }
});

</script>

<div class="grid grid-cols-[1fr_auto] gap-x-2">
    <div class="card p-4 space-y-2 bg-surface-300-600-token rounded-tl-none">
        <header class="flex justify-between items-center gap-x-4">
            <p class="font-bold text-sm md:text-lg">{zapperName}</p>
            <small class="opacity-50">{zapTimestamp}</small>
        </header>
        <h4 class="h4 sm:h3 space-x-2 text-center">
            <span class="text-warning-500">
                <i class="fa-solid fa-bolt"></i>
            </span>
            <span>
                {(amount ? insertThousandSeparator(amount) : '?') + ' sats'}
            </span>
        </h4>
        {#if zappedOffer}
            <div class="flex justify-center">
                <OfferCard
                    offer={zappedOffer}
                    showOfferReview={false}
                    showReputation={false}
                    showTicketReputation={false}
                    showTicketReview={false}
                    showDescription={false}
                    showPoster={false}
                    showDetails={false}
                >
                </OfferCard>
            </div>
        {/if}
    </div>
    <a href={'/' + zapperUser.npub}>
        <Avatar src={zapperImage} width="w-12" />
    </a>
</div>

