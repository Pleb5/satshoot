import type { NDKUser } from '@nostr-dev-kit/ndk';
import { writable } from 'svelte/store';

export const loginAlert = writable(true) ;

export const loggedIn = writable(false) ;

const currentUser = writable<NDKUser|null>(null);

export default currentUser;
