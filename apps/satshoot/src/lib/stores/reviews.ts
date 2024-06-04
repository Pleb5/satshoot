import ndk from './ndk.ts';
import { get, derived } from 'svelte/store';
import { wot } from './wot.ts';
import currentUser from './user.ts';
import { ClientRating, ReviewEvent, ReviewType } from '../events/ReviewEvent.ts';
import { NDKKind, type Hexpubkey } from '@nostr-dev-kit/ndk';

export const subOptions: NDKSubscriptionOptions = {
    closeOnEose: false,
    groupable: false,
    autoStart: false,
};

export const allReviewsFilter = {
    kinds: [NDKKind.Review],
    authors: [],
    '#L': ['qts/troubleshooting'],
};

export const allReviews = get(ndk).storeSubscribe(
    allReviewsFilter,
    subOptions,
    ReviewEvent
);


export const clientReviews = derived(
    [wot, allReviews],
    ([$wot, $allReviews]) => {
        return $allReviews.filter((r: ReviewEvent) => {
            return (r.type === ReviewType.Client && $wot.has(r.pubkey))
        });
    }
);

export const troubleshooterReviews = derived(
    [wot, allReviews],
    ([$wot, $allReviews]) => {
        return $allReviews.filter((r: ReviewEvent) => {
            return (r.type === ReviewType.Troubleshooter && $wot.has(r.pubkey))
        });
    }
);

// user reviews derived store that returns a map: Map<ReviewType, Map<Hexpubkey, Array<ClientRating | TroubleshooterRating>>>

export function aggregateClientRatings(client: Hexpubkey): Map<string, number> {
    const ratings: Map<string, number> = new Map();
    const $clientReviews = get(clientReviews).filter((r: ReviewEvent) => {
        return r.pubkey === client;
    });
    console.log('filtered client reviews', clientReviews)

    for (let i = 0; i < $clientReviews.length; i++){
        const r = $clientReviews[i];
        // currentUser must exist here bc reivews depend on wot
        // and wot on currentUser(init  user)
        // Users own reviews are counted 4X in the aggregate score
        const scoreMultiplier = (r.pubkey === get(currentUser)!.pubkey) ? 4 : 1;
        const rating = r.ratings as ClientRating;
        if (rating.thumb) {
            const currentCount = ratings.get('thumb') ?? 0;
            ratings.set('thumb', currentCount + 1);
        } 
        if (rating.availability) {
            const currentCount = ratings.get('availability') ?? 0;
            ratings.set('availability', currentCount + 1);
        }
        if (rating.communication) {
            const currentCount = ratings.get('communication') ?? 0;
            ratings.set('communication', currentCount + 1);
        }
    }
    return ratings;
}
