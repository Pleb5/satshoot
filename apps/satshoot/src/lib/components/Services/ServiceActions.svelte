<script lang="ts">
    import { ServiceEvent, ServiceStatus } from '$lib/events/ServiceEvent';
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import currentUser from '$lib/stores/user';
    import { checkRelayConnections } from '$lib/utils/helpers';
    import type { NDKSubscribeOptions } from '@nostr-dev-kit/ndk-svelte';
    import CloseEntityModal from '../Modals/CloseEntityModal.svelte';
    import ShareEventModal from '../Modals/ShareEventModal.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import { type NDKFilter, NDKKind } from '@nostr-dev-kit/ndk';
    import { OrderEvent, OrderStatus } from '$lib/events/OrderEvent';
    import PaymentModal from '../Modals/PaymentModal.svelte';
    import { serviceToEdit } from '$lib/stores/service-to-edit';
    import { goto } from '$app/navigation';
    import { toaster } from '$lib/stores/toaster';
    import ConfirmationDialog from '../UI/ConfirmationDialog.svelte';

    interface Props {
        service: ServiceEvent;
    }

    let { service }: Props = $props();

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

    // Reactive states
    let serviceStatus = $state(service.status);
    let showShareModal = $state(false);
    let showPaymentModal = $state(false);
    let showCloseModal = $state(false);
    let showDeactivateConfirmationDialog = $state(false);

    // Derived states
    const myService = $derived($currentUser?.pubkey === service.pubkey);
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
        showShareModal = true;
    }

    function handlePay() {
        showPaymentModal = true;
    }

    function handleCloseOrder() {
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

    const btnClasses =
        'bg-black-100 text-black-500 dark:text-white dark:bg-white-100 scale-100 w-auto grow justify-start';
</script>

<div class="flex flex-col grow-1 gap-[10px] p-[0px]">
    <div class="w-full flex flex-row flex-wrap gap-[10px]">
        <Button classes={btnClasses} onClick={handleShare}>
            <i class="bx bxs-share"></i>
            Share
        </Button>

        {#if myService}
            <Button variant="outlined" classes={btnClasses} fullWidth onClick={handleEdit}>
                <i class="bx bxs-edit-alt text-[20px]"></i>
                <p class="">Edit</p>
            </Button>
        {/if}

        {#if myService && serviceStatus === ServiceStatus.Active}
            <Button
                variant="outlined"
                classes={btnClasses}
                fullWidth
                onClick={() => (showDeactivateConfirmationDialog = true)}
            >
                <i class="bx bx-toggle-left text-[20px]"></i>
                <p class="">Deactivate</p>
            </Button>
        {/if}

        {#if myService && serviceStatus === ServiceStatus.InActive}
            <Button variant="outlined" classes={btnClasses} fullWidth onClick={handleActivate}>
                <i class="bx bx-toggle-right text-[20px]"></i>
                <p class="">Activate</p>
            </Button>
        {/if}

        {#if openedOrder && service.orders.includes(openedOrder.orderAddress)}
            <Button variant="outlined" classes="justify-start" fullWidth onClick={handlePay}>
                <i class="bx bxs-bolt text-[20px]"></i>
                <p class="">Pay</p>
            </Button>
        {/if}

        {#if openedOrder}
            <Button variant="outlined" classes="justify-start" fullWidth onClick={handleCloseOrder}>
                <i class="bx bxs-lock text-[20px]"></i>
                <p class="">Close Order</p>
            </Button>
        {/if}
    </div>
</div>

<ShareEventModal bind:isOpen={showShareModal} eventObj={service} />

{#if openedOrder}
    <PaymentModal
        bind:isOpen={showPaymentModal}
        targetEntity={service}
        secondaryEntity={openedOrder}
    />
{/if}

{#if openedOrder}
    <CloseEntityModal
        bind:isOpen={showCloseModal}
        targetEntity={openedOrder}
        secondaryEntity={service}
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
