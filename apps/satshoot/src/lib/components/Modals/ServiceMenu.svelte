<script lang="ts">
    import type { ServiceEvent } from '$lib/events/ServiceEvent';
    import Button from '../UI/Buttons/Button.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import ShareEventModal from './ShareEventModal.svelte';

    interface Props {
        isOpen: boolean;
        service: ServiceEvent;
    }

    let { isOpen = $bindable(), service }: Props = $props();

    let showShareModal = $state(false);

    function handleShare() {
        isOpen = false;
        showShareModal = true;
    }

    // todo: if user has an active order on current service allow him to close order
    // todo: if user has an active order on current service allow him to pay the freelancer
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
        </div>
    </div>
</ModalWrapper>

<ShareEventModal bind:isOpen={showShareModal} eventObj={service} />

<!-- close order modal -->
