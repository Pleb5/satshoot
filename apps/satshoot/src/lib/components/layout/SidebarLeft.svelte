<script lang="ts">
    import { page } from "$app/stores";
    import { AppRail, getModalStore } from "@skeletonlabs/skeleton";
    import SearchModal from "../Modals/SearchModal.svelte";
    import BottomNavItem from "./BottomNavItem.svelte";


    export let hideSidebarLeft = true

    $: hideMyself = hideSidebarLeft ? 'hidden' : ''

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

<AppRail
    class="{hideMyself} max-sm:hidden min-sm:block w-24 pt-2"
    background="bg-surface-100-800-token"
>
    <div class="flex flex-col items-center gap-y-4">
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
</AppRail>
