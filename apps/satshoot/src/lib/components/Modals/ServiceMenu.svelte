<script lang="ts">
    import { ServiceStatus, type ServiceEvent } from '$lib/events/ServiceEvent';
    import Button from '../UI/Buttons/Button.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import CloseEntityModal from './CloseEntityModal.svelte';
    import ShareEventModal from './ShareEventModal.svelte';
    import currentUser from '$lib/stores/user';
    import { serviceToEdit } from '$lib/stores/service-to-edit';
    import { goto } from '$app/navigation';
    import { toaster } from '$lib/stores/toaster';
    import ConfirmationDialog from '../UI/ConfirmationDialog.svelte';
    import SELECTED_QUERY_PARAM from '$lib/services/messages';
    import { myOrders } from '$lib/stores/freelance-eventstores';
    import { inFulfillmentOrderOnService } from '$lib/utils/service';
    import ServiceHistoryModal from './ServiceHistoryModal.svelte';

    interface Props {
        isOpen: boolean;
        service: ServiceEvent;
    }

    let { isOpen = $bindable(), service }: Props = $props();

    let serviceStatus = $state(service.status);
    let showShareModal = $state(false);
    let showCloseModal = $state(false);
    let showDeactivateConfirmationDialog = $state(false);
    let showHistoryModal = $state(false);

    const myService = $derived($currentUser?.pubkey === service.pubkey);
    const myInFulfillmentOrder = $derived(inFulfillmentOrderOnService(service, $myOrders));

    function handleShare() {
        isOpen = false;
        showShareModal = true;
    }

    function goToPay() {
        if (myInFulfillmentOrder) {
            const url = new URL(
                '/payments/' + myInFulfillmentOrder.encode(),
                window.location.origin
            );
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
        await updateServiceStatus(ServiceStatus.Active, 'Service Activated', 'activate');
    }

    async function deactivate() {
        await updateServiceStatus(ServiceStatus.InActive, 'Service de-activated', 'de-activate');
    }

    async function updateServiceStatus(
        newStatus: ServiceStatus,
        successMessage: string,
        action: string
    ) {
        const oldStatus = service.status;
        service.status = newStatus;
        if (oldStatus !== newStatus) {
            service.addStateHistory(oldStatus);
        }

        try {
            await service.publishReplaceable();
            serviceStatus = newStatus;
            toaster.success({
                title: successMessage,
            });
        } catch (error) {
            console.error(error);
            toaster.error({
                title: `Failed to ${action} the service: ${error}`,
            });
        }
    }

    function goToChat() {
        const url = new URL('/messages/' + service.encode(), window.location.origin);
        url.searchParams.append(SELECTED_QUERY_PARAM, service.pubkey);

        goto(url.toString());
    }

    function handleShowHistory() {
        isOpen = false;
        showHistoryModal = true;
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

            {#if myInFulfillmentOrder && service.orders.includes(myInFulfillmentOrder.orderAddress)}
                <Button variant="outlined" classes="justify-start" fullWidth onClick={goToPay}>
                    <i class="bx bxs-bolt text-[20px]"></i>
                    <p class="">Pay</p>
                </Button>
            {/if}

            {#if myInFulfillmentOrder}
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

            <Button
                variant="outlined"
                classes="justify-start"
                fullWidth
                onClick={handleShowHistory}
            >
                <i class="bx bx-history text-[20px]"></i>
                <p class="">Service History</p>
            </Button>
        </div>
    </div>
</ModalWrapper>

<ShareEventModal bind:isOpen={showShareModal} eventObj={service} />

{#if myInFulfillmentOrder}
    <CloseEntityModal
        bind:isOpen={showCloseModal}
        targetEntity={service}
        secondaryEntity={myInFulfillmentOrder}
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

<ServiceHistoryModal bind:isOpen={showHistoryModal} {service} />
