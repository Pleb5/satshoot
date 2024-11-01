import {
    NDKEvent,
    type NDKSigner,
    NDKKind,
    NDKRelayList,
    NDKRelay,
    NDKSubscriptionCacheUsage,
    type NDKFilter,
    profileFromEvent,
    getNip57ZapSpecFromLud,
    NDKRelaySet,
    NDKCashuMintList,
    type CashuPaymentInfo,
    type NDKUserProfile,
    serializeProfile,
    type NostrEvent,
} from '@nostr-dev-kit/ndk';

import ndk, { blastrUrl, BOOTSTRAPOUTBOXRELAYS } from '$lib/stores/ndk';

import type NDKSvelte from '@nostr-dev-kit/ndk-svelte';

import currentUser from '../stores/user';
import {
    loggedIn,
    loggingIn,
    loginMethod,
    followsUpdated,
    userRelaysUpdated,
} from '../stores/user';

import { updateFollowsAndWotScore, networkWoTScores } from '../stores/wot';

import { allReviews } from '$lib/stores/reviews';

import { allReceivedZapsFilter, allReceivedZaps } from '$lib/stores/zaps';

import { messageStore, sentMessageFilter, receivedMessageFilter } from '$lib/stores/messages';

import {
    allTickets,
    allOffers,
    myTicketFilter,
    myOfferFilter,
    myTickets,
    myOffers,
} from '$lib/stores/freelance-eventstores';

import { DEFAULTRELAYURLS } from '$lib/stores/ndk';
import { notifications } from '../stores/notifications';

