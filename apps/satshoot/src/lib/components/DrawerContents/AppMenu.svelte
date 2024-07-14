<script lang="ts">
    import { get } from 'svelte/store';

    import currentUser, { followsUpdated } from '$lib/stores/user';
    import { getDrawerStore, getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings, ModalComponent, ToastStore } from '@skeletonlabs/skeleton';
    import FeedbackModal from '../Modals/FeedbackModal.svelte';
    import { SlideToggle, LightSwitch } from '@skeletonlabs/skeleton';
    import { type ToastSettings, getToastStore } from '@skeletonlabs/skeleton';

    import notificationsEnabled from '$lib/stores/notifications';

    import { networkWoTScores, wot } from '$lib/stores/wot';

    import {
        sessionPK 
    } from "$lib/stores/ndk";

    import {
        myTicketFilter,
        myOfferFilter,
        myTickets,
        myOffers, 
    } from '$lib/stores/troubleshoot-eventstores';

    import { allReviews } from '$lib/stores/reviews';
    import { allReceivedZaps } from '$lib/stores/zaps';
    import { messageStore } from '$lib/stores/messages';

    import { goto } from '$app/navigation';
    import { loggedIn } from '$lib/stores/user';
    import UserTicketsIcon from '../Icons/UserTicketsIcon.svelte';
    import UserOffersIcon from '../Icons/UserOffersIcon.svelte';

    const drawerStore = getDrawerStore();
    const modalStore = getModalStore();
    const toastStore = getToastStore();

    $: if($notificationsEnabled || !$notificationsEnabled) {
        console.log('set notifications permission')
        // If there is no permission for notifications yet, ask for it
        // If it is denied then return and turn notifications off
        if(Notification.permission !== 'granted') {
            Notification.requestPermission().then(
            (permission: NotificationPermission) => {
                if (permission !== 'granted') {
                    notificationsEnabled.set(false);
                    const t: ToastSettings = {
                        message:`
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
                    console.log('user did not grant permission for notifications')
                }
                // User enabled notification settings, set user choice in local storage too
                notificationsEnabled.set($notificationsEnabled);
            });
        }
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

    function logout() {
        const modalBody = `
                <p>Do really you wish to log out?</p>
                <strong class="text-error-400-500-token">
                    If you are logged in with a Local Keypair,
                    it will be deleted from local storage!
                </strong>`;

        let logoutResponse = async function(r: boolean){
            if (r) {
                console.log('logout')
                drawerStore.close();

                followsUpdated.set(0);
                networkWoTScores.set(null);
                currentUser.set(null);
                console.log('wot', get(wot))

                localStorage.clear();

                $sessionPK = '';
                sessionStorage.clear();

                $loggedIn = false;

                myTickets.empty();
                myOffers.empty();
                myTicketFilter.authors = [];
                myOfferFilter.authors = [];

                messageStore.empty();
                allReviews.empty();
                allReceivedZaps.empty();
                
                $currentUser = null;

                modalStore.close();

                goto('/');
            }
        }

        const modal: ModalSettings = {
            type: 'confirm',
            // Data
            title: 'Confirm log out',
            body: modalBody,
            response: logoutResponse,
        };
        modalStore.trigger(modal);

    }
</script>

<div class="card p-4 flex-grow flex flex-col justify-between md:text-xl bg-inherit">
    <nav class="list-nav" style="line-height: 2.5rem;">
        <ul class="">
            {#if $currentUser}
                <li>
                    <a 
                        class="justify-start"
                        href={ "/" + $currentUser.npub}
                        on:click={()=>{
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
                        class="justify-start"
                        href={ "/my-tickets"}
                        on:click={()=>{drawerStore.close()}}
                    >
                        <span class="w-6 text-center">
                            <UserTicketsIcon sizeClass={''}/>
                        </span>
                        <span>My Tickets</span>
                    </a>
                </li>
                <li>
                    <a 
                        class="justify-start"
                        href={ "/my-offers"}
                        on:click={()=>{drawerStore.close()}}
                    >
                        <span class="w-6 text-center">
                            <UserOffersIcon sizeClass={'text-lg'}/>
                        </span>
                        <span>My Offers</span>
                    </a>
                </li>
            {/if}
            <li>
                <a 
                    class="justify-start"
                    href="/network"
                    on:click={()=>{drawerStore.close()}}
                >
                    <span class="w-6 text-center">
                        <i class="fa-solid fa-globe" />
                    </span>
                    <span>Network</span>
                </a>
            </li>
            <li class="flex justify-start">
                <SlideToggle name='enable-notifications'
                    class='text-md '
                    active="bg-primary-500"
                    size='sm'
                    bind:checked={$notificationsEnabled}
                >
                    Notifications
                </SlideToggle>
            </li>
            <hr class="!my-4" />
            <li class="flex justify-start gap-x-2 items-center">
                <LightSwitch />
                <span>Theme</span>
            </li>
            <li>
                <a
                    class="justify-start"
                    href="/about"
                    on:click={()=>{drawerStore.close()}}
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
                    class="justify-start"
                    href="/settings"
                    on:click={()=>{drawerStore.close()}}
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
                <button class="w-full justify-start" on:click={logout}>
                    <span class="w-6 text-center">
                        <i class="fa-solid fa-arrow-right-from-bracket" />
                    </span>
                    <span>Logout</span>
                </button>
            </li>
        </ul>
    </nav>
</div>
