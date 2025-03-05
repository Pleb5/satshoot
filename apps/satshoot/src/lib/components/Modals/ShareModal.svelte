<script lang="ts">
    import { clipboard, getModalStore } from '@skeletonlabs/skeleton';
    import { page } from '$app/stores';
    import Button from '../UI/Buttons/Button.svelte';
    import Popup from '../UI/Popup.svelte';

    const modalStore = getModalStore();

    $: copyUrlLabel = `Copy ${$page.route.id === '/[jobId=event]' ? 'Job' : 'Profile'} URL`;

    $: nostrAddress = $page.route.id === '/[jobId=event]' ? $page.params.jobId : $page.params.npub;

    let copiedURL = false;
    function onCopyURL() {
        copiedURL = true;
        setTimeout(() => {
            copiedURL = false;
        }, 1000);
    }

    let copiedNostrAddress = false;
    function onCopyNostrAddress() {
        copiedNostrAddress = true;
        setTimeout(() => {
            copiedNostrAddress = false;
        }, 1000);
    }
</script>

{#if $modalStore[0]}
    <Popup title="Share">
        <div class="w-full flex flex-col justify-center py-[10px] px-[5px] gap-[10px]">
            <Button grow on:click={onCopyURL}>
                <span use:clipboard={$page.url.href}>
                    {copiedURL ? 'Copied!' : copyUrlLabel}
                </span>
            </Button>
            <Button grow on:click={onCopyNostrAddress}>
                <span use:clipboard={nostrAddress}>
                    {copiedNostrAddress ? 'Copied!' : 'Copy Nostr Address'}
                </span>
            </Button>
        </div>
    </Popup>
{/if}
