<script lang="ts">
    import { JobEvent } from '$lib/events/JobEvent';
    import ndk from '$lib/stores/session';
    import currentUser from '$lib/stores/user';
    import { NDKEvent, NDKKind, type NDKTag } from '@nostr-dev-kit/ndk';

    import { onMount, tick } from 'svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { toaster } from '$lib/stores/toaster';

    interface Props {
        isOpen: boolean;
        job: JobEvent;
    }

    let { isOpen = $bindable(), job }: Props = $props();

    let shareURL = $state('');
    let shareNaddr = $state('');

    let message: string = $state('');
    let posting = $state(false);
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
            toaster.success({
                title: 'Job Posted as Text Note!',
            });

            isOpen = false;
        } catch (e) {
            posting = false;
            toaster.error({
                title: 'Error happened while publishing note!',
            });

            isOpen = false;
        }
    }

    function onCopyURL(): void {
        navigator.clipboard.writeText(shareURL);
    }

    function onCopyNaddr(): void {
        navigator.clipboard.writeText(shareNaddr);
    }

    onMount(() => {
        if (job) {
            const naddr = job.encode();
            shareNaddr = 'nostr:' + naddr;
            shareURL = `https://satshoot.com/${naddr}`;
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
</script>

<ModalWrapper bind:isOpen title="Share">
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
            <div class="w-full flex flex-wrap gap-[5px]">
                {#if job.pubkey === $currentUser?.pubkey}
                    <Button grow onClick={postJob} disabled={posting}>
                        {#if posting}
                            <span>
                                <ProgressRing />
                            </span>
                        {:else}
                            <span>Publish & Share on Nostr</span>
                        {/if}
                    </Button>
                {/if}
                <Button grow onClick={onCopyURL}>
                    <span class="w-full h-full">
                        {'Copy Job URL'}
                    </span>
                </Button>
                <Button grow onClick={onCopyNaddr}>
                    <span class="w-full h-full">
                        {'Copy Job Nostr Address'}
                    </span>
                </Button>
            </div>
        </div>
        <!-- popups Share Job Post end -->
    </div>
</ModalWrapper>
