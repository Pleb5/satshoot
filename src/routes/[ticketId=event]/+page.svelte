<script lang="ts">
    import type { TicketEvent } from "$lib/events/TicketEvent";
    import type { OfferEvent } from "$lib/events/OfferEvent";
    import { tickets, offers } from "$lib/stores/troubleshoot-eventstores";
    import ndk from "$lib/stores/ndk";

    import CreateOfferModal from "$lib/components/Modals/CreateOfferModal.svelte";
    import { getModalStore } from "@skeletonlabs/skeleton";
    import type { ModalComponent, ModalSettings } from "@skeletonlabs/skeleton";

    import { popup } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';

    import { page } from '$app/stores';
    import UserCard from "$lib/components/User/UserCard.svelte";
    import { onMount } from "svelte";
    
    const modalStore = getModalStore();

    let ticket: TicketEvent | undefined = undefined;

    console.log($page.params.ticketId)

    let offersOnTicket: OfferEvent[] = [];

    let offersAlreadyColor: string = 'text-primary-300-600-token';

    console.log('offers: ', $offers)

    $: {
        // Setting up the ticket if page even after page refreshes
        if (!ticket) {
            $tickets.forEach((ticketEvent) => {
                console.log('in foreach tickets')
                if (ticketEvent.encode() === $page.params.ticketId) {
                    ticket = ticketEvent;
                    console.log(ticket)
                }
            });
        }

        // Registering the offers on this ticket on the fly
        $offers.forEach((offer: OfferEvent) =>{
            if(offer.referencedTicketAddress === ticket?.ticketAddress) {
                offersOnTicket.push(offer)
                console.log('offer found on ticket!')
            }
        })

        if (offersOnTicket.length > 0) {
            offersAlreadyColor = 'text-error-500';
        }

    }

    function createOffer() {
        const modalComponent: ModalComponent = {
            ref: CreateOfferModal,
            props: {ticketAddress: ticket?.ticketAddress},
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.trigger(modal);
    }


    // For tootip    
    const popupHover: PopupSettings = {
        event: 'click',
        target: 'popupHover',
        placement: 'right'
    };
    
</script>

<div class="flex flex-col justify-center gap-y-4 mt-4 p-8" >
    {#if ticket}
        <h2 class="text-center font-bold" >Ticket:</h2>
        <div class="card">

            <header class="card-header">
                <h2 class="text-center text-2xl font-bold" >{ticket.title ?? 'No title'}</h2>
            </header>

            <section class="p-4 text-lg">{ticket.description ?? 'No description!'}</section>

            <footer class="grid grid-cols-5 card-footer">
                <div class="grid col-span-4">
                    <div class="items-center flex flex-wrap">
                        {#each ticket.tTags as tag }
                            <div class="px-2 rounded-token">
                                <span class="text-sm badge variant-filled-surface">{ tag[1] }</span>
                            </div>
                        {/each}
                    </div>
                </div>
                <div class="text-sm font-bold {offersAlreadyColor}">{'Offers on ticket: ' + offersOnTicket?.length}</div>
            </footer>

        </div>
                    <!-- Submit -->
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
        <h2 class="text-center font-bold" >Posted by:</h2>
        <UserCard ndk={$ndk} npub={ticket.author.npub} />
    {:else}
        <h2 class="text-center font-bold" >Error: Ticket not found among ticket events!</h2>
    {/if}
</div>

