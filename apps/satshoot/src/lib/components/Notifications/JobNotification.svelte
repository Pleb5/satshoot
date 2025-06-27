<script lang="ts">
    import ndk from '$lib/stores/session';
    import { NDKKind, NDKSubscriptionCacheUsage, type NDKFilter } from '@nostr-dev-kit/ndk';

    import { onMount } from 'svelte';

    import { JobEvent, JobStatus } from '$lib/events/JobEvent';
    import Card from '../UI/Card.svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import NotificationTimestamp from './NotificationTimestamp.svelte';
    import { readNotifications } from '$lib/stores/notifications';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import { BidEvent } from '$lib/events/BidEvent';
    import currentUser from '$lib/stores/user';

    interface Props {
        notification: JobEvent | BidEvent;
    }

    let { notification }: Props = $props();

    let user = $ndk.getUser({ pubkey: notification.pubkey });
    let userName = $state(user.npub.substring(0, 8));
    let userImage = $state(getRoboHashPicture(user.pubkey));
    let npub = $state(user.npub);

    let job = $state<JobEvent | null>(null);

    const loadUserProfile = async (userToLoad = user) => {
        const userProfile = await userToLoad.fetchProfile();
        if (userProfile) {
            if (userProfile.name) userName = userProfile.name;
            if (userProfile.picture) userImage = userProfile.picture;
        }
    };

    const loadJobDetails = async () => {
        if (!(notification instanceof BidEvent)) return;

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

        if (!jobEvent) return;

        job = JobEvent.from(jobEvent);

        if (job.status !== JobStatus.New) {
            const clientUser = $ndk.getUser({ pubkey: job.pubkey });
            userName = clientUser.npub.substring(0, 8);
            userImage = getRoboHashPicture(clientUser.pubkey);
            npub = clientUser.npub;
            await loadUserProfile(clientUser);
        }
    };

    onMount(async () => {
        await Promise.all([loadUserProfile(), loadJobDetails()]);
    });

    const markAsRead = () => {
        if (!$readNotifications.has(notification.id)) {
            readNotifications.update((notifications) => notifications.add(notification.id));
        }
    };
</script>

<Card
    classes={$readNotifications.has(notification.id) ? 'bg-black-50' : 'font-bold'}
    actAsButton
    onClick={markAsRead}
>
    <NotificationTimestamp ndkEvent={notification} />
    <div class="w-full flex flex-row gap-[15px]">
        <a href={'/' + npub}>
            <ProfileImage src={userImage} />
        </a>
        <div class="min-w-[50%] flex flex-col items-start overflow-hidden">
            <a href={'/' + npub}>
                <p>{userName}</p>
            </a>

            {#if notification instanceof JobEvent && notification.status === JobStatus.New}
                <div class="flex flex-row gap-[5px] flex-wrap">
                    <p>Has posted a new job:</p>
                    <a
                        href={'/' + notification.encode() + '/'}
                        class="transition ease duration-[0.3s] font-[600] text-blue-600 hover:text-blue-800 hover:underline"
                    >
                        "{notification.title}"
                    </a>
                </div>
            {:else if job}
                <div class="flex flex-col gap-[5px]">
                    <div class="flex flex-row gap-[5px] flex-wrap">
                        {#if job.pubkey === $currentUser?.pubkey}
                            {#if job.status === JobStatus.New}
                                <p>Has submitted a bid on the job:</p>
                            {/if}
                        {:else if job.status === JobStatus.InProgress}
                            {#if job.acceptedBidAddress === (notification as BidEvent).bidAddress}
                                <p>
                                    has <span class="text-warning-500">Accepted</span> your bid on the
                                    job:
                                </p>
                            {:else if job.acceptedBidAddress}
                                <p>
                                    has <span class="text-error-500">Rejected</span> your bid on the
                                    job:
                                </p>
                            {/if}
                        {:else if job.isClosed()}
                            <p>has closed the job:</p>
                        {/if}

                        <a
                            href={'/' + job.encode() + '/'}
                            class="transition ease duration-[0.3s] font-[600] text-blue-600 hover:text-blue-800 hover:underline"
                        >
                            "{job.title}"
                        </a>
                    </div>
                </div>
            {:else}
                <div class="p-4 space-y-4 w-full">
                    <div class="placeholder animate-pulse"></div>
                </div>
            {/if}
        </div>
    </div>
</Card>
