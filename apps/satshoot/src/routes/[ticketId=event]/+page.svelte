<script lang="ts">
    import ndk from "$lib/stores/ndk";
    import currentUser from '$lib/stores/user';
    import { loginAlert } from '$lib/stores/user';
    import { TicketEvent, TicketStatus } from "$lib/events/TicketEvent";
    import TicketCard from "$lib/components/OrderBook/TicketCard.svelte";
    import { OfferEvent } from "$lib/events/OfferEvent";
    import { connected } from "$lib/stores/ndk";
    
    import redirectStore from '$lib/stores/redirect-store';

    import { wot } from '$lib/stores/wot';

    import UserCard from "$lib/components/User/UserCard.svelte";
    import OfferCard from "$lib/components/OrderBook/OfferCard.svelte";
    import { BTCTroubleshootKind } from "$lib/events/kinds";
    import { idFromNaddr, relaysFromNaddr } from '$lib/utils/nip19'

    import CreateOfferModal from "$lib/components/Modals/CreateOfferModal.svelte";
    import TakeOfferModal from "$lib/components/Modals/TakeOfferModal.svelte";
    import { getModalStore } from "@skeletonlabs/skeleton";
    import type { ModalComponent, ModalSettings } from "@skeletonlabs/skeleton";

    import { popup } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';

    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';

    import { nip19 } from "nostr-tools";
    
    import {
        NDKRelay,
        type NDKFilter,
        type NDKSubscriptionOptions,
        NDKEvent,
        NDKSubscription 
    } from "@nostr-dev-kit/ndk";

    import type { NDKEventStore, ExtendedBaseType } from '@nostr-dev-kit/ndk-svelte';
    
    import { page } from '$app/stores';
    import { goto } from "$app/navigation";
    import { onDestroy } from "svelte";

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    const subOptions: NDKSubscriptionOptions = { 
        closeOnEose: false,
    };
    let ticketSubscription: NDKSubscription | undefined = undefined;
    let ticket: TicketEvent | undefined = undefined;
    let offersFilter: NDKFilter<BTCTroubleshootKind> = {
        kinds: [BTCTroubleshootKind.Offer],
        '#a': [],
    }
    let offerStore: NDKEventStore<ExtendedBaseType<OfferEvent>>;
    let alreadySubscribedToOffers = false;
    let npub: string | undefined = undefined;

    let myTicket = false;
    let offerToEdit: OfferEvent | undefined = undefined;

    let allowCreateOffer: boolean = true;
    let disallowCreateOfferReason = '';
    let btnActionText = 'Create Offer';
    let loginAlertShown = false;

    let needSetup = true;

    // Wait for ndk to connect then setup subscription on ticket from URL params
    $: if ($connected && needSetup) {
        needSetup = false;
        const naddr = $page.params.ticketId;
        const relaysFromURL = relaysFromNaddr(naddr).split(',');
        // console.log('ticket relays', relaysFromURL)
        if (relaysFromURL.length > 0) {
            relaysFromURL.forEach((relayURL: string) => {
                if (relayURL) {
                    $ndk.pool.addRelay(new NDKRelay(relayURL));
                }
            });
        }

        // Create new subscription on this ticket 
        const dTag = idFromNaddr(naddr).split(':')[2];
        const ticketFilter: NDKFilter<BTCTroubleshootKind> = {
            kinds: [BTCTroubleshootKind.Ticket],
            '#d': [dTag],
        };


        console.log('connected, setting up')
        ticketSubscription = $ndk.subscribe(ticketFilter, subOptions);
        ticketSubscription.on('event', (event: NDKEvent) => {
            // Dismiss with old tickets
            if (ticket) {
                const arrivedTicket = TicketEvent.from(event);
                if (arrivedTicket.created_at! < ticket.created_at!) {
                    return;
                }
            }
            ticket = TicketEvent.from(event);
            console.log('ticket', ticket)
            npub = nip19.npubEncode(ticket.pubkey);

            // Scroll to top as soon as ticket arrives
            const elemPage:HTMLElement = document.querySelector('#page') as HTMLElement;
            elemPage.scrollTo({ top: elemPage.scrollHeight*(-1), behavior:'instant' });

            // TODO: Some effect to show the ticket changed

            if (ticket.status !== TicketStatus.New) {
                allowCreateOffer = false;
                disallowCreateOfferReason = "Status of this ticket not 'New' anymore! Cannot Create Offer!";
            }

            // Subscribe on Offers of this ticket. Do this only once
            if (!alreadySubscribedToOffers) {
                alreadySubscribedToOffers = true;
                // Add a live sub on offers of this ticket if not already subbed
                // Else already subbed, we can check if new offer arrived on ticket
                offersFilter['#a']!.push(ticket.ticketAddress);
                offerStore = $ndk.storeSubscribe<OfferEvent>(
                    offersFilter, subOptions, OfferEvent
                );

                // Although the store has all the events we could check with svelte
                // reactive statements but this way we don't have to iterate though
                // the whole store to find the newest added offer. ndk svelte
                // stores events in chronological order, not in the order ndk saw the events.
                // Fine-grained reactivity is still better achieved with a regular subscription
                // The problem is that the storeSubscribe leaves the subscription UNDEFINED 
                // and only assigns value in startSubscription function
                // This makes it impossible to reliably attach a fine-grained Callback
                // on an ndk-svelte store because some events arrive before the callback registration
                // THIS DOES NOT WORK AT THE MOMENT BUT SHOULD IF NDK SUPPORTED Fine-grained
                // SUBS ALONG WITH THE STORE SUBSCRIPTION
                // offerStore.subscription?.on('event', (event: NDKEvent) => {
                //     const offer = OfferEvent.from(event);
                //     if (offer.pubkey === $currentUser?.pubkey) {
                //     }
                // });
            }
        });
    };

    $: if ($offerStore) {
        // Filtering out offers not in the web of Trust
        if ($wot && $wot.size > 1) {
            $offerStore = $offerStore.filter((offer: OfferEvent)=> {
                return $wot.has(offer.pubkey);
            });
        }
        $offerStore.forEach((offer: OfferEvent) => {
            if (offer.pubkey === $currentUser?.pubkey) {
                offerToEdit = offer;
                btnActionText = 'Edit Your Offer';
            }
        });
    }

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
    }

    $: if ($currentUser && ticket) {
        // If there is an active user and it is the creator of this ticket
        // We will hide create Offer button and the usercard, but enable taking offers
        if ($currentUser && $currentUser.pubkey === ticket.pubkey) {
            myTicket = true;
        }
    }

    async function createOffer(offer: OfferEvent | undefined) {
        const offerPosted: boolean = await new Promise<boolean>((resolve) => {
            const modalComponent: ModalComponent = {
                ref: CreateOfferModal,
                props: {
                    ticketAddress: ticket?.ticketAddress,
                    offerToEdit: offer,
                },
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
        if (ticket) {
            const modalComponent: ModalComponent = {
                ref: TakeOfferModal,
                props: {ticket: ticket, offer: offer},
            };

            const modal: ModalSettings = {
                type: 'component',
                component: modalComponent,
            };
            modalStore.trigger(modal);
        } 
    }

    // For tooltip    
    const popupHover: PopupSettings = {
        event: 'click',
        target: 'popupHover',
        placement: 'top'
    };

    onDestroy(() => {
        ticketSubscription?.stop()
        if (offerStore) {
            offerStore.empty();
        }
    });

</script>

<div class="m-6 flex justify-center">
    <TicketCard {ticket} titleSize='md sm:text-lg' titleLink={false} shortenDescription={false} />

</div>

{#if !myTicket}
    <!-- Create Offer -->
    <div class="flex justify-center items-center gap-x-2">
        <button 
            type="button"
            on:click={ () => createOffer(offerToEdit) }
            class="btn btn-2xl text-xl font-bold bg-primary-300-600-token"
            disabled={!allowCreateOffer}
        >
            { btnActionText }
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
    <h2 class="font-bold text-center text-lg sm:text-2xl mt-4" >Posted by:</h2>
    <div class="flex justify-center">
        <UserCard npub={npub} />
    </div>
{/if}
<!-- Offers on Ticket -->
<h2 class="font-bold text-center text-lg sm:text-2xl mb-4" >
    {'Offers on this Ticket: ' + ($offerStore ? $offerStore.length : '?') }
</h2>
<div class="grid grid-cols-1 items-center gap-y-4 mx-8 mb-8">
    {#if $offerStore}
        {#each $offerStore as offer}
            <div class="flex justify-center">
                <OfferCard {offer} showTicket={false} enableChat={myTicket}>
                    <div slot="takeOffer" class="flex justify-center mt-2">
                        {#if ticket && myTicket && ticket.status === TicketStatus.New}
                            <button
                                type="button"
                                class="btn btn-lg bg-primary-300-600-token"
                                on:click={() => takeOffer(offer)}
                            >
                                Take Offer
                            </button>
                        {/if}
                    </div>
                </OfferCard>
            </div>
        {/each}
    {/if}
</div>
