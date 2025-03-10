<script lang="ts">
	import { type SvelteComponent } from 'svelte';
    
	import { getModalStore } from '@skeletonlabs/skeleton';
    import Popup from '../UI/Popup.svelte';
    import Button from '../UI/Buttons/Button.svelte';

    const modalStore = getModalStore();

	// Props
	/** Exposes parent props to this component. */
	export let parent: SvelteComponent;

</script>

{#if $modalStore[0]}
    <Popup title="You accepted the Offer!">
        <strong class='text-error-500'>
            It is strongly recommended you use specialized E2EE(e.g. SimpleX chat)
            messaging software for highly sensitive information!
        </strong>
        <p class="mt-4">
            <span> You will be redirected to </span>
            <span class="badge bg-primary-300-600-token">
                <span class="mr-2">Chat</span>
                <i class="fa-solid fa-comment text-lg md:text-xl"></i>

            </span>
            <span>
                and talk about your preferred communication method then switch to that app for the actual Job!
            </span>
        </p>

        <div class="flex justify-center">
            <Button 
                on:click={()=> modalStore.close()}
            >
                Great!
            </Button>
        </div>
    </Popup>
{/if}
