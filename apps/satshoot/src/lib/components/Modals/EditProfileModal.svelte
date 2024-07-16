<script lang="ts">
	import { getModalStore } from '@skeletonlabs/skeleton';
    import { SvelteComponent, onMount } from 'svelte';

	export let parent: SvelteComponent;
	const modalStore = getModalStore();

    export let dataToEdit: string;
    export let fieldName: string;
    
    let editedData: string = '';

    function finish() {
        if ($modalStore[0].response) {
            $modalStore[0].response(editedData);
            modalStore.close();
        };
    }

    onMount(()=>{
        editedData = dataToEdit;
    });

</script>
{#if $modalStore[0]}
    <div class="card p-4 bg-primary-300-600-token">
        <h4 class="h4 text-center">{'Edit ' + fieldName}</h4>
        {#if fieldName === 'About'}
            <div class="flex flex-col justify-center gap-y-4">
                <textarea 
                rows="6"
                class="textarea"
                placeholder="Write about yourself"
                bind:value={editedData}
            />
            </div>
        {:else}
            <div class="flex flex-col justify-center gap-y-2">
                <input 
                type="text"
                class="input"
                placeholder={'New ' + fieldName}
                bind:value={ editedData }
            />
            </div>
        {/if}
        <div class="flex justify-between mt-4 h-10">
            <button 
                type="button"
                class="btn btn-sm sm:btn-md bg-error-300-600-token"
                on:click={()=> modalStore.close()}
            >
                Cancel
            </button>
            <button 
                type="button" 
                on:click={finish}
                class="btn btn-lg bg-success-300-600-token"
            >
                Change
            </button>
        </div>
    </div>
{/if}
