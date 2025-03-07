<script lang="ts">
    import { page } from '$app/stores';
    import { getModalStore, TabGroup } from '@skeletonlabs/skeleton';
    import SearchModal from '../Modals/SearchModal.svelte';
    import BottomNavItem from './BottomNavItem.svelte';

    export let hideFooter = false

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

</script>

<TabGroup
    class="sm:hidden {hideFooter ? 'hidden' : ''}"
>
    <div class="flex flex-col items-center max-sm:w-full">
        {#if filterList.length > 0}
            <div
                class="p-[4px] bg-white dark:bg-brightGray rounded-[4px] shadow-subtle flex flex-row"
            >
                <p class="w-full text-[14px] font-[500] text-center text-black-500 dark:text-white">
                    There's currently an active search on this page
                </p>
            </div>
        {/if}
        <div
            class="w-full flex justify-center items-center gap-[5px] p-1 border-t border-gray-300 bg-white dark:bg-brightGray dark:border-t-white-100 relative rounded-tr-[10px] rounded-tl-[10px]"
        >
            <div class="flex justify-center gap-x-2">
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
</TabGroup>
