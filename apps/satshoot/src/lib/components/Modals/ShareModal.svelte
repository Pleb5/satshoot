<script lang="ts">
    import { clipboard, getModalStore } from '@skeletonlabs/skeleton';
    import CloseModal from '../UI/Buttons/CloseModal.svelte';
    import { page } from '$app/stores';

    const modalStore = getModalStore();

    let copied = false;
    function onCopyURL(): void {
        copied = true;
        setTimeout(() => {
            copied = false;
        }, 1000);
    }

    const btnClasses =
        'transition-all ease duration-[0.3s] py-[5px] px-[10px] rounded-[4px] grow-[1] border-[1px] border-[rgb(0,0,0,0.1)] ' +
        'bg-[#3b73f6] text-[rgb(255,255,255,0.5)] hover:border-[rgb(0,0,0,0.0)] hover:text-white hover:bg-blue-500';
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
                    <div
                        class="w-full bg-white p-[15px] rounded-[8px] shadow-[0_0_8px_0_rgb(0,0,0,0.25)] gap-[5px]"
                    >
                        <div
                            class="flex flex-row justify-between gap-[10px] pb-[5px] border-b-[1px] border-b-[rgb(0,0,0,0.1)]"
                        >
                            <p class="font-[500] text-[18px]">Share</p>
                            <CloseModal />
                        </div>
                        <div class="w-full flex flex-row justify-center py-[10px] px-[5px]">
                            <button
                                class={btnClasses}
                                use:clipboard={$page.url.href}
                                on:click={onCopyURL}
                            >
                                {copied ? 'Copied!' : 'Copy Page URL'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}
