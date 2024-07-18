<script lang="ts">
import { page } from '$app/stores';
import Reputation from '$lib/components/OrderBook/Reputation.svelte';
import UserCard from "$lib/components/User/UserCard.svelte";
import { TicketEvent } from '$lib/events/TicketEvent';
import currentUser from '$lib/stores/user';
import ndk from '$lib/stores/ndk';
import { NDKKind } from '@nostr-dev-kit/ndk';
import type { NDKEventStore, ExtendedBaseType } from '@nostr-dev-kit/ndk-svelte';
import { OfferEvent } from '$lib/events/OfferEvent';
import TicketCard from '$lib/components/OrderBook/TicketCard.svelte';
import OfferCard from '$lib/components/OrderBook/OfferCard.svelte';
    import { onDestroy, onMount } from 'svelte';

$: npub = $page.params.npub;
$: user = $ndk.getUser({npub: npub});

const subOptions = {
    autoStart: true,
};

let allTicketsOfUser:NDKEventStore<ExtendedBaseType<TicketEvent>>;
let allOffersOfUser:NDKEventStore<ExtendedBaseType<OfferEvent>>;

$: if (user) {
    if (allTicketsOfUser) allTicketsOfUser.empty();
    if (allOffersOfUser) allOffersOfUser.empty();

    allTicketsOfUser = $ndk.storeSubscribe<TicketEvent>(
        {
            kinds: [NDKKind.TroubleshootTicket],
            authors: [user.pubkey],
        },
        subOptions,
        TicketEvent
    );

    allOffersOfUser = $ndk.storeSubscribe<OfferEvent>(
        {
            kinds: [NDKKind.TroubleshootOffer],
            authors: [user.pubkey],
        },
        subOptions,
        OfferEvent
    );
}

onMount(() => {
    // Scroll to top as soon as ticket arrives
    const elemPage:HTMLElement = document.querySelector('#page') as HTMLElement;
    elemPage.scrollTo({ top: elemPage.scrollHeight*(-1), behavior:'instant' });
});

onDestroy(()=>{
    if (allTicketsOfUser) allTicketsOfUser.empty();
    if (allOffersOfUser) allOffersOfUser.empty();
});
     

</script>

<div class="flex flex-col gap-y-4 items-center p-4">
    <div class="w-[90vw] sm:w-[70vw] lg:w-[60vw]">
        <UserCard {user} />
    </div>
    <!-- Show reputation defaulting ratings to the type of review
    <!-- that contains more reviews -->
    {#if $currentUser}
    <div class="w-[90vw] sm:w-[70vw] lg:w-[60vw]">
            <Reputation user={user.pubkey} type={undefined}/>
    </div>
    {/if}

    <h3 class="h3 text-center underline">
        Tickets of User
    </h3>
    {#if $allTicketsOfUser.length > 0}
        <div class="flex flex-col items-center gap-y-8">
            {#each $allTicketsOfUser as ticket (ticket.id)}
                <div class="w-[90vw] sm:w-[70vw] lg:w-[60vw]">
                    <TicketCard
                    {ticket}
                    titleSize={'md lg:text-xl'}
                    showReputation={false}
                />
                </div>
            {/each}
        </div>
    {:else}
        <h4>No Tickets found!</h4>
    {/if}
    <h3 class="h3 text-center underline">
        Offers of User
    </h3>
    {#if $allOffersOfUser.length > 0}
        <div class="flex flex-col items-center gap-y-8">
            {#each $allOffersOfUser as offer (offer.id)}
                <div class="w-[90vw] sm:w-[70vw] lg:w-[60vw]">
                    <OfferCard 
                    {offer}
                    enableChat={false}
                    showReputation={false}
                />
                </div>
            {/each}
        </div>
    {:else}
        <h4>No Offers found!</h4>
    {/if}
</div>
