<script lang="ts">
    import { page } from '$app/stores';
    import { unReadNotifications } from '$lib/stores/notifications';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import SearchModal from '../Modals/SearchModal.svelte';
    import BottomNavItem from './BottomNavItem.svelte';

    const modalStore = getModalStore();

    $: searchQuery = $page.url.searchParams.get('searchTerms');
    $: filterList = searchQuery ? searchQuery.split(',') : [];

    function handleSearch() {
        modalStore.trigger({
            type: 'component',
            component: {
                ref: SearchModal,
            },
        });
    }

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
            icon: 'bx-search',
        },
        {
            href: '/notifications/',
            icon: 'bxs-bell',
        },
    ];

    const wrapperClasses =
        'transition-all ease-in-out duration-[0.0s] ' +
        'bg-gray-600 dark:bg-brightGray border-[2px] border-white dark:border-white-100 ' +
        'flex flex-row items-center gap-[10px] p-[5px] rounded-[10px] shadow-soft';

    const itemClasses =
        'transition ease-in-out duration-[0.3s] ' +
        'text-[22px] border-0 outline-none py-[10px] px-[15px] ' +
        'rounded-[5px] font-semibold transform scale-100 whitespace-nowrap flex flex-row ' +
        'justify-center items-center gap-[8px] hover:bg-blue-600 hover:text-white relative';
</script>

<div class="flex justify-center relative">
    {#if filterList.length > 0}
        <div
            class="p-[4px] bg-white dark:bg-brightGray rounded-[4px] shadow-subtle flex flex-row absolute top-[-25px]"
        >
            <p class="w-full text-[14px] font-[500] text-center text-black-500 dark:text-white-500">
                There's currently an active search on this page
            </p>
        </div>
    {/if}

    <div
        class="hidden w-full min-h-[7dvh] max-[576px]:flex flex-row justify-between items-center gap-[5px] p-[5px] border-t border-gray-300 bg-white dark:bg-brightGray dark:border-t-white-100 relative"
    >
        <div class="flex justify-center flex-grow">
            {#each items as { href, icon }}
                {#if icon === 'bx-search'}
                    <BottomNavItem
                        {href}
                        {icon}
                        isActive={filterList.length !== 0}
                        on:click={handleSearch}
                    />
                {:else}
                    <BottomNavItem {href} {icon} isActive={href === $page.url.pathname} />
                {/if}
            {/each}
        </div>
    </div>

    <div
        class="max-[576px]:hidden min-h-[7dvh]  flex flex-grow justify-center py-[5px] bg-black-50 dark:bg-brightGray-700 relative"
    >
        <div class="flex justify-center">
            <div class={wrapperClasses}>
                {#each items as { href, icon }}
                    {#if icon === 'bx-search'}
                        <BottomNavItem
                            {href}
                            {icon}
                            isActive={filterList.length !== 0}
                            on:click={handleSearch}
                        />
                    {:else}
                        <BottomNavItem {href} {icon} isActive={href === $page.url.pathname} />
                    {/if}
                {/each}
            </div>
        </div>
    </div>
</div>
