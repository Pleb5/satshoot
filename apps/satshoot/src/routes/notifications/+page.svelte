<script lang="ts">
    import FollowNotification from '$lib/components/Notifications/FollowNotification.svelte';
    import JobNotification from '$lib/components/Notifications/JobNotification.svelte';
    import MessageNotification from '$lib/components/Notifications/MessageNotification.svelte';
    import OfferNotification from '$lib/components/Notifications/OfferNotification.svelte';
    import ReviewNotification from '$lib/components/Notifications/ReviewNotification.svelte';
    import ZapNotification from '$lib/components/Notifications/ZapNotification.svelte';
    import TabSelector from '$lib/components/UI/Buttons/TabSelector.svelte';
    import {
        followNotifications,
        messageNotifications,
        notificationsEnabled,
        offerNotifications,
        readNotifications,
        receivedZapsNotifications,
        reviewNotifications,
        jobNotifications,
    } from '$lib/stores/notifications';
    import currentUser from '$lib/stores/user';
    import { checkRelayConnections } from '$lib/utils/helpers';
    import { type ToastSettings, getToastStore } from '@skeletonlabs/skeleton';
    import { onMount } from 'svelte';

    enum Tab {
        Follows,
        Zaps,
        Jobs,
        Offers,
        Messages,
        Reviews,
    }

    const toastStore = getToastStore();

    let selectedTab = Tab.Follows;

    $: markNotificationsAsRead(selectedTab);

    function markNotificationsAsRead(tab: Tab) {
        switch (tab) {
            case Tab.Follows:
                readNotifications.update((notifications) => {
                    $followNotifications.forEach((notificationEvent) => {
                        notifications.add(notificationEvent.id);
                    });
                    return notifications;
                });
                break;
            case Tab.Zaps:
                readNotifications.update((notifications) => {
                    $receivedZapsNotifications.forEach((notificationEvent) => {
                        notifications.add(notificationEvent.id);
                    });
                    return notifications;
                });
                break;
            case Tab.Jobs:
                readNotifications.update((notifications) => {
                    $jobNotifications.forEach((notificationEvent) => {
                        notifications.add(notificationEvent.id);
                    });
                    return notifications;
                });
                break;
            case Tab.Offers:
                readNotifications.update((notifications) => {
                    $offerNotifications.forEach((notificationEvent) => {
                        notifications.add(notificationEvent.id);
                    });
                    return notifications;
                });
                break;
            case Tab.Messages:
                readNotifications.update((notifications) => {
                    $messageNotifications.forEach((notificationEvent) => {
                        notifications.add(notificationEvent.id);
                    });
                    return notifications;
                });
                break;
            case Tab.Reviews:
                readNotifications.update((notifications) => {
                    $reviewNotifications.forEach((notificationEvent) => {
                        notifications.add(notificationEvent.id);
                    });
                    return notifications;
                });
                break;
        }
    }

    $: if (!$notificationsEnabled) {
        const t: ToastSettings = {
            message: 'Notifications are Disabled!',
            timeout: 7000,
            background: 'bg-error-300-600-token',
        };
        toastStore.trigger(t);
    }

    onMount(() => checkRelayConnections());

    $: tabs = [
        {
            id: Tab.Follows,
            label: 'Follows',
            icon: 'user',
            notificationCount: $followNotifications.filter(
                (notification) => !$readNotifications.has(notification.id)
            ).length,
        },
        {
            id: Tab.Zaps,
            label: 'Zaps',
            icon: 'bolt',
            notificationCount: $receivedZapsNotifications.filter(
                (notification) => !$readNotifications.has(notification.id)
            ).length,
        },
        {
            id: Tab.Jobs,
            label: 'Jobs',
            icon: 'briefcase',
            notificationCount: $jobNotifications.filter(
                (notification) => !$readNotifications.has(notification.id)
            ).length,
        },
        {
            id: Tab.Offers,
            label: 'Offers',
            icon: 'file',
            notificationCount: $offerNotifications.filter(
                (notification) => !$readNotifications.has(notification.id)
            ).length,
        },
        {
            id: Tab.Messages,
            label: 'Messages',
            icon: 'conversation',
            notificationCount: $messageNotifications.filter(
                (notification) => !$readNotifications.has(notification.id)
            ).length,
        },
        {
            id: Tab.Reviews,
            label: 'Reviews',
            icon: 'star',
            notificationCount: $reviewNotifications.filter(
                (notification) => !$readNotifications.has(notification.id)
            ).length,
        },
    ];
