<script lang="ts">
import type { ClientRating, TroubleshooterRating } from "$lib/events/ReviewEvent";


export let review: ClientRating | TroubleshooterRating;
</script>

<div class="card p-2 bg-inherit flex flex-col gap-y-2">
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
    <div class="text-center mt-4">You wrote:</div>
    <div class="mt-2 text-xl">"{review.reviewText}"</div>
</div>
