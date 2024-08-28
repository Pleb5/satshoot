import { writable } from 'svelte/store';
import { persisted } from "svelte-persisted-store";

export const online = writable(true);
export const showedDisconnectToast = writable(false);
export const retryAttempts = writable(2);
export const retryConnection = persisted('retryConnection', retryAttempts);
const redirectStore = writable('') ;

export default redirectStore;
