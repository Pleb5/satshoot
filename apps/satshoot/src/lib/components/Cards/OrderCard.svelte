<script lang="ts">
    import type { OrderEvent } from '$lib/events/OrderEvent';
    import { ReviewType } from '$lib/events/ReviewEvent';
    import { type NDKFilter, NDKKind } from '@nostr-dev-kit/ndk';
    import Button from '../UI/Buttons/Button.svelte';
    import Card from '../UI/Card.svelte';
    import ExpandableText from '../UI/Display/ExpandableText.svelte';
    import UserProfile from '../UI/Display/UserProfile.svelte';
    import ReputationCard from './ReputationCard.svelte';
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import { onDestroy } from 'svelte';
    import { toaster } from '$lib/stores/toaster';

    interface Props {
        order: OrderEvent;
        orderStatus: 'pending' | 'in-progress' | 'completed';
    }

    const { order, orderStatus }: Props = $props();

    const serviceFilter: NDKFilter<NDKKind.FreelanceService> = {
        kinds: [NDKKind.FreelanceService],
        '#d': [order.referencedServiceAddress.split(':')[2]],
    };

    const serviceStore = $ndk.storeSubscribe<ServiceEvent>(
        serviceFilter,
        {
            autoStart: false,
            closeOnEose: false,
            groupable: true,
            groupableDelay: 1000,
        },
        ServiceEvent
    );

    const service = $derived.by(() => {
        return $serviceStore[0] ?? null;
    });

    $effect(() => {
        if ($sessionInitialized) {
            serviceStore.startSubscription();
        }
    });

    onDestroy(() => {
        if (serviceStore) serviceStore.empty();
    });

    async function handleAcceptOrder() {
        if (!service) {
            toaster.error({
                title: 'Service is not initialized yet!',
            });
            return;
        }

        service.tags.push(['a', order.orderAddress]);
        try {
            await service.publishReplaceable();
            toaster.success({
                title: 'Order Accepted',
            });
        } catch (error) {
            console.error(error);
            toaster.error({
                title: `Failed to accept order: ${error}`,
            });
        }
    }
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
            <Button onClick={handleAcceptOrder}>Accept</Button>
        {/if}
        {#if orderStatus === 'completed'}
            <Button>Review</Button>
        {/if}
    </div>
</Card>
