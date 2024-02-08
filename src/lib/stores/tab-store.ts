import { localStorageStore } from "@skeletonlabs/skeleton";
import type { Writable } from 'svelte/store';

const tabStore: Writable<number> = localStorageStore('tabStore', 0) ;

export default tabStore;
