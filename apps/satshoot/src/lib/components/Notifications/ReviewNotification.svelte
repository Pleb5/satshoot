<script lang="ts">
    import { OfferEvent } from '$lib/events/OfferEvent';
    import { ReviewType, type ReviewEvent } from '$lib/events/ReviewEvent';
    import { TicketEvent } from '$lib/events/TicketEvent';
    import ndk from '$lib/stores/ndk';
    import { NDKSubscriptionCacheUsage, type NDKUserProfile } from '@nostr-dev-kit/ndk';
    import { getModalStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
    import { formatDate, formatDistanceToNow } from 'date-fns';
    import { onMount } from 'svelte';
    import ReviewModal from '../Notifications/ReviewModal.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Card from '../UI/Card.svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import NotificationTimestamp from './NotificationTimestamp.svelte';

    const modalStore = getModalStore();

    export let review: ReviewEvent;

    $: user = $ndk.getUser({ pubkey: review.pubkey });
    $: userName = user.npub.substring(0, 8);
    $: userImage = `https://robohash.org/${user.pubkey}`;

    let userProfile: NDKUserProfile | null;
    let job: TicketEvent | null;

    onMount(async () => {
        userProfile = await user.fetchProfile();
        if (userProfile) {
            if (userProfile.name) {
                userName = userProfile.name;
            }
            if (userProfile.image) {
                userImage = userProfile.image;
            }
        }

        if (review.reviewedEventAddress) {
            const reviewedEvent = await $ndk.fetchEvent(review.reviewedEventAddress, {
                groupable: true,
                groupableDelay: 1000,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            });

            if (reviewedEvent) {
                if (review.type === ReviewType.Client) {
                    job = TicketEvent.from(reviewedEvent);
                } else {
                    const offer = OfferEvent.from(reviewedEvent);
                    const jobEvent = await $ndk.fetchEvent(offer.referencedTicketAddress, {
                        groupable: true,
                        groupableDelay: 1000,
                        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                    });
                    if (jobEvent) {
                        job = TicketEvent.from(jobEvent);
                    }
                }
            }
        }
    });

    function handlePreview() {
        const modalComponent: ModalComponent = {
            ref: ReviewModal,
            props: { review },
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.trigger(modal);
    }
</script>

<Card>
    <NotificationTimestamp ndkEvent={review} />
    <div class="w-full flex flex-row gap-[15px]">
        <a href={'/' + user.npub}>
            <ProfileImage src={userImage} />
        </a>
        <div class="flex flex-col">
            <a href={'/' + user.npub}>
                <p>{userName}</p>
            </a>
            <div class="flex flex-row gap-[5px] flex-wrap">
                <p>Has left a review for job:</p>
                {#if job}
                    <a
                        href={'/' + job.encode() + '/'}
                        class="transition ease duration-[0.3s] font-[600] hover:text-blue-500"
                    >
                        "{job.title}"
                    </a>
                {/if}
            </div>
        </div>
        <div class="flex flex-col gap-[5px] justify-end">
            <Button on:click={handlePreview}>Preview</Button>
        </div>
    </div>
</Card>
