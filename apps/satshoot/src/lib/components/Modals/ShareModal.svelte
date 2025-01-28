<script lang="ts">
    import { clipboard, getModalStore } from '@skeletonlabs/skeleton';
    import { page } from '$app/stores';
    import Button from '../UI/Buttons/Button.svelte';
    import Popup from '../UI/Popup.svelte';

    const modalStore = getModalStore();

    let copied = false;
    function onCopyURL(): void {
        copied = true;
        setTimeout(() => {
            copied = false;
        }, 1000);
    }
</script>

{#if $modalStore[0]}
    <Popup title="Share">
        <div class="w-full flex flex-row justify-center py-[10px] px-[5px]">
            <Button grow on:click={onCopyURL}>
                <span use:clipboard={$page.url.href}>
                    {copied ? 'Copied!' : 'Copy Page URL'}
                </span>
            </Button>
        </div>
    </Popup>
{/if}
