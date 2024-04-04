<script lang="ts">
    import ndk from "$lib/stores/ndk";
    import currentUser from '$lib/stores/login';
    import { TicketEvent, TicketStatus } from "$lib/events/TicketEvent";
    import TicketCard from "$lib/components/OrderBook/TicketCard.svelte";
    import type { OfferEvent } from "$lib/events/OfferEvent";
    import { connected } from "$lib/stores/ndk";
    import { loginAlert } from '$lib/stores/login';
    import redirectStore from '$lib/stores/redirect-store';

    import { offersOnTicketsFilter, offersOnTickets, ticketsOfSpecificOffersFilter, ticketsOfSpecificOffers } from "$lib/stores/troubleshoot-eventstores";

    import CreateOfferModal from "$lib/components/Modals/CreateOfferModal.svelte";
    import OfferTakenModal from "$lib/components/Modals/OfferTakenModal.svelte";
    import { getModalStore } from "@skeletonlabs/skeleton";
    import type { ModalComponent, ModalSettings } from "@skeletonlabs/skeleton";

    import { popup } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';

    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';

    import { page } from '$app/stores';
    import { idFromNaddr, relaysFromNaddr } from '$lib/utils/nip19'
    import { nip19 } from "nostr-tools";
    import UserCard from "$lib/components/User/UserCard.svelte";
    import OfferCard from "$lib/components/OrderBook/OfferCard.svelte";
    import { goto } from "$app/navigation";
    import { NDKRelay } from "@nostr-dev-kit/ndk";

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    let ticket: TicketEvent | undefined = undefined;
    let offers: OfferEvent[] = [];
    let npub: string | undefined = undefined;

    let myTicket = false;

    let allowCreateOffer: boolean = true;
    let disallowCreateOfferReason = '';
    let loginAlertShown = false;

    // Only trying to fetch offers on ticket once. This doesnt create a permanent
    // subscription which would likely be an overkill

    $: {
        if (!$currentUser){
            allowCreateOffer = false;
            disallowCreateOfferReason = 'Need to log in before creating an offer!'; 
            
            if ($loginAlert && !loginAlertShown) {
                loginAlertShown = true;

                let toastId:string;
                const t: ToastSettings = {
                    message: 'Login to create an Offer!',
                    autohide: false,
                    action: {
                        label: 'Login',
                        response: () => {
                            $redirectStore = $page.url.toString();
                            goto('/login');
                        },
                    },
                    callback: (response) => {
                        if(response.status === 'closed') {
                            $loginAlert = false;
                        }
                    },
                };
                toastId = toastStore.trigger(t);

            }
        } else {
            allowCreateOffer = true;
            toastStore.clear();
        }
        if ($ticketsOfSpecificOffers) {
            const naddr = $page.params.ticketId;
            const relaysFromURL = relaysFromNaddr(naddr).split(',');
            // console.log('ticket relays', relaysFromURL)
            relaysFromURL.forEach((relayURL: string) => {
                $ndk.pool.addRelay(new NDKRelay(relayURL));
            });

            // console.log('pool after adding relays from URL: ', $ndk.pool)

            const dTag = idFromNaddr(naddr).split(':')[2];
            const dTagFilters = ticketsOfSpecificOffersFilter['#d'];

            if (!dTagFilters?.includes(dTag) && $connected) {
                ticketsOfSpecificOffersFilter['#d']?.push(dTag);
                // Restart subscription
                ticketsOfSpecificOffers.unsubscribe();
                ticketsOfSpecificOffers.startSubscription();
            } else {
                $ticketsOfSpecificOffers.forEach((t: TicketEvent) => {
                    if (idFromNaddr(t.encode()) === idFromNaddr(naddr)){
                        if (!ticket) {
                            ticket = TicketEvent.from(t);
                            // console.log('setting ticket in ticket page')
                            if (ticket.status !== TicketStatus.New) {
                                allowCreateOffer = false;
                                disallowCreateOfferReason = 'This ticket is already In Progress! No new offers will be accepted!';
                            }
                        }
                    }
                });
            }
        }
        if (ticket) {
            npub = nip19.npubEncode(ticket.pubkey);
            // If there is an active user and it is the creator of this ticket
            // We will hide create Offer button and the usercard, but enable taking offers
            if ($currentUser && $currentUser.pubkey === ticket.pubkey) {
                myTicket = true;
            }

            // Add a live sub on offers of this ticket if not already subbed
            // Else already subbed, we can check if new offer arrived on ticket
            const aTagFilters = offersOnTicketsFilter['#a'];
            if (!aTagFilters?.includes(ticket?.ticketAddress)) {
                offersOnTicketsFilter['#a']?.push(ticket.ticketAddress);
                offersOnTickets.unsubscribe();
                offersOnTickets.startSubscription();
            } else {
                offers = [];
                $offersOnTickets.forEach((offer: OfferEvent) => {
                    if (offer.referencedTicketAddress === ticket?.ticketAddress) {
                        offers.push(offer);
                        if (offer.pubkey === $currentUser?.pubkey) {
                            allowCreateOffer = false;
                            disallowCreateOfferReason = 'You already have an offer on ticket! Edit your Offer from the Offers-list if you want to change it!';
                        }
                    }
                });

                offers = offers;
            }
        }
    }

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
    }

    async function takeOffer(offer: OfferEvent) {
        const modalBody = `
                    <p>Do really want to take this Offer?</p>
                    <strong class="text-error-500">
                        You agree to pay the fee listed on the Offer!
                    </strong>
        `;

        let takeOfferResponse = async function(r: boolean){
            if (r) {
                if (ticket) {
                    // User chose to take offer
                    let ticketToPublish = new TicketEvent($ndk);
                    ticketToPublish.tags = ticket.tags;
                    ticketToPublish.description = ticket.description;
                    // Important part! This also sets status to in progress
                    ticketToPublish.acceptedOfferAddress = offer.offerAddress;

                    try {
                        await ticketToPublish.publish();

                        const modalComponent: ModalComponent = {
                            ref: OfferTakenModal,
                        };

                        const modal: ModalSettings = {
                            type: 'component',
                            component: modalComponent,
                        };
                        modalStore.trigger(modal);

                        // Navigate to ticket messages
                        goto('/messages/' + ticket.encode() + ":" + ticket.title);

                    } catch(e) {
                        console.log(e)
                        const t: ToastSettings = {
                            message: 'Error while accepting Offer! Fix connection with Relays and try again!',
                            timeout: 7000,
                            background: 'bg-error-300-600-token',
                        };
                        toastStore.trigger(t);
                    }
                } else {
                    const t: ToastSettings = {
                        message: 'Cannot accept Offer, Ticket not found!',
                        timeout: 7000,
                        background: 'bg-error-300-600-token',
                    };
                    toastStore.trigger(t);
                }
            }
        }

        const modal: ModalSettings = {
            type: 'confirm',
            // Data
            title: 'Confirm taking Offer',
            body: modalBody,
            response: takeOfferResponse,
        };
        modalStore.trigger(modal);
    }


    // For tooltip    
    const popupHover: PopupSettings = {
        event: 'click',
        target: 'popupHover',
        placement: 'top'
    };
    
