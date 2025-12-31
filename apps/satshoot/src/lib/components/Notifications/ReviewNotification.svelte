<script lang="ts">
    import { BidEvent } from '$lib/events/BidEvent';
    import { JobEvent } from '$lib/events/JobEvent';
    import ndk from '$lib/stores/session';
    import { NDKSubscriptionCacheUsage, type NDKUserProfile } from '@nostr-dev-kit/ndk';
    import { onMount } from 'svelte';
    import ReviewModal from '../Notifications/ReviewModal.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Card from '../UI/Card.svelte';
    import NotificationTimestamp from './NotificationTimestamp.svelte';
    import { readNotifications } from '$lib/stores/notifications';
    import { page } from '$app/state';
    import Fuse from 'fuse.js';
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import { OrderEvent } from '$lib/events/OrderEvent';
    import { ExtendedNDKKind } from '$lib/types/ndkKind';
    import Avatar from '../Users/Avatar.svelte';
    import type { ReviewEvent } from '$lib/events/ReviewEvent';

    interface Props {
        notification: ReviewEvent;
    }

    let { notification }: Props = $props();

    let searchQuery = $derived(page.url.searchParams.get('searchQuery'));

    let user = $state($ndk.getUser({ pubkey: notification.pubkey }));
    let userProfile = $state<NDKUserProfile | null>()
    let userName = $derived(userProfile?.name ?? user.npub.substring(0, 8));

    let jobOrService = $state<JobEvent | ServiceEvent>();
    let label = $state('');

    let showReviewModal = $state(false);

    onMount(async () => {
        if (notification.reviewedEventAddress) {
            const reviewedEvent = await $ndk.fetchEvent(notification.reviewedEventAddress, {
                groupable: true,
                groupableDelay: 1000,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            });

            const reviewedEventKind = parseInt(notification.reviewedEventAddress.split(':')[0]);

            if (reviewedEvent) {
                if (reviewedEventKind === ExtendedNDKKind.FreelanceService) {
                    jobOrService = ServiceEvent.from(reviewedEvent);
                    label = 'has reviewed service:';
                } else if (reviewedEventKind === ExtendedNDKKind.FreelanceJob) {
                    jobOrService = JobEvent.from(reviewedEvent);
                    label = 'has reviewed job:';
                } else if (reviewedEventKind === ExtendedNDKKind.FreelanceBid) {
                    const bid = BidEvent.from(reviewedEvent);
                    const jobEvent = await $ndk.fetchEvent(bid.referencedJobAddress, {
                        groupable: true,
                        groupableDelay: 1000,
                        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                    });
                    if (jobEvent) {
                        jobOrService = JobEvent.from(jobEvent);
                        label = 'has reviewed a bid on job:';
                    }
                } else if (reviewedEventKind === ExtendedNDKKind.FreelanceOrder) {
                    const order = OrderEvent.from(reviewedEvent);
                    const serviceEvent = await $ndk.fetchEvent(order.referencedServiceAddress, {
                        groupable: true,
                        groupableDelay: 1000,
                        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                    });
                    if (serviceEvent) {
                        jobOrService = ServiceEvent.from(serviceEvent);
                        label = 'has reviewed an order on service:';
                    }
                }
            }
        }
    });

    function handlePreview() {
        showReviewModal = true;
    }

    const display = $derived.by(() => {
        if (searchQuery && searchQuery.length > 0) {
            const dataToSearch = [
                {
                    npub: user.npub,
                    name: userName,
                    job: jobOrService?.title,
                },
            ];

            const fuse = new Fuse(dataToSearch, {
                isCaseSensitive: false,
                ignoreLocation: true, // When true, search will ignore location and distance, so it won't matter where in the string the pattern appears
                threshold: 0.6,
                minMatchCharLength: 2, // Only the matches whose length exceeds this value will be returned
                keys: [
                    {
                        name: 'npub',
                        weight: 0.3,
                    },
                    {
                        name: 'name',
                        weight: 0.3,
                    },
                    {
                        name: 'job',
                        weight: 0.4,
                    },
                ],
            });
            const searchResult = fuse.search(searchQuery);
            return searchResult.length > 0;
        }

        return true;
    });

    const classes = $derived.by(() => {
        let classes = $readNotifications.has(notification.id) ? 'bg-black-50' : 'font-bold';
        if (!display) {
            classes += ' hidden';
        }

        return classes;
    });
</script>

<Card
    {classes}
    actAsButton
    onClick={() => {
        if (!$readNotifications.has(notification.id)) {
            readNotifications.update((notifications) => notifications.add(notification.id));
        }
    }}
>
    <NotificationTimestamp ndkEvent={notification} />
    <div class="w-full flex flex-row gap-[15px]">
        <a href={'/' + user.npub} class="shrink-0">
            <Avatar pubkey={notification.pubkey} bind:userProfile />
        </a>
        <div class="flex-1 min-w-0 flex flex-col items-start">
            <p class="truncate max-w-full">{userName}</p>
            <div class="flex flex-row gap-[5px] flex-wrap w-full">
                <p>{label}</p>
                {#if jobOrService}
                    <a
                        href={'/' + jobOrService.encode() + '/'}
                        class="transition ease duration-[0.3s] font-[600] link break-words"
                    >
                        "{jobOrService.title}"
                    </a>
                {:else}
                    <div class="w-32 placeholder animate-pulse bg-blue-600"></div>
                {/if}
            </div>
        </div>
        <div class="flex flex-col gap-[5px] justify-end shrink-0">
            <Button onClick={handlePreview}>Preview</Button>
        </div>
    </div>
</Card>

<ReviewModal bind:isOpen={showReviewModal} review={notification} />
