<script lang="ts">
    import { readNotifications } from '$lib/stores/notifications';
    import type { NDKEvent } from '@nostr-dev-kit/ndk';
    import SectionSeparator from './SectionSeparator.svelte';

    export let notifications: NDKEvent[];
    export let NotificationComponent: any;

    $: newNotifications = notifications.filter(
        (notification) => !$readNotifications.has(notification.id)
    );
    $: oldNotifications = notifications.filter((notification) =>
        $readNotifications.has(notification.id)
    );
</script>

{#if notifications.length > 0}
    {#if newNotifications.length > 0}
        <SectionSeparator label="Unread Notifications" />

        <div class="w-full flex flex-col gap-[10px]">
            {#each newNotifications as notification (notification.id)}
                <svelte:component this={NotificationComponent} {notification} />
            {/each}
        </div>
    {/if}

    {#if oldNotifications.length > 0}
        <SectionSeparator label="Read Notifications" />

        <div class="w-full flex flex-col gap-[10px]">
            {#each oldNotifications as notification (notification.id)}
                <svelte:component this={NotificationComponent} {notification} />
            {/each}
        </div>
    {/if}
{:else}
    <div
        class="w-full min-h-[100px] rounded-[8px] bg-black-100 border-[4px] border-black-100 flex flex-col justify-center items-center"
    >
        <p class="font-[600] text-[18px] text-black-300">No Notification Yet</p>
    </div>
{/if}
