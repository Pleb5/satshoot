<script lang="ts">
    import ndk from "$lib/stores/ndk";
    import currentUser from "$lib/stores/login";

    import { nip19 } from "nostr-tools";
    import { OfferEvent, Pricing } from "$lib/events/OfferEvent";

    import TicketCard from "./TicketCard.svelte";
    import { TicketStatus, TicketEvent } from "$lib/events/TicketEvent";

    import { offerMakerToSelect } from "$lib/stores/messages";

    import type { NDKFilter, NDKEvent, NDKSubscription } from "@nostr-dev-kit/ndk";
    import { BTCTroubleshootKind } from "$lib/events/kinds";

    import CreateOfferModal from "../Modals/CreateOfferModal.svelte";

    import { getModalStore } from "@skeletonlabs/skeleton";
    import type { ModalComponent,  ModalSettings} from "@skeletonlabs/skeleton";
    import { onDestroy } from "svelte";

    const modalStore = getModalStore();
    
    export let offer: OfferEvent | null = null;
    export let countAllOffers: boolean = false;
    export let showTicket: boolean = true;
    let ticket: TicketEvent | undefined = undefined;
    export let enableChat = false;

    let ticketSubscription: NDKSubscription | undefined = undefined;
    let alreadySubscribedToTicket = false;

    let npub: string;
    let timeSincePosted: string; 
    let pricing: string = '';

    let editOffer: boolean = false;

    // Because Tickets drive the status of Offers, this is calculated always
    // as soon as the ticket for this offer is fetched
    let status = '?';
    let statusColor = 'text-primary-400-500-token';

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

            if (!alreadySubscribedToTicket) {
                alreadySubscribedToTicket = true;
                const dTagOfTicket = offer.referencedTicketAddress.split(':')[2];
                const ticketFilter: NDKFilter<BTCTroubleshootKind> = {
                    kinds: [BTCTroubleshootKind.Ticket],
                    '#d': [dTagOfTicket],
                    // This could break subs if low!
                    // Limit of the initial query.
                    // Might be the case that filters are groupable and this 
                    // limits this kind of query. Need to test more...
                    limit: 10000,
                }
                ticketSubscription = $ndk.subscribe(
                    ticketFilter,
                    {closeOnEose: false, pool: $ndk.pool},
                );
                ticketSubscription.on('event', (event: NDKEvent) => {
                    ticket = TicketEvent.from(event);
                    const winner = ticket.acceptedOfferAddress;
                    if (winner === offer!.offerAddress){
                        status = 'Won';
                    } else if(winner || ticket.status === TicketStatus.Closed) {
                        status = 'Lost';
                        statusColor = 'text-error-500';
                    } else {
                        // The winner is defined but it is not us so our offer lost
                        // OR the ticket does not have a winner but it is closed
                        statusColor = 'text-warning-500';
                        status = 'Pending';
                    }
                });
                // console.log('subscribing to ticket of this Offer', ticketSubscription)
            }
        } else {
            console.log('offer is null yet!')
        }

        // Only allow editing offer if the ticket still accepts offers(no winner yet)
        if (offer && ticket) {
            if ($currentUser
                && $currentUser.npub === npub
                && ticket.status === TicketStatus.New
            ) {
                editOffer = true;
            } else {
                editOffer = false;
            }
        }
    }

    function setOfferToSelect() {
        $offerMakerToSelect = (offer as OfferEvent).pubkey;
    }

    onDestroy(() => {
        // console.log('Unsubbing from Ticket updates of this Offer')
        ticketSubscription?.stop();
    });

</script>

<div class="card pt-2 bg-surface-200-700-token flex-grow sm:max-w-[70vw] lg:max-w-[60vw]">
    {#if offer}
        <div class="grid grid-cols-[15%_1fr_15%] justify-center items-center mx-2">
            {#if $currentUser && enableChat && ticket}
                <a
                    on:click={setOfferToSelect}
                    href={"/messages/" + ticket.encode() + ":" + ticket.title}
                    class="btn btn-icon btn-sm justify-self-start"
                >
                    <i class="fa-solid fa-comment text-2xl"></i>
                </a>
                
            {/if}
            <h3 class="h4 md:h3 col-start-2 text-center text-tertiary-500">
                { (editOffer ? 'My ' : '') + 'Offer: ' + insertThousandSeparator(offer.amount) + ' ' + pricing} 
            </h3>
            <div class="col-start-3 justify-self-end">
                {#if editOffer}
                    <button 
                        type="button"
                        class="btn btn-icon font-bold " 
                        on:click = {editMyOffer}
                    >
                        <i class="text-primary-300-600-token fa-solid fa-pen-to-square text-xl" />
                    </button>
                {/if}
            </div>
        </div>
        <div class="text-center text-base md:text-lg p-2">
            {offer.description}
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
                <hr class="my-2"/>
                {#if ticket}
                    <TicketCard 
                        {ticket}
                        titleSize={'md md:text-xl'}
                        showChat={false}
                        {countAllOffers}
                    >
                    </TicketCard>
                {:else}
                    <section class="w-full">
                        <div class="p-4 space-y-4">
                            <div class="placeholder animate-pulse" />
                            <div class="grid grid-cols-3 gap-8">
                                <div class="placeholder animate-pulse" />
                                <div class="placeholder animate-pulse" />
                                <div class="placeholder animate-pulse" />
                            </div>
                            <div class="grid grid-cols-4 gap-4">
                                <div class="placeholder animate-pulse" />
                                <div class="placeholder animate-pulse" />
                                <div class="placeholder animate-pulse" />
                                <div class="placeholder animate-pulse" />
                            </div>
                        </div>
                    </section>
                {/if}
            {/if}
        </div>
    {:else}
        <h2 class="h2 text-center text-error-500">Error: Offer not found!</h2>
    {/if}
</div>
