<script lang="ts">
    import { page } from '$app/stores';
    import { unReadNotifications } from '$lib/stores/notifications';
    import { createEventDispatcher } from 'svelte';
    import Button from '../UI/Buttons/Button.svelte';

    const dispatch = createEventDispatcher();

    export let href: string | undefined;
    export let icon: string;
    export let isActive = false;

    // Use a computed class for active state
    $: activeClass = isActive
        ? 'bg-blue-500 text-white'
        : 'bg-blue-0 text-black-300 dark:text-white-400';

    // Base classes for the nav item
    const baseClasses =
        'transition ease-in-out duration-[0.3s] text-[22px] border-0 outline-none py-[10px] px-[15px] rounded-[5px] font-semibold transform scale-100 whitespace-nowrap flex flex-row flex-grow justify-center items-center gap-[8px] hover:bg-blue-600 hover:text-white relative';

    function handleClick() {
        dispatch('click');
    }
</script>

{#if href}
    <a class={`${baseClasses} ${activeClass}`} {href}>
        <i class={`bx ${icon}`} />

        {#if href === '/notifications/' && $unReadNotifications.length > 0}
            <span
                class="absolute top-0 right-0 max-[576px]:right-[20px] bg-[red] text-white rounded-full text-[12px] min-w-[20px] h-[20px] flex items-center justify-center p-[2px]"
            >
                {$unReadNotifications.length > 9 ? '9+' : $unReadNotifications.length}
            </span>
        {/if}
    </a>
{:else}
    <button class={`${baseClasses} ${activeClass}`} on:click={handleClick}>
        <i class={`bx ${icon}`} />
    </button>
{/if}
