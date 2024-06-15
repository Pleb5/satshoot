<script lang="ts">
import ndk from "$lib/stores/ndk";
import currentUser from "$lib/stores/user";
import type { ClientRating, TroubleshooterRating } from "$lib/events/ReviewEvent";
import type { NDKUser, NDKUserProfile } from "@nostr-dev-kit/ndk";
import { onMount } from "svelte";
import { Avatar } from '@skeletonlabs/skeleton';


export let review: ClientRating | TroubleshooterRating;
export let reviewer: NDKUser;
let reviewerProfile: NDKUserProfile | null;
let reviewerName = reviewer.npub.substring(0,8);
let reviewerImage = `https://robohash.org/${reviewer.pubkey}`;

onMount(async() => {
   reviewerProfile = await reviewer.fetchProfile(); 
    if (reviewerProfile) {
        if (reviewerProfile.name) {
            reviewerName = reviewerProfile.name;
        }
        if (reviewerProfile.image) {
            reviewerImage = reviewerProfile.image;
        }
    }
});

$: if($currentUser && ($currentUser.pubkey === reviewer.pubkey)) {
    reviewerName = 'You';
}
</script>

<div class="card p-2 bg-inherit flex flex-col gap-y-2 text-lg sm:text-xl">
    <div class="h4 text-center underline">Review:</div>
    <!-- TroubleshooterRating -->
    {#if 'success' in review}
        <div class="grid grid-cols-[1fr_auto] gap-x-4">
            <div class="justify-self-start">
                Ticket Resolved:
            </div>
            <div class="flex gap-x-2">
                {
                ((review)['success'])
                    ? '👍' : '❌'
                }
            </div>
        </div>
        <div class="grid grid-cols-[1fr_auto] gap-x-4">
            <div class="justify-self-start">
                Expertise:
            </div>
            <div class="flex gap-x-2">
                {
                ((review)['expertise'])
                    ? '👍' : '❌'
                }
            </div>
        </div>
        <div class="grid grid-cols-[1fr_auto] gap-x-4">
            <div class="justify-self-start">
                Availability:
            </div>
            <div class="flex gap-x-2">
                {
                ((review)['availability'])
                    ? '👍' : '❌'
                }
            </div>
        </div>
        <div class="grid grid-cols-[1fr_auto] gap-x-4">
            <div class="justify-self-start">
                Communication:
            </div>
            <div class="flex gap-x-2">
                {
                ((review)['communication'])
                    ? '👍' : '❌'
                }
            </div>
        </div>
        <!-- ClientRating -->
    {:else}
        <div class="grid grid-cols-[1fr_auto] gap-x-4">
            <div class="justify-self-start">
                Overall Experience:
            </div>
            <div class="flex gap-x-2">
                {
                ((review)['thumb'])
                    ? '👍' : '❌'
                }
            </div>
        </div>
        <div class="grid grid-cols-[1fr_auto] gap-x-4">
            <div class="justify-self-start">
                Availability:
            </div>
            <div class="flex gap-x-2">
                {
                ((review)['availability'])
                    ? '👍' : '❌'
                }
            </div>
        </div>
        <div class="grid grid-cols-[1fr_auto] gap-x-4">
            <div class="justify-self-start">
                Communication:
            </div>
            <div class="flex gap-x-2">
                {
                ((review)['communication'])
                    ? '👍' : '❌'
                }
            </div>
        </div>
    {/if}
    <div class="flex gap-x-2 justify-center items-center">
        <Avatar src={reviewerImage} width='w-10'/>
        <div class="text-md sm:text-xl">{reviewerName} wrote:</div>
    </div>
    <div class="text-center mt-2 text-lg sm:text-xl">{review.reviewText!=='' ? ('"' + review.reviewText + '"') : 'No text'}</div>
</div>
