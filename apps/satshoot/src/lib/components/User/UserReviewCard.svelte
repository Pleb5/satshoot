<script lang="ts">
import currentUser from "$lib/stores/user";
import type { ClientRating, TroubleshooterRating } from "$lib/events/ReviewEvent";
import type { NDKUser, NDKUserProfile } from "@nostr-dev-kit/ndk";
import { onMount } from "svelte";
import { Avatar } from '@skeletonlabs/skeleton';
import { Accordion, AccordionItem } from '@skeletonlabs/skeleton';


export let review: ClientRating | TroubleshooterRating;
export let reviewer: NDKUser;
export let open = true;
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

<Accordion class="card p-2 bg-inherit ">
    <AccordionItem bind:open={open}>
        <svelte:fragment slot="lead">
            <i class="fa-solid fa-star-half-stroke text-xl"></i>
        </svelte:fragment>
        <svelte:fragment slot="summary">
            <div class="flex items-center justify-center">
                <h3 class="h4 sm:h3 text-center">Review</h3>
            </div>
        </svelte:fragment>
        <svelte:fragment slot="content">
            <div class="flex flex-col items-center gap-y-2 text-lg sm:text-xl">
                <div class="flex flex-col justify-center mb-4">
                    <!-- TroubleshooterRating -->
                    {#if 'success' in review}
                        <div class="grid grid-cols-[1fr_auto] gap-x-8">
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
                        <div class="grid grid-cols-[1fr_auto] gap-x-8">
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
                        <div class="grid grid-cols-[1fr_auto] gap-x-8">
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
                        <div class="grid grid-cols-[1fr_auto] gap-x-8">
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
                        <div class="grid grid-cols-[1fr_auto] gap-x-8">
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
                        <div class="grid grid-cols-[1fr_auto] gap-x-8">
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
                        <div class="grid grid-cols-[1fr_auto] gap-x-8">
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
                </div>
            </div>
            <div class="flex gap-x-2 justify-center items-center">
                <Avatar src={reviewerImage} width='w-10'/>
                <div class="text-md sm:text-xl">{reviewerName} wrote:</div>
            </div>
            <div class="text-center mt-2 text-lg sm:text-xl">{review.reviewText!=='' ? ('"' + review.reviewText + '"') : 'No text'}</div>
        </svelte:fragment>
    </AccordionItem>
</Accordion>
