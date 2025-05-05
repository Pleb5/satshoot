import { get } from 'svelte/store';
import {
    NDKEvent,
    NDKKind,
    NDKRelay,
    NDKSubscription,
    NDKSubscriptionCacheUsage,
    type NDKFilter,
} from '@nostr-dev-kit/ndk';
import { JobEvent } from '$lib/events/JobEvent';
import { OfferEvent } from '$lib/events/OfferEvent';
import ndk from '$lib/stores/session';
import currentUserStore from '$lib/stores/user';
import { checkRelayConnections } from '$lib/utils/helpers';
import type { ContactService } from './ContactService.svelte';

/**
 * Service for handling job-related functionality
 */
export class JobService {
    // Public state for direct access
    job = $state<JobEvent | null>(null);
    offers = $state<OfferEvent[]>([]);
    isOwner = $state<boolean>(false);

    // Private properties
    private jobAddress: string;
    private relays: string[];
    private offerSubscription: NDKSubscription | null = null;
    private contactService: ContactService | null = null;

    constructor(jobAddress: string, relays: string[]) {
        this.jobAddress = jobAddress;
        this.relays = relays;
    }

    /**
     * Initialize with other services
     */
    async initialize(contactService: ContactService) {
        this.contactService = contactService;
        await this.initializeJob();
    }

    /**
     * Initialize the job details
     */
    private async initializeJob() {
        const ndkInstance = get(ndk);

        // Add relays from URL
        if (this.relays.length > 0) {
            this.relays.forEach((relayURL: string) => {
                if (relayURL) {
                    ndkInstance.pool.addRelay(new NDKRelay(relayURL, undefined, ndkInstance));
                }
            });
        }

        // Check relay connections
        try {
            await checkRelayConnections();
        } catch (error) {
            console.error('Error checking relay connections:', error);
        }

        // Fetch job details
        try {
            const jobEvent = await ndkInstance.fetchEvent(
                this.jobAddress,
                // Try to fetch latest state of the job
                // but fall back to cache
                { cacheUsage: NDKSubscriptionCacheUsage.PARALLEL }
            );

            if (jobEvent) {
                this.handleJobEvent(jobEvent);
            } else {
                console.warn('Job could not be fetched in chat page!');
            }

            this.initializeOffersSubscription();
        } catch (error) {
            console.error('Error fetching job details:', error);
        }
    }

    /**
     * Initialize subscription to offers for this job
     */
    private initializeOffersSubscription() {
        const ndkInstance = get(ndk);

        try {
            const offerFilter: NDKFilter = {
                kinds: [NDKKind.FreelanceOffer],
                '#a': [this.jobAddress],
            };

            this.offerSubscription = ndkInstance.subscribe(offerFilter, { closeOnEose: false });
            this.offerSubscription.on('event', (event: NDKEvent) => {
                this.handleOfferEvent(event);
            });
        } catch (error) {
            console.error('Error setting up offer subscription:', error);
        }
    }

    /**
     * Handle job event update
     */
    private handleJobEvent(event: NDKEvent) {
        const jobEvent = JobEvent.from(event);
        this.job = jobEvent;

        // Check if current user is the job owner
        const currentUser = get(currentUserStore);
        if (currentUser && jobEvent.pubkey === currentUser.pubkey) {
            this.isOwner = true;
        } else {
            this.isOwner = false;
        }

        // Handle winner if available
        const winner = jobEvent.winnerFreelancer;
        if (winner && this.contactService) {
            this.contactService.setWinnerPubkey(winner);
        }
    }

    /**
     * Handle offer event update
     */
    private handleOfferEvent(event: NDKEvent) {
        const offerEvent = OfferEvent.from(event);

        // Add to offers if not already present
        const existingIndex = this.offers.findIndex((o) => o.id === offerEvent.id);
        if (existingIndex >= 0) {
            // Create a new array with the updated offer
            const updatedOffers = [...this.offers];
            updatedOffers[existingIndex] = offerEvent;
            this.offers = updatedOffers;
        } else {
            // Add new offer
            this.offers = [...this.offers, offerEvent];
        }
    }

    /**
     * Unsubscribe from all subscriptions
     */
    unsubscribe() {
        if (this.offerSubscription) {
            this.offerSubscription.stop();
            this.offerSubscription = null;
        }
    }
}
