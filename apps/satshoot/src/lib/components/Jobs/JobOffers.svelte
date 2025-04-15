<script lang="ts">
    import { OfferEvent, Pricing } from '$lib/events/OfferEvent';
    import { TicketStatus, type TicketEvent } from '$lib/events/TicketEvent';
    import ndk from '$lib/stores/session';
    import { createPaymentFilters, createPaymentStore } from '$lib/stores/payment';
    import { getJobStatusColor, getJobStatusString } from '$lib/utils/job';
    import { abbreviateNumber, insertThousandSeparator } from '$lib/utils/misc';
    import { NDKKind, NDKSubscriptionCacheUsage, type NDKFilter } from '@nostr-dev-kit/ndk';
    import { nip19 } from 'nostr-tools';
    import Card from '../UI/Card.svelte';
    import { Popover } from '@skeletonlabs/skeleton-svelte';

    interface Props {
        job: TicketEvent;
    }

    let { job }: Props = $props();

    let paymentPopoverState = $state(false);

    const statusString = $derived(getJobStatusString(job.status));
    const statusColor = $derived(getJobStatusColor(job.status));

    let offers = $state<OfferEvent[]>([]);
    let winningOffer = $state<OfferEvent | undefined>();

    let freelancerName = $state('?');
    let freelancerPaid = $state(0);

    const pricing = $derived.by(() => {
        if (winningOffer) {
            switch (winningOffer.pricing) {
                case Pricing.Absolute:
                    return 'sats';
                case Pricing.SatsPerMin:
                    return 'sats/min';
            }
        }
        return '';
    });

    const freelancerPaymentStore = $derived.by(() => {
        if (!winningOffer) return undefined;
        const freelancerFilters = createPaymentFilters(winningOffer, 'freelancer');
        return createPaymentStore(freelancerFilters);
    });

    // Effect to fetch freelancer profile
    $effect(() => {
        if (!job.winnerFreelancer) return;

        const jobWinner = $ndk.getUser({ pubkey: job.winnerFreelancer });
        freelancerName = jobWinner.npub.substring(0, 8);

        jobWinner.fetchProfile().then((profile) => {
            if (profile?.name) {
                freelancerName = profile.name;
            }
        });
    });

    // Effect to fetch winning offer
    $effect(() => {
        if (!job.acceptedOfferAddress) return;

        $ndk.fetchEvent(job.acceptedOfferAddress, {
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        }).then((event) => {
            if (event) {
                winningOffer = OfferEvent.from(event);
            }
        });
    });

    $effect(() => {
        const unSubscribe = freelancerPaymentStore?.totalPaid.subscribe((value) => {
            freelancerPaid = value;
        });

        return () => {
            if (unSubscribe) unSubscribe();
        };
    });

    // Effect to fetch offers on mount
    $effect(() => {
        const fetchOffers = async () => {
            const offersFilter: NDKFilter = {
                kinds: [NDKKind.FreelanceOffer],
                '#a': [job.ticketAddress],
            };

            const events = await $ndk.fetchEvents(offersFilter, {
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            });

            offers = Array.from(events).map((event) => OfferEvent.from(event));
        };

        fetchOffers();
    });

    // Cleanup effect
    $effect(() => {
        return () => {
            freelancerPaymentStore?.paymentStore.empty();
        };
    });

    const boxWrapperClasses =
        'transition-all ease-in-out duration-[0.3s] flex flex-row gap-[5px] p-[5px_10px] ' +
        'rounded-[6px] bg-black-100 text-black-500 dark:bg-white-100 dark:text-white items-center ' +
        'outline outline-[2px] outline-[rgba(0,0,0,0.15)] text-[14px] grow w-full';
</script>

<div class="flex flex-col grow-1 gap-[10px] p-[0px]">
    <div class="w-full flex flex-row gap-[10px] flex-wrap">
        <div class={boxWrapperClasses}>
            <p class="font-[600]">Status:</p>
            <p class="line-clamp-1 overflow-hidden {statusColor}">{statusString}</p>
        </div>
        <div class={boxWrapperClasses}>
            <p class="font-[600]">{job.status === TicketStatus.New ? 'Pending ' : ''} Offers:</p>
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
                    <Popover
                        open={paymentPopoverState}
                        onOpenChange={(e) => (paymentPopoverState = e.open)}
                        positioning={{ placement: 'top' }}
                        triggerBase="btn preset-tonal"
                        contentBase="card bg-surface-200-800 p-4 space-y-4 max-w-[320px]"
                        arrow
                        arrowBackground="!bg-surface-200 dark:!bg-surface-800"
                    >
                        {#snippet trigger()}
                            <i
                                class="bx bx-question-mark bg-blue-500 text-white p-[3px] rounded-[50%]"
                            ></i>
                        {/snippet}
                        {#snippet content()}
                            <Card>
                                <p>Amount paid to freelancer / Amount promised for job</p>
                            </Card>
                        {/snippet}
                    </Popover>
                </p>

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
