<script lang="ts">
    import currentUser, { loggedIn } from '$lib/stores/user';
    import { getModalStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
    import LogoutModal from '../Modals/LogoutModal.svelte';
    import { getRoboHashPicture, shortenTextWithEllipsesInMiddle } from '$lib/utils/helpers';
    import TicketIcon from '../Icons/TicketIcon.svelte';
    import BitcoinIcon from '../Icons/BitcoinIcon.svelte';
    import WalletIcon from '../Icons/WalletIcon.svelte';
    import ReadyToWorkModal from '../Modals/ReadyToWorkModal.svelte';
    import FeedbackModal from '../Modals/FeedbackModal.svelte';
    import BullhornIcon from '../Icons/BullhornIcon.svelte';
    import { createEventDispatcher, onDestroy, onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { ProfilePageTabs, profileTabStore } from '$lib/stores/tab-store';
    import Button from '../UI/Buttons/Button.svelte';

    export let classes = '';

    const modalStore = getModalStore();
    const dispatch = createEventDispatcher();

    let profileDropdownOpen = false;
    let dropdownElement: HTMLDivElement | null = null; // Reference for the dropdown element

    $: profileHref = $currentUser ? '/' + $currentUser.npub || '' + '/' : '/';

    function toggleProfileDropdown() {
        profileDropdownOpen = !profileDropdownOpen;
    }

    function onLogout() {
        const modalComponent: ModalComponent = {
            ref: LogoutModal,
        };

        const modal: ModalSettings = {
            type: 'component',
            title: 'Confirm log out',
            component: modalComponent,
        };

        modalStore.trigger(modal);
    }

    function readyToWork() {
        const modalComponent: ModalComponent = {
            ref: ReadyToWorkModal,
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.trigger(modal);
    }

    function feedback() {
        const modalComponent: ModalComponent = {
            ref: FeedbackModal,
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.trigger(modal);
    }

    function handleClickOutside(event: MouseEvent) {
        const target = event.target as HTMLElement;

        // Ignore elements with the data-ignore-outside-click attribute
        if (target.closest('[data-ignore-outside-click]')) {
            return;
        }

        profileDropdownOpen = false;
    }

    if (browser) {
        // Attach and detach the event listener
        onMount(() => {
            window.addEventListener('click', handleClickOutside);
        });

        onDestroy(() => {
            window.removeEventListener('click', handleClickOutside);
        });
    }

    $: profileMenuItems = [
        {
            href: profileHref,
            label: 'Profile',
            icon: {
                component: null, // No component, just an HTML icon class
                props: { class: 'fa-solid fa-user' },
            },
        },
        {
            href: `${profileHref}#jobs`,
            label: 'My Jobs',
            icon: {
                component: TicketIcon,
                props: { sizeClass: '' },
            },
            callback: () => {
                $profileTabStore = ProfilePageTabs.Jobs;
            },
        },
        {
            href: `${profileHref}#offers`,
            label: 'My Offers',
            icon: {
                component: BitcoinIcon,
                props: { extraClasses: 'text-lg' },
            },
            callback: () => {
                $profileTabStore = ProfilePageTabs.Offers;
            },
        },
        {
            href: '/my-cashu-wallet/',
            label: 'Wallet',
            icon: {
                component: WalletIcon,
                props: {},
            },
        },
        {
            href: '/settings/',
            label: 'Settings',
            icon: {
                component: null, // No component, just an HTML icon class
                props: { class: 'fa-solid fa-gear' },
            },
        },
    ];

    const profileDropdownWrapperClass =
        'dropdown-menu absolute left-1/2 transform -translate-x-1/2 md:right-0 md:left-auto md:transform-none z-10 mt-[5px] flex min-w-[150px] bg-white dark:bg-brightGray ' +
        'rounded-[6px] border-[1px] border-black-100 dark:border-white-100 shadow-soft';

    const profileMenuItemClass = 'px-[4px] py-[4px] gap-2  justify-start';

    const extraClassesForLogoutBtn =
        'bg-red-500 hover:bg-red-600 text-white dark:bg-red-700 dark:hover:bg-red-800 px-4 py-2 justify-center';
</script>

{#if $currentUser}
    <div data-ignore-outside-click>
        <Button variant="outlined" on:click={toggleProfileDropdown} {classes}>
            <img
                src={$currentUser.profile?.image ?? getRoboHashPicture($currentUser.pubkey)}
                alt="user profile"
                class="w-[25px] h-[25px] rounded-[100%]"
            />
            <span class="overflow-hidden whitespace-nowrap overflow-ellipsis max-w-[200px]"
                >{$currentUser.profile?.name ??
                    $currentUser.profile?.displayName ??
                    shortenTextWithEllipsesInMiddle($currentUser.npub, 15)}</span
            >
        </Button>
    </div>

    {#if profileDropdownOpen}
        <div class={profileDropdownWrapperClass} bind:this={dropdownElement}>
            <div class="p-[5px] flex flex-col gap-2" role="menu">
                {#each profileMenuItems as { href, label, icon, callback }}
                    <Button
                        {href}
                        variant="text"
                        classes={profileMenuItemClass}
                        fullWidth
                        on:click={() => {
                            if (callback) callback();

                            toggleProfileDropdown();
                            dispatch('click');
                        }}
                    >
                        <span class="w-6 text-center">
                            {#if !icon.component}
                                <i {...icon.props}></i>
                            {:else}
                                <svelte:component this={icon.component} {...icon.props} />
                            {/if}
                        </span>
                        <span>{label}</span>
                    </Button>
                {/each}

                <Button variant="text" classes={profileMenuItemClass} on:click={readyToWork}>
                    <span class="w-6 text-center">
                        <BullhornIcon extraClasses={''} />
                    </span>
                    <span>Announcement</span>
                </Button>

                <Button variant="text" classes={profileMenuItemClass} on:click={feedback}>
                    <span class="w-6 text-center">
                        <i class="fa-regular fa-comment" />
                    </span>
                    <span>Feedback</span>
                </Button>

                {#if $loggedIn}
                    <Button
                        classes="{profileMenuItemClass} {extraClassesForLogoutBtn} "
                        on:click={onLogout}
                    >
                        Logout
                    </Button>
                {/if}
            </div>
        </div>
    {/if}
{/if}
