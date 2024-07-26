import { writable } from 'svelte/store';

export const online = writable(false);
export const showedDisconnectToast = writable(false);
const redirectStore = writable('') ;

export default redirectStore;
