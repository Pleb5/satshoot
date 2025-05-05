import type { JobEvent } from '$lib/events/JobEvent';
import { writable } from 'svelte/store';

// Interface for job post success state
interface JobPostSuccessState {
    showModal: boolean;
    jobData: JobEvent | null;
}

// Create a store that will survive page navigations
export const jobPostSuccessState = writable<JobPostSuccessState>({
    showModal: false,
    jobData: null,
});

interface BidTakenState {
    showModal: boolean;
    jobId: string | null;
}

export const bidTakenState = writable<BidTakenState>({
    showModal: false,
    jobId: null,
});
