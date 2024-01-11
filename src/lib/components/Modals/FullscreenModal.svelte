<script lang="ts">
	import type { SvelteComponent } from 'svelte';


    import { clipboard } from '@skeletonlabs/skeleton';

	// Stores
	import { getModalStore } from '@skeletonlabs/skeleton';

	// Props
	/** Exposes parent props to this component. */
	export let parent: SvelteComponent;

	const modalStore = getModalStore();

	// Notes: Use `w-screen h-screen` to fit the visible canvas size.
	const cBase = 'bg-surface-100-800-token w-screen h-screen p-4 flex justify-center items-center';

    export let seedWords:string;

    let copied = false;
    function onClickHandler(): void {
        copied = true;
        setTimeout(() => {
            copied = false;
        }, 1000);
    }

</script>

{#if $modalStore[0]}
	<div class="modal-example-fullscreen {cBase}">
		<div class="flex flex-col items-center space-y-16">
			<h2 class="h2">Backup your Account</h2>
            <p class="mb-4">Write down these words in a safe place to be able to access your account later:</p>
            <div class="flex w-full justify-between">
                <strong class="max-w-sm">{seedWords}</strong>
                <button 
                    class="btn btn-sm bg-error-400-500-token"
                    use:clipboard={seedWords}
                    on:click={onClickHandler}
                >
                    {copied ? 'Copied!' : 'Dangerously Copy'}
                <button>
            </div>

			<button class="btn bg-success-400-500-token" on:click={parent.onClose}>I wrote them down!</button>
		</div>
	</div>
{/if}
