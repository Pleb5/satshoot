<script lang="ts">
    import { page } from '$app/state';
    import { UserMode, userMode } from '$lib/stores/user';
    import BottomNavItem from './BottomNavItem.svelte';

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

<div class="flex flex-col items-center max-sm:w-full">
    <div
        class="w-full flex justify-center items-center gap-[5px] p-1 border-t border-gray-300 bg-white dark:bg-brightGray dark:border-t-white-100 relative rounded-tr-[10px] rounded-tl-[10px]"
    >
        <div class="flex justify-center gap-x-2">
            {#each items as { href, icon }}
                <BottomNavItem {href} {icon} isActive={href === page.url.pathname} />
            {/each}
        </div>
    </div>
</div>
