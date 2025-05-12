<script lang="ts">
    import { OfferEvent } from '$lib/events/OfferEvent';
    import ndk from '$lib/stores/session';
    import {
        NDKKind,
        NDKSubscriptionCacheUsage,
        type NDKFilter,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';

    import { onMount } from 'svelte';

    import { TicketEvent } from '$lib/events/TicketEvent';
    import currentUser from '$lib/stores/user';
    import Card from '../UI/Card.svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import NotificationTimestamp from './NotificationTimestamp.svelte';
    import { readNotifications } from '$lib/stores/notifications';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';

    interface Props {
        notification: OfferEvent;
    }

    let { notification }: Props = $props();

    let user = $ndk.getUser({ pubkey: notification.pubkey });
    let userName = $state(user.npub.substring(0, 8));
    let userImage = $state(getRoboHashPicture(user.pubkey));

    let userProfile: NDKUserProfile | null;
    let job = $state<TicketEvent | null>(null);

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

        const dTagOfJob = notification.referencedTicketAddress.split(':')[2];
        const jobFilter: NDKFilter<NDKKind.FreelanceTicket> = {
            kinds: [NDKKind.FreelanceTicket],
            '#d': [dTagOfJob],
        };

        const jobEvent = await $ndk.fetchEvent(jobFilter, {
            groupable: true,
            groupableDelay: 1000,
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });

        if (jobEvent) {
            job = TicketEvent.from(jobEvent);
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
                        {#if job.acceptedOfferAddress === notification.offerAddress}
                            <p>
                                You have <span class="text-warning-500">Won</span> the offer on the job:
                            </p>
                        {:else if job.acceptedOfferAddress || job.isClosed()}
                            <p>
                                You have <span class="text-error-500">Lost</span> the offer on the job:
                            </p>
                        {/if}
                    {:else}
                        <p>Has submitted an offer on the job:</p>
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
