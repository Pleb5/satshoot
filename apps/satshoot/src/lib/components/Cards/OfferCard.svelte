<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import {
        NDKKind,
        NDKNutzap,
        NDKSubscriptionCacheUsage,
        zapInvoiceFromEvent,
        type NDKUser,
    } from '@nostr-dev-kit/ndk';

    import { nip19 } from 'nostr-tools';
    import { OfferEvent, Pricing } from '$lib/events/OfferEvent';

    import TicketCard from './TicketCard.svelte';
    import { TicketStatus, TicketEvent } from '$lib/events/TicketEvent';

    import { offerMakerToSelect, selectedPerson } from '$lib/stores/messages';

    import type { NDKFilter, NDKEvent } from '@nostr-dev-kit/ndk';

    import CreateOfferModal from '../Modals/CreateOfferModal.svelte';
    import ReviewClientModal from '../Modals/ReviewClientModal.svelte';
    import { Avatar, getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';
    import { popup } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';
    import { Accordion, AccordionItem } from '@skeletonlabs/skeleton';

    import { onDestroy, onMount } from 'svelte';
    import ReputationCard from './ReputationCard.svelte';
    import { ReviewEvent, ReviewType, type FreelancerRating } from '$lib/events/ReviewEvent';
    import UserReviewCard from '../Cards/UserReviewCard.svelte';
    import { clientReviews, freelancerReviews } from '$lib/stores/reviews';

    import { insertThousandSeparator, SatShootPubkey } from '$lib/utils/misc';
    import type { ExtendedBaseType, NDKEventStore } from '@nostr-dev-kit/ndk-svelte';
    import { wot } from '$lib/stores/wot';
    import TicketIcon from '../Icons/TicketIcon.svelte';

	import Markdown from './Markdown.svelte'

    const modalStore = getModalStore();

    export let offer: OfferEvent;
    let avatarImage = `https://robohash.org/${offer.pubkey}`;
    let name = '';
    export let countAllOffers = true;
    export let showDescription = true;
    export let showReputation = true;
    export let showPoster = true;
    export let showDetails = true;
    let ticket: TicketEvent | undefined = undefined;
    export let enableChat = false;

    export let maxWidth = 'max-w-[90vw] sm:max-w-[70vw] lg:max-w-[60vw]';
    export let showTicket = true;
    export let showTicketReputation = true;
    export let showTicketReview = true;
    export let openTicket = false;
    export let openTicketReputation = false;

    export let showOfferReview = true;
    export let openReview = false;

    let freelancerReview: FreelancerRating | null = null;
    let reviewer: NDKUser;

    let freelancerPaid = 0;
    let satshootPaid = 0;
    let freelancerPaymentStore: NDKEventStore<NDKEvent>;
    let satshootPaymentStore: NDKEventStore<NDKEvent>;

    let ticketFilter: NDKFilter<NDKKind.FreelanceTicket> = {
        kinds: [NDKKind.FreelanceTicket],
        '#d': [],
    };
    let dTagOfTicket: string;
    let ticketStore: NDKEventStore<ExtendedBaseType<TicketEvent>>;
    let npub: string;
    let timeSincePosted: string;
    let pricing: string = '';

    let editOffer: boolean = false;

    // Because Tickets drive the status of Offers, this is calculated always
    // as soon as the ticket for this offer is fetched
    let winner = false;
    let status = '?';
    let statusColor = 'text-primary-400-500-token';
    let canReviewClient = true;

    if (offer) {
        dTagOfTicket = offer.referencedTicketAddress.split(':')[2];
        ticketFilter['#d'] = [dTagOfTicket];

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

        freelancerPaymentStore = $ndk.storeSubscribe(
            [
                { kinds: [NDKKind.Zap], '#e': [offer.id] },
                { kinds: [NDKKind.Nutzap], '#a': [offer.offerAddress] },
            ],
            {
                closeOnEose: false,
                groupable: true,
                groupableDelay: 1500,
                autoStart: true,
            }
        );

        satshootPaymentStore = $ndk.storeSubscribe(
            [
                {
                    kinds: [NDKKind.Zap],
                    '#p': [SatShootPubkey],
                    '#a': [offer.referencedTicketAddress],
                },
                {
                    kinds: [NDKKind.Nutzap],
                    '#p': [SatShootPubkey],
                    '#a': [offer.referencedTicketAddress],
                },
            ],
            {
                closeOnEose: false,
                groupable: true,
                groupableDelay: 1500,
                autoStart: true,
            }
        );
    } else {
        console.log('offer is null yet!');
    }

    function editMyOffer() {
        if (ticket && offer) {
            const modalComponent: ModalComponent = {
                ref: CreateOfferModal,
                props: { ticket: ticket, offerToEdit: offer },
            };

            const modal: ModalSettings = {
                type: 'component',
                component: modalComponent,
            };
            modalStore.trigger(modal);
        }
    }

    function reviewClient() {
        if (offer) {
            const modalComponent: ModalComponent = {
                ref: ReviewClientModal,
                props: { ticketAddress: offer.referencedTicketAddress },
            };

            const modal: ModalSettings = {
                type: 'component',
                component: modalComponent,
            };
            modalStore.trigger(modal);
        }
    }

    function startTicketSub() {
        if (ticketFilter['#d']!.length > 0) {
            ticketStore = $ndk.storeSubscribe<TicketEvent>(
                ticketFilter,
                {
                    autoStart: true,
                    closeOnEose: false,
                    groupable: true,
                    groupableDelay: 1000,
                },
                TicketEvent
            );
        } else {
            console.log('Cannot start ticket sub! Filter does not contain a ticket d-tag!');
        }
    }

    $: if ($ticketStore?.length > 0) {
        ticket = $ticketStore[0];
        const winnerId = ticket.acceptedOfferAddress;
        if (winnerId === offer!.offerAddress) {
            winner = true;
            status = 'Won';
            statusColor = 'text-warning-500';
        } else if (winnerId || ticket.isClosed()) {
            status = 'Lost';
            statusColor = 'text-error-500';
        } else {
            // The winner is defined but it is not us so our offer lost
            // OR the ticket does not have a winner but it is closed
            status = 'Pending';
            statusColor = 'text-primary-400-500-token';
        }
        offer = offer;
    }

    $: if ($clientReviews && ticket) {
        $clientReviews.forEach((review: ReviewEvent) => {
            if (review.reviewedEventAddress === ticket!.ticketAddress) {
                canReviewClient = false;
            }
        });
    }

    $: if ($freelancerPaymentStore) {
        freelancerPaid = 0;
        $freelancerPaymentStore.forEach((zap: NDKEvent) => {
            if (zap.kind === NDKKind.Zap) {
                const zapInvoice = zapInvoiceFromEvent(zap);
                if (zapInvoice) {
                    const zappee = zapInvoice.zappee;
                    if ($wot.has(zappee)) {
                        freelancerPaid += Math.round(zapInvoice.amount / 1000);
                    }
                }
            } else if (zap.kind === NDKKind.Nutzap) {
                const nutzap = NDKNutzap.from(zap);
                if (nutzap) {
                    if ($wot.has(nutzap.pubkey)) {
                        freelancerPaid += Math.round(nutzap.amount / 1000);
                    }
                }
            }
        });
    }

    $: if ($satshootPaymentStore) {
        satshootPaid = 0;
        $satshootPaymentStore.forEach((zap: NDKEvent) => {
            if (zap.kind === NDKKind.Zap) {
                const zapInvoice = zapInvoiceFromEvent(zap);
                if (zapInvoice) {
                    const zappee = zapInvoice.zappee;
                    if ($wot.has(zappee)) {
                        satshootPaid += Math.round(zapInvoice.amount / 1000);
                    }
                }
            } else if (zap.kind === NDKKind.Nutzap) {
                const nutzap = NDKNutzap.from(zap);
                if (nutzap) {
                    if ($wot.has(nutzap.pubkey)) {
                        satshootPaid += Math.round(nutzap.amount / 1000);
                    }
                }
            }
        });
    }

    // Only allow editing offer if the ticket still accepts offers(no winner yet)
    $: if (offer && ticket) {
        if ($currentUser && $currentUser.npub === npub && ticket.status === TicketStatus.New) {
            editOffer = true;
        } else {
            editOffer = false;
        }

        if (winner) {
            $freelancerReviews.forEach((review: ReviewEvent) => {
                if (review.reviewedEventAddress === offer!.offerAddress) {
                    freelancerReview = review.freelancerRatings;
                    const reviewerPubkey = review.pubkey;
                    reviewer = $ndk.getUser({ pubkey: reviewerPubkey });
                }
            });
        }
    }

    function setChatPartner() {
        if (ticket!.pubkey === $currentUser!.pubkey) {
            $offerMakerToSelect = (offer as OfferEvent).pubkey;
        } else {
            $selectedPerson = ticket!.pubkey + '$' + ticket!.encode();
        }
    }

    onMount(async () => {
        startTicketSub();
        const user = $ndk.getUser({ pubkey: offer.pubkey });

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
        if (ticketStore) ticketStore.empty();
        if (freelancerPaymentStore) freelancerPaymentStore.empty();
        if (satshootPaymentStore) satshootPaymentStore.empty();
    });

    // For context menu: Edit ticket, close ticket, share ticket
    const contextMenu: PopupSettings = {
        event: 'click',
        target: `contextMenu_${offer?.id}`,
        placement: 'bottom',
    };

    const pledgeInfoPopup: PopupSettings = {
        event: 'click',
        target: `pledgeInfo_${offer?.id}`,
        placement: 'top',
    };
</script>

<div class="card pt-2 bg-surface-200-700-token flex-grow {maxWidth}">
    {#if offer}
        <div class="grid grid-cols-[15%_1fr_15%] justify-center items-center mx-2">
            {#if $currentUser && enableChat && ticket}
                <a
                    on:click={setChatPartner}
                    href={'/messages/' + ticket.encode()}
                    class="btn btn-icon btn-sm justify-self-start"
                >
                    <i class="fa-solid fa-comment text-2xl"></i>
                </a>
            {/if}
            <h3 class="h4 md:h3 col-start-2 text-center text-tertiary-500">
                {(editOffer ? 'My ' : '') +
                    'Offer: ' +
                    insertThousandSeparator(offer.amount) +
                    ' ' +
                    pricing}
            </h3>
            {#if $currentUser && offer.pubkey === $currentUser.pubkey}
                <div class="col-start-3 justify-self-end">
                    <div class="justify-self-end">
                        <button
                            type="button"
                            class="btn btn-icon w-8 h-8 bg-primary-400-500-token"
                            use:popup={contextMenu}
                        >
                            <i class="fa text-sm fa-ellipsis-v"></i>
                        </button>
                        <div data-popup="contextMenu_{offer.id}">
                            <div class="card p-2 bg-primary-300-600-token shadow-xl z-50">
                                <ul class="list space-y-4">
                                    <!-- Edit Offer -->
                                    {#if editOffer}
                                        <li>
                                            <button class="" on:click={editMyOffer}>
                                                <span><i class="fa-solid fa-pen-to-square" /></span>
                                                <span class="flex-auto">Edit</span>
                                            </button>
                                        </li>
                                    {/if}
                                    {#if winner && canReviewClient}
                                        <li>
                                            <button class="" on:click={reviewClient}>
                                                <span
                                                    ><i
                                                        class="fa-regular fa-star-half-stroke"
                                                    /></span
                                                >
                                                <span class="flex-auto">Review Client</span>
                                            </button>
                                        </li>
                                    {/if}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            {/if}
        </div>
        <div class="flex justify-center items-center gap-x-2">
            <h4 class="h5 md:h4 col-start-2 text-center text-tertiary-500">
                {'Pledged: ' + offer.pledgeSplit + ' %'}
            </h4>
            <i
                class="text-primary-300-600-token fa-solid fa-circle-question text-xl
                [&>*]:pointer-events-none"
                use:popup={pledgeInfoPopup}
            />
            <div data-popup="pledgeInfo_{offer.id}">
                <div class="card w-80 p-4 bg-primary-300-600-token max-h-60 overflow-y-auto">
                    <p>
                        Revenue share percentage the Freelancer pledged to SatShoot to support
                        development.
                    </p>
                    <div class="arrow bg-primary-300-600-token" />
                </div>
            </div>
        </div>
        {#if winner}
            <div class="flex flex-col gap-2">
                <h4 class="h5 md:h4 col-start-2 text-center text-success-500">
                    <div class="flex flex-col items-center gap-y-2">
                        <div>
                            <div>
                                Freelancer Paid: 
                            </div>
                            <div>
                                {
                                (insertThousandSeparator(freelancerPaid) ?? '?') +
                                    ' sats'
                                }
                            </div>
                        </div>
                    </div>
                </h4>
                <h4 class="h5 md:h4 col-start-2 text-center text-success-500">
                    <div class="flex flex-col items-center gap-y-2">
                        <div>
                            <div>
                                Satshoot Paid:
                            </div>
                            <div>
                                {
                                (insertThousandSeparator(satshootPaid) ?? '?') +
                                    ' sats'
                                }
                            </div>
                        </div>
                    </div>
                </h4>
            </div>
        {/if}
        {#if showDescription}
            <div class="h5 sm:h4 text-center mt-2">
                Pitch:
            </div>
            <div class="text-center text-base md:text-lg p-2">
                <Markdown content={offer.description} />
            </div>
        {/if}
        <slot name="takeOffer" />
        <div class="flex flex-col gap-y-1 justify-start px-4 pt-2 pb-4">
            {#if showPoster}
                <div class="flex flex-col items-center mb-4">
                    <div class="flex items-center">
                        <h4 class="h5 sm:h4">Posted by:</h4>
                    </div>
                    <a class="anchor text-lg sm:text-xl" href={'/' + npub}>
                        <div class="flex justify-center items-center gap-x-2">
                            <Avatar src={avatarImage} width="w-12" />
                            {name ? name : npub.slice(0, 10) + '...'}
                        </div>
                    </a>
                </div>
            {/if}
            {#if showReputation && $currentUser && offer.pubkey !== $currentUser.pubkey}
                <ReputationCard type={ReviewType.Freelancer} user={offer.pubkey} />
            {/if}
            {#if showDetails}
                <div class="">
                    <span class="">Status: </span>
                    <span class="font-bold {statusColor}">{status}</span>
                </div>
                <div class="">{timeSincePosted}</div>
            {/if}
            {#if showTicket}
                <hr class="my-2" />
                <Accordion>
                    <AccordionItem bind:open={openTicket}>
                        <svelte:fragment slot="lead">
                            <TicketIcon sizeClass={'text-xl'} />
                        </svelte:fragment>
                        <svelte:fragment slot="summary">
                            <div class="flex items-center justify-center">
                                <h3 class="h4 sm:h3 text-center">Ticket</h3>
                            </div>
                        </svelte:fragment>
                        <svelte:fragment slot="content">
                            {#if ticket}
                                <TicketCard
                                    {ticket}
                                    titleSize={'md md:text-xl'}
                                    showChat={false}
                                    {countAllOffers}
                                    showReputation={showTicketReputation}
                                    openReputation={openTicketReputation}
                                    showReview={showTicketReview}
                                    showWinner={!winner}
                                ></TicketCard>
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
                        </svelte:fragment>
                    </AccordionItem>
                </Accordion>
            {/if}
            {#if showOfferReview && freelancerReview && reviewer}
                <UserReviewCard rating={freelancerReview} {reviewer} open={openReview} />
            {/if}
        </div>
    {:else}
        <h2 class="h2 text-center text-error-500">Error: Offer not found!</h2>
    {/if}
</div>