import { goto } from '$app/navigation';
import { get } from 'svelte/store';
import { dev } from '$app/environment';
import { connected, sessionPK } from '../stores/ndk';
import { retryConnection, retryDelay, maxRetryAttempts } from '../stores/network';
import {
    cashuTokensBackup,
    ndkNutzapMonitor,
    unsavedProofsBackup,
    wallet,
    walletInit,
} from '$lib/stores/wallet';
import { NDKCashuToken, type NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
import { CashuMint, CashuWallet, type Proof } from '@cashu/cashu-ts';
import { getUniqueProofs } from './cashu';

export async function initializeUser(ndk: NDKSvelte) {
    console.log('begin user init');
    try {
        loggingIn.set(false);

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
        const profile = await user.fetchProfile({ cacheUsage: NDKSubscriptionCacheUsage.PARALLEL });
        // for now loading profile from cache disabled but if reenabled, this bug
        // that profile returned is a strangely nested object should be handled
        if (profile) {
            user.profile = profile;
        }
        currentUser.set(user);

        // initialize user wallet for ecash payments
        walletInit(ndk, user);

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

        // let wotArray: string[] = Array.from(get(wot));
        const $networkWoTScores = get(networkWoTScores);

        if ($followsUpdated < updateDelay || !$networkWoTScores || $networkWoTScores.size === 0) {
            // console.log('wot outdated, updating...')
            await updateFollowsAndWotScore(ndk);
            // console.log('wot updated')
            // wotArray = Array.from(get(wot));
        }

        // Start all tickets/offers sub
        allTickets.startSubscription();
        allOffers.startSubscription();

        receivedMessageFilter['#p']! = [user.pubkey];
        sentMessageFilter['authors'] = [user.pubkey];
        allReceivedZapsFilter['#p']! = [user.pubkey];

        // Start message and review subs after successful wot and follow recalc
        messageStore.startSubscription();
        allReviews.startSubscription();
        allReceivedZaps.startSubscription();
    } catch (e) {
        console.log('Could not initialize User. Reason: ', e);
    }
}

export function logout() {
    console.log('logout');

    loggedIn.set(false);

    loginMethod.set(null);

    followsUpdated.set(0);
    networkWoTScores.set(null);

    currentUser.set(null);

    localStorage.clear();
    sessionStorage.clear();

    sessionPK.set('');

    myTickets.empty();
    myOffers.empty();
    myTicketFilter.authors = [];
    myOfferFilter.authors = [];

    allTickets.empty();
    allOffers.empty();

    messageStore.empty();
    allReviews.empty();
    allReceivedZaps.empty();

    notifications.set([]);

    wallet.set(null);

    const nutzapMonitor = get(ndkNutzapMonitor);
    if (nutzapMonitor) {
        nutzapMonitor.stop();
        ndkNutzapMonitor.set(null);
    }

    get(ndk).signer = undefined;

    goto('/');
}

export async function getActiveServiceWorker(): Promise<ServiceWorker | null> {
    if ('serviceWorker' in navigator) {
        let registeredSW = await (
            navigator.serviceWorker as ServiceWorkerContainer
        ).getRegistration();
        if (!registeredSW) {
            console.log('No registered Service Worker for this page!');
            console.log('Trying to register one...');
            // Try to register new service worker here
            registeredSW = await (navigator.serviceWorker as ServiceWorkerContainer).register(
                '/service-worker.js',
                { type: dev ? 'module' : 'classic' }
            );

            if (!registeredSW) return null;
        }

        const activeSW = registeredSW.active;
        if (activeSW) {
            return activeSW;
        } else {
            console.log('No active Service Worker. Must wait for it...');
            console.log((navigator.serviceWorker as ServiceWorkerContainer).getRegistrations());

            let pendingSW;
            if (registeredSW.installing) {
                pendingSW = registeredSW.installing;
            } else if (registeredSW.waiting) {
                pendingSW = registeredSW.waiting;
            }

            if (pendingSW) {
                pendingSW.onstatechange = (event: Event) => {
                    if (registeredSW!.active) {
                        console.log('Regsitered Service worker activated!');
                    }
                };
            }
        }
    } else {
        console.log('service worker not supported');
        return null;
    }

    return null;
}

export async function fetchUserOutboxRelays(ndk: NDKSvelte): Promise<NDKEvent | null> {
    const $currentUser = get(currentUser);

    const queryRelaysUrls = [...ndk.pool.urls(), ...ndk.outboxPool!.urls()];

    const queryRelays: Array<NDKRelay> = [];

    queryRelaysUrls.forEach((url) => {
        queryRelays.push(new NDKRelay(url, undefined, ndk));
    });

    const relayFilter = {
        kinds: [NDKKind.RelayList],
        authors: [$currentUser!.pubkey],
    };

    let relays = await fetchEventFromRelaysFirst(relayFilter, 4000, true, queryRelays);

    return relays;
}

export async function broadcastRelayList(
    ndk: NDKSvelte,
    readRelayUrls: string[],
    writeRelayUrls: string[]
) {
    const userRelayList = new NDKRelayList(ndk);
    userRelayList.readRelayUrls = Array.from(readRelayUrls);
    userRelayList.writeRelayUrls = Array.from(writeRelayUrls);

    const relaysPosted = await broadcastEvent(ndk, userRelayList, [...writeRelayUrls]);
    console.log('relays posted to:', relaysPosted);
}

export async function broadcastUserProfile(ndk: NDKSvelte, userProfile: NDKUserProfile) {
    const ndkEvent = new NDKEvent(ndk);
    ndkEvent.content = serializeProfile(userProfile);
    ndkEvent.kind = NDKKind.Metadata;

    const explicitRelays: string[] = [];

    const relayListEvent = await fetchUserOutboxRelays(ndk);
    if (relayListEvent) {
        const relayList = NDKRelayList.from(relayListEvent);
        explicitRelays.push(...relayList.writeRelayUrls);
    }

    const relaysPosted = await broadcastEvent(ndk, ndkEvent, explicitRelays);
    console.log('userProfile posted to:', relaysPosted);
}

export async function broadcastEvent(
    ndk: NDKSvelte,
    ndkEvent: NDKEvent,
    explicitRelayUrls: string[],
    includePoolRelays: boolean = true,
    includeOutboxPoolRelays: boolean = true,
    includeBlastUrl: boolean = true
) {
    const relayUrls = [...explicitRelayUrls];

    if (includePoolRelays) {
        relayUrls.push(...ndk.pool.urls());
    }

    if (includeOutboxPoolRelays && ndk.outboxPool) {
        relayUrls.push(...ndk.outboxPool.urls());
    }

    if (includeBlastUrl) {
        relayUrls.push(blastrUrl);
    }

    return await ndkEvent.publish(NDKRelaySet.fromRelayUrls(relayUrls, ndk));
}

export async function checkRelayConnections() {
    const $ndk = get(ndk);
    const $currentUser = get(currentUser);

    const anyConnectedRelays = $ndk.pool.stats().connected !== 0;
    let readAndWriteRelaysExist = false;

    // Only bother to check stronger condition if weaker is met
    if (anyConnectedRelays && $currentUser) {
        const relays = await $ndk.fetchEvent(
            { kinds: [NDKKind.RelayList], authors: [$currentUser!.pubkey] },
            {
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                groupable: false,
            }
        );

        if (relays) {
            const relayList = NDKRelayList.from(relays);
            let readRelayExists = false;
            let writeRelayExists = false;

            // Check if user has at least 1 read and 1 write relay connected
            for (const connectedPoolRelay of $ndk.pool.connectedRelays()) {
                relayList.readRelayUrls.forEach((url: string) => {
                    if (connectedPoolRelay.url === url) {
                        readRelayExists = true;
                    }
                });

                relayList.writeRelayUrls.forEach((url: string) => {
                    if (connectedPoolRelay.url === url) {
                        writeRelayExists = true;
                    }
                });

                if (readRelayExists && writeRelayExists) {
                    readAndWriteRelaysExist = true;
                    break;
                }
            }
        }
    }

    if (!anyConnectedRelays || ($currentUser && !readAndWriteRelaysExist)) {
        connected.set(false);
        let retriesLeft = get(retryConnection);
        if (retriesLeft > 0) {
            retriesLeft -= 1;
            retryConnection.set(retriesLeft);
            // Try to reconnect to relays, timeout in 2sec for each relay
            $ndk.pool.connect(2000);
            // Re-check recursively when retry delay expires
            // This sets an explicit cap on retries.
            // After retryDelay X retryConnection amount of time is elapsed
            // retry process is concluded and either we reconnected or
            // user needs to fix network and reload page (toast with btn is shown)
            setTimeout(checkRelayConnections, retryDelay);
        }
    } else {
        // We are sufficiently connected
        connected.set(true);
        retryConnection.set(maxRetryAttempts);
    }
}

export async function fetchEventFromRelaysFirst(
    filter: NDKFilter,
    relayTimeoutMS: number = 6000,
    fallbackToCache: boolean = false,
    relays?: NDKRelay[]
): Promise<NDKEvent | null> {
    const $ndk = get(ndk);

    // If relays are provided construct a set and pass over to sub
    const relaySet = relays ? new NDKRelaySet(new Set(relays), $ndk) : undefined;

    const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
            resolve(null);
        }, relayTimeoutMS);
    });

    const relayPromise = $ndk.fetchEvent(
        filter,
        {
            cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY,
            groupable: false,
        },
        relaySet
    );

    const fetchedEvent: NDKEvent | null = (await Promise.race([
        timeoutPromise,
        relayPromise,
    ])) as NDKEvent | null;

    if (fetchedEvent) {
        return fetchedEvent;
    } else if (!fetchedEvent && !fallbackToCache) {
        return null;
    }

    const cachedEvent = await $ndk.fetchEvent(filter, {
        cacheUsage: NDKSubscriptionCacheUsage.ONLY_CACHE,
        groupable: false,
    });

    return cachedEvent;
}

