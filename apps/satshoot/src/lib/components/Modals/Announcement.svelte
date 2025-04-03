<script lang="ts">
    import { onMount, tick, type SvelteComponent } from 'svelte';
    import ndk from '$lib/stores/ndk';
    import { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';

    import { SatShootPubkey } from '$lib/utils/misc';

    import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';

    import Button from '../UI/Buttons/Button.svelte';
    import Popup from '../UI/Popup.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

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
            const t: ToastSettings = {
                message: 'Broadcasted!',
                timeout: 5000,
                background: 'bg-success-300-600-token',
            };
            toastStore.trigger(t);

            modalStore.close();
        } catch (e) {
            posting = false;
            const t: ToastSettings = {
                message: 'Error happened while broadcasting! Try again later!',
                timeout: 5000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);

            modalStore.close();
        }
    }
</script>

{#if $modalStore[0]}
    <Popup title="Broadcast to Nostr">
        <div class="flex flex-col justify-center gap-y-4">
            <label class="label">
                <span class="font-bold">Your Message:</span>
                <textarea rows="8" class="textarea" bind:this={textArea} bind:value={messageResult}
                ></textarea>
            </label>
            <div class="grid grid-cols-[30%_1fr] gap-x-2">
                <Button variant="outlined" on:click={() => modalStore.close()}>Cancel</Button>

                <Button on:click={broadcast} disabled={posting}>
                    {#if posting}
                        <span>
                            <ProgressRing color="tertiary" size="size-8" />
                        </span>
                    {:else}
                        <span>Post</span>
                    {/if}
                </Button>
            </div>
        </div>
    </Popup>
{/if}
