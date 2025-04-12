<script lang="ts">
    import { page } from '$app/state';
    import { Modal, Navigation } from '@skeletonlabs/skeleton-svelte';

    import SearchModal from '../Modals/SearchModal.svelte';
    import BottomNavItem from './BottomNavItem.svelte';

    let isSearchModalOpened = $state(false);

    let searchQuery = $derived(page.url.searchParams.get('searchTerms'));
    let filterList = $derived(searchQuery ? searchQuery.split(',') : []);

    function handleSearch() {
        isSearchModalOpened = true;
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

<Navigation.Rail
    classes="hidden sm:block flex-none overflow-x-hidden overflow-y-auto"
    background="bg-white dark:bg-brightGray"
>
    {#snippet tiles()}
        <div class="flex flex-col items-center gap-y-4">
            {#each items as { href, icon }}
                {#if icon === 'bx-search'}
                    <BottomNavItem
                        {href}
                        {icon}
                        isActive={filterList.length !== 0}
                        onClick={handleSearch}
                    />
                {:else}
                    <BottomNavItem {href} {icon} isActive={href === page.url.pathname} />
                {/if}
            {/each}
        </div>
    {/snippet}
</Navigation.Rail>

<Modal open={isSearchModalOpened} closeOnInteractOutside={false} closeOnEscape={false}>
    {#snippet content()}
        <SearchModal />
    {/snippet}
</Modal>