export async function getZapConfiguration(pubkey: string) {
    const $ndk = get(ndk);

    const metadataFilter = {
        kinds: [NDKKind.Metadata],
        authors: [pubkey],
    };

    const metadataRelays = [...$ndk.outboxPool!.connectedRelays(), ...$ndk.pool!.connectedRelays()];

    const metadataEvent = await fetchEventFromRelays(metadataFilter, 5000, false, metadataRelays);

    if (!metadataEvent) return null;

    const profile = profileFromEvent(metadataEvent);

    if (!profile.lud16) return null;

    try {
        const lnurlSpec = await getNip57ZapSpecFromLud(
            {
                lud06: profile.lud06,
                lud16: profile.lud16,
            },
            $ndk
        );

        if (!lnurlSpec) {
            return null;
        }

        return lnurlSpec;
    } catch (err) {
        console.error(`An error occurred in getZapConfiguration for ${pubkey}`, err);
        console.error('Try to parse lud06 as lud16 as last resort..');
        try {
            // try if lud06 is actually a lud16
            const lnurlSpec = await getNip57ZapSpecFromLud(
                { lud06: undefined, lud16: profile.lud06 },
                $ndk
            );

            if (!lnurlSpec) {
                return null;
            }

            return lnurlSpec;
        } catch (err) {
            console.error(
                `Tried to parse lud06 as lud16 but error occurred again for ${pubkey}`,
                err
            );
            return null;
        }
    }
}

