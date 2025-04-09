import { writable, get, derived } from 'svelte/store';
import { persisted } from 'svelte-persisted-store';
import type { Writable } from 'svelte/store';

import { getMapSerializer, SatShootPubkey, filterValidPTags } from '../utils/misc';

import type { NDKEvent, NDKUser, Hexpubkey, NDKFilter } from '@nostr-dev-kit/ndk';

import { NDKSubscriptionCacheUsage, NDKKind } from '@nostr-dev-kit/ndk';

import type NDKSvelte from '@nostr-dev-kit/ndk-svelte';
import { tick } from 'svelte';

import currentUser, { currentUserFreelanceFollows, fetchFreelanceFollowEvent } from '../stores/user';
import {followsUpdated } from '../stores/user';

import satShootWoT from './satshoot-wot';

export const networkWoTScores: Writable<Map<Hexpubkey, number>> = persisted(
    'networkWoTScores',
    new Map(),
    { serializer: getMapSerializer<Hexpubkey, number>() }
);

// Minimum wot to b
// e included in any result
export const minWot = writable(3);

// WoT scores for follows, mutes and reports
const firstOrderFollowWot = 4;
const firstOrderMuteWot = -0.5 * firstOrderFollowWot;
const firstOrderReportWot = -0.5 * firstOrderFollowWot;

const secondOrderFollowWot = 1;
const secondOrderMuteWot = -0.5 * secondOrderFollowWot;
const secondOrderReportWot = -0.5 * secondOrderFollowWot;

export const useSatShootWoT: Writable<boolean> = persisted('useSatShootWoT', true);

export const wotUpdating = writable(false);
export const wotUpdateFailed = writable(false);
export const wotUpdateNoResults = writable(false);
export const wotLoaded = writable(false);

let saveSatShootWoT = false;
export const wot = derived(
    [
        networkWoTScores,
        minWot,
        currentUser,
        currentUserFreelanceFollows,
        useSatShootWoT
    ],
    (
        [
            $networkWoTScores,
            $minWot,
            $currentUser,
            $currentUserFreelanceFollows,
            $useSatShootWoT
        ]
    ) => {
        // Make sure all these stores are properly initialized
        console.log('LOG', {
            networkWoTScores: !!networkWoTScores,
            minWot: !!minWot,
            currentUser: !!currentUser,
            currentUserFreelanceFollows: !!currentUserFreelanceFollows,
            useSatShootWoT: !!useSatShootWoT,
        });
        const initialWoT: Array<Hexpubkey> = [];
        if ($useSatShootWoT) {
            initialWoT.push(SatShootPubkey);
            initialWoT.push(...satShootWoT);
        }

        const pubkeys = new Set<Hexpubkey>(initialWoT);

        $networkWoTScores.forEach((score: number, follow: Hexpubkey) => {
            if (score >= $minWot) pubkeys.add(follow);
        });

        if ($currentUser) {
            pubkeys.add($currentUser.pubkey);

            // add current user's freelance follows to wot
            $currentUserFreelanceFollows.forEach((follow) => {
                pubkeys.add(follow);
            });

            if ($currentUser.pubkey === SatShootPubkey && saveSatShootWoT) {
                saveSatShootWoTInFile(pubkeys);
            }
        }

        return pubkeys;
    }
);

export async function loadWot(ndk: NDKSvelte, user: NDKUser) {
    // This should not take more than 15 sec
    setTimeout(() => {
        if (get(wotUpdating)) {
            wotUpdateFailed.set(true);
            throw new Error('Updating Wot score took too long!');
        }
    }, 30_000);

    try {
        wotUpdating.set(true);
        await tick();

        // fetch the freelance follow event of current user
        const freelanceFollows = await fetchFreelanceFollowEvent(user.pubkey);

        if (updateNecessary()) {
            const primaryWoTEventsFilter: NDKFilter = {
                kinds: [NDKKind.Contacts, NDKKind.MuteList, NDKKind.Report],
                authors: [user.pubkey],
            };

            const primaryWoTEvents = await ndk.fetchEvents(
                primaryWoTEventsFilter,
                {
                    groupable: false,
                    closeOnEose: true,
                    cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
                }
            );

            if (primaryWoTEvents.size > 0) {
                await updateSocialWoT(primaryWoTEvents, ndk);
            }

            if (get(networkWoTScores).size === 0 && !freelanceFollows) {
                wotUpdateNoResults.set(true);
            }
        }

        wotUpdating.set(false);
        wotLoaded.set(true);
        wotUpdateFailed.set(false);
    } catch (e) {
        wotUpdating.set(false);
        wotUpdateFailed.set(true);
        console.log('Could not update Web of Trust scores: ', e);
    }
}

