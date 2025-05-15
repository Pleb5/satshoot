<script lang="ts">
    import { goto } from '$app/navigation';
    import { BidEvent } from '$lib/events/BidEvent';
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import { serviceToEdit } from '$lib/stores/service-to-edit';
    import currentUser from '$lib/stores/user';
    import Button from '../UI/Buttons/Button.svelte';

    interface Props {
        service: ServiceEvent;
    }

    let { service }: Props = $props();

    // Reactive states
    let winnerBid = $state<BidEvent | null>(null);
    let showShareModal = $state(false);
    let showCloseServiceModal = $state(false);
    let showReviewClientModal = $state(false);
    let showPaymentModal = $state(false);
    let showReviewModal = $state(false);

    // Derived states
    const bech32ID = $derived(service.encode());
    const myService = $derived($currentUser?.pubkey === service.pubkey);

    function handleShare() {
        showShareModal = true;
    }

    function handleEdit() {
        // if (service) {
        //     $serviceToEdit = service;
        //     goto('/post-service');
        // }
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
    </div>
</div>
