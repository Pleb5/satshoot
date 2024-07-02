import { 
    type NDKSigner, 
    type NDKEvent,
    NDKRelayList,
    NDKRelaySet,
    NDKSubscriptionCacheUsage,
} from '@nostr-dev-kit/ndk';

import type NDKSvelte from '@nostr-dev-kit/ndk-svelte';

import currentUser from '../stores/user';
import {
    loggedIn,
    followsUpdated,
    userRelaysUpdated,
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
    sentMessageFilter,
    receivedMessageFilter,
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
import { DEFAULTRELAYURLS, OUTBOXRELAYURLS } from '$lib/stores/ndk';


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

        myTickets.startSubscription();
        myOffers.startSubscription();
        
        // --------- User Profile --------------- //
        const profile = await user.fetchProfile(
            {cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY}
        );
        // for now loading profile from cache disabled but if reenabled, this bug
        // that profile returned is a strangely nested object should be handled
        if (profile) {
            user.profile = profile;
        }
        currentUser.set(user);

        // fetch users relays. If there are no outbox relays, set default ones
        const relays = await fetchUserOutboxRelays(ndk);
        if (!relays) {
            broadcastRelayList(ndk, DEFAULTRELAYURLS, DEFAULTRELAYURLS);
            userRelaysUpdated.set(true);
        }

        const $followsUpdated = get(followsUpdated) as number;
        // Update wot every 5 hours: Newbies can get followers and after 5 hours
        // their actions will be visible to a decent amount of people
        const updateDelay = Math.floor(Date.now() / 1000) - 60 * 60 * 5;

        let wotArray: string[] = Array.from(get(wot));

        if ( ($followsUpdated < updateDelay) || !(get(networkWoTScores)) ) {
            // console.log('wot outdated, updating...')
            await updateFollowsAndWotScore(ndk);
            // console.log('wot updated')
            wotArray = Array.from(get(wot));
        } 

        receivedMessageFilter['#p']! = [user.pubkey];
        sentMessageFilter['authors'] = [user.pubkey];
        
        // (Re)start every subscription after successful wot and follow recalc
        messageStore.startSubscription();
        allReviews.startSubscription();

        // allTickets.unsubscribe();
        // allOffers.unsubscribe();
        //
        // allOffers.startSubscription();
        // allTickets.startSubscription();
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


export async function fetchUserOutboxRelays(ndk: NDKSvelte):Promise<NDKEvent | null> {
    const $currentUser = get(currentUser);

    const queryRelays = NDKRelaySet.fromRelayUrls([
        ...ndk.pool.urls(),
        ...ndk.outboxPool!.urls()
    ], ndk);

    const relays = await ndk.fetchEvent(
        { kinds: [10002], authors: [$currentUser!.pubkey] },
        { 
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            groupable: false,
        },
        queryRelays,
    );
    console.log('outbox relays', relays)
    return relays;
}

export async function broadcastRelayList(ndk: NDKSvelte, readRelayUrls: string[], writeRelayUrls: string[]) {
    const userRelayList = new NDKRelayList(ndk);
    userRelayList.readRelayUrls = Array.from(readRelayUrls);
    userRelayList.writeRelayUrls = Array.from(writeRelayUrls);

    const blastrUrl = 'wss://nostr.mutinywallet.com';
    const broadCastRelaySet = NDKRelaySet.fromRelayUrls([
        blastrUrl,
        ...ndk.pool.urls(),
        ...ndk.outboxPool!.urls()
    ], ndk);
    console.log('relays sent to:', broadCastRelaySet)

    const relaysPosted = await userRelayList.publish(broadCastRelaySet);
    console.log('relays posted to:', relaysPosted)
}

