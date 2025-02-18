<script lang="ts">
    import { OfferEvent, Pricing } from '$lib/events/OfferEvent';
    import { type TicketEvent } from '$lib/events/TicketEvent';
    import ndk, { connected } from '$lib/stores/ndk';
    import {
        createPaymentFilters,
        createPaymentStore,
        type PaymentStore,
    } from '$lib/stores/payment';
    import { getJobStatusColor, getJobStatusString } from '$lib/utils/job';
    import { abbreviateNumber, insertThousandSeparator } from '$lib/utils/misc';
    import { NDKKind, NDKSubscriptionCacheUsage, type NDKFilter } from '@nostr-dev-kit/ndk';
    import { popup, type PopupSettings } from '@skeletonlabs/skeleton';
    import { nip19 } from 'nostr-tools';
    import { onDestroy, onMount } from 'svelte';
    import Card from '../UI/Card.svelte';

    export let job: TicketEvent;

    $: statusString = getJobStatusString(job.status);
    $: statusColor = getJobStatusColor(job.status);

    let offers: OfferEvent[] = [];
    let winningOffer: OfferEvent | undefined = undefined;

    let freelancerName = '?';
    let freelancerPaid = 0;
    let freelancerPaymentStore: PaymentStore;
    let pricing: string = '';

    let needSetup = true;
    // Wait for ndk to connect then setup subscription on ticket from URL params
    // Also check for existing ndk because we try to add relays from the naddr here
    $: if ($ndk && $connected && needSetup && job) {
        needSetup = false;
    }

    $: if (job.winnerFreelancer) {
        const jobWinner = $ndk.getUser({ pubkey: job.winnerFreelancer });
        freelancerName = jobWinner.npub.substring(0, 8);

        jobWinner.fetchProfile().then((profile) => {
            if (profile) {
                if (profile.name) freelancerName = profile.name;
            }
        });
    }

    $: if (job.acceptedOfferAddress) {
        $ndk.fetchEvent(job.acceptedOfferAddress, {
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        }).then((event) => {
            if (event) {
                winningOffer = OfferEvent.from(event);
            }
        });
    }

    $: if (winningOffer) {
        switch (winningOffer.pricing) {
            case Pricing.Absolute:
                pricing = 'sats';
                break;
            case Pricing.SatsPerMin:
                pricing = 'sats/min';
                break;
        }

        const freelancerFilters = createPaymentFilters(winningOffer, 'freelancer');

        freelancerPaymentStore = createPaymentStore(freelancerFilters);

        freelancerPaymentStore.totalPaid.subscribe((value) => {
            freelancerPaid = value;
        });
    }

    onMount(async () => {
        let offersFilter: NDKFilter = {
            kinds: [NDKKind.FreelanceOffer],
            '#a': [job.ticketAddress],
        };

        const events = await $ndk.fetchEvents(offersFilter, {
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });

        const offerEvents: OfferEvent[] = [];

        events.forEach((event) => {
            offerEvents.push(OfferEvent.from(event));
        });

        offers = offerEvents;
    });

    onDestroy(() => {
        if (freelancerPaymentStore) freelancerPaymentStore.paymentStore.empty();
    });

    // For tooltip
    const paymentTooltip: PopupSettings = {
        event: 'click',
        target: 'paymentTooltip',
        placement: 'top',
    };

    const boxWrapperClasses =
        'transition-all ease-in-out duration-[0.3s] flex flex-row gap-[5px] p-[5px_10px] ' +
        'rounded-[6px] bg-black-100 text-black-500 dark:bg-white-100 dark:text-white-500 items-center ' +
        'outline outline-[2px] outline-[rgba(0,0,0,0.15)] text-[14px] flex-grow w-full';
</script>

<div class="flex flex-col grow-[1] gap-[10px] p-[0px]">
    <div class="w-full flex flex-row gap-[10px] flex-wrap">
        <div class={boxWrapperClasses}>
            <p class="font-[600]">Status:</p>
            <p class="line-clamp-1 overflow-hidden {statusColor}">{statusString}</p>
        </div>
        <div class={boxWrapperClasses}>
            <p class="font-[600]">Offers:</p>
            <p class="line-clamp-1 overflow-hidden">
                {insertThousandSeparator(offers.length)}
            </p>
        </div>
        {#if job.winnerFreelancer}
            <div class={boxWrapperClasses}>
                <p class="font-[600]">Freelancer:</p>
                <a
                    href={'/' + nip19.npubEncode(job.winnerFreelancer)}
                    class="font-[600] line-clamp-1 overflow-hidden max-w-[200px]"
                >
                    {freelancerName}
                </a>
            </div>
        {/if}

        {#if winningOffer}
            <div class={boxWrapperClasses}>
                <p class="font-[600]">
                    Payments
                    <span>
                        <i
                            class="bx bx-question-mark bg-blue-500 text-white p-[3px] rounded-[50%]"
                            use:popup={paymentTooltip}
                        />
                    </span>
                    :
                </p>
                <div data-popup="paymentTooltip">
                    <Card>
                        <p>Amount paid to freelancer / Amount promised for job</p>
                    </Card>
                </div>
                <p class="line-clamp-1 overflow-hidden">
                    <span>
                        {abbreviateNumber(freelancerPaid)}
                    </span>
                    <span>/</span>
                    <span>
                        {`${abbreviateNumber(winningOffer.amount)} ${pricing}`}
                    </span>
                </p>
            </div>
        {/if}
    </div>
</div>
