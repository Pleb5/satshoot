<script lang="ts">
    import { page } from '$app/stores';
    import { unReadNotifications } from '$lib/stores/notifications';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import SearchModal from '../Modals/SearchModal.svelte';
    import BottomNavItem from './BottomNavItem.svelte';

    export let hideFooter = false;

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

</script>

<div class="flex flex-col items-center min-h-[70px] h-full">
    {#if filterList.length > 0}
        <div
            class="p-[4px] bg-white dark:bg-brightGray rounded-[4px] shadow-subtle flex flex-row"
        >
            <p class="w-full text-[14px] font-[500] text-center text-black-500 dark:text-white-500">
                There's currently an active search on this page
            </p>
        </div>
    {/if}
    <div class="{hideFooter ? 'hidden' : ''} flex justify-center w-full h-full">
        <div
            class="w-full flex flex-row justify-between items-center gap-[5px] p-[5px] border-t border-gray-300 bg-white dark:bg-brightGray dark:border-t-white-100 relative"
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
            class="hidden min-h-[55px] flex flex-grow justify-center py-[5px] bg-black-50 dark:bg-brightGray-700 relative"
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
</div>
