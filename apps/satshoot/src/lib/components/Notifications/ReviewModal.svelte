<script lang="ts">
    import type { ReviewEvent } from '$lib/events/ReviewEvent';
    import ReviewCard from '../Cards/ReviewCard.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    interface Props {
        isOpen: boolean;
        review: ReviewEvent;
    }

    let { isOpen = $bindable(), review }: Props = $props();
</script>

<ModalWrapper bind:isOpen title="Review">
    <ReviewCard {review} />
</ModalWrapper>
