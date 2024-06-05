import { writable } from 'svelte/store';

export enum drawerIDs {
    ReviewBreakdown = 0,
    UserMenu = 1,
}

const drawerID = writable(drawerIDs.ReviewBreakdown);

export default drawerID;
