<script lang="ts">
	import type { SvelteComponent } from 'svelte';


    import { clipboard } from '@skeletonlabs/skeleton';
	// Stores
	import { getModalStore } from '@skeletonlabs/skeleton';

    // Todo: show nsec and npub also! Let user copy
    // passwords fields -> passphrase and smaller width
    // gap reduce

	// Props
	/** Exposes parent props to this component. */
	export let parent: SvelteComponent;

    export let seedWords: string[] = [];
    export let npub: string | undefined = undefined;

	const modalStore = getModalStore();

	// Notes: Use `w-screen h-screen` to fit the visible canvas size.
	const cBase = 'bg-surface-100-800-token w-screen h-screen p-4 flex justify-center items-center';

    let copied = false;
    function onCopySeed(): void {
        copied = true;
        setTimeout(() => {
            copied = false;
        }, 1000);
    }

    let passphrase:string;
    let confirmPassphrase:string;
    let passphraseValid: boolean = false;
    let confirmPassphraseValid: boolean = false;

    let statusMessage: string;
    let statusColor = 'text-blue-500';

    function validatePassword() {
        if (passphrase.length > 13){
            passphraseValid = true;
        } else {
            passphraseValid = false;
            confirmPassphraseValid = false;
        }
    }

    function validateConfirmPassword() {
        if (passphrase === confirmPassphrase){
            confirmPassphraseValid = true;
        } else {
            confirmPassphraseValid = false;
        }
    }

    function encryptAndSaveSeed() {
        if (seedWords && npub) {
            // encrypt seed 
            const cryptWorker = new Worker(new URL("$lib/utils/crypto.worker.ts", import.meta.url),{
                type: 'module'
            });

            cryptWorker.onmessage = (m) => {
                console.log("Received message from cryptWorker:", m)
                const encryptedSeed = m.data['encryptedSeed'];
                if (encryptedSeed && npub) {
                    // Save encrypted seed words in browser localStorage
                    localStorage.setItem('nostr-seedwords', encryptedSeed);
                    localStorage.setItem('nostr-npub', npub);
                    // todo: enum for signing methods
                    localStorage.setItem('signin-method', "ephemeral");
                } else {
                    statusMessage = 'Unexpected response from decryption process:' + m.data;
                setTimeout(()=>{
                    statusColor = 'text-red-500';
                }, 800);            
                }
            };

            cryptWorker.onerror = (e) => {
                console.log("Error happened in cryptWorker:", e.message)
                statusMessage = `Error while decrypting seed words! Incorrect Passphrase!`;
                setTimeout(()=>{
                    statusColor = 'text-red-500';
                }, 800);            

            };

            cryptWorker.onmessageerror = (me) => {
                console.log('Message error:', me);
                statusMessage = 'Received malformed message: ' + me.data;

                setTimeout(()=>{
                    statusColor = 'text-red-500';
                }, 800);            
            }

            // Start worker in background and wait for decryption result in onmessage
            cryptWorker.postMessage({
                seed: seedWords.join(' '),
                passphrase: passphrase,
                salt: npub
            });
        }

    }

    function finish() {
        // Todo: Loading popup while encrypting
        encryptAndSaveSeed();
        parent.onClose();
    }

</script>

{#if $modalStore[0]}
	<div class="modal-example-fullscreen {cBase}">
		<div class="flex flex-col items-center space-y-16">
			<h2 class="h2">Backup your Account</h2>
            {#if seedWords.length > 0 || !npub}
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
                        use:clipboard={seedWords.join(' ')}
                        on:click={onCopySeed}
                    >
                        {copied ? 'Copied!' : 'Dangerously Copy'}
                        <button>
                </div>

                <h2 class="h4 mb-4">Your secret words will be stored locally in encrypted form</h2>
                <h4 class="h4 mb-4">Provide a strong passphrase for encryption:</h4>

                <input 
                    class="input {passphraseValid ? 'input-success' : 'input-error'}" 
                    title="Password(min. 14chars):" 
                    type="password" 
                    placeholder="Enter password..."
                    bind:value={passphrase}
                    on:input={validatePassword}
                />
                <input 
                    class="input {confirmPassphraseValid ? 'input-success' : 'input-error'}" 
                    title="Confirm Password:" 
                    type="password" 
                    placeholder="Enter password..." 
                    disabled={!passphraseValid}
                    bind:value={confirmPassphrase}
                    on:input={validateConfirmPassword}
                />
                 
                <button 
                    class="btn font-bold bg-success-400-500-token" 
                    disabled={!passphraseValid || !confirmPassphraseValid} 
                    on:click={finish}
                >
                    Finish
                </button>
                {#if statusMessage}
                    <h5 class="h5 font-bold text-center {statusColor} mt-2" >{statusMessage}</h5>
                {/if}
            {:else}
                <p>Error! No seed words to show!</p>
            {/if}
		</div>
	</div>
{/if}
