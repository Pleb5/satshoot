<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import { get } from 'svelte/store';

    import NDKCacheAdapterDexie from "@nostr-dev-kit/ndk-cache-dexie";
    import currentUser from '$lib/stores/user';
    import { getDrawerStore, getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings, ModalComponent, ToastStore } from '@skeletonlabs/skeleton';
    import FeedbackModal from '../Modals/FeedbackModal.svelte';
    import { SlideToggle } from '@skeletonlabs/skeleton';
    import { type ToastSettings, getToastStore } from '@skeletonlabs/skeleton';

    import notificationsEnabled from '$lib/stores/notifications';

    import { networkWoTScores, wot } from '$lib/stores/wot';

    import {
        DEFAULTRELAYURLS,
        OUTBOXRELAYURLS,
        sessionPK 
    } from "$lib/stores/ndk";

    import {
        myTicketFilter,
        myOfferFilter,
        myTickets,
        myOffers, 
        allTickets,
        allOffers,
        allTicketsFilter,
        allOffersFilter,
    } from '$lib/stores/troubleshoot-eventstores';

    import { messageStore } from '$lib/stores/messages';

    import { goto } from '$app/navigation';
    import NDKSvelte from '@nostr-dev-kit/ndk-svelte';
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
                    If you are logged in with an local keypair,
                    it will be deleted from local storage!
                </strong>`;

        let logoutResponse = async function(r: boolean){
            if (r) {
                console.log('logout')
                drawerStore.close();

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
                
                allTickets.unsubscribe();
                allOffers.unsubscribe();
                delete allTicketsFilter.authors;
                delete allOffersFilter.authors;

                // Remove all relays from pool
                $ndk.pool.urls().forEach((url: string) => {
                    $ndk.pool.removeRelay(url);
                });

                $ndk.outboxPool?.urls().forEach((url: string) => {
                    $ndk.outboxPool?.removeRelay(url);
                });

                $currentUser = null;

                // Fresh start
                ndk.set(new NDKSvelte({
                    enableOutboxModel: true,
                    outboxRelayUrls: OUTBOXRELAYURLS,
                    blacklistRelayUrls: [],
                    explicitRelayUrls: DEFAULTRELAYURLS,
                    cacheAdapter: new NDKCacheAdapterDexie({ dbName: 'satshoot-db' }),
                }));

                await $ndk.connect();

                allTickets.startSubscription();
                allOffers.startSubscription();

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

<div class="card p-4 flex-grow md:text-xl">
    <nav class="list-nav">
        <ul>
            {#if $currentUser}
                <li>
                    <a 
                        class="justify-center"
                        href={ "/" + $currentUser.npub}
                        on:click={()=>{drawerStore.close()}}
                    >
                        <span class="w-6 text-center">
                            <i class="fa-solid fa-user" />
                        </span>
                        <span>Profile</span>
                    </a>
                </li>
                <li>
                    <a 
                        class="justify-center"
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
                        class="justify-center"
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
                    class="justify-center"
                    href="/network"
                    on:click={()=>{drawerStore.close()}}
                >
                    <span class="w-6 text-center">
                        <i class="fa-solid fa-globe" />
                    </span>
                    <span>Network</span>
                </a>
            </li>
            <li class="flex justify-center">
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
            <li>
                <a
                    class="justify-center"
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
                <button class="w-full justify-center" on:click={feedback}>
                    <span class="w-6 text-center">
                        <i class="fa-regular fa-comment" />
                    </span>
                    <span>Feedback</span>
                </button>
            </li>
            <hr class="!my-4" />
            <li>
                <button class="w-full justify-center" on:click={logout}>
                    <span class="w-6 text-center">
                        <i class="fa-solid fa-arrow-right-from-bracket" />
                    </span>
                    <span>Logout</span>
                </button>
            </li>
        </ul>
    </nav>
</div>