export async function getCashuPaymentInfo(
    pubkey: string,
    wholeEvent: boolean = false
): Promise<NDKCashuMintList | CashuPaymentInfo | null> {
    const $ndk = get(ndk);

    const filter = {
        kinds: [NDKKind.CashuMintList],
        authors: [pubkey],
    };

    const relays = [...$ndk.outboxPool!.connectedRelays(), ...$ndk.pool!.connectedRelays()];

    const cashuMintlistEvent = await fetchEventFromRelaysFirst(filter, 5000, false, relays);

    if (!cashuMintlistEvent) {
        console.warn(`Could not fetch Cashu Mint list for ${pubkey}`);
        return null;
    }

    const mintList = NDKCashuMintList.from(cashuMintlistEvent);

    if (wholeEvent) return mintList;

    return {
        mints: mintList.mints,
        relays: mintList.relays,
        p2pk: mintList.p2pk,
    };
}

export function orderEventsChronologically(events: NDKEvent[], reverse: boolean = false) {
    events.sort((e1: NDKEvent, e2: NDKEvent) => {
        if (reverse) return e1.created_at! - e2.created_at!;
        else return e2.created_at! - e1.created_at!;
    });

    events = events;
}

export function arraysAreEqual<T>(arr1: T[], arr2: T[]): boolean {
    // Check if arrays have the same length
    if (arr1.length !== arr2.length) return false;

    // Check if all elements are equal (using deep equality for objects)
    return arr1.every((element, index) => element === arr2[index]);
}

export function shortenTextWithEllipsesInMiddle(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    const textCharactersLeftAlone: number = maxLength - 3;
    const lengthOfStart = Math.round(textCharactersLeftAlone / 2);
    const lengthOfEnd: number = textCharactersLeftAlone - lengthOfStart;

    const result =
        text.substring(0, lengthOfStart) + '...' + text.substring(text.length - lengthOfEnd - 1);

    return result;
}

export interface RatingConsensus {
    ratingConsensus: string;
    ratingColor: string;
}

export function averageToRatingText(average: number): RatingConsensus {
    let ratingConsensus = '';
    let ratingColor = '';
    if (isNaN(average)) {
        ratingConsensus = 'No Ratings';
        ratingColor = 'bg-surface-500';
    } else {
        ratingConsensus = 'Excellent';
        ratingColor = 'bg-warning-500';
        if (average < 0.9) {
            ratingConsensus = 'Great';
            ratingColor = 'bg-tertiary-500';
        }
        if (average < 0.75) {
            ratingConsensus = 'Good';
            ratingColor = 'bg-success-500';
        }
        if (average < 0.5) {
            ratingConsensus = 'Mixed ratings';
            ratingColor = 'bg-surface-500';
        }
        if (average < 0.25) {
            ratingConsensus = 'Bad';
            ratingColor = 'bg-error-500';
        }
    }
    return { ratingConsensus: ratingConsensus, ratingColor: ratingColor };
}

