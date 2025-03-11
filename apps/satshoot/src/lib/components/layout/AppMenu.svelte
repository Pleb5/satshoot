<script lang="ts">
    import {
        getDrawerStore,
        getModalStore,
        type ModalComponent,
        type ModalSettings,
    } from '@skeletonlabs/skeleton';
    import Announcement from '../Modals/Announcement.svelte';
    import FeedbackModal from '../Modals/FeedbackModal.svelte';
    import LogoutModal from '../Modals/LogoutModal.svelte';
    import currentUser, { loggedIn } from '$lib/stores/user';
    import TicketIcon from '../Icons/TicketIcon.svelte';
    import { scrollToMyJobsAndMyOffers } from '$lib/stores/gui';
    import { ProfilePageTabs, profileTabStore } from '$lib/stores/tab-store';
    import BitcoinIcon from '../Icons/BitcoinIcon.svelte';
    import WalletIcon from '../Icons/WalletIcon.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import TowerBroadcastIcon from '../Icons/TowerBroadcastIcon.svelte';

    const drawerStore = getDrawerStore();
    const modalStore = getModalStore();

    $: profileHref = $currentUser ? '/' + $currentUser.npub || '' + '/' : '/';

    function readyToWork() {
        const modalComponent: ModalComponent = {
            ref: Announcement,
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.trigger(modal);
        drawerStore.close();
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
        drawerStore.close();
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
        drawerStore.close();
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
            href: `${profileHref}`,
            label: 'My Jobs',
            icon: {
                component: TicketIcon,
                props: { sizeClass: '' },
            },
            callback: () => {
                $scrollToMyJobsAndMyOffers = true;
                $profileTabStore = ProfilePageTabs.Jobs;
            },
        },
        {
            href: `${profileHref}`,
            label: 'My Offers',
            icon: {
                component: BitcoinIcon,
                props: { extraClasses: 'text-lg' },
            },
            callback: () => {
                $scrollToMyJobsAndMyOffers = true;
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

    const profileMenuItemClass = 'px-[4px] py-[4px] gap-2  justify-start';

    const extraClassesForLogoutBtn =
        'bg-red-500 hover:bg-red-600 text-white dark:bg-red-700 dark:hover:bg-red-800 px-4 py-2 justify-center';
</script>

<div class="flex flex-col flex-grow gap-[20px] p-[20px] bg-white dark:bg-brightGray">
    {#each profileMenuItems as { href, label, icon, callback }}
        <Button
            {href}
            variant="text"
            classes={profileMenuItemClass}
            fullWidth
            on:click={() => {
                if (callback) callback();

                drawerStore.close();
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
            <TowerBroadcastIcon extraClasses={''} />
        </span>
        <span>Announcement</span>
    </Button>

    <Button variant="text" classes={profileMenuItemClass} on:click={feedback}>
        <span class="w-6 text-center">
            <i class="fa-regular fa-comment" />
        </span>
        <span>Feedback</span>
    </Button>

    <div class="flex flex-col justify-end flex-grow">
        {#if $loggedIn}
            <Button
                classes="{profileMenuItemClass} {extraClassesForLogoutBtn} "
                on:click={onLogout}
                fullWidth
            >
                Logout
            </Button>
        {/if}
    </div>
    <div class="flex justify-center">
        <a class="anchor" href="https://github.com/Pleb5/satshoot" target="_blank">
            <span>Running v0.3.0</span> 
        </a>
    </div>
</div>
