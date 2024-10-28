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

export interface AggregatedClientRatings {
    type: 'client',
    thumbsUp: number,
    thumbsDown: number,
    availability: number,
    communication: number,
    average: number,
}

export interface AggregatedFreelancerRatings {
    type: 'freelancer',
    success: number,
    failure: number,
    expertise: number,
    availability: number,
    communication: number,
    average: number,
}

// We only return the first review that actually refers to a ticket
function filterDuplicateReviewsOnSameDeal(reviews: ReviewEvent[])
    : ReviewEvent[] {
    const filteredReviews = Array.from(
        reviews.reduce(
            (map: Map<string, ReviewEvent>, r: ReviewEvent) => {
                if (r.reviewedEventAddress) {
                    map.set(r.reviewedEventAddress, r)
                }
                return map;
            }
            , new Map<string, ReviewEvent>()
        ).values()
    );

    return filteredReviews;
}

export function aggregateClientRatings(target: Hexpubkey)
    : AggregatedClientRatings {
    const reviewsOnClient = get(clientReviews).filter((r: ReviewEvent) => {
        return r.reviewedPerson === target;
    });

    const filteredClientReviews = filterDuplicateReviewsOnSameDeal(reviewsOnClient);

    const aggregateClientRatings: AggregatedClientRatings = {
        type: 'client',
        thumbsUp: 0,
        thumbsDown: 0,
        availability: 0,
        communication: 0,
        average: 0,
    };

    let aggregatedAverage = 0;
    let numberOfReviews = 0;
    for (const clientReview of filteredClientReviews) {
        // Users own reviews are counted 4X in the aggregatedAverage score
        let scoreMultiplier = 1;
        numberOfReviews += 1;

        const $currentUser = get(currentUser);
        if ($currentUser && clientReview.pubkey === $currentUser.pubkey) {
            scoreMultiplier = 4;
            numberOfReviews += 3;
        }
        const sum = (clientReview.overallRating ?? 0) * scoreMultiplier;
        aggregatedAverage += sum;

        const rating = clientReview.clientRatings;
        if (rating.thumb) {
            aggregateClientRatings.thumbsUp += 1;
        } else {
            aggregateClientRatings.thumbsDown += 1;
        }
        if (rating.availability) {
            aggregateClientRatings.availability += 1;
        }
        if (rating.communication) {
            aggregateClientRatings.communication += 1;
        }
    }

    aggregatedAverage /= numberOfReviews;
    aggregateClientRatings.average = aggregatedAverage;

    return aggregateClientRatings;
}

export function aggregateFreelancerRatings(target: Hexpubkey)
    : AggregatedFreelancerRatings {
    const reviewsOnFreelancer = get(freelancerReviews).filter((r: ReviewEvent) => {
        return r.reviewedPerson === target;
    });

    const filteredFreelancerReviews = filterDuplicateReviewsOnSameDeal(reviewsOnFreelancer);

    const aggregateFreelancerRatings: AggregatedFreelancerRatings = {
        type: 'freelancer',
        success: 0,
        failure: 0,
        expertise: 0,
        availability: 0,
        communication: 0,
        average: 0,
    };

    let aggregatedAverage = 0;
    let numberOfReviews = 0;
    for (const freelancerReview of filteredFreelancerReviews) {
        // Users own reviews are counted 4X in the aggregatedAverage score
        let scoreMultiplier = 1;
        numberOfReviews += 1;

        const $currentUser = get(currentUser);
        if ($currentUser && freelancerReview.pubkey === $currentUser.pubkey) {
            scoreMultiplier = 4;
            numberOfReviews += 3;
        }
        const sum = (freelancerReview.overallRating ?? 0) * scoreMultiplier;
        aggregatedAverage += sum;

        const rating = freelancerReview.freelancerRatings;
        if (rating.success) {
            aggregateFreelancerRatings.success += 1;
        } else {
            aggregateFreelancerRatings.failure += 1;
        }
        if (rating.expertise) {
            aggregateFreelancerRatings.expertise += 1;
        }
        if (rating.availability) {
            aggregateFreelancerRatings.availability += 1;
        }
        if (rating.communication) {
            aggregateFreelancerRatings.communication += 1;
        }
    }

    aggregatedAverage /= numberOfReviews;
    aggregateFreelancerRatings.average = aggregatedAverage;

    return aggregateFreelancerRatings;
}
