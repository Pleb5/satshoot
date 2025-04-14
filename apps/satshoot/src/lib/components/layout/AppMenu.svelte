<script lang="ts">
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
    import { Modal } from '@skeletonlabs/skeleton-svelte';

    interface Props {
        isOpen: boolean;
    }

    let { isOpen = $bindable() }: Props = $props();

    let showAnnouncementModal = $state(false);
    let showFeedbackModal = $state(false);
    let showLogoutModal = $state(false);

    let profileHref = $derived($currentUser ? '/' + $currentUser.npub || '' + '/' : '/');

    function readyToWork() {
        showAnnouncementModal = true;
        isOpen = false;
    }

    function feedback() {
        showFeedbackModal = true;
        isOpen = false;
    }

    function onLogout() {
        showLogoutModal = true;
        isOpen = false;
    }

    let profileMenuItems = $derived([
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
    ]);

    const profileMenuItemClass = 'px-[4px] py-[4px] gap-2  justify-start';

    const extraClassesForLogoutBtn =
        'bg-red-500 hover:bg-red-600 text-white dark:bg-red-700 dark:hover:bg-red-800 px-4 py-2 justify-center';
</script>

<Modal
    open={isOpen}
    onInteractOutside={() => (isOpen = false)}
    contentBase="flex flex-col gap-[20px] p-[20px] bg-white dark:bg-brightGray w-[50vw] sm:w-[40vw] md:w-[30vw] h-screen"
    positionerJustify="justify-end"
    positionerPadding="p-0"
>
    {#snippet content()}
        {#each profileMenuItems as { href, label, icon, callback }}
            <Button
                {href}
                variant="text"
                classes={profileMenuItemClass}
                fullWidth
                onClick={() => {
                    if (callback) callback();

                    isOpen = false;
                }}
            >
                <span class="w-6 text-center">
                    {#if !icon.component}
                        <i {...icon.props}></i>
                    {:else}
                        <icon.component {...icon.props} />
                    {/if}
                </span>
                <span>{label}</span>
            </Button>
        {/each}

        <Button variant="text" classes={profileMenuItemClass} onClick={readyToWork}>
            <span class="w-6 text-center">
                <TowerBroadcastIcon extraClasses={''} />
            </span>
            <span>Announcement</span>
        </Button>

        <Button variant="text" classes={profileMenuItemClass} onClick={feedback}>
            <span class="w-6 text-center">
                <i class="fa-regular fa-comment"></i>
            </span>
            <span>Feedback</span>
        </Button>

        <div class="flex flex-col justify-end grow">
            {#if $loggedIn}
                <Button
                    classes="{profileMenuItemClass} {extraClassesForLogoutBtn} "
                    onClick={onLogout}
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
    {/snippet}
</Modal>

<Announcement bind:isOpen={showAnnouncementModal} />
<FeedbackModal bind:isOpen={showFeedbackModal} />
<LogoutModal bind:isOpen={showLogoutModal} />
