import { localStorageStore } from "@skeletonlabs/skeleton";
import type { Writable } from 'svelte/store';

const notificationsEnabled: Writable<boolean> = localStorageStore('notificationsEnabled', false) ;

export default notificationsEnabled;
