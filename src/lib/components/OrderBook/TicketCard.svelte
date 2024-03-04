<script lang="ts">
    import ndk from "$lib/stores/ndk";
    import type { OfferEvent } from "$lib/events/OfferEvent";
    import { TicketStatus, TicketEvent, } from "$lib/events/TicketEvent";
    import { offersOnTickets } from "$lib/stores/troubleshoot-eventstores";

    import { nip19 } from "nostr-tools";

    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings } from '@skeletonlabs/skeleton';

    const toastStore = getToastStore();
    const modalStore = getModalStore();
			
    
    export let ticket: TicketEvent | null = null;
    let ticketChat = false;
    export let titleSize: string = 'xl';
    export let titleLink: boolean = true;
    export let countAllOffers: boolean = false;

    const bech32ID = ticket?.encode();
    let npub: string;
    let timeSincePosted: string; 
    let ticketStatus: string;

    let offers: OfferEvent[] = [];
    let offerCount: string = '?';
    let offersAlreadyColor: string = 'text-primary-300-600-token';

    async function closeTicket() {
        let closeTicketResponse = async function(r: boolean) {
            if (r) {
                if (ticket) {
                    // User chose to take offer
                    let ticketToPublish = new TicketEvent($ndk);
                    ticketToPublish.tags = ticket.tags;
                    ticketToPublish.description = ticket.description;
                    // Important part! This also sets status to in progress
                    ticketToPublish.status = TicketStatus.Closed;

                    try {
                        await ticketToPublish.publish();

                        console.log('ticket closed', ticketToPublish)

                        // Ticket posted Modal
                        const modal: ModalSettings = {
                            type: 'alert',
                            title: 'Ticket Closed!',
                            body: `
                                <p>You Closed the Ticket! Hope your issue was resolved!</p>
                                <p>
                                    You will find this Ticket in 'My Tickets' under the 'Closed' tab!
                                </p>
                            `,
                            buttonTextCancel:'Ok',
                        };
                        modalStore.trigger(modal);
                    } catch(e) {
                        console.log(e)
                        const t: ToastSettings = {
                            message: 'Error while closing Ticket! Fix connection with Relays and try again!',
                            timeout: 7000,
                            background: 'bg-error-300-600-token',
                        };
                        toastStore.trigger(t);
                    }
                } else {
                    const t: ToastSettings = {
                        message: 'Error: Could could not find ticket to close!',
                        timeout: 7000,
                        background: 'bg-error-300-600-token',
                    };
                    toastStore.trigger(t);
                }
            }
        }
        const modal: ModalSettings = {
            type: 'confirm',
            title: 'Confirm closing Ticket',
            body: 'Do really want to Close this Ticket?',
            response: closeTicketResponse,
        };
        modalStore.trigger(modal);
    }

    // TODO:Edit new ticket if mine on ticket page

    $: if ($ndk.activeUser) {
        ticketChat = true;
    }

    $: {
        if (ticket) {
            npub = nip19.npubEncode(ticket.pubkey);

            if (ticket.created_at) {
                // Created_at is in Unix time seconds
                let seconds = Math.floor(Date.now() / 1000 - ticket.created_at);
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

            if (ticket.status >= 0) {
                if (ticket.status === TicketStatus.New) {
                    ticketStatus = 'New';
                } else if (ticket.status === TicketStatus.InProgress) {
                    ticketStatus = 'In Progress';
                } else if (ticket.status === TicketStatus.Closed) {
                    ticketStatus = 'Closed';
                }
            }

            if (countAllOffers) {

                console.log('start offer sub for offercount in ticket card')

                offers = [];
                $offersOnTickets.forEach((offer: OfferEvent) => {
                    if (offer.referencedTicketAddress === ticket?.ticketAddress) {
                        offers.push(offer);
                    }

                });

                offerCount = offers.length.toString();
                if (offers.length > 0) {
                    offersAlreadyColor = 'text-error-300-600-token';
                }
                console.log('offer count: ', offerCount)
            }
        }
    }

</script>


<div class="card">
    {#if ticket}
        <header class="card-header grid grid-cols-3">
            {#if ticketChat}
                <a
                    href={"/messages/" + bech32ID + ":" + ticket.title}
                    class="btn btn-icon btn-md justify-self-start"
                >
                    <i class="fa-solid fa-comment text-3xl"></i>
                </a>
                
            {/if}
            {#if titleLink}
                <a 
                    class="anchor col-start-2 justify-self-center text-{titleSize}" 
                    href={"/" + bech32ID }>{ticket.title ?? 'No title'}
                </a>
            {:else}
                <div class="col-start-2 text-{titleSize}">
                    {ticket.title ?? 'No title'}
                </div>
            {/if}
            {#if ticket.status === TicketStatus.InProgress }
                <div class="justify-self-end mr-4">
                    <button type="button" class="btn btn-md bg-primary-400-500-token" on:click={closeTicket}>
                        Close
                    </button>
                </div> 
            {/if }
        </header>

        <section class="p-4">
            <div class=" grid grid-cols-5 gap-x-2">
                <div class="col-span-4">
                    { 
                    ticket.description 
                        ? ticket.description.length > 80 ? ticket.description.substring(0, 80) + "..." : ticket.description
                        : 'No description!'
                    }
                </div>
            </div>

            <hr class="my-4" />

            <div class="">
                <span class="pr-1">Status: </span>
                <span class="text-primary-400-500-token font-bold">{ticketStatus}</span>
            </div>
            <div class="">
                <span class="">Posted by: </span>
                <span>
                    <a class="anchor" href={'/' + npub}>{npub.slice(0, 10) + '...'}</a>
                </span>
            </div>
            <div class="">{timeSincePosted}</div>
        {#if countAllOffers}
                <div 
                    class="text-sm font-bold {offersAlreadyColor} mt-2"
                >
                    {'Offers on ticket: ' + offerCount}
                </div>
        {/if}
        </section>
        <footer class="items-center flex flex-wrap card-footer">
            {#each ticket.tTags as tag }
                <div class="pr-4 rounded-token">
                    <span class="badge variant-filled-surface">{ tag[1] }</span>
                </div>
            {/each}
        </footer>
    {:else}
        <h2 class="text-center font-bold mt-10" >Loading Ticket...</h2>
    {/if}
</div>