</script>

{#if $currentUser}
    <div class="w-full flex flex-col gap-0 flex-grow">
        <div class="w-full h-full flex flex-col justify-center items-center py-[50px]">
            <div
                class="max-w-[1400px] w-full h-full flex flex-col justify-start items-end px-[10px] relative"
            >
                <div class="w-full h-full flex flex-col gap-[15px]">
                    <TabSelector {tabs} bind:selectedTab />
                    <div class="w-full flex flex-col flex-grow overflow-y-auto">
                        {#if selectedTab === Tab.Follows}
                            {#if $followNotifications.length > 0}
                                <div class="w-full flex flex-col gap-[10px]">
                                    {#each $followNotifications as followEvent (followEvent.id)}
                                        <FollowNotification {followEvent} />
                                    {/each}
                                </div>
                            {:else}
                                <div
                                    class="w-full min-h-[100px] rounded-[8px] bg-black-100 border-[4px] border-black-100 flex flex-col justify-center items-center"
                                >
                                    <p class="font-[600] text-[18px] text-black-300">
                                        No New Follower!
                                    </p>
                                </div>
                            {/if}
                        {:else if selectedTab === Tab.Zaps}
                            {#if $receivedZapsNotifications.length > 0}
                                <div class="w-full flex flex-col gap-[10px]">
                                    {#each $receivedZapsNotifications as zap (zap.id)}
                                        <ZapNotification zapEvent={zap} />
                                    {/each}
                                </div>
                            {:else}
                                <div
                                    class="w-full min-h-[100px] rounded-[8px] bg-black-100 border-[4px] border-black-100 flex flex-col justify-center items-center"
                                >
                                    <p class="font-[600] text-[18px] text-black-300">
                                        No New Zaps!
                                    </p>
                                </div>
                            {/if}
                        {:else if selectedTab === Tab.Jobs}
                            {#if $jobNotifications.length > 0}
                                <div class="w-full flex flex-col gap-[10px]">
                                    {#each $jobNotifications as job (job.id)}
                                        <JobNotification {job} />
                                    {/each}
                                </div>
                            {:else}
                                <div
                                    class="w-full min-h-[100px] rounded-[8px] bg-black-100 border-[4px] border-black-100 flex flex-col justify-center items-center"
                                >
                                    <p class="font-[600] text-[18px] text-black-300">
                                        No New Jobs!
                                    </p>
                                </div>
                            {/if}
                        {:else if selectedTab === Tab.Offers}
                            {#if $offerNotifications.length > 0}
                                <div class="w-full flex flex-col gap-[10px]">
                                    {#each $offerNotifications as offer (offer.id)}
                                        <OfferNotification {offer} />
                                    {/each}
                                </div>
                            {:else}
                                <div
                                    class="w-full min-h-[100px] rounded-[8px] bg-black-100 border-[4px] border-black-100 flex flex-col justify-center items-center"
                                >
                                    <p class="font-[600] text-[18px] text-black-300">
                                        No New Offers!
                                    </p>
                                </div>
                            {/if}
                        {:else if selectedTab === Tab.Messages}
                            {#if $messageNotifications.length > 0}
                                <div class="w-full flex flex-col gap-[10px]">
                                    {#each $messageNotifications as message (message.id)}
                                        <MessageNotification {message} />
                                    {/each}
                                </div>
                            {:else}
                                <div
                                    class="w-full min-h-[100px] rounded-[8px] bg-black-100 border-[4px] border-black-100 flex flex-col justify-center items-center"
                                >
                                    <p class="font-[600] text-[18px] text-black-300">
                                        No New Messages!
                                    </p>
                                </div>
                            {/if}
                        {:else if selectedTab === Tab.Reviews}
                            {#if $reviewNotifications.length > 0}
                                <div class="w-full flex flex-col gap-[10px]">
                                    {#each $reviewNotifications as review (review.id)}
                                        <ReviewNotification {review} />
                                    {/each}
                                </div>
                            {:else}
                                <div
                                    class="w-full min-h-[100px] rounded-[8px] bg-black-100 border-[4px] border-black-100 flex flex-col justify-center items-center"
                                >
                                    <p class="font-[600] text-[18px] text-black-300">
                                        No New Review!
                                    </p>
                                </div>
                            {/if}
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>
{:else}
    <h2 class="h2 text-center">No logged in User!</h2>
{/if}
