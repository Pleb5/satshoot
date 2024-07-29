import { writable } from 'svelte/store';
import { localStorageStore } from "@skeletonlabs/skeleton";

export const online = writable(false);
export const showedDisconnectToast = writable(false);
export const retryConnection = localStorageStore('retryConnection', 2);
const redirectStore = writable('') ;

export default redirectStore;
