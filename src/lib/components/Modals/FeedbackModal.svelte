<script lang="ts">
	import { onMount, type SvelteComponent } from 'svelte';
    import ndk from '$lib/stores/ndk';
    import { NDKEvent, NDKKind, NDKRelaySet, NDKUser } from '@nostr-dev-kit/ndk';
    
	import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { getToastStore } from '@skeletonlabs/skeleton';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

	// Props
	/** Exposes parent props to this component. */
	export let parent: SvelteComponent;

    let message: string = '';

    async function postFeedback() {
        $ndk.enableOutboxModel = true;
        $ndk.outboxRelayUrls = ["wss://purplepag.es"];
        const kind1Event = new NDKEvent($ndk);
        kind1Event.kind = NDKKind.Text;

        kind1Event.content = message;
        kind1Event.generateTags();

        const five = $ndk.getUser(
            {npub: 'npub16p8v7varqwjes5hak6q7mz6pygqm4pwc6gve4mrned3xs8tz42gq7kfhdw'}
        );
        kind1Event.tag(five);

        try {

            let relays = await kind1Event.publish();
            console.log(relays)
            const t: ToastSettings = {
                message: 'Appreciate Your Feedback!',
                timeout: 7000,
                background: 'bg-success-300-600-token',
            };
            toastStore.trigger(t);

            modalStore.close();
            $ndk.enableOutboxModel = false;
        } catch(e) {
            const t: ToastSettings = {
                message: 'Error happened while publishing Feedback! Try again later!',
                timeout: 5000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);

            modalStore.close();
            $ndk.enableOutboxModel = false;
        }
    }

    onMount(()=>{
        message = `\n\n#bitcointroubleshoot #feedback`;
    });

</script>

{#if $modalStore[0]}
    <div class="card p-4 bg-primary-300-600-token">
        <h4 class="h4 text-center mb-2">Post Public Feedback</h4>
        <form on:submit|preventDefault={ postFeedback }>
            <div class="flex flex-col justify-center gap-y-4">
                <textarea 
                    rows="8"
                    class="textarea"
                    bind:value={message}
                />
                <button
                    type="submit"
                    class="btn btn-lg bg-success-300-600-token"
                >
                    Post
                </button>
            </div>
        </form>
    </div>
{/if}
