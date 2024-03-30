<script lang="ts">
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings, ModalComponent } from '@skeletonlabs/skeleton';
    import FeedbackModal from '../Modals/FeedbackModal.svelte';

    import ndk from '$lib/stores/ndk';
    import {DEFAULTRELAYURLS, blacklistedRelays, storedPool, sessionPK } from "$lib/stores/ndk";

    import { myTicketFilter, myOfferFilter, myTickets, myOffers, ticketsOfSpecificOffers,
        ticketsOfSpecificOffersFilter, offersOnTicketsFilter, offersOnTickets 
    } from '$lib/stores/troubleshoot-eventstores';

    import { messageStore,  receivedMessageFilter, myMessageFilter } from '$lib/stores/messages';

    import { goto } from '$app/navigation';
    import NDKSvelte from '@nostr-dev-kit/ndk-svelte';
    import type { OfferEvent } from '$lib/events/OfferEvent';
    import type { TicketEvent } from '$lib/events/TicketEvent';
    import { loggedIn } from '$lib/stores/login';

    const modalStore = getModalStore();

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
                localStorage.clear();
                // Reset local storage pool and blacklist
                blacklistedRelays.set([]);
                storedPool.set(DEFAULTRELAYURLS);

                $sessionPK = '';
                sessionStorage.clear();

                $loggedIn = false;

                // Remove offer subscriptions that follow offers on myTickets
        // also remove those that tracked other offers on tickets I bid on as a Troubleshooter(myOffers #a tag or ticketsOfSpecificOffers.ticketAddress)

                // helper variables
                let aTagArray = offersOnTicketsFilter['#a'] as string[];
                let restartSubNeeded = false;
                for (let i = 0; i < aTagArray.length; i++) {
                    let ticketAddr: string = aTagArray[i];
                    $myTickets.forEach((ticket: TicketEvent) => {
                        if (ticket.ticketAddress === ticketAddr) {
                            offersOnTicketsFilter['#a']?.splice(i, 1);
                            restartSubNeeded = true;
                        }
                    });
                    $myOffers.forEach((offer: OfferEvent) => {
                        if (offer.referencedTicketAddress === ticketAddr) {
                            offersOnTicketsFilter['#a']?.splice(i, 1);
                            restartSubNeeded = true;
                        }
                    });
                }

                if (restartSubNeeded) {
                    offersOnTickets.empty();
                    offersOnTickets.startSubscription();
                }

                myTickets.empty();
                myOffers.empty();
                myTicketFilter.authors = [];
                myOfferFilter.authors = [];

                ticketsOfSpecificOffers.empty();
                ticketsOfSpecificOffersFilter['#d'] = [];

                messageStore.empty();
                receivedMessageFilter['#t'] = [];
                receivedMessageFilter['#p'] = [];

                myMessageFilter['authors'] = [];
                myMessageFilter['#t'] = [];


                ndk.set(new NDKSvelte({
                    enableOutboxModel: false,
                    explicitRelayUrls: DEFAULTRELAYURLS,
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
    <div class="card p-4 w-44 sm:w-60 shadow-xl z-50">
        <nav class="list-nav">
            <ul>
                <li>
                    <a href={ "/" + $ndk.activeUser?.npub }>
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

