<script lang="ts">
    import type { OrderEvent } from '$lib/events/OrderEvent';
    import { ReviewType } from '$lib/events/ReviewEvent';
    import Button from '../UI/Buttons/Button.svelte';
    import Card from '../UI/Card.svelte';
    import ExpandableText from '../UI/Display/ExpandableText.svelte';
    import UserProfile from '../UI/Display/UserProfile.svelte';
    import ReputationCard from './ReputationCard.svelte';

    interface Props {
        order: OrderEvent;
        orderStatus: 'pending' | 'in-progress' | 'completed';
    }

    const { order, orderStatus }: Props = $props();
</script>

<Card classes="flex-wrap gap-[15px]">
    <UserProfile pubkey={order.pubkey} />
    <ReputationCard user={order.pubkey} type={ReviewType.Client} />
    <div
        class="w-full border-[1px] border-black-100 dark:border-white-100 rounded-[4px] bg-black-50"
    >
        <ExpandableText text={order.description} maxCharacters={200} renderAsMarkdown />
    </div>
    <div
        class="w-full flex flex-row flex-wrap gap-[5px] border-t-[1px] border-t-black-100 dark:border-t-white-100 pl-[5px] pr-[5px] pt-[10px] justify-end"
    >
        {#if orderStatus === 'pending'}
            <Button>Accept</Button>
        {/if}
        {#if orderStatus === 'completed'}
            <Button>Review</Button>
        {/if}
    </div>
</Card>
