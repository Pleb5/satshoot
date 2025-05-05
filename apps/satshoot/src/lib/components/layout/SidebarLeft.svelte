<script lang="ts">
    import { page } from '$app/state';
    import { Navigation } from '@skeletonlabs/skeleton-svelte';
    import BottomNavItem from './BottomNavItem.svelte';
    import { UserMode, userMode } from '$lib/stores/user';

    const items = $derived([
        $userMode === UserMode.Client
            ? {
                  href: '/services/',
                  icon: 'fa-solid fa-laptop-code',
              }
            : {
                  href: '/jobs/',
                  icon: 'bx bxs-briefcase',
              },
        {
            href: '/messages/',
            icon: 'bx bxs-conversation',
        },
        {
            href: '/notifications/',
            icon: 'bx bxs-bell',
        },
    ]);
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
