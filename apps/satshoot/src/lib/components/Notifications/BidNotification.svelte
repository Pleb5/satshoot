<script lang="ts">
    import { BidEvent } from '$lib/events/BidEvent';
    import ndk from '$lib/stores/session';
    import {
        NDKKind,
        NDKSubscriptionCacheUsage,
        type NDKFilter,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';

    import { onMount } from 'svelte';

    import { JobEvent } from '$lib/events/JobEvent';
    import currentUser from '$lib/stores/user';
    import Card from '../UI/Card.svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import NotificationTimestamp from './NotificationTimestamp.svelte';
    import { readNotifications } from '$lib/stores/notifications';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';

    interface Props {
        notification: BidEvent;
    }

    let { notification }: Props = $props();

    let user = $ndk.getUser({ pubkey: notification.pubkey });
    let userName = $state(user.npub.substring(0, 8));
    let userImage = $state(getRoboHashPicture(user.pubkey));

    let userProfile: NDKUserProfile | null;
    let job = $state<JobEvent | null>(null);

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

        const dTagOfJob = notification.referencedJobAddress.split(':')[2];
        const jobFilter: NDKFilter<NDKKind.FreelanceJob> = {
            kinds: [NDKKind.FreelanceJob],
            '#d': [dTagOfJob],
        };

        const jobEvent = await $ndk.fetchEvent(jobFilter, {
            groupable: true,
            groupableDelay: 1000,
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });

        if (jobEvent) {
            job = JobEvent.from(jobEvent);
        }
    });
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
    {#if job}
        <div class="w-full flex flex-row gap-[15px]">
            <a href={'/' + user.npub}>
                <ProfileImage src={userImage} />
            </a>
            <div class="flex flex-col items-start">
                <p>{userName}</p>
                <div class="flex flex-row gap-[5px] flex-wrap">
                    {#if notification.pubkey === $currentUser?.pubkey}
                        {#if job.acceptedBidAddress === notification.bidAddress}
                            <p>
                                You have <span class="text-warning-500">Won</span> the bid on the job:
                            </p>
                        {:else if job.acceptedBidAddress || job.isClosed()}
                            <p>
                                You have <span class="text-error-500">Lost</span> the bid on the job:
                            </p>
                        {/if}
                    {:else}
                        <p>Has submitted an bid on the job:</p>
                    {/if}

                    <a
                        href={'/' + job.encode() + '/'}
                        class="transition ease duration-[0.3s] font-[600] text-blue-600 hover:text-blue-800 hover:underline"
                    >
                        "{job.title}"
                    </a>
                </div>
            </div>
        </div>
    {:else}
        <ProgressRing color="primary" />
    {/if}
</Card>
