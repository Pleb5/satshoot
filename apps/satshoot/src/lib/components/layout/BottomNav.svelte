<script lang="ts">
    import currentUser from '$lib/stores/user';
    import { getModalStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
    import SearchModal from '../Modals/SearchModal.svelte';
    import { page } from '$app/stores';
    import Button from '../UI/Buttons/Button.svelte';
    import { unReadNotifications } from '$lib/stores/notifications';

    const modalStore = getModalStore();

    $: searchQuery = $page.url.searchParams.get('searchTerms');
    $: filterList = searchQuery ? searchQuery.split(',') : [];

    let isCollapsed = true;

    const toggleCollapse = () => {
        isCollapsed = !isCollapsed;
    };

    let items: { href?: string; icon: string }[] = [];

    $: {
        items = [
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
            {
                href: '/settings/',
                icon: 'bxs-cog',
            },
        ];

        if ($currentUser) {
            items.push({
                href: '/' + $currentUser.npub + '/',
                icon: 'bxs-user',
            });
        }
    }

    function handleSearch() {
        const modalComponent: ModalComponent = {
            ref: SearchModal,
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };

        modalStore.trigger(modal);
    }

    const collapseWrapperClasses =
        'transition-all ease-in-out duration-[0.4s] w-auto fixed bottom-0 ' +
        'transform self-center max-w-[500px] ' +
        'flex flex-row justify-center items-center gap-[8px] z-5 ' +
        'min-h-[50px] max-[576px]:w-full max-[576px]:right-0 max-[576px]:left-0 ' +
        'max-[576px]:translate-x-0 max-[576px]:max-w-none max-[576px]:justify-end';

    const collapseBoxClass =
        'transition-all ease-in-out duration-[0.0s] ' +
        'bg-gray-600 rounded-[10px] shadow-soft ' +
        'flex flex-row border-white dark:bg-brightGray dark:border-white-100';

    const itemClasses =
        'transition ease-in-out duration-[0.3s] ' +
        'text-[24px] border-0 outline-none py-[10px] px-[15px] ' +
        'rounded-[5px] font-semibold transform scale-100 whitespace-nowrap flex flex-row ' +
        'justify-center items-center gap-[8px] hover:bg-blue-600 hover:text-white relative';

    const collapseTriggerBtnClasses =
        'bg-white text-black-300 shadow-subtle ' +
        'hover:bg-white hover:text-black-700 py-[15px] px-[5px] ' +
        'dark:bg-brightGray dark:hover:bg-brightGray dark:text-white-500 dark:hover:text-white-700 dark:border-[2px] dark:border-white-100';

    // Helper function to check if the current path is under /settings/
    function isSettingsPath(path: string): boolean {
        return path.startsWith('/settings/');
    }

    // Helper function to determine if the link is active
    function isActive(href: string, currentPath: string) {
        return href === currentPath || (href === '/settings/' && isSettingsPath(currentPath));
    }

    // $: linkClasses = `
    //     ${itemClasses}
    //     ${isActive(href, $page.url.pathname) ? 'bg-blue-500 text-white dark:text-white-400' : 'bg-blue-0 text-black-300 dark:text-gray-500'}
    // `;
</script>

<div
    id="btnBotNavCollapseWrapper"
    class={collapseWrapperClasses +
        ` ${isCollapsed ? 'right-1/2 translate-x-1/2' : 'right-0 translate-x-0'}`}
>
    <div class="w-full flex flex-col gap-[5px] pl-[35px]">
        {#if filterList.length > 0}
            <div
                id="btnBotNavCollapseBoxSearch"
                class="p-[4px] bg-white dark:bg-brightGray rounded-[4px] shadow-subtle flex flex-row"
            >
                <p
                    class="w-full text-[14px] font-[500] text-center text-black-500 dark:text-white-500"
                >
                    There's currently an active search on this page
                </p>
            </div>
        {/if}

        <div
            id="btnBotNavCollapseBox"
            class={collapseBoxClass}
            class:w-auto={isCollapsed}
            class:w-[0px]={!isCollapsed}
            class:p-[6px]={isCollapsed}
            class:p-[0px]={!isCollapsed}
            class:overflow-auto={isCollapsed}
            class:overflow-hidden={!isCollapsed}
            class:border-0={!isCollapsed}
            class:border-4={isCollapsed}
            class:gap-[6px]={isCollapsed}
            class:gap-[0px]={!isCollapsed}
            class:max-[576px]:w-full={isCollapsed}
            class:max-[576px]:0={!isCollapsed}
        >
            {#each items as { href, icon }}
                {#if href}
                    <a
                        {href}
                        class="{itemClasses} {isActive(href, $page.url.pathname)
                            ? 'bg-blue-500 text-white'
                            : 'bg-blue-0 text-black-300 dark:text-white-400'}"
                    >
                        <i class={`bx ${icon}`} />
                        {#if href === '/notifications/' && $unReadNotifications.length > 0}
                            <span
                                class="absolute top-0 right-0 bg-[red] text-white rounded-full text-[12px] min-w-[20px] h-[20px] flex items-center justify-center p-[2px]"
                            >
                                {$unReadNotifications.length > 9
                                    ? '9+'
                                    : $unReadNotifications.length}
                            </span>
                        {/if}
                    </a>
                {:else if icon === 'bx-search'}
                    <button
                        class="{itemClasses} {filterList.length !== 0
                            ? 'bg-blue-500 text-white '
                            : 'bg-blue-0 text-black-300 dark:text-white-400'}"
                        on:click={handleSearch}
                    >
                        <i class="bx bx-search"></i></button
                    >
                {/if}
            {/each}
        </div>
    </div>
    <Button classes={collapseTriggerBtnClasses} on:click={toggleCollapse}>
        <i
            id="btnBotNavCollapseDirection"
            class="bx bxs-chevron-right transform"
            class:rotate-180={!isCollapsed}
            class:rotate-0={isCollapsed}
        />
    </Button>
</div>
