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
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import Popup from '../UI/Popup.svelte';

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
</script>

{#if $modalStore[0]}
    <Popup title="Share">
        <div class="w-full flex flex-col">
            <!-- popups Share Job Post start -->
            <div class="w-full pt-[10px] px-[5px] flex flex-col gap-[10px]">
                <div class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[5px]">
                    <p class="">Share your job post with others</p>
                    {#if job.pubkey === $currentUser?.pubkey}
                        <Input
                            bind:value={message}
                            classes="min-h-[100px]"
                            fullWidth
                            textarea
                            rows={10}
                        />
                    {/if}
                </div>
                <div class="w-full flex flex-row gap-[5px]">
                    {#if job.pubkey === $currentUser?.pubkey}
                        <Button grow on:click={postJob} disabled={posting}>
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
                        </Button>
                    {/if}
                    <Button grow on:click={onCopyURL}>
                        <span use:clipboard={shareURL}>
                            {copied ? 'Copied!' : 'Copy Job URL'}
                        </span>
                    </Button>
                </div>
            </div>
            <!-- popups Share Job Post end -->
        </div>
    </Popup>
{/if}
