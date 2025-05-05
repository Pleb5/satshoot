<script lang="ts">
    import { BidEvent } from '$lib/events/BidEvent';
    import { ReviewType, type ReviewEvent } from '$lib/events/ReviewEvent';
    import { JobEvent } from '$lib/events/JobEvent';
    import ndk from '$lib/stores/session';
    import { NDKSubscriptionCacheUsage, type NDKUserProfile } from '@nostr-dev-kit/ndk';
    import { onMount } from 'svelte';
    import ReviewModal from '../Notifications/ReviewModal.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Card from '../UI/Card.svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import NotificationTimestamp from './NotificationTimestamp.svelte';
    import { readNotifications } from '$lib/stores/notifications';
    import { getRoboHashPicture } from '$lib/utils/helpers';

    interface Props {
        notification: ReviewEvent;
    }

    let { notification }: Props = $props();

    let user = $ndk.getUser({ pubkey: notification.pubkey });
    let userName = $state(user.npub.substring(0, 8));
    let userImage = $state(getRoboHashPicture(user.pubkey));

    let userProfile: NDKUserProfile | null;
    let job = $state<JobEvent | null>();

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

            if (reviewedEvent) {
                if (notification.type === ReviewType.Client) {
                    job = JobEvent.from(reviewedEvent);
                } else {
                    const bid = BidEvent.from(reviewedEvent);
                    const jobEvent = await $ndk.fetchEvent(bid.referencedJobAddress, {
                        groupable: true,
                        groupableDelay: 1000,
                        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                    });
                    if (jobEvent) {
                        job = JobEvent.from(jobEvent);
                    }
                }
            }
        }
    });

    function handlePreview() {
        showReviewModal = true;
    }
</script>

<Card
    classes={$readNotifications.has(notification.id) ? 'bg-black-50' : 'font-bold'}
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
                <p>Has left a review for job:</p>
                {#if job}
                    <a
                        href={'/' + job.encode() + '/'}
                        class="transition ease duration-[0.3s] font-[600] text-blue-600 hover:text-blue-800 hover:underline"
                    >
                        "{job.title}"
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
