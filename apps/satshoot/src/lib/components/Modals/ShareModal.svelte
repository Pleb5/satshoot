<script lang="ts">
    import { clipboard, getModalStore } from '@skeletonlabs/skeleton';
    import { page } from '$app/state';
    import Button from '../UI/Buttons/Button.svelte';
    import Popup from '../UI/Popup.svelte';

    const modalStore = getModalStore();

    let copyUrlLabel = $derived(
        `Copy ${page.route.id === '/[jobId=event]' ? 'Job' : 'Profile'} URL`
    );

    let nostrAddress = $derived(
        page.route.id === '/[jobId=event]' ? page.params.jobId : page.params.npub
    );

    let copiedURL = $state(false);
    function onCopyURL() {
        copiedURL = true;
        setTimeout(() => {
            copiedURL = false;
        }, 1000);
    }

    let copiedNostrAddress = $state(false);
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
            <Button grow>
                <span class="w-full h-full" use:clipboard={page.url.href} onclick={onCopyURL}>
                    {copiedURL ? 'Copied!' : copyUrlLabel}
                </span>
            </Button>
            <Button grow>
                <span
                    class="w-full h-full"
                    use:clipboard={nostrAddress}
                    onclick={onCopyNostrAddress}
                >
                    {copiedNostrAddress ? 'Copied!' : 'Copy Npub'}
                </span>
            </Button>
        </div>
    </Popup>
{/if}
