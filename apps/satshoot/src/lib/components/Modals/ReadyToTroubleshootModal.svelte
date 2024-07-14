<script lang="ts">
	import { onMount, tick, type SvelteComponent } from 'svelte';
    import ndk from '$lib/stores/ndk';
    import { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';

    import { SatShootPubkey } from '$lib/utils/misc';
    
    import { ProgressRadial } from '@skeletonlabs/skeleton';
	import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';

    import { Autocomplete } from '@skeletonlabs/skeleton';
    import type { AutocompleteOption } from '@skeletonlabs/skeleton';
    import tagOptions from "$lib/utils/tag-options";

    const modalStore = getModalStore();
    const toastStore = getToastStore();

	// Props
	/** Exposes parent props to this component. */
	export let parent: SvelteComponent;
    let textArea:HTMLTextAreaElement;

    let tagInput = '';
    let messageResult = 'Ready for Troubleshooting!\nGo to https://satshoot.com'; 
    messageResult += ' and post your issues in these topics:\n';

    let posting = false;

    // Tag validation on tag selection from autocomplete
    function onAutoCompleteSelected(event: CustomEvent<AutocompleteOption<string>>): void {
        let tagValue = event.detail.value;
        addTag(tagValue);
        tagInput = '';        
    }

    function addTag(tag: string) {
        messageResult += ` #${tag}`;
    }

    async function broadcast() {
        const kind1Event = new NDKEvent($ndk);
        kind1Event.kind = NDKKind.Text;

        messageResult += '\n\n #satshoot #asknostr #troubleshooting';
        kind1Event.content = messageResult;
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
        textArea.setSelectionRange(0, 0);
        textArea.focus();
    });

</script>

{#if $modalStore[0]}
    <div class="card p-4 bg-primary-300-600-token">
        <h4 class="h4 text-center mb-2 underline">Broadcast to Nostr</h4>
        <div class="flex flex-col justify-center gap-y-4">
            <label class="label">
                <span class="">Add topics of interest</span>
                <div class="flex justify-between">
                    <input class="input w-full text-center" 
                    bind:value={tagInput}
                    title="Tag your Interests" 
                    type="text" 
                    placeholder="Type topics of interest"
                />
                    <button 
                        class="btn btn-icon"
                        type="button" 
                        on:click={()=>{addTag(tagInput)}}
                        disabled={posting}
                    >
                        <span>
                            <i 
                                class="text-3xl text-success-500 fa-solid fa-circle-plus"
                            >
                            </i>
                        </span>
                    </button>
                </div>
            </label>
            <div class="card max-w-sm px-4 pb-4 overflow-y-auto max-h-32" tabindex="-1">
                <Autocomplete
                    bind:input={tagInput}
                    options={tagOptions}
                    on:selection={onAutoCompleteSelected}
                />
            </div>
            <label class="label">
                <span>Your Message:</span>
                <textarea 
                rows="8"
                class="textarea"
                bind:this={textArea}
                bind:value={messageResult}
            />
                <span>#satshoot #asknostr #troubleshooting</span>
            </label>
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
                        <span>Post</span>
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}
