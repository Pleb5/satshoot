import { ServiceEvent } from '$lib/events/ServiceEvent';
import { writable } from 'svelte/store';

export const serviceToEdit = writable<ServiceEvent | null>(null);
