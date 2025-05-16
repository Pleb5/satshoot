<script lang="ts">
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import currentUser from '$lib/stores/user';
    import ShareEventModal from '../Modals/ShareEventModal.svelte';
    import Button from '../UI/Buttons/Button.svelte';

    interface Props {
        service: ServiceEvent;
    }

    let { service }: Props = $props();

    // Reactive states
    let showShareModal = $state(false);

    // Derived states

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

<ShareEventModal bind:isOpen={showShareModal} eventObj={service} />
