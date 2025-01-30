<script lang="ts">
    import {
        NDKEvent,
        NDKKind,
        NDKNutzap,
        NDKSubscriptionCacheUsage,
        zapInvoiceFromEvent,
        type Hexpubkey,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import UserProfile from '../UI/Display/UserProfile.svelte';
    import { onMount } from 'svelte';
    import ndk from '$lib/stores/ndk';
    import { nip19 } from 'nostr-tools';
    import {
        averageToRatingText,
        shortenTextWithEllipsesInMiddle,
        type RatingConsensus,
    } from '$lib/utils/helpers';
    import type { NDKEventStore } from '@nostr-dev-kit/ndk-svelte';
    import currentUser from '$lib/stores/user';
    import {
        aggregateClientRatings,
        aggregateFreelancerRatings,
        clientReviews,
        freelancerReviews,
    } from '$lib/stores/reviews';
    import { wot } from '$lib/stores/wot';
    import { wotFilteredOffers, wotFilteredTickets } from '$lib/stores/freelance-eventstores';
    import { TicketEvent } from '$lib/events/TicketEvent';
    import type { OfferEvent } from '$lib/events/OfferEvent';
    import { abbreviateNumber, insertThousandSeparator, SatShootPubkey } from '$lib/utils/misc';

    export let user: Hexpubkey;

    $: npub = nip19.npubEncode(user);
    $: avatarImage = `https://robohash.org/${npub}`;
    $: profileLink = '/' + npub;

    let userProfile: NDKUserProfile | undefined = undefined;

    $: if (userProfile?.image) {
        avatarImage = userProfile.image;
    }

    const subOptions = {
        closeOnEose: false,
        groupable: true,
        groupableDelay: 1500,
        autoStart: true,
    };

    let allEarningsStore: NDKEventStore<NDKEvent>;
    let allPaymentsStore: NDKEventStore<NDKEvent>;
    let allPledgesStore: NDKEventStore<NDKEvent>;

    let allEarnings = 0;
    let allPayments = 0;
    let allPledges = 0;

    let ratingConsensus = '?';
    let ratingColor = '';

    // Get all winner offer a-tags OF this user as a freelancer
    // We take only those that were on tickets from a client in wot
    const allWinnerOffersOfUser: string[] = [];

    // Get all winner offer a-tags FOR this user as a client
    // We take only freelancers in wot
    const allWinnerOffersForUser: string[] = [];

    // Get all tickets where user won and client is in wot
    // OR tickets where user is a client and winner freelancer is in wot
    const allTicketsWhereUserInvolved: string[] = [];

    let needSetup = true;

    $: if ($currentUser && user && $clientReviews && $freelancerReviews) {
        let clientAverage = aggregateClientRatings(user).average;
        let freelancerAverage = aggregateFreelancerRatings(user).average;
        let overallAverage: number = NaN;

        if (!isNaN(clientAverage) && !isNaN(freelancerAverage)) {
            overallAverage = (clientAverage + freelancerAverage) / 2;
        } else if (isNaN(clientAverage) && !isNaN(freelancerAverage)) {
            overallAverage = freelancerAverage;
        } else if (isNaN(freelancerAverage) && !isNaN(clientAverage)) {
            overallAverage = clientAverage;
        } else {
            overallAverage = NaN;
        }

        const ratingText: RatingConsensus = averageToRatingText(overallAverage);
        ratingConsensus = ratingText.ratingConsensus;
        ratingColor = ratingText.ratingColor;
    }

    $: if ($currentUser && needSetup && user && $wot && $wotFilteredTickets && $wotFilteredOffers) {
        needSetup = true;

        const allTicketsOfUser = $wotFilteredTickets.filter(
            (ticket: TicketEvent) => ticket.pubkey === user
        );

        const allOffersOfUser = $wotFilteredOffers.filter(
            (offer: OfferEvent) => offer.pubkey === user
        );

        $wotFilteredTickets.forEach((t: TicketEvent) => {
            allOffersOfUser.forEach((o: OfferEvent) => {
                if (t.acceptedOfferAddress === o.offerAddress) {
                    allWinnerOffersOfUser.push(o.id);
                    allTicketsWhereUserInvolved.push(t.ticketAddress);
                }
            });
        });

        $wotFilteredOffers.forEach((o: OfferEvent) => {
            allTicketsOfUser.forEach((t: TicketEvent) => {
                if (t.acceptedOfferAddress === o.offerAddress) {
                    allWinnerOffersForUser.push(o.id);
                    allTicketsWhereUserInvolved.push(t.ticketAddress);
                }
            });
        });

        allEarningsStore = $ndk.storeSubscribe(
            {
                kinds: [NDKKind.Zap, NDKKind.Nutzap],
                '#p': [user],
                '#e': allWinnerOffersOfUser,
            },
            subOptions
        );
        allPaymentsStore = $ndk.storeSubscribe(
            { kinds: [NDKKind.Zap, NDKKind.Nutzap], '#e': allWinnerOffersForUser },
            subOptions
        );

        allPledgesStore = $ndk.storeSubscribe(
            {
                kinds: [NDKKind.Zap, NDKKind.Nutzap],
                '#a': allTicketsWhereUserInvolved,
                '#p': [SatShootPubkey],
            },
            subOptions
        );
    }

    $: if ($allEarningsStore) {
        allEarnings = 0;
        $allEarningsStore.forEach((zap: NDKEvent) => {
            if (zap.kind === NDKKind.Zap) {
                const zapInvoice = zapInvoiceFromEvent(zap);
                if (zapInvoice && zapInvoice.amount) {
                    allEarnings += Math.round(zapInvoice.amount / 1000);
                }
            } else if (zap.kind === NDKKind.Nutzap) {
                const nutzap = NDKNutzap.from(zap);
                if (nutzap && nutzap.amount) {
                    allEarnings += Math.round(nutzap.amount / 1000);
                }
            }
        });
    }

    $: if ($allPaymentsStore) {
        allPayments = 0;
        $allPaymentsStore.forEach((zap: NDKEvent) => {
            if (zap.kind === NDKKind.Zap) {
                const zapInvoice = zapInvoiceFromEvent(zap);
                if (zapInvoice && zapInvoice.amount) {
                    allPayments += Math.round(zapInvoice.amount / 1000);
                }
            } else if (zap.kind === NDKKind.Nutzap) {
                const nutzap = NDKNutzap.from(zap);
                if (nutzap && nutzap.amount) {
                    allPayments += Math.round(nutzap.amount / 1000);
                }
            }
        });
    }

    $: if ($allPledgesStore) {
        allPledges = 0;

        // Helper function to calculate pledge share
        function calculateUserShare(pledgeSum: number, ticket: TicketEvent, offer: OfferEvent) {
            const absolutePledgeSplit = Math.round((offer.pledgeSplit / 100) * pledgeSum);
            let userShare = 0;

            if (ticket.pubkey === user) {
                // User is the client
                userShare = pledgeSum - absolutePledgeSplit;
            } else {
                // User is the freelancer
                userShare = absolutePledgeSplit;
            }

            return userShare;
        }

        // Helper function to find the ticket and offer
        function getTicketAndOffer(zap: NDKEvent) {
            const ticket = $wotFilteredTickets
                .filter((t: TicketEvent) => t.ticketAddress === zap.tagValue('a'))
                .at(0) as TicketEvent;

            const offer = $wotFilteredOffers
                .filter((o: OfferEvent) => o.offerAddress === ticket.acceptedOfferAddress)
                .at(0) as OfferEvent;

            return { ticket, offer };
        }

        // Main loop to process each pledge event
        $allPledgesStore.forEach((zap: NDKEvent) => {
            let pledgeSum = 0;

            if (zap.kind === NDKKind.Zap) {
                const zapInvoice = zapInvoiceFromEvent(zap);
                if (zapInvoice && zapInvoice.amount) {
                    pledgeSum = Math.round(zapInvoice.amount / 1000);
                }
            } else if (zap.kind === NDKKind.Nutzap) {
                const nutzap = NDKNutzap.from(zap);
                if (nutzap && nutzap.amount) {
                    pledgeSum = Math.round(nutzap.amount / 1000);
                }
            }

            if (pledgeSum > 0) {
                const { ticket, offer } = getTicketAndOffer(zap);

                if (ticket && offer) {
                    const userShare = calculateUserShare(pledgeSum, ticket, offer);
                    allPledges += userShare;
                }
            }
        });
    }

    onMount(async () => {
        const ndkUser = $ndk.getUser({ pubkey: user });

        const profile = await ndkUser.fetchProfile({
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            closeOnEose: true,
            groupable: true,
            groupableDelay: 1000,
        });
        if (profile) {
            userProfile = profile;
        }
    });

    const profileImageWrapperClasses =
        'transition ease-in-out duration-[0.3s] min-w-[40px] min-h-[40px] w-[40px] h-[40px] ' +
        'rounded-full border border-[3px] border-white shadow-[0_0_4px_2px_rgba(0,0,0,0.35)] ' +
        'flex flex-col justify-center items-center relative overflow-hidden bg-white-200 ' +
        'backdrop-blur-[10px] text-[12px] leading-[1] hover:border-[3px] hover:border-blue-600 ' +
        'hover:scale-[1.1] hover:shadow-[0_0_4px_2px_rgba(0,0,0,0.1)]';

    const ratingConsensusWrapperClasses =
        'w-full flex flex-row justify-center items-center gap-[5px] p-[5px] rounded-[4px] ' +
        'bg-black-50 border-[1px] border-black-100';

    const paymentWrapperClasses =
        'transition-all ease-in-out duration-[0.3s] flex flex-row flex-grow gap-[5px] p-[5px_10px] rounded-[6px] ' +
        'bg-black-100 text-black-500 items-center outline outline-[2px] outline-black-200 ' +
        'text-[14px] hover:outline-yellow-600';
</script>

<div class="flex-grow-1 flex flex-col gap-[10px] p-[0px]">
    <div class="w-full flex flex-row gap-[5px]">
        <div class="flex flex-row p-[0_8px_0_0] m-[0_5px_0_0] border-r border-black-100">
            <a
                class="transition ease-in-out duration-[0.3s] flex flex-col justify-center items-center"
                href={profileLink}
            >
                <div class={profileImageWrapperClasses}>
                    <img
                        class="w-full h-full absolute top-0 bottom-0 right-0 left-0 object-cover"
                        src={avatarImage}
                        alt="user profile"
                    />
                </div>
            </a>
        </div>
        <div class="w-full flex flex-col gap-[5px]">
            <a href={profileLink} class="font-[600] line-clamp-1 overflow-hidden max-w-[200px]">
                {userProfile?.name ??
                    userProfile?.displayName ??
                    shortenTextWithEllipsesInMiddle(npub, 15)}
            </a>
            <div class={ratingConsensusWrapperClasses}>
                <i class="bx bxs-star border-r-[1px] border-r-black-100 text-black-500 pr-[5px]" />
                <p class="font-[700] grow-[1]">{ratingConsensus}</p>
            </div>
        </div>
    </div>
    <div class="w-full flex flex-row gap-[10px] flex-wrap">
        <div class="{paymentWrapperClasses} w-full">
            <p class="font-[600]">Earnings:</p>
            <p class="line-clamp-1 overflow-hidden">{abbreviateNumber(allEarnings)}</p>
        </div>
        <div class="{paymentWrapperClasses} w-[calc(50%-5px)]">
            <p class="font-[600]">Payments:</p>
            <p class="line-clamp-1 overflow-hidden">{abbreviateNumber(allPayments)}</p>
        </div>
        <div class="{paymentWrapperClasses} w-[calc(50%-5px)]">
            <p class="font-[600]">Pledges:</p>
            <p class="line-clamp-1 overflow-hidden">{abbreviateNumber(allPledges)}</p>
        </div>
    </div>
</div>
