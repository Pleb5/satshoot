<script lang="ts">
    import { run } from 'svelte/legacy';

    import FollowNotification from '$lib/components/Notifications/FollowNotification.svelte';
    import JobNotification from '$lib/components/Notifications/JobNotification.svelte';
    import MessageNotification from '$lib/components/Notifications/MessageNotification.svelte';
    import NotificationsList from '$lib/components/Notifications/NotificationsList.svelte';
    import OfferNotification from '$lib/components/Notifications/OfferNotification.svelte';
    import ReviewNotification from '$lib/components/Notifications/ReviewNotification.svelte';
    import ZapNotification from '$lib/components/Notifications/ZapNotification.svelte';
    import TabSelector from '$lib/components/UI/Buttons/TabSelector.svelte';
    import {
        followNotifications,
        messageNotifications,
        browserNotificationsEnabled,
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

    let selectedTab = $state(Tab.Follows);
    let previousTab = $state<Tab | null>(null);

    $effect(() => {
        if (previousTab !== null && previousTab !== selectedTab) {
            markNotificationsAsRead(previousTab);
        }
        previousTab = selectedTab;
    });

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

    onMount(() => checkRelayConnections());

    let tabs = $derived([
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
    ]);
</script>

{#if $currentUser}
    <div class="w-full flex flex-col gap-0 flex-grow">
        <div class="w-full h-full flex flex-col justify-center items-center py-4">
            <div
                class="max-w-[1400px] w-full h-full flex flex-col justify-start items-end px-[10px] relative"
            >
                <div class="w-full h-full flex flex-col gap-[15px]">
                    <TabSelector {tabs} bind:selectedTab />
                    <div class="w-full flex flex-col flex-grow overflow-y-auto">
                        {#if selectedTab === Tab.Follows}
                            <NotificationsList
                                notifications={$followNotifications}
                                NotificationComponent={FollowNotification}
                            />
                        {:else if selectedTab === Tab.Zaps}
                            <NotificationsList
                                notifications={$receivedZapsNotifications}
                                NotificationComponent={ZapNotification}
                            />
                        {:else if selectedTab === Tab.Jobs}
                            <NotificationsList
                                notifications={$jobNotifications}
                                NotificationComponent={JobNotification}
                            />
                        {:else if selectedTab === Tab.Offers}
                            <NotificationsList
                                notifications={$offerNotifications}
                                NotificationComponent={OfferNotification}
                            />
                        {:else if selectedTab === Tab.Messages}
                            <NotificationsList
                                notifications={$messageNotifications}
                                NotificationComponent={MessageNotification}
                            />
                        {:else if selectedTab === Tab.Reviews}
                            <NotificationsList
                                notifications={$reviewNotifications}
                                NotificationComponent={ReviewNotification}
                            />
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    </div>
{:else}
    <h2 class="h2 text-center">No logged in User!</h2>
{/if}
