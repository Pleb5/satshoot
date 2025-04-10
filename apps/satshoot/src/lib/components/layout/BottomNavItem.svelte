<script lang="ts">
    import { unReadNotifications } from '$lib/stores/notifications';
    import { createEventDispatcher } from 'svelte';
    import { Navigation } from '@skeletonlabs/skeleton-svelte';

    const dispatch = createEventDispatcher();

    interface Props {
        href?: string;
        icon: string;
        isActive?: boolean;
    }

    let { href, icon, isActive = false }: Props = $props();

    // Use a computed class for active state
    let activeClass = $derived(
        isActive ? 'bg-blue-500 text-white' : 'bg-blue-0 text-black-300 dark:text-white'
    );

    // Base classes for the nav item
    const baseClasses =
        'text-[16pt] sm:text-[20pt] border-0 outline-hidden py-[15px] px-[20px] rounded-[5px] font-semibold transform scale-100 whitespace-nowrap flex flex-row grow justify-center items-center gap-[8px] hover:bg-blue-600 hover:text-white relative';

    function handleClick() {
        dispatch('click');
    }
</script>

<Navigation.Tile {href} padding="" rounded="rounded-[5px]">
    <button class={`${baseClasses} ${activeClass}`} onclick={handleClick}>
        {#if href}
            <i class={`bx ${icon} relative`}>
                {#if href === '/notifications/' && $unReadNotifications.length > 0}
                    <span
                        class="absolute -top-3 -right-3 bg-[red] text-white font-bold rounded-full text-[11pt] min-w-[20px] h-[20px] p-[2px]"
                    >
                        {$unReadNotifications.length > 9 ? '9+' : $unReadNotifications.length}
                    </span>
                {/if}
            </i>
        {:else}
            <i class={`bx ${icon}`}></i>
        {/if}
    </button>
</Navigation.Tile>
