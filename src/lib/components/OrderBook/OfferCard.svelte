<script lang="ts">
    import ndk from "$lib/stores/ndk";
    import { nip19 } from "nostr-tools";
    import { OfferEvent, Pricing } from "$lib/events/OfferEvent";

    import CreateOfferModal from "../Modals/CreateOfferModal.svelte";

    import { getModalStore } from "@skeletonlabs/skeleton";
    import type { ModalComponent,  ModalSettings} from "@skeletonlabs/skeleton";

    import TicketCard from "./TicketCard.svelte";
    import { TicketStatus, type TicketEvent } from "$lib/events/TicketEvent";

    import { offersOnTickets, offersOnTicketsFilter, ticketsOfSpecificOffers } from "$lib/stores/troubleshoot-eventstores";

    const modalStore = getModalStore();
    
    export let offer: OfferEvent | null = null;
    export let countAllOffers: boolean = false;
    export let showTicket: boolean = true;
    let ticket: TicketEvent | undefined = undefined;

    let npub: string;
    let timeSincePosted: string; 
    let pricing: string = '';

    let editOffer: boolean = false;

    // Because Tickets drive the status of Offers, this is calculated always
    // as soon as the ticket for this offer is fetched
    let status = '?';
    let statusColor = 'text-primary-300-600-token';

    function insertThousandSeparator(amount: number) {
        return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    }

    function editMyOffer() {
        if (offer) {
            const modalComponent: ModalComponent = {
                ref: CreateOfferModal,
                props: {ticketAddress: offer.referencedTicketAddress, offerToEdit: offer},
            };

            const modal: ModalSettings = {
                type: 'component',
                component: modalComponent,
            };
            modalStore.trigger(modal);
        }
    }


    $: {
        if (offer) {
            switch (offer.pricing) {
                case Pricing.Absolute:
                    pricing = 'sats';
                    break;
                case Pricing.SatsPerMin:
                    pricing = 'sats/min';
                    break;
            }

            npub = nip19.npubEncode(offer.pubkey);

            if (offer.created_at) {
                // Created_at is in Unix time seconds
                let seconds = Math.floor(Date.now() / 1000 - offer.created_at);
                let minutes = Math.floor(seconds / 60);
                let hours = Math.floor(minutes / 60);
                let days = Math.floor(hours / 24);
                if (days >= 1) {
                    timeSincePosted = days.toString() + ' day(s) ago';
                } else if(hours >= 1) {
                    timeSincePosted = hours.toString() + ' hour(s) ago';
                } else if(minutes >= 1) {
                    timeSincePosted = minutes.toString() + ' minute(s) ago';
                } else if(seconds >= 20) {
                    timeSincePosted = seconds.toString() + ' second(s) ago';
                } else {
                    timeSincePosted = 'just now';
                }
            }

            console.log('offer is defined, lets set ticket...')
            console.log('tickets of my offers:', $ticketsOfSpecificOffers)
            if ($ticketsOfSpecificOffers) {
                $ticketsOfSpecificOffers.forEach((t: TicketEvent) => {
                    if (t.ticketAddress === offer?.referencedTicketAddress) {
                        ticket = t;
                        const winner = ticket.acceptedOfferAddress;
                        console.log('ticket', ticket)
                        if (!winner){
                            status = 'Pending';
                        } else if(winner === offer.offerAddress) {
                            status = 'Won';
                            statusColor = 'text-success-300-600-token';
                        } else {
                            // The winner is defined but it is not us so our offer lost
                            status = 'Lost';
                        }
                        
                        const aTagFilters = offersOnTicketsFilter['#a'];
                        if (!aTagFilters?.includes(ticket?.ticketAddress)) {
                            offersOnTicketsFilter['#a']?.push(ticket.ticketAddress);
                            offersOnTickets.unsubscribe();
                            offersOnTickets.startSubscription();
                        }
                    }
                });
            }
        } else {
            console.log('offer is null yet!')
        }

        // Only allow editing offer if the ticket still accepts offers(no winner yet)
        if (offer && ticket) {
            if ($ndk.activeUser
                && $ndk.activeUser.npub === npub
                && ticket.status === TicketStatus.New
            ) {
                editOffer = true;
            } else {
                editOffer = false;
            }
        }
    }

</script>

<div class="card pt-4">
    {#if offer}
        <div class="grid grid-cols-3 justify-center">
            <h3 class="h3 col-start-2 text-center text-primary-300-600-token">
                { (editOffer ? 'My ' : '') + 'Offer: ' + insertThousandSeparator(offer.amount) + ' ' + pricing} 
            </h3>
            <div class="col-start-3 justify-self-end mr-4">
                {#if editOffer}
                    <button 
                        type="button"
                        class="btn font-bold bg-primary-400-500-token" 
                        on:click = {editMyOffer}
                    >
                        Edit
                    </button>
                {/if}
            </div>
        </div>
        <slot name="takeOffer" />
        <div class="flex flex-col gap-y-1 justify-start p-8 pt-2">
            <div class="">
                <span class="">Status: </span>
                <span class="font-bold {statusColor}">{status}</span>
            </div>
            <div class="">
                <span class="">Posted by: </span>
                <span>
                    <a class="anchor" href={'/' + npub}>{npub.slice(0, 10) + '...'}</a>
                </span>
            </div>
            <div class="">{timeSincePosted}</div>
            {#if showTicket}
                <h4 class="h4 text-primary-300-600-token"> On Ticket:</h4>
                {#if ticket}
                    <TicketCard ticket={ticket} {countAllOffers} >
                    </TicketCard>
                {:else}
                    <h2 class="h2 text-center text-error-500">Loading Ticket for Offer...</h2>
                {/if}
            {/if}
        </div>
    {:else}
        <h2 class="h2 text-center text-error-500">Error: Offer not found!</h2>
    {/if}
</div>
