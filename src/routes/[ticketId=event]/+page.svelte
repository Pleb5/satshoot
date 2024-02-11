<script lang="ts">
    import { TicketEvent } from "$lib/events/TicketEvent";
    import TicketCard from "$lib/components/OrderBook/TicketCard.svelte";
    import type { OfferEvent } from "$lib/events/OfferEvent";
    import ndk from "$lib/stores/ndk";
    import type { NDKEvent } from "@nostr-dev-kit/ndk";
    import { NDKRelaySet } from "@nostr-dev-kit/ndk";

    import pageTitleStore from "$lib/stores/pagetitle-store";

    import CreateOfferModal from "$lib/components/Modals/CreateOfferModal.svelte";
    import { getModalStore } from "@skeletonlabs/skeleton";
    import type { ModalComponent, ModalSettings } from "@skeletonlabs/skeleton";

    import { popup } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';

    import { page } from '$app/stores';
    import UserCard from "$lib/components/User/UserCard.svelte";
    import { onMount } from "svelte";

    $pageTitleStore = 'Ticket';
    
    const modalStore = getModalStore();

    let ticket: TicketEvent | undefined = undefined;
    let ticketPromise: Promise<NDKEvent | null> ;

    let offersOnTicket: Set<OfferEvent> = new Set();

    // Only trying to fetch offers on ticket once. This doesnt create a permanent
    // subscription which would likely be an overkill
    onMount(async() => {
        // Get ticket from naddr
        ticketPromise = $ndk.fetchEvent($page.params.ticketId, {}, new NDKRelaySet(new Set($ndk.pool.relays.values()), $ndk)); 
        let event = await ticketPromise;
        console.log('ticket event fetched, value:', event)
        if (event) {
            ticket = TicketEvent.from(event);
            ticket = ticket;
            offersOnTicket = await ticket.fetchAllOffers($ndk);
        }
    });

    async function createOffer() {
        const offerPosted: boolean = await new Promise<boolean>((resolve) => {
            const modalComponent: ModalComponent = {
                ref: CreateOfferModal,
                props: {ticketAddress: ticket?.ticketAddress},
            };

            const modal: ModalSettings = {
                type: 'component',
                component: modalComponent,
                response: (offerPosted: boolean) => {resolve(offerPosted)},
            };
            modalStore.trigger(modal);
        });

        if (offerPosted) {
            // Get offer posted by user from relays and also other offers possibly posted in the meantime
            if (ticket) {
                offersOnTicket = await ticket.fetchAllOffers($ndk);
            }
        }
    }


    // For tootip    
    const popupHover: PopupSettings = {
        event: 'click',
        target: 'popupHover',
        placement: 'right'
    };
    
</script>

<div class="card m-6">
    <TicketCard {ticket} titleSize='xl' titleLink={false} />

</div>
<!-- Create Offer -->
<div class="flex justify-center items-center gap-x-2">
    <button 
        type="button"
        on:click={ createOffer }
        class="btn btn-2xl text-xl font-bold bg-primary-300-600-token"
        disabled={!$ndk.activeUser}
    >
        Create Offer
    </button>
    {#if !$ndk.activeUser}
        <i 
            class="text-primary-300-600-token fa-solid fa-circle-question text-2xl
            [&>*]:pointer-events-none" 
            use:popup={popupHover}
        />

        <div class="card w-80 p-4 bg-primary-300-600-token" data-popup="popupHover">
            <p>
                Need to log in before creating an offer!
            </p>
            <div class="arrow bg-primary-300-600-token" />
        </div>
    {/if}
</div>
<!-- User -->
<h2 class="font-bold text-2xl ml-8" >Posted by:</h2>
<UserCard ndk={$ndk} npub={ticket?.author.npub} />

