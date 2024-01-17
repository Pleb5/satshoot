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

    export let seedWords:string[];

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
            <h4 class="h4 mb-4">Write down these words in a safe place to be able to access your account later:</h4>
            <div class="flex w-full justify-between">
                <div class="card p-4 border-2 border-red-500">
                    <div class="grid grid-cols-4 gap-x-2 gap-y-2">
                        {#each seedWords as word, i}
                            <strong class="max-w-sm">{i+1}{'. ' + word}</strong>
                        {/each}
                    </div>
                </div>
                <button 
                    class="btn btn-md self-center bg-red-500 font-bold"
                    use:clipboard={seedWords.toString()}
                    on:click={onClickHandler}
                >
                    {copied ? 'Copied!' : 'Dangerously Copy'}
                <button>
            </div>
            <hr class="!my-4"/>
			<button class="btn font-bold bg-success-400-500-token" on:click={parent.onClose}>I wrote them down!</button>
		</div>
	</div>
{/if}
