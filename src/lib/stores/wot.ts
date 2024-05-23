import { writable, get, derived } from 'svelte/store';
import { localStorageStore } from "@skeletonlabs/skeleton";
import type { Writable } from 'svelte/store';

import {
    getMapSerializer,
    BTCTroubleshootPubkey ,
    filterValidPTags,
    percentile,
} from '../utils/misc';

import type { 
    NDKEvent,
    NDKUser,
    Hexpubkey,
    NDKFilter,
} from '@nostr-dev-kit/ndk';

import {
    NDKSubscriptionCacheUsage,
    NDKRelaySet,
    NDKKind,
    NDKRelayList ,
    NDKRelay,
} from '@nostr-dev-kit/ndk';

import type { NDKSvelte } from '@nostr-dev-kit/ndk-svelte';

import currentUser from '../stores/user';
import {
    currentUserFollows,
    followsUpdated,
} from '../stores/user';


export const networkWoTScores: Writable<Map<Hexpubkey, number> | null>
    = localStorageStore('networkWoTScores', null, {serializer: getMapSerializer()});

// Minimum wot to be included in any result
export const minWot = writable(3);

// WoT scores for follows, mutes and reports
const firstOrderFollowWot = 4;
const firstOrderMuteWot = -0.5*(firstOrderFollowWot);
const firstOrderReportWot = -0.5*(firstOrderFollowWot);
const secondOrderFollowWot = 1;
const secondOrderMuteWot = -0.5*(secondOrderFollowWot);
const secondOrderReportWot = -0.5*(secondOrderFollowWot);

export const bootstrapAccount = BTCTroubleshootPubkey;

export const wotUpdated = writable(false);

export const wot = derived(
    [networkWoTScores, minWot, currentUser],
    ([$networkWoTScores, $minWot, $currentUser]) => {
        const pubkeys = new Set<Hexpubkey>();

        $networkWoTScores?.forEach((score: number, follow: Hexpubkey) => {
            if (score >= $minWot) pubkeys.add(follow);
        });

        if ($currentUser) {
            pubkeys.add($currentUser.pubkey);
        }

        return pubkeys;
    }
);

export function wotFiltered(events: NDKEvent[]):NDKEvent[] {
    const $wot = get(wot);

    const filteredEvents: NDKEvent[] = [];

    for (const e of events) {
        if ($wot.has(e.pubkey)) filteredEvents.push(e);
    }

    return filteredEvents;
}
export async function updateFollowsAndWotScore(ndk: NDKSvelte) {
    const user = get(currentUser);
    try {
        if (!user) throw new Error('Could not get user');
        const $networkWoTScores = new Map<Hexpubkey, number>();
        const $currentUserFollows = new Set<Hexpubkey>();

        const queryRelayMap = await NDKRelayList.forUsers([user.pubkey, BTCTroubleshootPubkey], ndk);
        console.log('relay map', queryRelayMap)

        const userWriteRelays = queryRelayMap.get(user.pubkey)?.writeRelayUrls;
        const bootstrapWriteRelays = queryRelayMap.get(BTCTroubleshootPubkey)?.writeRelayUrls;

        if (!userWriteRelays || !bootstrapWriteRelays) {
            throw new Error('Could not get user or bootstrap relays!');
        }
        console.log('user write relays', userWriteRelays)
        console.log('bootstrap write relays', bootstrapWriteRelays)

        const queryRelaySet = NDKRelaySet.fromRelayUrls(
            [],
            ndk
        );

        userWriteRelays.forEach(
            (relay: WebSocket['url']) => queryRelaySet.addRelay(new NDKRelay(relay))
        );
        bootstrapWriteRelays.forEach(
            (relay: WebSocket['url']) => queryRelaySet.addRelay(new NDKRelay(relay))
        );

        console.log('write relay for user and bootstrap account: ', queryRelaySet);

        // user and bootstrap 'trust' basis: follows, mutes and reports
        const trustBasisFilter: NDKFilter = {
            kinds: [NDKKind.Contacts, NDKKind.MuteList, NDKKind.Report],
            authors: [user.pubkey, BTCTroubleshootPubkey]
        }

        const trustBasisEvents = await ndk.fetchEvents(
            trustBasisFilter,
            {
                groupable: false,
                closeOnEose: true,
                cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
            },
            queryRelaySet,
        );

        console.log('trustBasisEvents', trustBasisEvents)

        // first order scores. Authors for the second order wot score are recorded
        const authors: Set<Hexpubkey> = updateWotScores(trustBasisEvents, $networkWoTScores, true);
        // Get a common relay set for the user's network
        //
        // The forUsers() method is bugs with many authors for some reason! 
        // const networkQueryRelayMap = await NDKRelayList.forUsers(Array.from(authors), ndk);

        // Now get ALL second order follows, mutes and reports
        const authorsArray = Array.from(authors);
        console.log('authors', authors)

        const queryBatchSize = 20;
        for (let i = 0; i < authorsArray.length; i+= queryBatchSize) {
            const networkQueryRelaySet = NDKRelaySet.fromRelayUrls(
                [],
                ndk
            );
            // Calculate relays fo the batch
            const authorsToQuery = [];
            for (let j = i; j < i + queryBatchSize; j++) {
                // dont index out of bound
                if (j === authors.size) {
                    console.log('reached end of authors, breaking..')
                    break;
                }

                authorsToQuery.push(authorsArray[j]);

                const relays: NDKRelayList | undefined = await NDKRelayList
                    .forUser(authorsArray[j], ndk);

                if (relays) {
                    relays.writeRelayUrls.forEach((r: string) => {
                        networkQueryRelaySet.addRelay(new NDKRelay(r));
                    });
                }
            }
            console.log('Network query relay set: ', networkQueryRelaySet)
            // Fetch data and update wot scores in batch
            const networkFilter = {
                kinds: [NDKKind.Contacts, NDKKind.MuteList, NDKKind.Report],
                authors: authorsToQuery,
            };

            const networkStore = await ndk.fetchEvents(
                networkFilter,
                {
                    groupable: false,
                    closeOnEose: true,
                    cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
                },
                networkQueryRelaySet,
            );

            console.log('Network event store', networkStore)

            // Second order scores
            updateWotScores(networkStore, $networkWoTScores, false);
            console.log("Updated Network wot scores:", $networkWoTScores);
        }

        networkWoTScores.set($networkWoTScores);

        followsUpdated.set(Math.floor(Date.now() / 1000));

        wotUpdated.set(true);

        console.log("Follows", get(currentUserFollows));
        console.log("wot pubkeys", get(wot));
        setTimeout(()=>{console.log('ndk pool after 35secs of completion:', ndk.pool)}, 35000);
        setTimeout(()=>{console.log('ndk pool after 65secs of completion:', ndk.pool)}, 65000);
        setTimeout(()=>{console.log('ndk pool after 95secs of completion:', ndk.pool)}, 95000);
        setTimeout(()=>{console.log('ndk pool after 165secs of completion:', ndk.pool)}, 165000);
        setTimeout(()=>{console.log('ndk pool after 240secs of completion:', ndk.pool)}, 240000);
    } catch (e) {
        console.log('Could not update Web of Trust scores: ', e)
    }
}

