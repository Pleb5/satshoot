<script lang="ts">
    import { OrderEvent, OrderStatus } from '$lib/events/OrderEvent';
    import { ServiceStatus, type ServiceEvent } from '$lib/events/ServiceEvent';
    import type { NDKSubscribeOptions } from '@nostr-dev-kit/ndk-svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import CloseEntityModal from './CloseEntityModal.svelte';
    import ShareEventModal from './ShareEventModal.svelte';
    import { type NDKFilter, NDKKind } from '@nostr-dev-kit/ndk';
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import { checkRelayConnections } from '$lib/utils/helpers';
    import currentUser from '$lib/stores/user';
    import { serviceToEdit } from '$lib/stores/service-to-edit';
    import { goto } from '$app/navigation';
    import { toaster } from '$lib/stores/toaster';
    import ConfirmationDialog from '../UI/ConfirmationDialog.svelte';
    import SELECTED_QUERY_PARAM from '$lib/services/messages';
    import { myOrders } from '$lib/stores/freelance-eventstores';

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

    let serviceStatus = $state(service.status);
    let showShareModal = $state(false);
    let showCloseModal = $state(false);
    let showDeactivateConfirmationDialog = $state(false);
    let order = $state<OrderEvent | null>(null);

    // Derived states
    const myService = $derived($currentUser?.pubkey === service.pubkey);
    const openedOrder = $derived($myOrdersStore.find((order) => order.status === OrderStatus.Open));

    let initialized = $state(false);
    $effect(() => {
        if ($sessionInitialized && !initialized) {
            initialized = true;
            checkRelayConnections();
        }
    });

    $effect(() => {
        const openOrder = $myOrders.find(
            (order) =>
                order.referencedServiceAddress === service.serviceAddress &&
                order.status === OrderStatus.Open
        );

        if (openOrder) {
            order = openOrder;
        }
    });

    function handleShare() {
        isOpen = false;
        showShareModal = true;
    }

    function goToPay() {
        if (openedOrder) {
            const url = new URL('/payments/' + openedOrder.encode(), window.location.origin);
            goto(url.toString());
        }
    }

    function handleCloseOrder() {
        isOpen = false;
        showCloseModal = true;
    }

    function handleEdit() {
        if (service) {
            $serviceToEdit = service;
            goto('/post-service');
        }
    }

    async function handleActivate() {
        service.status = ServiceStatus.Active;
        try {
            await service.publishReplaceable();
            serviceStatus = ServiceStatus.Active;
            toaster.success({
                title: 'Service Activated',
            });
        } catch (error) {
            console.error(error);
            toaster.error({
                title: `Failed to activate the service: ${error}`,
            });
        }
    }

    async function deactivate() {
        service.status = ServiceStatus.InActive;
        try {
            await service.publishReplaceable();
            serviceStatus = ServiceStatus.InActive;
            toaster.success({
                title: 'Service de-activated',
            });
        } catch (error) {
            console.error(error);
            toaster.error({
                title: `Failed to de-activate the service: ${error}`,
            });
        }
    }

    function goToChat() {
        const url = new URL('/messages/' + service.encode(), window.location.origin);
        url.searchParams.append(SELECTED_QUERY_PARAM, service.pubkey);

        goto(url.toString());
    }
</script>

<ModalWrapper bind:isOpen title="Service Menu">
    <div class="w-full flex flex-col">
        <div class="w-full py-[10px] px-[5px] flex flex-col gap-[10px]">
            <Button variant="outlined" classes="justify-start" fullWidth onClick={handleShare}>
                <i class="bx bxs-share text-[20px]"></i>
                <p class="">Share</p>
            </Button>

            {#if myService}
                <Button variant="outlined" classes="justify-start" fullWidth onClick={handleEdit}>
                    <i class="bx bxs-edit-alt text-[20px]"></i>
                    <p class="">Edit</p>
                </Button>
            {/if}

            {#if myService && serviceStatus === ServiceStatus.Active}
                <Button
                    variant="outlined"
                    classes="justify-start"
                    fullWidth
                    onClick={() => {
                        isOpen = false;
                        showDeactivateConfirmationDialog = true;
                    }}
                >
                    <i class="bx bx-toggle-left text-[20px]"></i>
                    <p class="">Deactivate</p>
                </Button>
            {/if}

            {#if myService && serviceStatus === ServiceStatus.InActive}
                <Button
                    variant="outlined"
                    classes="justify-start"
                    fullWidth
                    onClick={handleActivate}
                >
                    <i class="bx bx-toggle-right text-[20px]"></i>
                    <p class="">Activate</p>
                </Button>
            {/if}

            {#if openedOrder && service.orders.includes(openedOrder.orderAddress)}
                <Button variant="outlined" classes="justify-start" fullWidth onClick={goToPay}>
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

            {#if $currentUser && $currentUser.pubkey !== service.pubkey}
                <Button onClick={goToChat} variant="outlined" classes="justify-start" fullWidth>
                    <i class="bx bxs-conversation text-[20px]"></i>
                    <p class="">Message</p>
                </Button>
            {/if}
        </div>
    </div>
</ModalWrapper>

<ShareEventModal bind:isOpen={showShareModal} eventObj={service} />

{#if openedOrder}
    <CloseEntityModal
        bind:isOpen={showCloseModal}
        targetEntity={service}
        secondaryEntity={openedOrder}
    />
{/if}

{#if showDeactivateConfirmationDialog}
    <ConfirmationDialog
        bind:isOpen={showDeactivateConfirmationDialog}
        confirmText="Yes"
        onConfirm={deactivate}
        onCancel={() => (showDeactivateConfirmationDialog = false)}
    >
        <strong class="text-primary-400-500">
            Do you really want to de-activate the service? You won't be able to get any new order.
        </strong>
    </ConfirmationDialog>
{/if}
