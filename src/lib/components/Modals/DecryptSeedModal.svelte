<script lang="ts">
	import type { SvelteComponent } from 'svelte';

	// Modals, Toasts
	import { getModalStore } from '@skeletonlabs/skeleton';
    import { getToastStore, type ToastSettings } from '@skeletonlabs/skeleton';

    import { decryptSeed } from '$lib/utils/crypto';

	// Props
	/** Exposes parent props to this component. */
	export let parent: SvelteComponent;

	const modalStore = getModalStore();
    const toastStore = getToastStore();

    let seedWords: string;
    let passphrase:string;
    let error: string='';

    async function loadSeed() {
        try {
            const encrpytedSeed: string|null = localStorage.getItem("nostr-seedwords")
            const salt :string|null = localStorage.getItem("nostr-npub")

            if (!encrpytedSeed || !salt) {
                throw new Error('Could not fetch encrypted seedwords from local storage!');
            }

            seedWords = await decryptSeed(encrpytedSeed, passphrase, salt);

            if ($modalStore[0].response) {
                $modalStore[0].response(seedWords);
                modalStore.close();
            };
        } catch(e) {
            // Show error message
            error = `Error while decrypting seed words! Incorrect Passphrase!`;
        }
    }

    let showPassword: boolean = false;

</script>

{#if $modalStore[0]}
	<div class="card p-4 grid grid-cols-1 justify-center w-screen/2 h-screen-2 bg-surface-400-500-token">
        <h2 class="h2">Decrypt Ephemeral Seed</h2>
        <h4 class="h4 mt-2">Found Seed in browser local storage, provide passphrase to load it</h4>
        <form on:submit={()=>{
            error = 'Decrypting...';
            loadSeed();
        }}>
            <div class="flex justify-between items-center m-4">
                <div class="flex justify-between items-center gap-x-1">
                    <input 
                        class="input w-60 " 
                        title="Passphrase:" 
                        type={ showPassword ? 'text' : 'password' }
                        placeholder="Enter Passphrase..."
                        on:input={(event) => passphrase = event.currentTarget.value}
                    />
                    <button
                        type="button" 
                        class="btn btn-icon-sm"
                        on:click={ () => showPassword = !showPassword }>
                        <span>
                            <i class="fa-solid { showPassword ? 'fa-eye' : 'fa-eye-slash' }"></i>
                        </span>
                    </button>
                </div>
                <button 
                    type="submit"
                    class="btn btn-lg h-14 font-bold bg-primary-400-500-token"
                    disabled={!passphrase}
                >
                    Decrypt
                </button>
            </div>
            {#if error}
                <h5 class="h5 font-bold text-red-500">{error}</h5>
            {/if}
        </form>
    </div>
{/if}