function updateNecessary(): boolean {
    const $followsUpdated = get(followsUpdated) as number;
    // Update wot every 5 hours: Newbies can get followers and after 5 hours
    // their actions will be visible to a decent amount of people
    const updateDelay = Math.floor(Date.now() / 1000) - 60 * 60 * 5;

    const $networkWoTScores = get(networkWoTScores);

    if (
        $followsUpdated < updateDelay ||
            $networkWoTScores.size === 0
    ) {
        return true;
    }
    return false;
}

async function updateSocialWoT(
    primaryWoTEvents: Set<NDKEvent>, 
    ndk: NDKSvelte
) {
    const newWoTScores = new Map<Hexpubkey, number>();

    // first order scores. Authors for the second order wot score are recorded
    const authors: Set<Hexpubkey> = updateWotScores(
        primaryWoTEvents,
        newWoTScores,
        true
    );
    // Get a common relay set for the user's network

    // Now get ALL second order follows, mutes and reports
    const authorsArray = Array.from(authors);

    await ndk.outboxTracker!.trackUsers(authorsArray);

    const networkFilter = {
        kinds: [
            NDKKind.Contacts,
            NDKKind.MuteList,
            NDKKind.Report,
            NDKKind.Metadata
        ],
        authors: authorsArray,
    };

    const networkEvents = await ndk.fetchEvents(networkFilter, {
        groupable: false,
        closeOnEose: true,
        cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
    });

    if (networkEvents.size === 0) {
        throw new Error(
            'Could not fetch events to build trust network from INDIRECT follows!'
        );
    }

    // Second order scores
    updateWotScores(networkEvents, newWoTScores, false);

    networkWoTScores.set(newWoTScores);
    console.log('Updated Network wot scores:', networkWoTScores);

    followsUpdated.set(Math.floor(Date.now() / 1000));
}

function updateWotScores(
    events: Set<NDKEvent>,
    networkWoTScores: Map<Hexpubkey, number>,
    firstOrderFollows: boolean
): Set<Hexpubkey> {
    const user = get(currentUser);
    if (!user || !networkWoTScores) {
        throw new Error('Could not get data to update wot scores');
    }
    const followWot = firstOrderFollows ? firstOrderFollowWot : secondOrderFollowWot;
    const muteWot = firstOrderFollows ? firstOrderMuteWot : secondOrderMuteWot;
    const reportWot = firstOrderFollows ? firstOrderReportWot : secondOrderReportWot;

    const authors: Set<Hexpubkey> = new Set();

    events.forEach((event: NDKEvent) => {
        if (event.kind === NDKKind.Contacts) {
            const follows = filterValidPTags(event.tags);
            const userFollow: boolean = event.pubkey === user.pubkey;
            follows.forEach((f: Hexpubkey) => {
                // Add first order follow score
                const currentScore: number =
                    (networkWoTScores as Map<Hexpubkey, number>).get(f) ?? 0;

                (networkWoTScores as Map<Hexpubkey, number>).set(f, currentScore + followWot);
                // Register first order follows for second order follows query
                authors.add(f);
            });
            events.delete(event);
        }
    });

    events.forEach((event: NDKEvent) => {
        if (event.kind === NDKKind.MuteList) {
            const mutes = filterValidPTags(event.tags);
            mutes.forEach((mutedPerson: Hexpubkey) => {
                const currentScore: number | undefined = networkWoTScores.get(mutedPerson);
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
                const currentScore: number | undefined = networkWoTScores.get(reportedPerson);
                // Only include score if part of the follow network
                if (currentScore) {
                    // Add report score
                    networkWoTScores.set(reportedPerson, currentScore + reportWot);
                }
            }
        }
    });

    return authors;
}

function saveSatShootWoTInFile(pubkeys: Set<Hexpubkey>) {
    // Save SatShoot WoT in file to use it later
    // as hardcoded initial WoT while user is not logged in
    // and as long as 'useSatShootWoT' is true
    // Recalculated on every release preferably
    const tsContent = `const satShootWoT = ${JSON.stringify(
        Array.from(pubkeys),
        null,
        2
    )};\nexport default satShootWoT;`;
    const blob = new Blob([tsContent], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const atag = document.createElement('a');
    atag.href = url;
    atag.download = 'satshoot-wot.ts';
    atag.click();
    URL.revokeObjectURL(url);
    saveSatShootWoT = false;
}
