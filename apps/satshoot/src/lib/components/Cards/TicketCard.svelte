<script lang="ts">
    import currentUser from '$lib/stores/user';
    import ndk from '$lib/stores/ndk';
    import {
        type NDKFilter,
        type NDKUser,
        type NDKSubscriptionOptions,
        NDKSubscriptionCacheUsage,
        NDKKind,
    } from '@nostr-dev-kit/ndk';
    import { OfferEvent } from '$lib/events/OfferEvent';
    import { TicketStatus, TicketEvent } from '$lib/events/TicketEvent';
    import { derived } from 'svelte/store';
    import { wot } from '$lib/stores/wot';

    import { nip19 } from 'nostr-tools';

    import { Avatar, popup } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';
    import { getModalStore, Accordion, AccordionItem } from '@skeletonlabs/skeleton';
    import type { ModalSettings, ModalComponent } from '@skeletonlabs/skeleton';

    import { ticketToEdit } from '$lib/stores/ticket-to-edit';
    import ShareTicketModal from '../Modals/ShareTicketModal.svelte';
    import CloseTicketModal from '$lib/components/Modals/CloseTicketModal.svelte';

    import ReputationCard from './ReputationCard.svelte';
    import { ReviewEvent, ReviewType, type ClientRating } from '$lib/events/ReviewEvent';

    import { goto } from '$app/navigation';
    import { clientReviews } from '$lib/stores/reviews';
    import UserReviewCard from '../Cards/UserReviewCard.svelte';
    import { onDestroy, onMount } from 'svelte';
    import OfferCard from './OfferCard.svelte';
    import BitcoinIcon from '../Icons/BitcoinIcon.svelte';
    import { offerMakerToSelect, selectedPerson } from '$lib/stores/messages';
    import { paymentDetail } from '$lib/stores/payment';

    import { page } from '$app/stores';

	import Markdown from './Markdown.svelte'

    const modalStore = getModalStore();

    export let ticket: TicketEvent;
    // Can disable chat from outside manually
    export let showChat = true;
    let ticketChat = false;
    export let width = 'max-w-[95vw] sm:max-w-[70vw] lg:max-w-[60vw]';
    export let titleSize: string = 'xl';
    export let titleLink: boolean = true;
    export let shortenDescription = true;
    let processedDescription = '';
    export let countAllOffers = true;
    export let tagCallback: ((tag: string) => void) | null = null;
    export let showPoster = true
    export let showReputation = true;
    export let openReputation = true;
    export let showReview = true;
    export let openReview = false;
    export let showWinner = true;

    let bech32ID = '';
    let npub: string;
    let avatarImage = `https://robohash.org/${ticket.pubkey}`;
    let name = '';
    let timeSincePosted: string;
    let ticketStatus: string;

    let offersFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceOffer],
        '#a': [ticket.ticketAddress],
    };
    const subOptions: NDKSubscriptionOptions = {
        closeOnEose: false,
        groupable: true,
        groupableDelay: 1500,
    };
    const allOffers = $ndk.storeSubscribe<OfferEvent>(offersFilter, subOptions, OfferEvent);
    const offerStore = derived([allOffers, wot], ([$allOffers, $wot]) => {
        const offers = $allOffers.filter((offer: OfferEvent) => {
            if ($wot.size > 2) {
                return $wot.has(offer.pubkey);
            } else {
                // Dont filter when wot is not initialized
                return true;
            }
        });

        return offers;
    });

    let winnerOffer: OfferEvent | null = null;

    let offersAlreadyColor: string = 'text-primary-400-500-token';

    let clientReview: ClientRating | null = null;
    let reviewer: NDKUser | null = null;

    // For context menu: Edit ticket, close ticket, share ticket
    const popupHover: PopupSettings = {
        event: 'click',
        target: `popupHover_${ticket?.id}`,
        placement: 'bottom',
    };

    let statusColor: string = '';

    if (ticket) {
        bech32ID = ticket.encode();
        npub = nip19.npubEncode(ticket.pubkey);
        popupHover.target = 'popupHover_' + ticket.id;

        if (ticket?.description) {
            if (shortenDescription && ticket.description.length > 80) {
                processedDescription = ticket.description.substring(0, 80) + '...';
            } else {
                processedDescription = ticket.description;
            }
        } else {
            processedDescription = 'No description!';
        }

        if (ticket.created_at) {
            // Created_at is in Unix time seconds
            let seconds = Math.floor(Date.now() / 1000 - ticket.created_at);
            let minutes = Math.floor(seconds / 60);
            let hours = Math.floor(minutes / 60);
            let days = Math.floor(hours / 24);
            if (days >= 1) {
                timeSincePosted = days.toString() + ' day(s) ago';
            } else if (hours >= 1) {
                timeSincePosted = hours.toString() + ' hour(s) ago';
            } else if (minutes >= 1) {
                timeSincePosted = minutes.toString() + ' minute(s) ago';
            } else if (seconds >= 20) {
                timeSincePosted = seconds.toString() + ' second(s) ago';
            } else {
                timeSincePosted = 'just now';
            }
        }

        if (ticket.status >= 0) {
            if (ticket.status === TicketStatus.New) {
                ticketStatus = 'New';
                statusColor = 'text-primary-400-500-token';
            } else if (ticket.status === TicketStatus.InProgress) {
                ticketStatus = 'In Progress';
                statusColor = 'text-success-500';
            } else if (ticket.status === TicketStatus.Resolved) {
                ticketStatus = 'Resolved';
                statusColor = 'text-tertiary-500';
            } else if (ticket.status === TicketStatus.Failed) {
                ticketStatus = 'Failed';
                statusColor = 'text-error-500';
            }
        }

        if (ticket.status !== TicketStatus.New) {
            $clientReviews.forEach((review: ReviewEvent) => {
                if (review.reviewedEventAddress === ticket.ticketAddress) {
                    clientReview = review.clientRatings;
                    const reviewerPubkey = review.pubkey;
                    reviewer = $ndk.getUser({ pubkey: reviewerPubkey });
                }
            });
        }
    } else {
        console.log('Ticket undefined!');
    }

    $: if ($currentUser && showChat) {
        ticketChat = true;
    } else ticketChat = false;

    $: if ($offerStore) {
        // ?
    }

    $: offerCount = $offerStore.length;
    $: if (offerCount > 0) {
        offersAlreadyColor = 'text-tertiary-400-500-token';
    }

    function shareTicket() {
        if (ticket) {
            const modalComponent: ModalComponent = {
                ref: ShareTicketModal,
                props: { ticket: ticket },
            };

            const modal: ModalSettings = {
                type: 'component',
                component: modalComponent,
            };
            modalStore.trigger(modal);
        }
    }

    function selectChatPartner() {
        if (ticket.pubkey !== $currentUser!.pubkey) {
            $selectedPerson = ticket.pubkey + '$' + bech32ID;
        } else if (ticket.acceptedOfferAddress) {
            $offerMakerToSelect = ticket.winnerFreelancer as string;
        }
    }

    function editTicket() {
        if (ticket) {
            $ticketToEdit = ticket;

            goto('/post-ticket');
        }
    }

    async function closeTicket() {
        if (ticket) {
            const modalComponent: ModalComponent = {
                ref: CloseTicketModal,
                props: { ticket: ticket, offer: winnerOffer },
            };

            const modal: ModalSettings = {
                type: 'component',
                component: modalComponent,
            };
            modalStore.trigger(modal);
        }
    }

    async function pay() {
        if (!winnerOffer) return;

        $paymentDetail = {
            ticket: ticket,
            offer: winnerOffer,
        };

        const currentPath = $page.url.pathname;
        const paymentUrl = new URL('payment', window.location.origin);
        paymentUrl.searchParams.set('redirectPath', currentPath);

        goto(paymentUrl);
    }

    onMount(async ()=>{
        if (ticket.acceptedOfferAddress) {
            const winnerOfferEvent = await $ndk.fetchEvent(ticket.acceptedOfferAddress);
            if (winnerOfferEvent) {
                winnerOffer = OfferEvent.from(winnerOfferEvent);
            }
        }
        const user = $ndk.getUser({ pubkey: ticket.pubkey });

        const profile = await user.fetchProfile({
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            closeOnEose: true,
            groupable: true,
            groupableDelay: 1000,
        });
        if (profile) {
            if (profile.name) name = profile.name;
            if (profile.image) avatarImage = profile.image;
        }
    });

    onDestroy(() => {
        allOffers.empty();
    });
