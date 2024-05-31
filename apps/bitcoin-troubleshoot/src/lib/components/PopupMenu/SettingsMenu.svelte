<script lang="ts">
    import ndk from '$lib/stores/ndk';

    import NDKCacheAdapterDexie from "@nostr-dev-kit/ndk-cache-dexie";
    import currentUser from '$lib/stores/user';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings, ModalComponent, ToastStore } from '@skeletonlabs/skeleton';
    import FeedbackModal from '../Modals/FeedbackModal.svelte';
    import { SlideToggle } from '@skeletonlabs/skeleton';
    import { type ToastSettings, getToastStore } from '@skeletonlabs/skeleton';

    import notificationsEnabled from '$lib/stores/notifications';

    import { networkWoTScores } from '$lib/stores/wot';

    import {
        DEFAULTRELAYURLS,
        OUTBOXRELAYURLS,
        sessionPK 
    } from "$lib/stores/ndk";

    import { myTicketFilter, myOfferFilter, myTickets, myOffers, ticketsOfMyOffers,
        ticketsOfMyOffersFilter, offersOfMyTicketsFilter, offersOfMyTickets 
    } from '$lib/stores/troubleshoot-eventstores';

    import { messageStore,  receivedMessageFilter, myMessageFilter } from '$lib/stores/messages';

    import { goto } from '$app/navigation';
    import NDKSvelte from '@nostr-dev-kit/ndk-svelte';
    import type { OfferEvent } from '$lib/events/OfferEvent';
    import type { TicketEvent } from '$lib/events/TicketEvent';
    import { loggedIn } from '$lib/stores/user';
    import type { Hexpubkey } from '@nostr-dev-kit/ndk';

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
                        <span><i class="fa-solid fa-circle-info"></i></span>
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
                networkWoTScores.set(new Map());

                localStorage.clear();

                $sessionPK = '';
                sessionStorage.clear();

                $loggedIn = false;

                // Remove offer subscriptions that follow offers on myTickets
        // also remove those that tracked other offers on tickets I bid on as a Troubleshooter(myOffers #a tag or ticketsOfMyOffers.ticketAddress)

                // helper variables
                let aTagArray = offersOfMyTicketsFilter['#a'] as string[];
                let restartSubNeeded = false;
                for (let i = 0; i < aTagArray.length; i++) {
                    let ticketAddr: string = aTagArray[i];
                    $myTickets.forEach((ticket: TicketEvent) => {
                        if (ticket.ticketAddress === ticketAddr) {
                            offersOfMyTicketsFilter['#a']?.splice(i, 1);
                            restartSubNeeded = true;
                        }
                    });
                    $myOffers.forEach((offer: OfferEvent) => {
                        if (offer.referencedTicketAddress === ticketAddr) {
                            offersOfMyTicketsFilter['#a']?.splice(i, 1);
                            restartSubNeeded = true;
                        }
                    });
                }

                if (restartSubNeeded) {
                    offersOfMyTickets.empty();
                    offersOfMyTickets.startSubscription();
                }

                myTickets.empty();
                myOffers.empty();
                myTicketFilter.authors = [];
                myOfferFilter.authors = [];

                ticketsOfMyOffers.empty();
                ticketsOfMyOffersFilter['#d'] = [];

                messageStore.empty();
                receivedMessageFilter['#t'] = [];
                receivedMessageFilter['#p'] = [];

                myMessageFilter['authors'] = [];
                myMessageFilter['#t'] = [];


                ndk.set(new NDKSvelte({
                    enableOutboxModel: true,
                    outboxRelayUrls: OUTBOXRELAYURLS,
                    blacklistRelayUrls: [],
                    autoConnectUserRelays: true,
                    autoFetchUserMutelist: true,
                    explicitRelayUrls: DEFAULTRELAYURLS,
                    cacheAdapter: new NDKCacheAdapterDexie({ dbName: 'bitcoin-troubleshoot-db' }),
                }));

                await $ndk.connect();

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

<div data-popup="settingsMenu" >
    <div class="card p-4 w-48 sm:w-60 shadow-xl z-50">
        <nav class="list-nav">
            <ul>
                <li>
                    <a href={ "/" + $currentUser.npub }>
                        <span class="w-6 text-center"><i class="fa-solid fa-user" /></span>
                        <span>Profile</span>
                    </a>
                </li>
                <li>
                    <a href="/network">
                        <span class="w-6 text-center"><i class="fa-solid fa-globe" /></span>
                        <span>Network</span>
                    </a>
                </li>
                <li>
                    <SlideToggle name='enable-notifications'
                        class='text-md'
                        active="bg-primary-500"
                        size='sm'
                        bind:checked={$notificationsEnabled}
                    >
                        Notifications
                    </SlideToggle>
                </li>
                <hr class="!my-4" />
                <li>
                    <button class="w-full" on:click={feedback}>
                        <span class="w-6 text-center"><i class="fa-regular fa-comment" /></span>
                        <span>Feedback</span>
                    </button>
                </li>
                <hr class="!my-4" />
                <li>
                    <button class="w-full" on:click={logout}>
                        <span class="w-6 text-center">
                            <i class="fa-solid fa-arrow-right-from-bracket" />
                        </span>
                        <span>Logout</span>
                    </button>
                </li>
            </ul>
        </nav>
    </div>
</div>

