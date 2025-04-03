<script lang="ts">
    import { onMount, tick, type SvelteComponent } from 'svelte';
    import ndk from '$lib/stores/ndk';
    import { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';

    import { SatShootPubkey } from '$lib/utils/misc';

    import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import Popup from '../UI/Popup.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

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
            const t: ToastSettings = {
                message: 'Appreciate Your Feedback!',
                timeout: 7000,
                background: 'bg-success-300-600-token',
            };
            toastStore.trigger(t);

            modalStore.close();
        } catch (e) {
            posting = false;
            const t: ToastSettings = {
                message: 'Error happened while publishing Feedback! Try again later!',
                timeout: 5000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);

            modalStore.close();
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

{#if $modalStore[0]}
    <Popup title="Post Public Feedback">
        <div class="flex flex-col justify-center gap-y-4">
            <textarea rows="8" class="textarea" bind:this={textArea}></textarea>
            <div class="grid grid-cols-[30%_1fr] gap-x-2">
                <Button variant="outlined" on:click={() => modalStore.close()}>Cancel</Button>

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
    </Popup>
{/if}
