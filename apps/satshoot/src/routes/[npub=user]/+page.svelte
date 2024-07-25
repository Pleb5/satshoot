<script lang="ts">
import { page } from '$app/stores';
import Reputation from '$lib/components/OrderBook/Reputation.svelte';
import UserCard from "$lib/components/User/UserCard.svelte";
import { TicketEvent } from '$lib/events/TicketEvent';
import currentUser, { loggedIn } from '$lib/stores/user';
import ndk from '$lib/stores/ndk';
import { NDKKind } from '@nostr-dev-kit/ndk';
import type { NDKEventStore, ExtendedBaseType } from '@nostr-dev-kit/ndk-svelte';
import { OfferEvent } from '$lib/events/OfferEvent';
import TicketCard from '$lib/components/OrderBook/TicketCard.svelte';
import OfferCard from '$lib/components/OrderBook/OfferCard.svelte';
import { onDestroy, onMount } from 'svelte';
import { derived } from 'svelte/store';
import { Accordion, AccordionItem } from '@skeletonlabs/skeleton';
import UserTicketsIcon from '$lib/components/Icons/UserTicketsIcon.svelte';
import HandshakeIcon from '$lib/components/Icons/HandshakeIcon.svelte';
import PostTicketIcon from '$lib/components/Icons/PostTicketIcon.svelte';
import UserOffersIcon from '$lib/components/Icons/UserOffersIcon.svelte';

$: npub = $page.params.npub;
$: user = $ndk.getUser({npub: npub});

const subOptions = {
    autoStart: true,
};

let allTicketsOfUser:NDKEventStore<ExtendedBaseType<TicketEvent>>;
let allOffersOfUser:NDKEventStore<ExtendedBaseType<OfferEvent>>;
let ticketsWithUser;
let offersWithUser;


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

$: if (loggedIn) {
    ticketsWithUser = derived(
        [allTicketsOfUser, currentUser],
        ([$allTicketsOfUser, $currentUser]) => {
            const tickets = $allTicketsOfUser.filter((ticket: TicketEvent) => {
                const winner = ticket.acceptedOfferAddress;
                if (
                    winner
                    && winner.split(':')[1] === $currentUser!.pubkey
                ) {
                    return true;
                } 

                return false;
            });

            return tickets;
        }
    );

    offersWithUser = derived(
        [allOffersOfUser, currentUser],
        ([$allOffersOfUser, $currentUser]) => {
            const offers = $allOffersOfUser.filter((offer: OfferEvent) => {
                const ticketPubkey = offer.referencedTicketAddress.split(':')[1];
                if (ticketPubkey === $currentUser!.pubkey) {
                    return true;
                }

                return false;
            });

            return offers;
        }
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

    <div class="w-[90vw] sm:w-[70vw] lg:w-[60vw]">
        {#if $loggedIn && (user.pubkey !== $currentUser?.pubkey)}
            {#if $ticketsWithUser?.length > 0 
                || $offersWithUser?.length > 0}
                <Accordion>
                    <AccordionItem>
                        <svelte:fragment slot="lead">
                            <HandshakeIcon/>
                        </svelte:fragment>
                        <svelte:fragment slot="summary">
                            <h3 class="h3 text-center underline">
                                Deals with User
                            </h3>
                        </svelte:fragment>
                        <svelte:fragment slot="content">
                            <Accordion>
                                <AccordionItem>
                                    <svelte:fragment slot="lead">
                                        <PostTicketIcon/>
                                    </svelte:fragment>
                                    <svelte:fragment slot="summary">
                                        <h3 class="h3 text-center underline">
                                            Tickets
                                        </h3>
                                    </svelte:fragment>
                                    <svelte:fragment slot="content">
                                        {#if $ticketsWithUser?.length > 0}
                                            <div class="flex flex-col items-center gap-y-8">
                                                {#each $ticketsWithUser as ticket (ticket.id)}
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
                                            <h4 class="text-center">No Tickets with User!</h4>
                                        {/if}
                                    </svelte:fragment>
                                </AccordionItem>
                            </Accordion>
                            <Accordion>
                                <AccordionItem>
                                    <svelte:fragment slot="lead">
                                        <UserOffersIcon/>
                                    </svelte:fragment>
                                    <svelte:fragment slot="summary">
                                        <h3 class="h3 text-center underline">
                                            Offers
                                        </h3>
                                    </svelte:fragment>
                                    <svelte:fragment slot="content">
                                        {#if $offersWithUser?.length > 0}
                                            <div class="flex flex-col items-center gap-y-8">
                                                {#each $offersWithUser as offer (offer.id)}
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
                                            <h4 class="text-center">No Offers found!</h4>
                                        {/if}
                                    </svelte:fragment>
                                </AccordionItem>
                            </Accordion>
                        </svelte:fragment>
                    </AccordionItem>
                </Accordion>
            {:else}
                <h3 class="h3 text-center">
                    No Deals yet with this User
                </h3>
            {/if}
            
        {:else if (user.pubkey !== $currentUser?.pubkey)}
            <div class="h4">Login to view your deals with this user!</div>
        {/if}
        <Accordion>
            <AccordionItem>
                <svelte:fragment slot="lead">
                    <UserTicketsIcon/>
                </svelte:fragment>
                <svelte:fragment slot="summary">
                    <h3 class="h3 text-center underline">
                        All Tickets of User
                    </h3>
                </svelte:fragment>
                <svelte:fragment slot="content">
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
                        <h4 class="text-center">No Tickets found!</h4>
                    {/if}
                </svelte:fragment>
            </AccordionItem>
        </Accordion>
        <Accordion>
            <AccordionItem>
                <svelte:fragment slot="lead">
                    <UserOffersIcon/>
                </svelte:fragment>
                <svelte:fragment slot="summary">
                    <h3 class="h3 text-center underline">
                        All Offers of User
                    </h3>
                </svelte:fragment>
                <svelte:fragment slot="content">
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
                        <h4 class="text-center">No Offers found!</h4>
                    {/if}
                </svelte:fragment>
            </AccordionItem>
        </Accordion>
    </div>
</div>
