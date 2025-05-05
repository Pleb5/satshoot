<script lang="ts">
    import Button from '../UI/Buttons/Button.svelte';
    import type { JobEvent } from '$lib/events/JobEvent';
    import ShareJobModal from './ShareJobModal.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    interface Props {
        isOpen: boolean;
        job: JobEvent;
    }

    let { isOpen = $bindable(), job }: Props = $props();

    let showShareJobModal = $state(false);

    function handleConfirm() {
        isOpen = false;
        showShareJobModal = true;
    }
</script>

<ModalWrapper bind:isOpen title="Success!">
    <div class="w-full flex flex-col">
        <div class="w-full py-[10px] px-[5px]">
            <div class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[10px]">
                <p class="w-full">Job posted successfully!</p>
                <p class="w-full">
                    <strong>Share Job as Text Note?</strong> It will show up in your feed on popular
                    clients.
                </p>

                <Button onClick={handleConfirm}>Of course!</Button>
                <Button variant="outlined" onClick={() => (isOpen = false)}>No thanks</Button>
            </div>
        </div>
    </div>
</ModalWrapper>

<ShareJobModal bind:isOpen={showShareJobModal} {job} />
