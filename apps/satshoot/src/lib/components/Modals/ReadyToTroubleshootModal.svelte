<script lang="ts">
	import { onMount, tick, type SvelteComponent } from 'svelte';
    import ndk from '$lib/stores/ndk';
    import { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';

    import { SatShootPubkey } from '$lib/utils/misc';
    
    import { ProgressRadial } from '@skeletonlabs/skeleton';
	import { getModalStore, getToastStore, getDrawerStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

	// Props
	/** Exposes parent props to this component. */
	export let parent: SvelteComponent;
    let textArea:HTMLTextAreaElement;

    let posting = false;

    async function broadcast() {
        const kind1Event = new NDKEvent($ndk);
        kind1Event.kind = NDKKind.Text;

        kind1Event.content = textArea.value;
        kind1Event.generateTags();

        const satShootUser = $ndk.getUser({pubkey: SatShootPubkey});
        kind1Event.tag(satShootUser);

        try {
            posting = true;
            await tick();

            let relays = await kind1Event.publish();
            posting = false;
            console.log(relays)
            const t: ToastSettings = {
                message: 'Broadcasted!',
                timeout: 5000,
                background: 'bg-success-300-600-token',
            };
            toastStore.trigger(t);

            modalStore.close();
        } catch(e) {
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

    onMount(()=>{
        textArea.value = `Ready for Troubleshooting!\n\n#satshoot #asknostr #troubleshooting`;
        textArea.setSelectionRange(0, 0);
        textArea.focus();
    });

</script>

{#if $modalStore[0]}
    <div class="card p-4 bg-primary-300-600-token">
        <h4 class="h4 text-center mb-2">Broadcast to Nostr</h4>
        <div class="flex flex-col justify-center gap-y-4">
            <textarea 
                rows="8"
                class="textarea"
                bind:this={textArea}
            />
            <div class="grid grid-cols-[30%_1fr] gap-x-2">
                <button 
                    type="button"
                    class="btn btn-sm sm:btn-md bg-error-300-600-token"
                    on:click={()=> modalStore.close()}
                >
                    Cancel
                </button>

                <button
                    type="submit"
                    on:click={broadcast}
                    class="btn btn-sm sm:btn-md bg-success-300-600-token"
                    disabled={posting}
                >
                    {#if posting}
                        <span>
                            <ProgressRadial value={undefined} stroke={60} meter="stroke-tertiary-500"
                                track="stroke-tertiary-500/30" strokeLinecap="round" width="w-8" />
                        </span>
                    {:else}
                        <span>Post</span>
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}
