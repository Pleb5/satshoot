<script lang="ts">
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ReviewEvent } from '$lib/events/ReviewEvent';
    import ReviewCard from '../Cards/ReviewCard.svelte';
    import Popup from '../UI/Popup.svelte';

    interface Props {
        review: ReviewEvent;
    }

    let { review }: Props = $props();

    const modalStore = getModalStore();
</script>

{#if $modalStore[0]}
    <Popup title="Review">
        <ReviewCard {review} />
    </Popup>
{/if}
