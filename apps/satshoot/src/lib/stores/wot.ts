import { writable, get, derived } from 'svelte/store';
import { persisted } from 'svelte-persisted-store';
import type { Writable } from 'svelte/store';

import {
    getMapSerializer,
    SatShootPubkey,
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
    NDKKind,
} from '@nostr-dev-kit/ndk';

import { type NDKSvelte } from '@nostr-dev-kit/ndk-svelte';

import currentUser from '../stores/user';
import {
    currentUserFollows,
    followsUpdated,
} from '../stores/user';
import { tick } from 'svelte';

export const networkWoTScores: Writable<Map<Hexpubkey, number> | null>
    = persisted('networkWoTScores', null, {serializer: getMapSerializer()});

// Minimum wot to be included in any result
export const minWot = writable(3);

// WoT scores for follows, mutes and reports
const firstOrderFollowWot = 4;
const firstOrderMuteWot = -0.5*(firstOrderFollowWot);
const firstOrderReportWot = -0.5*(firstOrderFollowWot);
const secondOrderFollowWot = 1;
const secondOrderMuteWot = -0.5*(secondOrderFollowWot);
const secondOrderReportWot = -0.5*(secondOrderFollowWot);

export const useBootstrapAccount = true;

export const wotUpdating = writable(false);
export const wotUpdateFailed = writable(false);

export const wot = derived(
    [networkWoTScores, minWot, currentUser],
    ([$networkWoTScores, $minWot, $currentUser]) => {
        const pubkeys = new Set<Hexpubkey>();

        $networkWoTScores?.forEach((score: number, follow: Hexpubkey) => {
            if (score >= $minWot) pubkeys.add(follow);
        });

        if ($currentUser) {
            pubkeys.add($currentUser.pubkey);
            pubkeys.add(SatShootPubkey);
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
    // This should not take more than 15 sec
    setTimeout(
        () => {
            if (get(wotUpdating)) {
                wotUpdateFailed.set(true);
                throw new Error('Updating Wot score took too long!');
            }
        },
        15_000
    );
    const user = get(currentUser);
    try {
        wotUpdating.set(true);
        console.log('wotupdating', get(wotUpdating))
        await tick();
        if (!user) throw new Error('Could not get user');
        const $networkWoTScores = new Map<Hexpubkey, number>();


        await ndk.outboxTracker!.trackUsers([user.pubkey, SatShootPubkey]);

        // log write relays with buitin fn

        // user and bootstrap 'trust' basis: follows, mutes and reports
        const trustBasisFilter: NDKFilter = {
            kinds: [NDKKind.Contacts, NDKKind.MuteList, NDKKind.Report],
            authors: [user.pubkey, SatShootPubkey]
        }

        console.log('outboxPool:', ndk.outboxPool)

        const trustBasisEvents = await ndk.fetchEvents(
            trustBasisFilter,
            {
                groupable: false,
                closeOnEose: true,
                cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
            },
        );

        console.log('trustBasisEvents', trustBasisEvents)

        if (trustBasisEvents.size === 0) {
            console.log('Could not fetch events to build trust network!')
            throw new Error('Could not fetch events to build trust network!');
        }

        // first order scores. Authors for the second order wot score are recorded
        const authors: Set<Hexpubkey> = updateWotScores(trustBasisEvents, $networkWoTScores, true);
        // Get a common relay set for the user's network
        //

        // Now get ALL second order follows, mutes and reports
        const authorsArray = Array.from(authors);
        console.log('authors', authors)

        await ndk.outboxTracker!.trackUsers(authorsArray);

        console.log('outboxPool after tracking all authors:', ndk.outboxPool)

        const networkFilter = {
            kinds: [NDKKind.Contacts, NDKKind.MuteList, NDKKind.Report, NDKKind.Metadata],
            authors: authorsArray,
        };

        const networkStore = await ndk.fetchEvents(
            networkFilter,
            {
                groupable: false,
                closeOnEose: true,
                cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
            },
        );

        console.log('Network event store', networkStore)

        if (networkStore.size === 0) {
            throw new Error('Could not fetch events to build trust network from INDIRECT follows!');
        }

        // Second order scores
        updateWotScores(networkStore, $networkWoTScores, false);
        console.log("Updated Network wot scores:", $networkWoTScores);

        networkWoTScores.set($networkWoTScores);

        followsUpdated.set(Math.floor(Date.now() / 1000));

        wotUpdating.set(false);
        wotUpdateFailed.set(false);

        console.log("Follows", get(currentUserFollows));
        console.log("wot pubkeys", get(wot));
    } catch (e) {
        wotUpdating.set(false);
        wotUpdateFailed.set(true);
        console.log('Could not update Web of Trust scores: ', e)
    }
}

function updateWotScores(events: Set<NDKEvent>, networkWoTScores:Map<Hexpubkey, number>, firstOrderFollows: boolean): Set<Hexpubkey> {
    const user = get(currentUser);
    if (!user || !networkWoTScores) {
        throw new Error('Could not get data to update wot scores');
    }
    const $currentUserFollows = get(currentUserFollows) ?? new Set<Hexpubkey>;

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

