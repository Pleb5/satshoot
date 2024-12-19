import { writable } from 'svelte/store';

export const searchTerms = writable<Set<string>>(new Set());
