<script lang="ts">
    import { tick } from 'svelte';
    import ndk from '$lib/stores/ndk';
    import { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';

    import { SatShootPubkey } from '$lib/utils/misc';

    import { createToaster } from '@skeletonlabs/skeleton-svelte';
    import Popup from '../UI/Popup.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    interface Props {
        isOpen: boolean;
    }

    const toaster = createToaster();

    let { isOpen = $bindable() }: Props = $props();

    let textArea = $state<HTMLTextAreaElement>();

    let posting = $state(false);

    async function postFeedback() {
        if (!textArea) return;

        const kind1Event = new NDKEvent($ndk);
        kind1Event.kind = NDKKind.Text;

        kind1Event.content = textArea.value;
        kind1Event.generateTags();

        const five = $ndk.getUser({
            npub: 'npub16p8v7varqwjes5hak6q7mz6pygqm4pwc6gve4mrned3xs8tz42gq7kfhdw',
        });
        const satShootUser = $ndk.getUser({ pubkey: SatShootPubkey });
        kind1Event.tag(five);
        kind1Event.tag(satShootUser);

        try {
            posting = true;
            await tick();

            let relays = await kind1Event.publish();
            posting = false;
            console.log(relays);
            toaster.success({
                title: 'Appreciate Your Feedback!',
            });

            isOpen = false;
        } catch (e) {
            posting = false;
            toaster.error({
                title: 'Error happened while publishing Feedback! Try again later!',
            });

            isOpen = false;
        }
    }

    $effect(() => {
        if (textArea) {
            textArea.value = `\n\n#satshoot-feedback`;
            textArea.setSelectionRange(0, 0);
            textArea.focus();
        }
    });
</script>

<ModalWrapper bind:isOpen title="Post Public Feedback">
    <div class="flex flex-col justify-center gap-y-4">
        <textarea rows="8" class="textarea" bind:this={textArea}></textarea>
        <div class="grid grid-cols-[30%_1fr] gap-x-2">
            <Button
                variant="outlined"
                on:click={() => {
                    isOpen = false;
                }}
            >
                Cancel
            </Button>

            <Button on:click={postFeedback} disabled={posting}>
                {#if posting}
                    <span>
                        <ProgressRing />
                    </span>
                {:else}
                    <span>Post</span>
                {/if}
            </Button>
        </div>
    </div>
</ModalWrapper>
