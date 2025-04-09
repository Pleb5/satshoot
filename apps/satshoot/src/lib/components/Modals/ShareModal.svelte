<script lang="ts">
    import { page } from '$app/state';
    import Button from '../UI/Buttons/Button.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    interface Props {
        isOpen: boolean;
    }

    let { isOpen = $bindable() }: Props = $props();

    let copyUrlLabel = $derived(
        `Copy ${page.route.id === '/[jobId=event]' ? 'Job' : 'Profile'} URL`
    );

    let nostrAddress = $derived(
        page.route.id === '/[jobId=event]' ? page.params.jobId : page.params.npub
    );

    let copiedURL = $state(false);
    function onCopyURL() {
        navigator.clipboard.writeText(page.url.href).then(() => {
            copiedURL = true;
            setTimeout(() => {
                copiedURL = false;
            }, 1000);
        });
    }

    let copiedNostrAddress = $state(false);
    function onCopyNostrAddress() {
        navigator.clipboard.writeText(nostrAddress).then(() => {
            copiedNostrAddress = true;
            setTimeout(() => {
                copiedNostrAddress = false;
            }, 1000);
        });
    }
</script>

<ModalWrapper bind:isOpen title="Share">
    <div class="w-full flex flex-col justify-center py-[10px] px-[5px] gap-[10px]">
        <Button grow on:click={onCopyURL}>
            <span class="w-full h-full">
                {copiedURL ? 'Copied!' : copyUrlLabel}
            </span>
        </Button>
        <Button grow on:click={onCopyNostrAddress}>
            <span class="w-full h-full">
                {copiedNostrAddress ? 'Copied!' : 'Copy Npub'}
            </span>
        </Button>
    </div>
</ModalWrapper>
