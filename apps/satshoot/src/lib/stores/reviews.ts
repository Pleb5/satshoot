import { get, derived } from 'svelte/store';
import ndk from '$lib/stores/ndk';
import { type NDKSubscriptionOptions } from '@nostr-dev-kit/ndk';
import { wot } from '$lib/stores/wot';
import currentUser from '$lib/stores/user';
import {
    type ClientRating,
    type FreelancerRating,
    ReviewEvent, 
    ReviewType,

} from '$lib/events/ReviewEvent';

import {
    NDKKind,
    type Hexpubkey,
    type NDKFilter,
} from '@nostr-dev-kit/ndk';
import { orderEventsChronologically } from '$lib/utils/helpers';

export const subOptions: NDKSubscriptionOptions = {
    closeOnEose: false,
    groupable: false,
};

export const allReviewsFilter: NDKFilter<NDKKind.Review> = {
    kinds: [NDKKind.Review],
    '#L': ['qts/freelancing'],
};

// export const reviewsOnMyTicketsFilter: NDKFilter<NDKKind.Review> = {
//     kinds: [NDKKind.Review],
//     '#L': ['qts/freelancing'],
//     authors: [],
//     '#a': [],
// };

// export const reviewsOnMyOffersFilter: NDKFilter<NDKKind.Review> = {
//     kinds: [NDKKind.Review],
//     '#L': ['qts/freelancing'],
//     authors: [],
//     '#a': [],
// };

export const allReviews = get(ndk).storeSubscribe(
    allReviewsFilter,
    subOptions,
    ReviewEvent
);

export const clientReviews = derived(
    [wot, allReviews],
    ([$wot, $allReviews]) => {
        const reviews = $allReviews.filter((r: ReviewEvent) => {
            return (r.type === ReviewType.Client && $wot.has(r.pubkey))
        });

        orderEventsChronologically(reviews);
        return reviews;
    }
);

export const freelancerReviews = derived(
    [wot, allReviews],
    ([$wot, $allReviews]) => {
        // console.log('review arrived', get(allReviews))
        const reviews = $allReviews.filter((r: ReviewEvent) => {
            return (r.type === ReviewType.Freelancer && $wot.has(r.pubkey))
        });

        orderEventsChronologically(reviews);
        return reviews;

    }
);

export function userClientRatings(source: Hexpubkey, target: Hexpubkey):
    Array<ClientRating> {
    const ratings: Array<ClientRating> = [];

    get(clientReviews).forEach((r: ReviewEvent) => {
        if (r.reviewedPerson === target && r.pubkey === source) {
            ratings.push(r.clientRatings);
        }
    });

    return ratings
}

export function userFreelancerRatings(source: Hexpubkey, target: Hexpubkey):
    Array<FreelancerRating> {
    const ratings: Array<FreelancerRating> = [];

    get(freelancerReviews).forEach((r: ReviewEvent) => {
        if (r.reviewedPerson === target && r.pubkey === source) {
            ratings.push(r.freelancerRatings);
        }
    });

    return ratings
}

export function aggregateClientRatings(target: Hexpubkey)
    : Map<string, number> {
    const ratings: Map<string, number> = new Map();
    const thumbString = 'Positive Overall Experience';
    const availabilityString = 'Availability';
    const communicationString = 'Communication';

    const reviews = get(clientReviews).filter((r: ReviewEvent) => {
        return r.reviewedPerson === target;
    });
    ratings.set(thumbString, 0);
    ratings.set(availabilityString, 0);
    ratings.set(communicationString, 0);

    // Filter out duplicate reviews: Same person posted
    // on the same event address but different event ID
    for (const review of reviews) {
        for(let i = 0; i < reviews.length; i++) {
            const compareReview = reviews[i];
            if (review.pubkey === compareReview.pubkey
                && review.reviewedEventAddress === compareReview.reviewedEventAddress
                && review.id !== compareReview.id) {
                reviews.splice(i, 1);
            }
        }
    }

    // console.log('filtered target reviews', reviews)

    let aggregatedAverage = 0;
    let numberOfReviews = 0;
    for (let i = 0; i < reviews.length; i++){
        const r = reviews[i];
        // console.log('rating: ', r)
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

        const rating = r.clientRatings;
        // console.log('rating: ', rating)
        if (rating.thumb) {
            const currentCount = ratings.get(thumbString) ?? 0;
            ratings.set(thumbString, currentCount + 1);
        } 
        if (rating.availability) {
            const currentCount = ratings.get(availabilityString) ?? 0;
            ratings.set(availabilityString, currentCount + 1);
        }
        if (rating.communication) {
            const currentCount = ratings.get(communicationString) ?? 0;
            ratings.set(communicationString, currentCount + 1);
        }
    }

    aggregatedAverage /= numberOfReviews;
    ratings.set("average", aggregatedAverage);
    // console.log('ratings', ratings)

    return ratings;
}

export function aggregateFreelancerRatings(target: Hexpubkey)
    : Map<string, number> {
    const ratings: Map<string, number> = new Map();
    const successString = 'Successful Jobs';
    const expertiseString = 'Expertise';
    const availabilityString = 'Availability';
    const communicationString = 'Communication';

    const reviews = get(freelancerReviews).filter((r: ReviewEvent) => {
        return r.reviewedPerson === target;
    });

    ratings.set(successString, 0);
    ratings.set(expertiseString, 0);
    ratings.set(availabilityString, 0);
    ratings.set(communicationString, 0);

    // Filter out duplicate reviews: Same person posted
    // on the same event address but different event ID
    for (const review of reviews) {
        for(let i = 0; i < reviews.length; i++) {
            const compareReview = reviews[i];
            if (review.pubkey === compareReview.pubkey
                && review.reviewedEventAddress === compareReview.reviewedEventAddress
                && review.id !== compareReview.id) {
                reviews.splice(i, 1);
            }
        }
    }

    // console.log('filtered target reviews', reviews)

    let aggregatedAverage = 0;
    let numberOfReviews = 0;
    for (let i = 0; i < reviews.length; i++){
        const r = reviews[i];
        // console.log('rating: ', r)
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

        const rating = r.freelancerRatings;
        // console.log('rating: ', rating)
        if (rating.success) {
            const currentCount = ratings.get(successString) ?? 0;
            ratings.set(successString, currentCount + 1);
        } 
        if (rating.expertise) {
            const currentCount = ratings.get(expertiseString) ?? 0;
            ratings.set(expertiseString, currentCount + 1);
        } 
        if (rating.availability) {
            const currentCount = ratings.get(availabilityString) ?? 0;
            ratings.set(availabilityString, currentCount + 1);
        }
        if (rating.communication) {
            const currentCount = ratings.get(communicationString) ?? 0;
            ratings.set(communicationString, currentCount + 1);
        }
    }

    aggregatedAverage /= numberOfReviews;
    ratings.set("average", aggregatedAverage);
    // console.log('ratings', ratings)

    return ratings;
}
