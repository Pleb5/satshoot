<script lang="ts">
    import type { ClientRating, TroubleshooterRating } from "$lib/events/ReviewEvent";


export let review: ClientRating | TroubleshooterRating;
</script>

<div class="card p-2 bg-inherit flex flex-col just">
    <!-- TroubleshooterRating -->
    {#if 'success' in review}
        <div class="flex gap-x-2">
            {
            ((review)['success'])
                ? 'success' : 'failure'
            }
        </div>
        <div class="flex gap-x-2">
            {
                `expertise: 
                $((review)['expertise']
                ? '👍' : '❌')`
            }
        </div>
        <!-- ClientRating -->
    {:else}
        <div class="flex gap-x-2">
            {
                `Rating: 
                $((review)['thumb']
                ? '👍' : '👎')`
            }
        </div>
    {/if}
</div>
