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
    import { page } from '$app/state';
    import Fuse from 'fuse.js';

    interface Props {
        notification: JobEvent | BidEvent;
    }

    let { notification }: Props = $props();

    let searchQuery = $derived(page.url.searchParams.get('searchQuery'));

    let user = $ndk.getUser({ pubkey: notification.pubkey });
    let userName = $state(user.npub.substring(0, 8));
    let userImage = $state(getRoboHashPicture(user.pubkey));
    let npub = $state(user.npub);

    let job = $state<JobEvent | null>(null);

    const userLink = $derived('/' + npub);
    const jobLink = $derived(job ? '/' + job.encode() + '/' : '/');

    const notificationMessage = $derived.by(() => {
        if (notification instanceof JobEvent && notification.status === JobStatus.New) {
            return {
                prefix: 'Has posted a new job:',
                title: notification.title,
                link: '/' + notification.encode() + '/',
            };
        } else if (job) {
            const isClient = job.pubkey === $currentUser?.pubkey;
            const bidEvent = notification as BidEvent;

            if (isClient && job.status === JobStatus.New) {
                return {
                    prefix: 'Has submitted a bid on the job:',
                    title: job.title,
                    link: jobLink,
                };
            }

            if (!isClient && job.status === JobStatus.InProgress) {
                if (job.acceptedBidAddress === bidEvent.bidAddress) {
                    return {
                        prefix: 'has Accepted your bid on the job:',
                        prefixClass: 'text-yellow-500',
                        title: job.title,
                        link: jobLink,
                    };
                } else if (job.acceptedBidAddress) {
                    return {
                        prefix: 'has Rejected your bid on the job:',
                        prefixClass: 'text-error-500',
                        title: job.title,
                        link: jobLink,
                    };
                }
            }

            if (job.isClosed()) {
                return {
                    prefix: 'has closed the job:',
                    title: job.title,
                    link: jobLink,
                };
            }
        }

        return null;
    });

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

    const display = $derived.by(() => {
        if (searchQuery && searchQuery.length > 0) {
            const dataToSearch = [
                {
                    npub: npub,
                    name: userName,
                    job: notificationMessage?.title,
                    prefix: notificationMessage?.prefix,
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
                        weight: 0.3,
                    },
                    {
                        name: 'prefix',
                        weight: 0.1,
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

<Card {classes} actAsButton onClick={markAsRead}>
    <NotificationTimestamp ndkEvent={notification} />
    <div class="w-full flex flex-row gap-[15px]">
        <a href={userLink}>
            <ProfileImage src={userImage} />
        </a>
        <div class="min-w-[50%] flex flex-col items-start overflow-hidden">
            <a href={userLink}>
                <p>{userName}</p>
            </a>

            {#if notificationMessage}
                <div class="flex flex-row gap-[5px] flex-wrap">
                    <p>
                        <span class={notificationMessage.prefixClass ?? ''}>
                            {notificationMessage.prefix}
                        </span>
                    </p>
                    <a
                        href={notificationMessage.link}
                        class="transition ease duration-[0.3s] font-[600] link"
                    >
                        "{notificationMessage.title}"
                    </a>
                </div>
            {:else}
                <div class="p-4 space-y-4 w-full">
                    <div class="placeholder animate-pulse"></div>
                </div>
            {/if}
        </div>
    </div>
</Card>
