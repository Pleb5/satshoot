<script lang="ts">
    import { clipboard, getModalStore } from '@skeletonlabs/skeleton';
    import { page } from '$app/stores';
    import Card from '../UI/Card.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ModalHeader from '../UI/Modal/ModalHeader.svelte';

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
    <div
        class="fixed inset-[0] z-[90] bg-[rgb(0,0,0,0.5)] backdrop-blur-[10px] flex flex-col justify-start items-center py-[25px] overflow-auto"
    >
        <div
            class="max-w-[1400px] w-full flex flex-col justify-start items-center px-[10px] relative"
        >
            <div class="w-full flex flex-col justify-start items-center">
                <div class="w-full max-w-[500px] justify-start items-center">
                    <Card>
                        <ModalHeader title="Share" />
                        <div class="w-full flex flex-row justify-center py-[10px] px-[5px]">
                            <Button grow on:click={onCopyURL}>
                                <span use:clipboard={$page.url.href}>
                                    {copied ? 'Copied!' : 'Copy Page URL'}
                                </span>
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    </div>
{/if}
