<script lang="ts">
	import type { SvelteComponent } from 'svelte';
    import ndk from '$lib/stores/ndk';
    import { NDKPrivateKeySigner, NDKUser } from "@nostr-dev-kit/ndk";
    import { privateKeyFromSeedWords, validateWords } from "nostr-tools/nip06";

	// Stores
	import { getModalStore } from '@skeletonlabs/skeleton';

	// Props
	/** Exposes parent props to this component. */
	export let parent: SvelteComponent;

	const modalStore = getModalStore();

    let seedWords: string[] = new Array(12).fill('');
    let passphrase:string;
    let confirmPassphrase:string;
    let passphraseValid: boolean = false;
    let confirmPassphraseValid: boolean = false;

    let statusMessage: string;
    let statusColor = 'text-blue-500';

    function validateSeedWordInputs():boolean {
        // Validate all words filled in
        seedWords.forEach((value) => {
            if (!value) {
                statusMessage = "Fill in all words!";
                setTimeout(()=>{
                    statusColor = 'text-red-500';
                }, 800);            
                return false;
            }
        })
        // validate valid bip39 wordlist provided
        if (!validateWords(seedWords.join(' '))) {
            statusMessage = "Check the seed words again! Not valid bip39 wordlist!";
            setTimeout(()=>{
                statusColor = 'text-red-500';
            }, 800);            
            return false
        }
        return true;
    }

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

    async function encryptAndSaveSeed() {
        statusMessage = 'Encrypting and saving Seed in browser storage...';
        statusColor = 'text-blue-500';
        try {
            const privateKey = privateKeyFromSeedWords(seedWords.join(' ')); 
            $ndk.signer = new NDKPrivateKeySigner(privateKey); 
            
            // Fetch user
            const user:NDKUser = await $ndk.signer.user();

            user.fetchProfile().then(() => {
                // Trigger UI change in profile
                $ndk.activeUser = $ndk.activeUser;
            });

            // encrypt seed 
            const cryptWorker = new Worker(
                new URL("$lib/utils/crypto.worker.ts", import.meta.url),
                { type: 'module' }
            );

            cryptWorker.onmessage = (m) => {
                // set response and close modal
                console.log("Received message from cryptWorker:", m)
                const encryptedSeed = m.data['encryptedSeed'];
                if (encryptedSeed) {
                    localStorage.setItem('nostr-seedwords', encryptedSeed);
                    localStorage.setItem('nostr-npub', user.npub);
                    localStorage.setItem('signin-method', "ephemeral");
                    modalStore.close();
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
                salt: user.npub
            });
        } catch(e) {
            statusMessage = `Could not create Private Key from Seed Words!
Probably incorrect Seed Words!` + e
            setTimeout(()=>{
                statusColor = 'text-red-500';
            }, 800);            
        }
    }

    function finish() {
        // Todo: Loading popup while encrypting
        statusMessage = 'Validating...';
        statusColor = 'text-blue-500';
        if (validateSeedWordInputs()) {
            encryptAndSaveSeed();
        }
    }

    // Notes: Use `w-screen h-screen` to fit the visible canvas size.
    const cBase = 'bg-surface-100-800-token w-screen h-screen p-4 flex justify-center items-center';

</script>

{#if $modalStore[0]}
	<div class="modal-example-fullscreen {cBase}">
		<div class="flex flex-col items-center space-y-16">
            <h2 class="h2">Restore Seed Words:</h2>
            <form on:submit|preventDefault={ finish }>
                <div class="flex w-full justify-between">
                    <div class="card p-4 border-2 border-red-500">
                        <div class="grid grid-cols-4 gap-x-2 gap-y-2">
                            {#each seedWords as word, i}
                                <div class="flex items-center gap-x-1">
                                    <strong class="max-w-sm">{i+1}{'. '}</strong>
                                    <input
                                        class="input {seedWords[i] ? 'input-success' : 'input-error'}"
                                        type='text'
                                        bind:value={ seedWords[i] }
                                    />
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>


                <div class="flex flex-col gap-y-2 items-center my-6">
                    <h2 class="h4 font-bold text-center">Your secret words will be stored locally in encrypted form.</h2>
                    <h4 class="h4 text-center">Provide a strong passphrase for encryption:</h4>
                    <input 
                        class="input {passphraseValid ? 'input-success' : 'input-error'} w-80" 
                        title="Passphrase(min. 14chars):" 
                        type="password" 
                        placeholder="Enter Passphrase..."
                        bind:value={passphrase}
                        on:input={validatePassphrase}
                    />
                    <input 
                        class="input {confirmPassphraseValid ? 'input-success' : 'input-error'} w-80" 
                        title="Confirm Passphrase:" 
                        type="password" 
                        placeholder="Confirm Passphrase..." 
                        disabled={!passphraseValid}
                        bind:value={confirmPassphrase}
                        on:input={validateConfirmPassphrase}
                    />

                    <button 
                        type="submit"
                        class="btn font-bold bg-success-400-500-token w-72 mt-4" 
                        disabled={!passphraseValid || !confirmPassphraseValid} 
                    >
                        Finish
                    </button>
                </div>
            </form>
            {#if statusMessage}
                <h5 class="h5 font-bold text-center {statusColor} mt-2" >{statusMessage}</h5>
            {/if}
		</div>
	</div>
{/if}
