<script lang="ts">
    import { page } from '$app/state';
    import { Navigation } from '@skeletonlabs/skeleton-svelte';
    import BottomNavItem from './BottomNavItem.svelte';

    const items = [
        {
            href: '/jobs/',
            icon: 'bxs-briefcase',
        },
        {
            href: '/messages/',
            icon: 'bxs-conversation',
        },
        {
            href: '/notifications/',
            icon: 'bxs-bell',
        },
    ];
</script>

<Navigation.Rail
    classes="fixed left-0 top-[65px] hidden sm:block flex-none overflow-x-hidden overflow-y-auto"
    background="bg-white dark:bg-brightGray"
>
    {#snippet tiles()}
        <div class="flex flex-col items-center gap-y-4">
            {#each items as { href, icon }}
                <BottomNavItem {href} {icon} isActive={href === page.url.pathname} />
            {/each}
        </div>
    {/snippet}
</Navigation.Rail>
