<script lang="ts">
    import ndk from "$lib/stores/ndk";
    import type { OfferEvent } from "$lib/events/OfferEvent";
    import { TicketStatus, TicketEvent, } from "$lib/events/TicketEvent";
    import { offersOnTickets } from "$lib/stores/troubleshoot-eventstores";

    import { nip19 } from "nostr-tools";

    import { popup } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings } from '@skeletonlabs/skeleton';

    import { ticketToEdit } from "$lib/stores/ticket-to-edit";
    import { goto } from "$app/navigation";

    const toastStore = getToastStore();
    const modalStore = getModalStore();
			
    
    export let ticket: TicketEvent | null = null;
    // Can disable chat from outside manually
    export let showChat = true;
    let ticketChat = false;
    export let titleSize: string = 'xl';
    export let titleLink: boolean = true;
    export let shortenDescription = true;
    export let countAllOffers: boolean = false;

    let bech32ID = '';
    let npub: string;
    let timeSincePosted: string; 
    let ticketStatus: string;

    let offers: OfferEvent[] = [];
    let offerCount: string = '?';
    let offersAlreadyColor: string = 'text-primary-400-500-token';

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

    $: if ($ndk.activeUser && showChat) {
        ticketChat = true;
    }

    $: {
        if (ticket) {
            bech32ID = ticket.encode()
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
                offers = [];
                $offersOnTickets.forEach((offer: OfferEvent) => {
                    if (offer.referencedTicketAddress === ticket?.ticketAddress) {
                        offers.push(offer);
                    }

                });

                offerCount = offers.length.toString();
                if (offers.length > 0) {
                    offersAlreadyColor = 'text-error-400-500-token';
                }
            }
        }
    }

    function shareTicket() {
        if (ticket) {
            // Todo: share ticket here
            // perhaps modal with a url copy and a kind 1 note edit text 
            // with default text and default #bitcointroubleshoot #asknostr tags 
        }
    }

    function editTicket() {
        if (ticket) {
            $ticketToEdit = ticket;

            goto('/post-ticket')
        }
    }

    function generateDescription(): string {
        if (ticket?.description) {
            if (shortenDescription && ticket.description.length > 80) {
                return ticket.description.substring(0, 80) + '...';
            } else {
                return ticket.description;
            }
        } else return 'No description!';
    }

    // For context menu: Edit ticket, close ticket, share ticket
    const popupHover: PopupSettings = {
        event: 'click',
        target: 'popupHover',
        placement: 'bottom'
    };

</script>


<div class="card">
    {#if ticket}
        <header class="card-header grid grid-cols-6 items-center">
            {#if ticketChat}
                <a
                    href={"/messages/" + bech32ID + ":" + ticket.title}
                    class="btn btn-icon btn-sm md:btn-md justify-self-start"
                >
                    <i class="fa-solid fa-comment text-2xl md:text-3xl"></i>
                </a>
                
            {/if}
            <div class="col-start-2 col-span-4 justify-self-center">
                {#if titleLink}
                    <a 
                        class="anchor justify-self-center text-{titleSize}" 
                        href={"/" + bech32ID }>{ticket.title ?? 'No title'}
                    </a>
                {:else}
                    <div class="text-{titleSize}">
                        {ticket.title ?? 'No title'}
                    </div>
                {/if}
            </div>
            {#if $ndk.activeUser
                && ticket.pubkey === $ndk.activeUser.pubkey
            }
                <div class="justify-self-end ">
                    <button
                        type="button"
                        class="btn btn-icon btn-sm md:btn-md bg-primary-400-500-token"
                        use:popup={popupHover}
                    >
                        <i class="fa fa-sm fa-ellipsis-v"></i>
                    </button>
                    <div data-popup="popupHover">
                        <div class="card p-2 bg-primary-300-600-token shadow-xl z-50">
                            <ul class="list">
                                <!-- Share Ticket -->
                                <li>
                                    <button class="" on:click={shareTicket}>
                                        <span><i class="fa-solid fa-share-nodes"/></span>
                                        <span class="flex-auto">Share Ticket</span>
                                    </button>
                                </li>
                                <!-- Edit Ticket -->
                                {#if ticket.status === TicketStatus.New}
                                    <li>
                                        <button class="" on:click={editTicket}>
                                            <span><i class="fa-solid fa-pen-to-square"/></span>
                                            <span class="flex-auto">Edit Ticket</span>
                                        </button>
                                    </li>
                                {/if}
                                <!-- Close Ticket -->
                                {#if ticket.status === TicketStatus.InProgress
                                    || ticket.status === TicketStatus.New
                                }
                                    <li>
                                        <button class="" on:click={closeTicket}>
                                            <span><i class="fa-solid fa-lock"/></span>
                                            <span class="flex-auto">Close Ticket</span>
                                        </button>
                                    </li>
                                {/if}
                            </ul>
                        </div>
                    </div>
                </div> 
            {/if }
        </header>

        <section class="p-4">
            <div class=" grid grid-cols-5 gap-x-2">
                <div class="col-span-4">
                    { generateDescription() }
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
        <footer class="card-footer">
            <div class="flex justify-between">
                <div class="items-center flex flex-wrap gap-y-1">
                    {#each ticket.tTags as tag }
                        <div class="pr-3 rounded-token">
                            <span class="badge variant-filled-surface">{ tag[1] }</span>
                        </div>
                    {/each}
                </div>
            </div>
        </footer>
    {:else}
        <h2 class="text-center font-bold mt-10" >Loading Ticket...</h2>
    {/if}
</div>

