import { writable } from 'svelte/store';
import { localStorageStore } from "@skeletonlabs/skeleton";

export const online = writable(true);
export const showedDisconnectToast = writable(false);
export const retryAttempts = writable(2);
export const retryConnection = localStorageStore('retryConnection', retryAttempts);
const redirectStore = writable('') ;

export default redirectStore;
