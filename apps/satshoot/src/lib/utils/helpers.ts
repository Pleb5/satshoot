import type { 
    NDKSigner, 
} from '@nostr-dev-kit/ndk';

import currentUser from '../stores/user';
import {
    loggedIn,
    followsUpdated,
} from '../stores/user';

import {
    updateFollowsAndWotScore,
    networkWoTScores,
    wot
} from '../stores/wot';

import {
    allReviewsFilter,
    allReviews,
} from '$lib/stores/reviews';

import { 
    messageStore,
    receivedMessageFilter,
    myMessageFilter,
} from '$lib/stores/messages';

import { get } from "svelte/store";
import { dev } from '$app/environment';

import { 
    myTicketFilter,
    myOfferFilter,
    myTickets,
    myOffers,
    allTicketsFilter,
    allOffersFilter,
    allTickets,
    allOffers,
} from "$lib/stores/troubleshoot-eventstores";


export async function initializeUser(ndk: NDK) {
    console.log('begin user init')
    try {
        const user = await (ndk.signer as NDKSigner).user();
        if (user.npub) {
            loggedIn.set(true);
        } else return;

        currentUser.set(user);

        myTicketFilter.authors! = [user.pubkey];
        myOfferFilter.authors! = [user.pubkey];
        myMessageFilter.authors! = [user.pubkey];
        receivedMessageFilter['#p']! = [user.pubkey];

        myTickets.startSubscription();
        myOffers.startSubscription();
        messageStore.startSubscription();
        
        // --------- User Profile --------------- //
        await user.fetchProfile();
        currentUser.set(user);

        const $followsUpdated = get(followsUpdated) as number;
        // Update wot every 5 hours: Newbies can get followers and after 5 hours
        // their actions will be visible to a decent amount of people
        const updateDelay = Math.floor(Date.now() / 1000) - 60 * 60 * 5;

        // Try to recalculate wot every week
        let wotArray: string[] = Array.from(get(wot));

        if ($followsUpdated < updateDelay || !get(networkWoTScores)) {
            // console.log('wot outdated, updating...')
            await updateFollowsAndWotScore(ndk);
            // console.log('wot updated')
            wotArray = Array.from(get(wot));
        } 

        allReviewsFilter['authors'] = wotArray;
        allTicketsFilter['authors'] = wotArray;
        allOffersFilter['authors'] = wotArray;
        
        // allReviews.subscription?.on('event', (event: NDKEvent)=>{
        //     console.log('review arrived', event)
        // })
        // Restart every subscription after successful wot and follow recalc
        allReviews.startSubscription();

        allTickets.unsubscribe();
        allOffers.unsubscribe();

        allOffers.startSubscription();
        allTickets.startSubscription();
    } catch(e) {
        console.log('Could not initialize User. Reason: ', e)
    }
}

export async function getActiveServiceWorker(): Promise<ServiceWorker | null> {
    if ('serviceWorker' in navigator) {
        let registeredSW = await 
                (navigator.serviceWorker as ServiceWorkerContainer).getRegistration();
        if (!registeredSW) {
            console.log('No registered Service Worker for this page!');
            console.log('Trying to register one...');
            // Try to register new service worker here
            registeredSW = await 
                (navigator.serviceWorker as ServiceWorkerContainer).register(
                '/service-worker.js',
                {	type: dev ? 'module' : 'classic'}
            );

            if(!registeredSW) return null;
        }

        const activeSW = registeredSW.active;
        if(activeSW) {
            return activeSW;
        } else {
            console.log('No active Service Worker. Must wait for it...')
            console.log(
                (navigator.serviceWorker as ServiceWorkerContainer).getRegistrations()
            );

            let pendingSW;
            if(registeredSW.installing) {
                pendingSW = registeredSW.installing;
            } else if(registeredSW.waiting) {
                pendingSW = registeredSW.waiting;
            }

            if(pendingSW) {
                pendingSW.onstatechange = (event: Event) => {
                    if(registeredSW!.active) {
                        console.log('Regsitered Service worker activated!')
                    }
                };
            }
        }
    } else {
        console.log('service worker not supported')
        return null;
    }

    return null;
}
