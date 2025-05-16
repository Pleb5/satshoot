<script lang="ts">
    // Generic modal for sharing a Service or a Job (event)
    import ndk from '$lib/stores/session';
    import currentUser from '$lib/stores/user';
    import { NDKEvent, NDKKind, type NDKTag } from '@nostr-dev-kit/ndk';

    import { onMount, tick } from 'svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { toaster } from '$lib/stores/toaster';
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import type { JobEvent } from '$lib/events/JobEvent';

    enum EventType {
        Job,
        Service,
    }

    interface Props {
        isOpen: boolean;
        eventObj: JobEvent | ServiceEvent;
    }

    let { isOpen = $bindable(), eventObj }: Props = $props();

    let shareURL = $state('');
    let shareNaddr = $state('');
    let message: string = $state('');
    let posting = $state(false);

    const type = $derived.by(() => {
        if (eventObj instanceof ServiceEvent) return EventType.Service;

        return EventType.Job;
    });

    // Post to Nostr
    async function postEvent() {
        posting = true;
        await tick();

        const kind1Event = new NDKEvent($ndk);
        kind1Event.kind = NDKKind.Text;

        kind1Event.content = message;
        kind1Event.generateTags();

        try {
            await kind1Event.publish();
            posting = false;
            toaster.success({
                title: (type === EventType.Service ? 'Service' : 'Job') + ' Posted as Text Note!',
            });

            isOpen = false;
        } catch (e) {
            posting = false;
            toaster.error({
                title: 'Error occurred while publishing note!',
            });

            isOpen = false;
        }
    }

    // Copy helpers
    let urlCopied = $state(false);
    function onCopyURL(): void {
        urlCopied = true;
        setTimeout(() => {
            urlCopied = false;
        }, 1000);
    }

    let naddrCopied = $state(false);
    function onCopyNaddr(): void {
        naddrCopied = true;
        setTimeout(() => {
            naddrCopied = false;
        }, 1000);
    }

    // Default message generator
    function buildDefaultMessage() {
        if (!eventObj) return '';
        let msg = '';
        if (type === EventType.Service) {
            msg = `Check out this service I'm offering on Satshoot! ⚡\n\n`;
            msg += `## ${eventObj.title}\n\n`;
            msg += `${eventObj.description}\n\n`;
            msg += `You can learn more, contact me, or place an order here:\n\n`;
            msg += `${shareURL}\n\n`;
            msg += `#satshoot #nostrservice`;
        } else {
            msg = `Hey Nostr,\nPlease help me with this issue and I can pay sats for your time:\n\n`;
            msg += `## ${eventObj.title}\n\n`;
            msg += `${eventObj.description}\n\n`;
            msg += `Make a bid on this URL:\n\n`;
            msg += `${shareURL}\n\n`;
            msg += `#satshoot #asknostr`;
        }
        if (eventObj.tTags) {
            eventObj.tTags.forEach((tag: NDKTag) => {
                msg += ` #${(tag as string[])[1]}`;
            });
        }
        return msg;
    }

    onMount(() => {
        if (eventObj) {
            const naddr = eventObj.encode();
            shareNaddr = 'nostr:' + naddr;
            shareURL = `https://satshoot.com/${naddr}`;
            message = buildDefaultMessage();
        }
    });
</script>

<ModalWrapper bind:isOpen title="Share">
    <div class="w-full flex flex-col">
        <!-- popups Share Event Post start -->
        <div class="w-full pt-[10px] px-[5px] flex flex-col gap-[10px]">
            <div class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[5px]">
                <p class="">
                    {#if type === EventType.Service}
                        Share your service post with others
                    {:else}
                        Share your job post with others
                    {/if}
                </p>
                {#if eventObj.pubkey === $currentUser?.pubkey}
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
                {#if eventObj.pubkey === $currentUser?.pubkey}
                    <Button grow onClick={postEvent} disabled={posting}>
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
                        {#if type === EventType.Service}
                            {urlCopied ? 'Copied!' : 'Copy Service URL'}
                        {:else}
                            {urlCopied ? 'Copied!' : 'Copy Job URL'}
                        {/if}
                    </span>
                </Button>
                <Button grow onClick={onCopyNaddr}>
                    <span class="w-full h-full">
                        {#if type === EventType.Service}
                            {naddrCopied ? 'Copied!' : 'Copy Service Nostr Address'}
                        {:else}
                            {naddrCopied ? 'Copied!' : 'Copy Job Nostr Address'}
                        {/if}
                    </span>
                </Button>
            </div>
        </div>
        <!-- popups Share Event Post end -->
    </div>
</ModalWrapper>
