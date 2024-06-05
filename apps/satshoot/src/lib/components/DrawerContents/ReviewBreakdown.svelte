<script lang="ts">
    import type { ClientRating, TroubleshooterRating } from "$lib/events/ReviewEvent";
import { getDrawerStore } from "@skeletonlabs/skeleton";

const drawerStore = getDrawerStore();

const reviews = $drawerStore.meta['ratings'] as Map<string, number> | undefined;
const userReviews = $drawerStore.meta['userReviews'] as Array<ClientRating | TroubleshooterRating> | undefined;

const baseClasses = 'p-4 m-8 mt-4 bg-surface-200-700-token\
    flex-grow sm:max-w-[70vw] lg:max-w-[60vw]';

</script>

<div class="{baseClasses}">

</div>
