<script lang="ts">
    import { BidEvent } from '$lib/events/BidEvent';
    import { ReviewType, type ReviewEvent } from '$lib/events/ReviewEvent';
    import { JobEvent } from '$lib/events/JobEvent';
    import ndk from '$lib/stores/session';
    import { NDKKind, NDKSubscriptionCacheUsage, type NDKUserProfile } from '@nostr-dev-kit/ndk';
    import { onMount } from 'svelte';
    import ReviewModal from '../Notifications/ReviewModal.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Card from '../UI/Card.svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import NotificationTimestamp from './NotificationTimestamp.svelte';
    import { readNotifications } from '$lib/stores/notifications';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import { page } from '$app/state';
    import Fuse from 'fuse.js';
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import { OrderEvent } from '$lib/events/OrderEvent';

    interface Props {
        notification: ReviewEvent;
    }

    let { notification }: Props = $props();

    let searchQuery = $derived(page.url.searchParams.get('searchQuery'));

    let user = $state($ndk.getUser({ pubkey: notification.pubkey }));
    let userName = $state(user.npub.substring(0, 8));
    let userImage = $state(getRoboHashPicture(user.pubkey));

    let userProfile: NDKUserProfile | null;
    let jobOrService = $state<JobEvent | ServiceEvent>();
    let label = $state('');

    let showReviewModal = $state(false);

    onMount(async () => {
        userProfile = await user.fetchProfile();
        if (userProfile) {
            if (userProfile.name) {
                userName = userProfile.name;
            }
            if (userProfile.picture) {
                userImage = userProfile.picture;
            }
        }

        if (notification.reviewedEventAddress) {
            const reviewedEvent = await $ndk.fetchEvent(notification.reviewedEventAddress, {
                groupable: true,
                groupableDelay: 1000,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            });

            const reviewedEventKind = parseInt(notification.reviewedEventAddress.split(':')[0]);

            if (reviewedEvent) {
                if (reviewedEventKind === NDKKind.FreelanceService) {
                    jobOrService = ServiceEvent.from(reviewedEvent);
                    label = 'has reviewed service:';
                } else if (reviewedEventKind === NDKKind.FreelanceJob) {
                    jobOrService = JobEvent.from(reviewedEvent);
                    label = 'has reviewed job:';
                } else if (reviewedEventKind === NDKKind.FreelanceBid) {
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
                } else if (reviewedEventKind === NDKKind.FreelanceOrder) {
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
        <a href={'/' + user.npub}>
            <ProfileImage src={userImage} />
        </a>
        <div class="flex flex-col grow-1 items-start">
            <p>{userName}</p>
            <div class="flex flex-row gap-[5px] flex-wrap">
                <p>{label}</p>
                {#if jobOrService}
                    <a
                        href={'/' + jobOrService.encode() + '/'}
                        class="transition ease duration-[0.3s] font-[600] text-blue-500 hover:text-blue-600 hover:underline"
                    >
                        "{jobOrService.title}"
                    </a>
                {:else}
                    <div class="w-32 placeholder animate-pulse bg-blue-600"></div>
                {/if}
            </div>
        </div>
        <div class="flex flex-col gap-[5px] justify-end">
            <Button onClick={handlePreview}>Preview</Button>
        </div>
    </div>
</Card>

<ReviewModal bind:isOpen={showReviewModal} review={notification} />
