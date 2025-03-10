import { writable } from 'svelte/store';

export enum DrawerIDs {
    AppMenu,
}

const drawerID = writable(DrawerIDs.AppMenu);

export default drawerID;