export async function resyncWalletAndBackup(
    $wallet: NDKCashuWallet,
    $cashuTokensBackup: Map<string, NostrEvent>,
    $unsavedProofsBackup: Map<string, Proof[]>
) {
    console.log('syncing wallet and backup ');
    try {
        const $ndk = get(ndk);

        // get ids of existing tokens in wallet
        const existingTokenIds = $wallet.tokens.map((token) => token.id);

        // filter tokens from backup that don't exists in wallet
        const missingTokens = Array.from(
            $cashuTokensBackup.values().filter((token) => !existingTokenIds.includes(token.id!))
        );

        if (missingTokens.length > 0) {
            // convert raw token events to NDKCashuTokens
            // this also decrypts the private tags in token events
            const promises = missingTokens.map((token) => {
                const ndkEvent = new NDKEvent($ndk, token);
                return NDKCashuToken.from(ndkEvent);
            });

            const ndkCashuTokens = await Promise.all(promises).then((tokens) => {
                return tokens.filter((token) => token instanceof NDKCashuToken);
            });

            const invalidTokens: NDKCashuToken[] = [];

            // get all the unique mints from tokens
            const mints = new Set<string>();
            ndkCashuTokens.forEach((t) => {
                if (t.mint) mints.add(t.mint);
            });

            const mintsArray = Array.from(mints);
            const tokenPromises = mintsArray.map(async (mint) => {
                // get all the proofs tied to tokens with a specific mint
                const allProofs = ndkCashuTokens
                    .filter((t) => t.mint === mint)
                    .map((token) => token.proofs)
                    .flat();

                const _wallet = new CashuWallet(new CashuMint(mint));
                const spentProofs = await _wallet.checkProofsSpent(allProofs);

                ndkCashuTokens.map(async (token) => {
                    // check if there's any proof that has been spent then this is not a valid token
                    const proofsCountBeforeFilter = token.proofs.length;
                    const unspentProofs = getUniqueProofs(token.proofs, spentProofs);

                    if (proofsCountBeforeFilter === unspentProofs.length) {
                        await token.publish($wallet.relaySet);
                        $wallet.addToken(token);
                    } else {
                        invalidTokens.push(token);
                    }
                });
            });

            await Promise.all(tokenPromises);

            if (invalidTokens.length > 0) {
                cashuTokensBackup.update((map) => {
                    // remove invalid tokens from the backup
                    invalidTokens.forEach((t) => map.delete(t.id));

                    return map;
                });
            }
        }

        const unsavedProofsArray = Array.from($unsavedProofsBackup.entries());
        unsavedProofsArray.map(async ([mint, proofs]) => {
            if (proofs.length > 0) {
                // Creating new cashu token for backing up unsaved proofs related to a specific mint
                const newCashuToken = new NDKCashuToken($ndk);
                newCashuToken.proofs = proofs;
                newCashuToken.mint = mint;
                newCashuToken.wallet = $wallet;

                console.log('Encrypting proofs added to token event');
                newCashuToken.content = JSON.stringify({
                    proofs: newCashuToken.proofs,
                });

                const $currentUser = get(currentUser);
                // encrypt the new token event
                await newCashuToken.encrypt($currentUser!, undefined, 'nip44');
                await newCashuToken.sign();
                await newCashuToken.publish($wallet.relaySet);

                // now that new token has been signed and published to relays
                // we can add it to wallet and remove these proofs from unsaved proofs backup
                $wallet.addToken(newCashuToken);
                unsavedProofsBackup.update((map) => {
                    map.delete(mint);

                    return map;
                });
            }
        });
    } catch (error) {
        console.error('An error occurred in syncing wallet and backup', error);
    }
}
