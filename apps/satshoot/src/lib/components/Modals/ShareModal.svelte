<script lang="ts">
    import { clipboard, getModalStore } from '@skeletonlabs/skeleton';
    import CloseModal from '../UI/Buttons/CloseModal.svelte';
    import { page } from '$app/stores';
    import Card from '../UI/Card.svelte';
    import Button from '../UI/Buttons/Button.svelte';

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
                        <div
                            class="flex flex-row justify-between gap-[10px] pb-[5px] border-b-[1px] border-b-[rgb(0,0,0,0.1)]"
                        >
                            <p class="font-[500] text-[18px]">Share</p>
                            <CloseModal />
                        </div>
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
