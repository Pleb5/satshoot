<script lang="ts">
    import FollowNotification from '$lib/components/Notifications/FollowNotification.svelte';
    import JobNotification from '$lib/components/Notifications/JobNotification.svelte';
    import MessageNotification from '$lib/components/Notifications/MessageNotification.svelte';
    import NotificationsList from '$lib/components/Notifications/NotificationsList.svelte';
    import ReviewNotification from '$lib/components/Notifications/ReviewNotification.svelte';
    import ZapNotification from '$lib/components/Notifications/ZapNotification.svelte';
    import TabSelector from '$lib/components/UI/Buttons/TabSelector.svelte';
    import {
        followNotifications,
        messageNotifications,
        browserNotificationsEnabled,
        readNotifications,
        receivedZapsNotifications,
        reviewNotifications,
        jobNotifications,
        serviceNotifications,
    } from '$lib/stores/notifications';
    import currentUser, { UserMode, userMode } from '$lib/stores/user';
    import { checkRelayConnections } from '$lib/utils/helpers';
    import { onMount } from 'svelte';
    import ServiceNotification from '$lib/components/Notifications/ServiceNotification.svelte';
    import { selectedNotificationTab, NotificationTabs } from '$lib/stores/gui';

    let previousTab = $state<NotificationTabs | null>(null);

    $effect(() => {
        if (previousTab !== null && previousTab !== $selectedNotificationTab) {
            markNotificationsAsRead(previousTab);
        }
        previousTab = $selectedNotificationTab;
    });

    function markNotificationsAsRead(tab: NotificationTabs) {
        switch (tab) {
            case NotificationTabs.Follows:
                readNotifications.update((notifications) => {
                    $followNotifications.forEach((notificationEvent) => {
                        notifications.add(notificationEvent.id);
                    });
                    return notifications;
                });
                break;
            case NotificationTabs.Zaps:
                readNotifications.update((notifications) => {
                    $receivedZapsNotifications.forEach((notificationEvent) => {
                        notifications.add(notificationEvent.id);
                    });
                    return notifications;
                });
                break;
            case NotificationTabs.Jobs:
                readNotifications.update((notifications) => {
                    $jobNotifications.forEach((notificationEvent) => {
                        notifications.add(notificationEvent.id);
                    });
                    return notifications;
                });
                break;
            case NotificationTabs.Services:
                readNotifications.update((notifications) => {
                    $serviceNotifications.forEach((notificationEvent) => {
                        notifications.add(notificationEvent.id);
                    });
                    return notifications;
                });
                break;
            case NotificationTabs.Messages:
                readNotifications.update((notifications) => {
                    $messageNotifications.forEach((notificationEvent) => {
                        notifications.add(notificationEvent.id);
                    });
                    return notifications;
                });
                break;
            case NotificationTabs.Reviews:
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
            id: NotificationTabs.Follows,
            label: 'Follows',
            icon: 'user',
            notificationCount: $followNotifications.filter(
                (notification) => !$readNotifications.has(notification.id)
            ).length,
        },
        {
            id: NotificationTabs.Zaps,
            label: 'Zaps',
            icon: 'bolt',
            notificationCount: $receivedZapsNotifications.filter(
                (notification) => !$readNotifications.has(notification.id)
            ).length,
        },
        {
            id: NotificationTabs.Jobs,
            label: 'Jobs',
            icon: 'briefcase',
            notificationCount: $jobNotifications.filter(
                (notification) => !$readNotifications.has(notification.id)
            ).length,
        },
        {
            id: NotificationTabs.Services,
            label: 'Services',
            icon: 'briefcase',
            notificationCount: $serviceNotifications.filter(
                (notification) => !$readNotifications.has(notification.id)
            ).length,
        },
        {
            id: NotificationTabs.Messages,
            label: 'Messages',
            icon: 'conversation',
            notificationCount: $messageNotifications.filter(
                (notification) => !$readNotifications.has(notification.id)
            ).length,
        },
        {
            id: NotificationTabs.Reviews,
            label: 'Reviews',
            icon: 'star',
            notificationCount: $reviewNotifications.filter(
                (notification) => !$readNotifications.has(notification.id)
            ).length,
        },
    ]);
</script>

{#if $currentUser}
    <div class="w-full flex flex-col gap-0 grow">
        <div class="w-full h-full flex flex-col justify-center items-center py-4">
            <div
                class="max-w-[1400px] w-full h-full flex flex-col justify-start items-end px-[10px] relative"
            >
                <div class="w-full h-full flex flex-col gap-[15px]">
                    <TabSelector {tabs} bind:selectedTab={$selectedNotificationTab} />
                    <div class="w-full flex flex-col grow overflow-y-auto">
                        {#if $selectedNotificationTab === NotificationTabs.Follows}
                            <NotificationsList
                                notifications={$followNotifications}
                                NotificationComponent={FollowNotification}
                            />
                        {:else if $selectedNotificationTab === NotificationTabs.Zaps}
                            <NotificationsList
                                notifications={$receivedZapsNotifications}
                                NotificationComponent={ZapNotification}
                            />
                        {:else if $selectedNotificationTab === NotificationTabs.Jobs}
                            <NotificationsList
                                notifications={$jobNotifications}
                                NotificationComponent={JobNotification}
                            />
                        {:else if $selectedNotificationTab === NotificationTabs.Services}
                            <NotificationsList
                                notifications={$serviceNotifications}
                                NotificationComponent={ServiceNotification}
                            />
                        {:else if $selectedNotificationTab === NotificationTabs.Messages}
                            <NotificationsList
                                notifications={$messageNotifications}
                                NotificationComponent={MessageNotification}
                            />
                        {:else if $selectedNotificationTab === NotificationTabs.Reviews}
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
