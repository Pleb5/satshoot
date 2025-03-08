import { writable } from 'svelte/store';

export enum RelayType {
    READ,
    WRITE
}

export const online = writable(true);
export const showedDisconnectToast = writable(false);
export const maxRetryAttempts = 2;
export const retryDelay = 4000; //ms
export const retryConnection = writable(maxRetryAttempts);

const redirectStore = writable('') ;

export default redirectStore;
