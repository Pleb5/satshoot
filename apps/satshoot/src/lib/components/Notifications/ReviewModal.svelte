<script lang="ts">
    import { getModalStore } from '@skeletonlabs/skeleton';
    import Card from '../UI/Card.svelte';
    import ModalHeader from '../UI/Modal/ModalHeader.svelte';
    import type { ReviewEvent } from '$lib/events/ReviewEvent';
    import ReviewCard from '../Cards/ReviewCard.svelte';

    export let review: ReviewEvent;

    const modalStore = getModalStore();
</script>

{#if $modalStore[0]}
    <div
        class="fixed inset-[0] z-[90] bg-[rgb(0,0,0,0.5)] backdrop-blur-[10px] flex flex-col justify-start items-center py-[25px] overflow-auto"
    >
        <div
            class="max-w-[1400px] w-full flex flex-col justify-start items-center px-[10px] relative"
        >
            <div class="w-full flex flex-col justify-start items-center">
                <div class="w-full max-w-[500px] justify-start items-center">
                    <Card>
                        <ModalHeader title="Review" />
                        <ReviewCard {review} />
                    </Card>
                </div>
            </div>
        </div>
    </div>
{/if}
