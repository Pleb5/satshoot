<script lang="ts">
	import type { SvelteComponent } from 'svelte';


    import { clipboard } from '@skeletonlabs/skeleton';
	// Stores
	import { getModalStore } from '@skeletonlabs/skeleton';

	// Props
	/** Exposes parent props to this component. */
	export let parent: SvelteComponent;

    export let seedWords: string[] = [];
    export let nsec: string | undefined = undefined;
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

    let copiedNpub = false;
    function onCopyNpub(): void {
        copiedNpub = true;
        setTimeout(() => {
            copiedNpub = false;
        }, 1000);
    }

    let copiedNsec = false;
    function onCopyNsec(): void {
        copiedNsec = true;
        setTimeout(() => {
            copiedNsec = false;
        }, 1000);
    }

    let passphrase:string;
    let confirmPassphrase:string;
    let passphraseValid: boolean = false;
    let confirmPassphraseValid: boolean = false;
    let showPassphrase: boolean = false;
    let showConfirmPassphrase: boolean = false;

    let statusMessage: string;
    let statusColor = 'text-blue-500';

    function validatePassphrase() {
        if (passphrase.length > 13){
            passphraseValid = true;
        } else {
            passphraseValid = false;
            confirmPassphraseValid = false;
        }
    }

    function validateConfirmPassphrase() {
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
                const encryptedSeed = m.data['encryptedSeed'];
                if (encryptedSeed && npub) {
                    // Save encrypted seed words in browser localStorage
                    localStorage.setItem('nostr-seedwords', encryptedSeed);
                    localStorage.setItem('nostr-npub', npub);
                    // todo: enum for signing methods
                    localStorage.setItem('login-method', "ephemeral");
                } else {
                    statusMessage = 'Unexpected response from decryption process:' + m.data;
                setTimeout(()=>{
                    statusColor = 'text-red-500';
                }, 800);            
                }
            };

            cryptWorker.onerror = (e) => {
                statusMessage = `Error while decrypting seed words! Incorrect Passphrase!`;
                setTimeout(()=>{
                    statusColor = 'text-red-500';
                }, 800);            

            };

            cryptWorker.onmessageerror = (me) => {
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
		<div class="flex flex-col items-center ">
			<h2 class="h2 mb-4">Backup your Account</h2>
            {#if seedWords.length > 0 && npub && nsec}
                <h4 class="h4 mb-4">Put these words in a safe place to be able to access your account later:</h4>
                <div class="grid grid-cols-4 w-full space-x-2 mb-8">
                    <div class="card p-4 border-2 border-red-500 col-span-3">
                        <div class="grid grid-cols-4 gap-x-2 gap-y-2">
                            {#each seedWords as word, i}
                                <strong class="max-w-sm">{i+1}{'. ' + word}</strong>
                            {/each}
                        </div>
                    </div>
                    <button 
                        class="btn btn-md w-40 self-center justify-self-start bg-red-500 font-bold"
                        use:clipboard={seedWords.join(' ')}
                        on:click={onCopySeed}
                    >
                        {copied ? 'Copied!' : 'Dangerously Copy'}
                        <button>
                </div>

                <div class="grid grid-cols-4 w-full mb-8 space-x-2">
                    <div class="card p-4 border-2 border-red-500 col-span-3">
                        <strong class="max-w-sm">{nsec}</strong>
                    </div>
                    <button 
                        class="btn btn-md w-40 self-center justify-self-start bg-red-500 font-bold"
                        use:clipboard={nsec}
                        on:click={onCopyNsec}
                    >
                        {copiedNsec ? 'Copied!' : 'Dangerously Copy'}
                        <button>
                </div>

                <div class="grid grid-cols-4 w-full mb-8 space-x-2">
                    <div class="card p-4 border-2 border-red-500 col-span-3">
                        <strong class="max-w-sm">{npub}</strong>
                    </div>
                    <button 
                        class="btn btn-md self-center justify-self-start bg-red-500 font-bold"
                        use:clipboard={npub}
                        on:click={onCopyNpub}
                    >
                        {copiedNpub ? 'Copied!' : 'Copy'}
                        <button>
                </div>

                <h2 class="h4 mb-4">Your secret words will be stored locally in encrypted form</h2>
                <h4 class="h4 mb-4">Provide a strong passphrase for encryption:</h4>

            <div class="flex justify-between items-center m-4">
                <input 
                    class="input {passphraseValid ? 'input-success' : 'input-error'} w-80" 
                    title="Passphrase(min. 14chars):" 
                    type={ showPassphrase ? 'text' : 'password' }
                    placeholder="Enter passphrase..."
                    on:input={(event) => {
                        passphrase = event.currentTarget.value;
                        validatePassphrase();
                    }}
                />
                        
                    <button
                        type="button" 
                        class="btn btn-icon-sm"
                        on:click={ () => showPassphrase = !showPassphrase }>
                        <span>
                            <i class="fa-solid { showPassphrase ? 'fa-eye' : 'fa-eye-slash' }"></i>
                        </span>
                    </button>
            </div>

            <div class="flex justify-between items-center mb-8">
                <input 
                    class="input {confirmPassphraseValid ? 'input-success' : 'input-error'}  w-80" 
                    title="Confirm passphrase:" 
                    type={ showConfirmPassphrase ? 'text' : 'password' }
                    placeholder="Confirm passphrase..." 
                    disabled={!passphraseValid}
                    on:input={(event) => {
                        confirmPassphrase = event.currentTarget.value;
                        validateConfirmPassphrase();
                    }}
                />
                <button
                    type="button" 
                    class="btn btn-icon-sm"
                    on:click={ () => showConfirmPassphrase = !showConfirmPassphrase }>
                    <span>
                        <i class="fa-solid { showConfirmPassphrase ? 'fa-eye' : 'fa-eye-slash' }"></i>
                    </span>
                </button>
            </div>
                 
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
                <p>Error! Seed words, nsec or npub missing!</p>
            {/if}
		</div>
	</div>
{/if}
