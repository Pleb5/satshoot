<script lang="ts">
	import { type SvelteComponent } from 'svelte';
	import { getModalStore } from '@skeletonlabs/skeleton';
    import { ProgressRadial } from '@skeletonlabs/skeleton';

	// Props
	/** Exposes parent props to this component. */
	export let parent: SvelteComponent;

	const modalStore = getModalStore();

</script>

{#if $modalStore[0]}
	<div class="card p-8 flex flex-col items-center bg-surface-400-500-token">
        <h3 class="h3 text-center font-bold mb-8">Asking for permission</h3>
        <ProgressRadial
            value={undefined}
            stroke={60}
            meter="stroke-primary-500"
            track="stroke-primary-500/30"
            strokeLinecap="round" width="w-16" 
        />
        <button 
            type="button"
            class="btn btn-sm sm:btn-md bg-error-300-600-token w-24 mt-8"
            on:click={()=> modalStore.close()}
        >
            Cancel
        </button>
    </div>
{/if}
