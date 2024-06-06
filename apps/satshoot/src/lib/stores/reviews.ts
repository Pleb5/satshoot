import { get, derived } from 'svelte/store';
import ndk from '$lib/stores/ndk';
import { wot } from '$lib/stores/wot';
import currentUser from '$lib/stores/user';
import {
    type ClientRating,
    type TroubleshooterRating,
    ReviewEvent, 
    ReviewType,

} from '$lib/events/ReviewEvent';
import {
    NDKKind,
    type Hexpubkey,
    type NDKFilter,
} from '@nostr-dev-kit/ndk';

export const subOptions: NDKSubscriptionOptions = {
    closeOnEose: false,
    groupable: false,
    autoStart: false,
};

export const allReviewsFilter: NDKFilter<NDKKind.Review> = {
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
        console.log('review arrived', get(allReviews))
        return $allReviews.filter((r: ReviewEvent) => {
            return (r.type === ReviewType.Troubleshooter && $wot.has(r.pubkey))
        });
    }
);

export function userReviews(source: Hexpubkey, target: Hexpubkey, type: ReviewType):
    Array<ClientRating | TroubleshooterRating> {
    const userReviews: Array<ClientRating | TroubleshooterRating> = [];

    let $reviews: ReviewEvent[];
    if (type === ReviewType.Client) {
        $reviews = get(clientReviews).filter((r: ReviewEvent) => {
            return (r.reviewedPerson === target && r.pubkey === source);
        });
    } else {
        $reviews = get(troubleshooterReviews).filter((r: ReviewEvent) => {
            return r.reviewedPerson === target && r.pubkey === source;
        });
    }

    $reviews.forEach((r: ReviewEvent) => {
        if (r.ratings) {
            userReviews.push(r.ratings);
        }
    });

    console.log('user reviews', userReviews)
    return userReviews;
}

export function aggregateRatings(target: Hexpubkey, type: ReviewType): Map<string, number> {
    const ratings: Map<string, number> = new Map();

    let $reviews: ReviewEvent[];
    if (type === ReviewType.Client) {
        $reviews = get(clientReviews).filter((r: ReviewEvent) => {
            return r.reviewedPerson === target;
        });
    } else {
        $reviews = get(troubleshooterReviews).filter((r: ReviewEvent) => {
            return r.reviewedPerson === target;
        });
    }

    console.log('filtered target reviews', $reviews)

    let aggregatedAverage = 0;
    let numberOfReviews = 0;
    for (let i = 0; i < $reviews.length; i++){
        const r = $reviews[i];
        console.log('rating: ', r)
        // currentUser must exist here bc reivews depend on wot
        // and wot on currentUser(init  user)
        // Users own reviews are counted 4X in the aggregatedAverage score
        let scoreMultiplier = 1;
        numberOfReviews += 1;
        if (r.pubkey === get(currentUser)!.pubkey) {
            scoreMultiplier = 4;
            numberOfReviews += 3;
        }
        const sum = (r.overallRating ?? 0) * scoreMultiplier;
        aggregatedAverage += sum;

        if (type === ReviewType.Client) {
            const rating = r.ratings as ClientRating;
            console.log('rating: ', rating)
            if (rating.thumb) {
                const currentCount = ratings.get('Positive Overall Experience') ?? 0;
                ratings.set('Positive Overall Experience', currentCount + 1);
            } 
            if (rating.availability) {
                const currentCount = ratings.get('Availability') ?? 0;
                ratings.set('Availability', currentCount + 1);
            }
            if (rating.communication) {
                const currentCount = ratings.get('Communication') ?? 0;
                ratings.set('Communication', currentCount + 1);
            }
        } else {
            const rating = r.ratings as TroubleshooterRating;
            console.log('rating: ', rating)
            if (rating.success) {
                const currentCount = ratings.get('Successful TroubleShoots') ?? 0;
                ratings.set('Successful TroubleShoots', currentCount + 1);
            } 
            if (rating.expertise) {
                const currentCount = ratings.get('Expertise') ?? 0;
                ratings.set('Expertise', currentCount + 1);
            } 
            if (rating.availability) {
                const currentCount = ratings.get('Availability') ?? 0;
                ratings.set('Availability', currentCount + 1);
            }
            if (rating.communication) {
                const currentCount = ratings.get('Communication') ?? 0;
                ratings.set('Communication', currentCount + 1);
            }
        }
    }

    aggregatedAverage /= numberOfReviews;
    ratings.set("average", aggregatedAverage);
    console.log('ratings', ratings)

    return ratings;
}
