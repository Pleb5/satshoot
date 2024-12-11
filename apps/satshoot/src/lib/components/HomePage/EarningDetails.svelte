<script lang="ts">
    import type { OfferEvent } from '$lib/events/OfferEvent';
    import { TicketEvent } from '$lib/events/TicketEvent';
    import { wotFilteredOffers, wotFilteredTickets } from '$lib/stores/freelance-eventstores';
    import { wot } from '$lib/stores/wot';
    import { insertThousandSeparator, SatShootPubkey } from '$lib/utils/misc';
    import ndk from '$lib/stores/ndk';
    import {
        NDKKind,
        NDKNutzap,
        zapInvoiceFromEvent,
        type Hexpubkey,
        type NDKEvent,
    } from '@nostr-dev-kit/ndk';
    import type { NDKEventStore } from '@nostr-dev-kit/ndk-svelte';
    import { onDestroy } from 'svelte';

    export let user: Hexpubkey;

    let allEarningsStore: NDKEventStore<NDKEvent>;
    let allPaymentsStore: NDKEventStore<NDKEvent>;
    let allPledgesStore: NDKEventStore<NDKEvent>;

    let allEarnings = 0;
    let allPayments = 0;
    let allPledges = 0;

    const subOptions = {
        closeOnEose: false,
        groupable: true,
        groupableDelay: 1500,
        autoStart: true,
    };

    // Get all winner offer a-tags OF this user as a freelancer
    // We take only those that were on tickets from a client in wot
    const allWinnerOffersOfUser: string[] = [];

    // Get all winner offer a-tags FOR this user as a client
    // We take only freelancers in wot
    const allWinnerOffersForUser: string[] = [];

    // Get all tickets where user won and client is in wot
    // OR tickets where user is a client and winner freelancer is in wot
    const allTicketsWhereUserInvolved: string[] = [];

    $: if (user && $wot && $wotFilteredTickets && $wotFilteredOffers) {
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

    onDestroy(() => {
        if (allEarningsStore) allEarningsStore.empty();
        if (allPaymentsStore) allPaymentsStore.empty();
        if (allPledgesStore) allPledgesStore.empty();
    });

    const itemClasses =
        'transition-all ease-in-out duration-[0.3s] flex flex-col ' +
        'gap-[5px] p-[5px_10px] rounded-[6px] bg-[rgba(0,0,0,0.1)] ' +
        'text-[rgba(0,0,0,0.5)] items-center outline outline-[2px] ' +
        'outline-[rgba(0,0,0,0.15)] text-[14px] flex-grow hover:outline-[#ffb800]';
</script>

<div class="flex-grow-1 flex flex-col gap-[10px] p-[0px]">
    <div class="w-full flex flex-row gap-[10px] flex-wrap">
        <div class="w-full flex flex-row gap-[10px] flex-wrap">
            <div class={itemClasses + ' w-full'}>
                <p class="font-[600]">Earnings (sats):</p>
                <p class="">{insertThousandSeparator(allEarnings)}</p>
            </div>
            <div class={itemClasses + ' w-[calc(50%-5px)]'}>
                <p class="font-[600]">Payments:</p>
                <p class="">{insertThousandSeparator(allPayments)}</p>
            </div>
            <div class={itemClasses + ' w-[calc(50%-5px)]'}>
                <p class="font-[600]">Pledges:</p>
                <p class="">{insertThousandSeparator(allPledges)}</p>
            </div>
        </div>
    </div>
</div>
