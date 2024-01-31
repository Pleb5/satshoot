import { writable } from "svelte/store";
import { NDKUser } from "@nostr-dev-kit/ndk";


const currentUser = writable<NDKUser | null>(null);