</script>

<div class="card bg-surface-200-700-token {width} flex-grow text-wrap">
    {#if ticket}
        <header class="card-header grid grid-cols-[15%_1fr_15%] items-start">
            {#if ticketChat}
                <a
                    href={'/messages/' + bech32ID}
                    on:click={selectChatPartner}
                    class="btn btn-icon btn-sm md:btn-md justify-self-start"
                >
                    <i class="fa-solid fa-comment text-2xl md:text-3xl"></i>
                </a>
            {/if}
            <div class="justify-self-center text-center justify-center text-wrap col-start-2">
                {#if titleLink}
                    <a class="anchor justify-self-center text-{titleSize}" href={'/' + bech32ID}
                        >{ticket.title ?? 'No title'}
                    </a>
                {:else}
                    <div class="text-{titleSize} text-wrap break-words whitespace-pre-line">
                        {ticket.title ?? 'No title'}
                    </div>
                {/if}
            </div>
            <div class="justify-self-end">
                <button
                    type="button"
                    class="btn btn-icon w-8 h-8 bg-primary-400-500-token"
                    use:popup={popupHover}
                >
                    <i class="fa text-sm fa-ellipsis-v"></i>
                </button>
                <div data-popup="popupHover_{ticket.id}">
                    <div class="card p-2 bg-primary-300-600-token shadow-xl z-50">
                        <ul class="list space-y-4">
                            <!-- Share Ticket -->
                            <li>
                                <button class="" on:click={shareTicket}>
                                    <span><i class="fa-solid fa-share-nodes" /></span>
                                    <span class="flex-auto">Share</span>
                                </button>
                            </li>
                            {#if $currentUser && ticket.pubkey === $currentUser.pubkey}
                                <!-- Edit Ticket -->
                                {#if ticket.status === TicketStatus.New}
                                    <li>
                                        <button class="" on:click={editTicket}>
                                            <span><i class="fa-solid fa-pen-to-square" /></span>
                                            <span class="flex-auto">Edit</span>
                                        </button>
                                    </li>
                                {/if}
                                <!-- Close Ticket -->
                                {#if ticket.status === TicketStatus.InProgress || ticket.status === TicketStatus.New}
                                    <li>
                                        <button class="" on:click={closeTicket}>
                                            <span><i class="fa-solid fa-lock" /></span>
                                            <span class="flex-auto">Close</span>
                                        </button>
                                    </li>
                                {/if}
                                <!-- Pay -->
                                {#if ticket.status !== TicketStatus.New && winnerOffer}
                                    <li>
                                        <button class="" on:click={pay}>
                                            <span><i class="fa-brands fa-bitcoin" /></span>
                                            <span class="flex-auto">Pay</span>
                                        </button>
                                    </li>
                                {/if}
                            {/if}
                        </ul>
                    </div>
                </div>
            </div>
        </header>

        <section class="p-4">
            <div class="text-center text-base md:text-lg break-words whitespace-pre-line">
                <Markdown content={ticket.description} />
            </div>
            
            {#if showPoster}
                <hr class="my-4" />
                <div class="flex flex-col items-center mb-4">
                    <div class="flex items-center">
                        <h4 class="h5 sm:h4">Posted by:</h4>
                    </div>
                    <a class="anchor text-lg sm:text-xl" href={'/' + npub}>
                        <div class="flex justify-center items-center gap-x-2 z-0">
                            <Avatar src={avatarImage} width="w-12" />
                            {name ? name : npub.slice(0, 10) + '...'}
                        </div>
                    </a>
                </div>
            {/if}
            {#if showReputation && $currentUser && ticket.pubkey !== $currentUser.pubkey}
                <ReputationCard
                    type={ReviewType.Client}
                    user={ticket.pubkey}
                    open={openReputation}
                />
            {/if}

            <hr class="my-4" />

            {#if winnerOffer && showWinner}
                <Accordion>
                    <AccordionItem>
                        <svelte:fragment slot="lead">
                            <BitcoinIcon extraClasses={'text-xl sm:text-2xl text-warning-500'} />
                        </svelte:fragment>
                        <svelte:fragment slot="summary">
                            <div class="h5 sm:h4 text-center">Winning Offer</div>
                        </svelte:fragment>
                        <svelte:fragment slot="content">
                            <OfferCard
                                offer={winnerOffer}
                                showTicket={false}
                                showReputation={false}
                                showDetails={false}
                                showDescription={false}
                                showOfferReview={true}
                            ></OfferCard>
                        </svelte:fragment>
                    </AccordionItem>
                </Accordion>
                <hr class="my-4" />
            {/if}

            <div class="">
                <span class="pr-1">Status: </span>
                <span class="font-bold {statusColor}">{ticketStatus}</span>
            </div>
            <div class="">{timeSincePosted}</div>
            {#if countAllOffers}
                <div class="text-md font-bold {offersAlreadyColor} mt-2">
                    {'Offers on ticket: ' + (offerCount > 0 ? offerCount : '?')}
                </div>
            {/if}
        </section>
        <footer class="card-footer">
            <div class="flex justify-between mb-4">
                <div class="items-center flex flex-wrap gap-y-1">
                    {#each ticket.tTags as tag}
                        <div class="pr-3 rounded-token">
                            <button
                                type="button"
                                class="badge variant-filled-surface"
                                on:click={() => {
                                    if (tagCallback) tagCallback(tag[1]);
                                }}
                            >
                                <span class="">{tag[1]}</span>
                            </button>
                        </div>
                    {/each}
                </div>
            </div>
            {#if showReview && clientReview && reviewer}
                <UserReviewCard rating={clientReview} {reviewer} open={openReview} />
            {/if}
        </footer>
    {/if}
</div>
