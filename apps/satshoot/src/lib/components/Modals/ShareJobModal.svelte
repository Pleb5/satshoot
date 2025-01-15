<script lang="ts">
    import { TicketEvent } from '$lib/events/TicketEvent';
    import ndk from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import { NDKEvent, NDKKind, type NDKTag } from '@nostr-dev-kit/ndk';
    import {
        clipboard,
        getModalStore,
        getToastStore,
        ProgressRadial,
        type ToastSettings,
    } from '@skeletonlabs/skeleton';
    import { onMount, tick } from 'svelte';
    import CloseModal from '../UI/Buttons/CloseModal.svelte';
    import Card from '../UI/Card.svelte';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    export let job: TicketEvent;

    let shareURL = '';

    let message: string = '';
    let posting = false;
    async function postJob() {
        posting = true;
        await tick();

        const kind1Event = new NDKEvent($ndk);
        kind1Event.kind = NDKKind.Text;

        kind1Event.content = message;
        kind1Event.generateTags();

        try {
            let relays = await kind1Event.publish();
            posting = false;
            const t: ToastSettings = {
                message: 'job Posted as Text Note!',
                timeout: 7000,
                background: 'bg-success-300-600-token',
            };
            toastStore.trigger(t);

            modalStore.close();
        } catch (e) {
            posting = false;
            const t: ToastSettings = {
                message: 'Error happened while publishing note!',
                timeout: 5000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);

            modalStore.close();
        }
    }

    let copied = false;
    function onCopyURL(): void {
        copied = true;
        setTimeout(() => {
            copied = false;
        }, 1000);
    }

    onMount(() => {
        if (job) {
            shareURL = `https://satshoot.com/${job.encode()}`;
            // Set default text
            message = `Hey Nostr,\nPlease help me with this issue and I can pay sats for your time:\n\n`;
            message += `## ${job.title}\n\n`;
            message += `${job.description}\n\n`;
            message += `Make an offer on this URL:\n\n`;
            message += `${shareURL}\n\n`;
            message += `#satshoot #asknostr`;
            job.tTags.forEach((tag: NDKTag) => {
                message += ` #${(tag as string[])[1]}`;
            });
        }
    });

    const textAreaClasses =
        'transition ease duration-[0.3s] w-full min-h-[100px] bg-[rgb(0,0,0,0.05)] border-[2px] border-[rgb(0,0,0,0.1)] rounded-[6px] ' +
        'px-[10px] py-[5px] outline-[0px] outline-[rgb(59,115,246,0.0)] focus:border-[rgb(59,115,246)] focus:bg-[rgb(0,0,0,0.08)]';

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
                    <Card>
                        <div
                            class="flex flex-row justify-between gap-[10px] pb-[5px] border-b-[1px] border-b-[rgb(0,0,0,0.1)]"
                        >
                            <p class="font-[500] text-[18px]">Share</p>
                            <CloseModal />
                        </div>
                        <div class="w-full flex flex-col">
                            <!-- popups Share Job Post start -->
                            <div class="w-full pt-[10px] px-[5px] flex flex-col gap-[10px]">
                                <div
                                    class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[5px]"
                                >
                                    <p class="">Share your job post with others</p>
                                    {#if job.pubkey === $currentUser?.pubkey}
                                        <textarea
                                            rows="10"
                                            placeholder="Describe why you should get this job"
                                            class={textAreaClasses}
                                            bind:value={message}
                                        />
                                    {/if}
                                </div>
                                <div class="w-full flex flex-row gap-[5px]">
                                    {#if job.pubkey === $currentUser?.pubkey}
                                        <button
                                            on:click={postJob}
                                            class={btnClasses}
                                            disabled={posting}
                                        >
                                            {#if posting}
                                                <span>
                                                    <ProgressRadial
                                                        value={undefined}
                                                        stroke={60}
                                                        meter="stroke-tertiary-500"
                                                        track="stroke-tertiary-500/30"
                                                        strokeLinecap="round"
                                                        width="w-8"
                                                    />
                                                </span>
                                            {:else}
                                                <span>Publish & Share on Nostr</span>
                                            {/if}
                                        </button>
                                    {/if}
                                    <button
                                        class={btnClasses}
                                        use:clipboard={shareURL}
                                        on:click={onCopyURL}
                                    >
                                        {copied ? 'Copied!' : 'Copy Job URL'}
                                    </button>
                                </div>
                            </div>
                            <!-- popups Share Job Post end -->
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    </div>
{/if}
