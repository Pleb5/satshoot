import { JobEvent } from '$lib/events/JobEvent';
import { writable } from 'svelte/store';

export const jobToEdit = writable<JobEvent | null>(null);
