import type { TicketEvent } from '$lib/events/TicketEvent';
import { writable } from 'svelte/store';

// Interface for job post success state
interface JobPostSuccessState {
    showModal: boolean;
    jobData: TicketEvent | null;
}

// Create a store that will survive page navigations
export const jobPostSuccessState = writable<JobPostSuccessState>({
    showModal: false,
    jobData: null,
});

interface OfferTakenState {
    showModal: boolean;
    jobId: string | null;
}

export const offerTakenState = writable<OfferTakenState>({
    showModal: false,
    jobId: null,
});
