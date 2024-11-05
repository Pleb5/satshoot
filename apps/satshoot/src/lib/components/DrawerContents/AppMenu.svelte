<script lang="ts">
    import currentUser from '$lib/stores/user';
    import { getDrawerStore, getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings, ModalComponent } from '@skeletonlabs/skeleton';
    import FeedbackModal from '../Modals/FeedbackModal.svelte';
    import ReadyToWorkModal from '$lib/components/Modals/ReadyToWorkModal.svelte';
    import { SlideToggle } from '@skeletonlabs/skeleton';
    import { type ToastSettings, getToastStore } from '@skeletonlabs/skeleton';

    import notificationsEnabled from '$lib/stores/notifications';

    import TicketIcon from '../Icons/TicketIcon.svelte';
    import BitcoinIcon from '../Icons/BitcoinIcon.svelte';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import BullhornIcon from '../Icons/BullhornIcon.svelte';
    import WalletIcon from '../Icons/WalletIcon.svelte';
    import LogoutModal from '../Modals/LogoutModal.svelte';

    const drawerStore = getDrawerStore();
    const modalStore = getModalStore();
    const toastStore = getToastStore();

    const profileHref = '/' + $currentUser!.npub + '/';
    const myCashuWalletHref = '/my-cashu-wallet/';
    const myTicketsHref = '/my-tickets/';
    const myOffersHref = '/my-offers/';
    const networkHref = '/network/';
    const aboutHref = '/about/';
    const settingsHref = '/settings/';

    let profileAnchor: HTMLElement;

    $: classesActive = (href: string) => {
        const activeStr = href === $page.url.pathname ? '!variant-filled-primary' : '';
        return activeStr;
    };

    $: if ($notificationsEnabled || !$notificationsEnabled) {
        console.log('set notifications permission');
        // If there is no permission for notifications yet, ask for it
        // If it is denied then return and turn notifications off
        if (Notification.permission !== 'granted') {
            Notification.requestPermission().then((permission: NotificationPermission) => {
                if (permission !== 'granted') {
                    notificationsEnabled.set(false);
                    const t: ToastSettings = {
                        message: `
                        <p>Notifications Settings are Disabled in the browser!</p>
                        <p>
                        <span>Click small icon </span>
                        <span> left of browser search bar to enable this setting!</span>
                        </p>
`,
                        autohide: false,
                    };
                    toastStore.clear();
                    toastStore.trigger(t);
                    console.log('user did not grant permission for notifications');
                }
                // User enabled notification settings, set user choice in local storage too
                notificationsEnabled.set($notificationsEnabled);
            });
        }
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

    onMount(async () => {
        // Clicking the Avatar button focuses this element by default
        // we undo this unwanted behavior here
        profileAnchor.blur();
        profileAnchor = profileAnchor;
    });
</script>

<div class="card p-4 flex-grow flex flex-col justify-between md:text-xl bg-inherit">
    <nav class="list-nav" style="line-height: 2.5rem;">
        <ul class="">
            {#if $currentUser}
                <li>
                    <a
                        bind:this={profileAnchor}
                        href={profileHref}
                        class="justify-start {classesActive(profileHref)}"
                        on:click={() => {
                            drawerStore.close();
                        }}
                    >
                        <span class="w-6 text-center">
                            <i class="fa-solid fa-user" />
                        </span>
                        <span>Profile</span>
                    </a>
                </li>
                <li>
                    <a
                        class="justify-start {classesActive(myTicketsHref)}"
                        href={myTicketsHref}
                        on:click={() => {
                            drawerStore.close();
                        }}
                    >
                        <span class="w-6 text-center">
                            <TicketIcon sizeClass={''} />
                        </span>
                        <span>My Tickets</span>
                    </a>
                </li>
                <li>
                    <a
                        class="justify-start {classesActive(myOffersHref)}"
                        href={myOffersHref}
                        on:click={() => {
                            drawerStore.close();
                        }}
                    >
                        <span class="w-6 text-center">
                            <BitcoinIcon extraClasses={'text-lg'} />
                        </span>
                        <span>My Offers</span>
                    </a>
                </li>
                <li>
                    <a
                        class="justify-start {classesActive(myCashuWalletHref)}"
                        href={myCashuWalletHref}
                        on:click={() => {
                            drawerStore.close();
                        }}
                    >
                        <span class="w-6 text-center">
                            <WalletIcon />
                        </span>
                        <span>Wallet</span>
                    </a>
                </li>
            {/if}
            <li>
                <button class="w-full justify-start" on:click={readyToWork}>
                    <span class="w-6 text-center">
                        <BullhornIcon extraClasses={''} />
                    </span>
                    <span>Work</span>
                </button>
            </li>
            <li>
                <a
                    class="justify-start {classesActive(networkHref)}"
                    href={networkHref}
                    on:click={() => {
                        drawerStore.close();
                    }}
                >
                    <span class="w-6 text-center">
                        <i class="fa-solid fa-globe" />
                    </span>
                    <span>Network</span>
                </a>
            </li>
            <li class="flex justify-start">
                <SlideToggle
                    name="enable-notifications"
                    class="text-md "
                    active="bg-primary-500"
                    size="sm"
                    bind:checked={$notificationsEnabled}
                >
                    Notifications
                </SlideToggle>
            </li>
            <hr class="!my-4" />
            <li>
                <a
                    class="justify-start {classesActive(aboutHref)}"
                    href={aboutHref}
                    on:click={() => {
                        drawerStore.close();
                    }}
                >
                    <span class="w-6 text-center">
                        <i class="fa-solid fa-info" />
                    </span>
                    <span>About</span>
                </a>
            </li>
            <li>
                <button class="w-full justify-start" on:click={feedback}>
                    <span class="w-6 text-center">
                        <i class="fa-regular fa-comment" />
                    </span>
                    <span>Feedback</span>
                </button>
            </li>
            <li>
                <a
                    class="justify-start {classesActive(settingsHref)}"
                    href={settingsHref}
                    on:click={() => {
                        drawerStore.close();
                    }}
                >
                    <span class="w-6 text-center">
                        <i class="fa-solid fa-gear"></i>
                    </span>
                    <span>Settings</span>
                </a>
            </li>
        </ul>
    </nav>
    <nav class="list-nav">
        <ul>
            <li>
                <button class="w-full justify-start" on:click={onLogout}>
                    <span class="w-6 text-center">
                        <i class="fa-solid fa-arrow-right-from-bracket" />
                    </span>
                    <span>Logout</span>
                </button>
            </li>
        </ul>
    </nav>
</div>
