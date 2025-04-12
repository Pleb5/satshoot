<script lang="ts">
    import { tick } from 'svelte';
    import ndk from '$lib/stores/ndk';
    import { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';

    import { SatShootPubkey } from '$lib/utils/misc';

    import { createToaster } from '@skeletonlabs/skeleton-svelte';

    import Button from '../UI/Buttons/Button.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    interface Props {
        isOpen: boolean;
    }

    const toaster = createToaster();

    let { isOpen = $bindable() }: Props = $props();

    let textArea = $state<HTMLTextAreaElement>();
    $effect(() => {
        if (textArea) {
            textArea.setSelectionRange(0, 0);
            textArea.focus();
        }
    });

    let messageResult = $state('Ready to Work!\nGo to https://satshoot.com/post-job/');
    messageResult += ' and post your issues in these topics:\n';
    messageResult += '\n\n\n #satshoot #freelancing';

    let posting = $state(false);

    async function broadcast() {
        const kind1Event = new NDKEvent($ndk);
        kind1Event.kind = NDKKind.Text;

        kind1Event.content = messageResult;
        kind1Event.generateTags();

        const satShootUser = $ndk.getUser({ pubkey: SatShootPubkey });
        kind1Event.tag(satShootUser);

        try {
            posting = true;
            await tick();

            await kind1Event.publish();
            posting = false;
            toaster.success({ title: 'Broadcasted' });

            isOpen = false;
        } catch (e) {
            posting = false;
            toaster.error({ title: 'Error happened while broadcasting! Try again later!' });

            isOpen = false;
        }
    }
</script>

<ModalWrapper bind:isOpen title="Broadcast to Nostr">
    <div class="flex flex-col justify-center gap-y-4">
        <label class="label">
            <span class="font-bold">Your Message:</span>
            <textarea rows="8" class="textarea" bind:this={textArea} bind:value={messageResult}
            ></textarea>
        </label>
        <div class="grid grid-cols-[30%_1fr] gap-x-2">
            <Button
                variant="outlined"
                onClick={() => {
                    isOpen = false;
                }}
            >
                Cancel
            </Button>

            <Button onClick={broadcast} disabled={posting}>
                {#if posting}
                    <span>
                        <ProgressRing color="tertiary" />
                    </span>
                {:else}
                    <span>Post</span>
                {/if}
            </Button>
        </div>
    </div>
</ModalWrapper>
