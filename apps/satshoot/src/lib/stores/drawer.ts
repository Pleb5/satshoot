import { writable } from 'svelte/store';

export enum DrawerIDs {
    AppMenu = 0,
    ReviewBreakdown = 1,
    UserReviewBreakdown = 2,
}

const drawerID = writable(DrawerIDs.AppMenu);

export default drawerID;
