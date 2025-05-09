import type { JobEvent } from '$lib/events/JobEvent';
import type { ServiceEvent } from '$lib/events/ServiceEvent';
import { writable } from 'svelte/store';

// Interface for job post success state
interface JobPostSuccessState {
    showModal: boolean;
    jobData: JobEvent | null;
}

interface ServicePostSuccessState {
    showModal: boolean;
    serviceData: ServiceEvent | null;
}

// Create a store that will survive page navigations
export const jobPostSuccessState = writable<JobPostSuccessState>({
    showModal: false,
    jobData: null,
});

export const servicePostSuccessState = writable<ServicePostSuccessState>({
    showModal: false,
    serviceData: null,
});

interface BidTakenState {
    showModal: boolean;
    jobId: string | null;
}

export const bidTakenState = writable<BidTakenState>({
    showModal: false,
    jobId: null,
});