function updateWotScores(events: Set<NDKEvent>, networkWoTScores:Map<Hexpubkey, number>, firstOrderFollows: boolean): Set<Hexpubkey> {
    const user = get(currentUser);
    const $currentUserFollows = get(currentUserFollows);
    if (!user || !$currentUserFollows || !networkWoTScores) {
        throw new Error('Could not get data to update wot scores');
    }
    const followWot = (firstOrderFollows ? firstOrderFollowWot : secondOrderFollowWot);
    const muteWot = (firstOrderFollows ? firstOrderMuteWot : secondOrderMuteWot);
    const reportWot = (firstOrderFollows ? firstOrderReportWot : secondOrderReportWot);

    const authors: Set<Hexpubkey> = new Set();

    events.forEach((event: NDKEvent)=> {
        if (event.kind === NDKKind.Contacts) {
            const follows = filterValidPTags(event.tags);
            // console.log('follows', follows)
            const userFollow:boolean = (event.pubkey === user.pubkey);
            follows.forEach((f: Hexpubkey) => {
                if (userFollow) $currentUserFollows.add(f);

                // Add first order follow score
                const currentScore:number = (networkWoTScores as Map<Hexpubkey, number>)
                    .get(f) ?? 0;

                (networkWoTScores as Map<Hexpubkey, number>)
                    .set(f, currentScore + followWot);
                // Register first order follows for second order follows query
                authors.add(f);
            });
            events.delete(event);
        }
    });

    events.forEach((event: NDKEvent)=> {
        if (event.kind === NDKKind.MuteList) {
            const mutes = filterValidPTags(event.tags);
            mutes.forEach((mutedPerson: Hexpubkey) => {
                const currentScore:number|undefined = networkWoTScores.get(mutedPerson);
                // Only include score if part of the follow network
                if (currentScore) {
                    // Add mute score
                    networkWoTScores.set(mutedPerson, currentScore + muteWot);
                }
            });
        } else if (event.kind === NDKKind.Report) {
            const reportedPerson = filterValidPTags(event.tags).at(0);
            if (reportedPerson) {
                // console.log('reported: ', reportedPerson)
                // const reason = event.getMatchingTags('p')[0][2];
                // console.log('for: ', reason)
                const currentScore:number|undefined = networkWoTScores.get(reportedPerson);
                // Only include score if part of the follow network
                if (currentScore) {
                    // Add report score
                    networkWoTScores.set(reportedPerson, currentScore + reportWot);
                }
            }
        }
    });


    if (firstOrderFollows) {
        currentUserFollows.set($currentUserFollows);
    }

    return authors;
}

export function getWotScore(targetUser: NDKUser): number|undefined {
    const $networkWoTScores = get(networkWoTScores);

    if (!$networkWoTScores) return undefined;

    return ($networkWoTScores as Map<Hexpubkey, number>).get(targetUser.pubkey);
}

export function getWotPercentile(targetUser: NDKUser): number|undefined {
    const $networkWoTScores:Map<Hexpubkey, number> | null = get(networkWoTScores);
    if (!$networkWoTScores) return undefined;

    if (!$networkWoTScores.has(targetUser.pubkey)) return undefined;

    const wotValue = $networkWoTScores.get(targetUser.pubkey) as number;

    const wotValues:number[] = Array.from($networkWoTScores.values());

    return percentile(wotValues, wotValue);
}

