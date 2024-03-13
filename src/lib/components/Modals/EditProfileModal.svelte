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
        <form on:submit|preventDefault={ finish }>
            <div class="flex flex-col justify-center gap-y-4">
                <textarea 
                    rows="6"
                    class="textarea"
                    placeholder="Write about yourself"
                    bind:value={editedData}
                />
                <button
                    type="submit"
                    class="btn btn-lg bg-success-300-600-token"
                >
                    Change
                </button>
            </div>
        </form>
    {:else}
        <form on:submit|preventDefault={ finish }>
            <div class="flex flex-col justify-center gap-y-2">
                <input 
                    type="text"
                    class="input"
                    placeholder={'New ' + fieldName}
                    bind:value={ editedData }
                />
                <button 
                    type="submit" 
                    class="btn btn-lg mt-4 bg-success-300-600-token"
                >
                    Change
                </button>
            </div>
        </form>
    {/if}
</div>
{/if}
