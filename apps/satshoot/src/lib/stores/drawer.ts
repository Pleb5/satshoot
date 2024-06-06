import { writable } from 'svelte/store';

export enum DrawerIDs {
    UserMenu = 0,
    ReviewBreakdown = 1,
    UserReviewBreakdown = 2,
}

const drawerID = writable(DrawerIDs.ReviewBreakdown);

export default drawerID;
