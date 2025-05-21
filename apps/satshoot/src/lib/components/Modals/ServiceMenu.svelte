<script lang="ts">
    import { OrderEvent, OrderStatus } from '$lib/events/OrderEvent';
    import type { ServiceEvent } from '$lib/events/ServiceEvent';
    import type { NDKSubscribeOptions } from '@nostr-dev-kit/ndk-svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import CloseEntityModal from './CloseEntityModal.svelte';
    import ShareEventModal from './ShareEventModal.svelte';
    import { type NDKFilter, NDKKind } from '@nostr-dev-kit/ndk';
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import { checkRelayConnections } from '$lib/utils/helpers';
    import currentUser from '$lib/stores/user';
    import PaymentModal from './PaymentModal.svelte';

    interface Props {
        isOpen: boolean;
        service: ServiceEvent;
    }

    let { isOpen = $bindable(), service }: Props = $props();

    const ordersSubOptions: NDKSubscribeOptions = {
        closeOnEose: false,
        autoStart: false,
    };

    const myOrdersFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceOrder],
    };

    const myOrdersStore = $ndk.storeSubscribe<OrderEvent>(
        myOrdersFilter,
        ordersSubOptions,
        OrderEvent
    );

    let showShareModal = $state(false);
    let showCloseModal = $state(false);
    let showPaymentModal = $state(false);

    const openedOrder = $derived($myOrdersStore.find((order) => order.status === OrderStatus.Open));

    let initialized = $state(false);
    $effect(() => {
        if ($sessionInitialized && !initialized) {
            initialized = true;
            checkRelayConnections();

            // if current user is not service owner, then subscribe for
            // user's orders on current service
            if ($currentUser && $currentUser.pubkey !== service.pubkey) {
                myOrdersFilter['#a'] = [service.serviceAddress];
                myOrdersFilter.authors = [$currentUser.pubkey];
                myOrdersStore.startSubscription();
            }
        }
    });

    function handleShare() {
        isOpen = false;
        showShareModal = true;
    }

    function handlePay() {
        isOpen = false;
        showPaymentModal = true;
    }

    function handleCloseOrder() {
        isOpen = false;
        showCloseModal = true;
    }

    // todo: allow to message freelancer
    // todo: if my service, edit option
    // todo: review freelancer
</script>

<ModalWrapper bind:isOpen title="Service Menu">
    <div class="w-full flex flex-col">
        <div class="w-full py-[10px] px-[5px] flex flex-col gap-[10px]">
            <Button variant="outlined" classes="justify-start" fullWidth onClick={handleShare}>
                <i class="bx bxs-share text-[20px]"></i>
                <p class="">Share</p>
            </Button>

            {#if openedOrder && service.orders.includes(openedOrder.orderAddress)}
                <Button variant="outlined" classes="justify-start" fullWidth onClick={handlePay}>
                    <i class="bx bxs-bolt text-[20px]"></i>
                    <p class="">Pay</p>
                </Button>
            {/if}

            {#if openedOrder}
                <Button
                    variant="outlined"
                    classes="justify-start"
                    fullWidth
                    onClick={handleCloseOrder}
                >
                    <i class="bx bxs-lock text-[20px]"></i>
                    <p class="">Close Order</p>
                </Button>
            {/if}
        </div>
    </div>
</ModalWrapper>

<ShareEventModal bind:isOpen={showShareModal} eventObj={service} />

{#if openedOrder}
    <PaymentModal
        bind:isOpen={showPaymentModal}
        targetEntity={openedOrder}
        secondaryEntity={service}
    />
{/if}

{#if openedOrder}
    <CloseEntityModal
        bind:isOpen={showCloseModal}
        targetEntity={openedOrder}
        secondaryEntity={service}
    />
{/if}