</script>

<div class="card m-6">
    <TicketCard {ticket} titleSize='md sm:text-lg' titleLink={false} shortenDescription={false} />

</div>

{#if !myTicket}
    <!-- Create Offer -->
    <div class="flex justify-center items-center gap-x-2">
        <button 
            type="button"
            on:click={ createOffer }
            class="btn btn-2xl text-xl font-bold bg-primary-300-600-token"
            disabled={!allowCreateOffer}
        >
            Create Offer
        </button>
        {#if !allowCreateOffer}
            <i 
                class="text-primary-300-600-token fa-solid fa-circle-question text-2xl
                [&>*]:pointer-events-none" 
                use:popup={popupHover}
            />

            <div class="card p-4 bg-primary-300-600-token" data-popup="popupHover">
                <p>
                    {disallowCreateOfferReason} 
                </p>
                <div class="arrow bg-primary-300-600-token" />
            </div>
        {/if}
    </div>
    <!-- User -->
    <h2 class="font-bold text-lg sm:text-2xl ml-8 mt-4" >Posted by:</h2>
    <UserCard npub={npub} />
{/if}
<!-- Offers on Ticket -->
<h2 class="font-bold text-lg sm:text-2xl ml-8 mb-4" >{'Current Offers on this Ticket: ' + offers.length}</h2>
<div class="grid grid-cols-1 items-center gap-y-4 mx-8 mb-8">
    {#each offers as offer}
        <OfferCard {offer} showTicket={false} enableChat={myTicket}>
            <div slot="takeOffer" class="flex justify-center mt-2">
                {#if ticket && myTicket && ticket.status === TicketStatus.New}
                    <button
                        type="button"
                        class="btn btn-lg bg-primary-300-600-token"
                        on:click={takeOffer(offer)}
                    >
                        Take Offer
                    </button>
                {/if}
            </div>
        </OfferCard>
    {/each}
</div>
