<script lang="ts">
    import { ReviewType } from '$lib/events/ReviewEvent';
    import NewReputationCard from '../Cards/NewReputationCard.svelte';

    export let pubkey: string;
</script>

<div class="flex-grow-1 flex flex-col gap-[10px] p-[0px]">
    <div class="w-full flex flex-col gap-[10px]">
        <div class="w-full flex flex-col gap-[10px]">
            <NewReputationCard user={pubkey} type={ReviewType.Client} />
        </div>
    </div>
</div>
