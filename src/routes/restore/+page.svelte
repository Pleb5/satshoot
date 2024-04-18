<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import currentUser from "$lib/stores/login";

    import { RestoreMethod, sessionPK } from "$lib/stores/ndk";
    import { privateKeyFromNsec } from '$lib/utils/nip19';
    import { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
    import { privateKeyFromSeedWords, validateWords } from "nostr-tools/nip06";
    import { wordlist } from '@scure/bip39/wordlists/english';

    import redirectStore from '$lib/stores/redirect-store';
    
    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { ProgressRadial } from '@skeletonlabs/skeleton';

    import { goto } from '$app/navigation';
    import { tick } from 'svelte';
    import { loggedIn } from '$lib/stores/login';
    import { initializeUser } from '$lib/utils/helpers';

    
    const toastStore = getToastStore();

    let restoreMethod: RestoreMethod | undefined = undefined;

    let seedWords: string[] = new Array(12).fill('');
    let nsec: string = '';
    let passphrase:string;
    let confirmPassphrase:string;
    let passphraseValid: boolean = false;
    let confirmPassphraseValid: boolean = false;
    let showPassword: boolean = false;
    let showConfirmPassword: boolean = false;

    let statusMessage: string;
    let statusColor = 'text-tertiary-200-700-token';

    let encrypting = false;

    function validateSingleSeedWord(seedWord: string):boolean {
        return wordlist.includes(seedWord);
    }

    function validateSeedWordInputs():boolean {
        // Validate all words filled in
        let allFilledIn = true;
        seedWords.forEach((value) => {
            if (!value) {
                allFilledIn = false;
            }
        });
        if (!allFilledIn) {
            statusMessage = "Fill in all words!";
            setTimeout(()=>{
                statusColor = 'text-red-500';
            }, 800);            
            return false;
        }
        // validate valid bip39 wordlist provided
        if (!validateWords(seedWords.join(' '))) {
            statusMessage = "Check the seed words again! Not a valid bip39 wordlist!";
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

    async function encryptAndSaveSecret() {
        statusMessage = 'Encrypting and saving Secret in browser storage...';
        statusColor = 'text-tertiary-200-700-token';
        try {

            let privateKey: string|undefined = undefined; 
            if (restoreMethod === RestoreMethod.Seed) {
                privateKey = privateKeyFromSeedWords(seedWords.join(' '));
            } else if (restoreMethod === RestoreMethod.Nsec) {
                privateKey = privateKeyFromNsec(nsec);
            }

            if (privateKey) {
                $ndk.signer = new NDKPrivateKeySigner(privateKey); 

                $sessionPK = privateKey;

                await initializeUser($ndk);

                if ($loggedIn) {
                    // Disable Finish button until we get a result from the encryption process
                    // encrypt secret 
                    const cryptWorker = new Worker(
                        new URL("$lib/utils/crypto.worker.ts", import.meta.url),
                        { type: 'module' }
                    );

                    cryptWorker.onmessage = (m) => {
                        // set response and close modal
                        const encryptedSecret = m.data['encryptedSecret'];
                        if (encryptedSecret) {
                            if (restoreMethod === RestoreMethod.Seed) {
                                localStorage.setItem('nostr-seedwords', encryptedSecret);
                            } else if (restoreMethod === RestoreMethod.Nsec) {
                                localStorage.setItem('nostr-nsec', encryptedSecret);
                            }
                            localStorage.setItem('nostr-npub', $currentUser!.npub);
                            localStorage.setItem('login-method', "ephemeral");

                            const t: ToastSettings = {
                                message: 'Encrypted Secret saved in local storage!',
                                timeout: 7000,
                                background: 'bg-success-300-600-token',
                            };
                            toastStore.trigger(t);
                            if ($redirectStore) {
                                goto($redirectStore);
                                $redirectStore = '';
                            } else {
                                goto('/my-tickets');
                            }
                        } else {
                            statusMessage = 'Unexpected response from encryption process:' + m.data;
                            setTimeout(()=>{
                                statusColor = 'text-red-500';
                            }, 800);            
                        }
                    };

                    cryptWorker.onerror = (e) => {
                        console.log("Error happened in cryptWorker:", e.message)
                        statusMessage = `Error while encrypting secret!`;
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

                    encrypting = true;
                    await tick();

                    // Start worker in background and wait for result in onmessage
                    cryptWorker.postMessage({
                        // Pass the correct secret to the encryption process
                        secret: restoreMethod === RestoreMethod.Seed 
                            ? seedWords.join(' ') : nsec,
                        passphrase: passphrase,
                        salt: $currentUser!.npub
                    });
                }
            } else {
                throw new Error("Creating Private key from input failed!");
            }
        } catch(e) {
            statusMessage = `Could not create Private Key!
Probably incorrect Seed Words or nsec! ` + e
            setTimeout(()=>{
                statusColor = 'text-red-500';
                encrypting = false;
            }, 800);            
        }
    }

    function finish() {
        if (restoreMethod === RestoreMethod.Seed && validateSeedWordInputs()) {
            encryptAndSaveSecret();
        } else if (restoreMethod === RestoreMethod.Nsec) {
            encryptAndSaveSecret();
        }
    }

</script>

<div class="p-4">
    {#if !restoreMethod}
        <div class="flex flex-col justify-center items-center gap-y-8 ">
            <button
                class="btn btn-md mt-2 bg-primary-300-600-token min-w-64 max-w-96"
                on:click={()=>{restoreMethod = RestoreMethod.Seed;}}
            >
                Restore from Seed Words
            </button>
            <button
                class="btn btn-md mt-2 bg-primary-300-600-token min-w-64 max-w-96"
                on:click={()=>{restoreMethod = RestoreMethod.Nsec;}}
            >
                Restore from Nsec
            </button>
        </div>
    {/if}
    {#if restoreMethod}
        <h2 class="h2 text-center mb-8">{restoreMethod === RestoreMethod.Seed
            ? 'Restore from Seed Words:' 
            : 'Restore from Nsec:'}
        </h2>
        <form on:submit|preventDefault={ finish }>
            <div class="flex flex-col items-center">
                <div class="card p-4 border-2 border-red-500 mx-4 max-w-96">
                    {#if restoreMethod === RestoreMethod.Seed}
                        <div class="grid grid-cols-2 gap-x-2 gap-y-2">
                            {#each seedWords as word, i}
                                <div class="flex items-center gap-x-1">
                                    <strong class="max-w-sm">{i+1}{'. '}</strong>
                                    <input
                                        class="input {
                                        validateSingleSeedWord(seedWords[i])
                                        ? 'input-success' : 'input-error'
                                        }"
                                        type='text'
                                        on:input={ (event) => {
                                            seedWords[i] = event.currentTarget.value.toLowerCase();
                                        }}
                                    />
                                </div>
                            {/each}
                        </div>
                        {:else if restoreMethod === RestoreMethod.Nsec}
                        <div class="flex justify-center ">
                            <input class="input" type="text" bind:value={nsec} />
                        </div>
                    {/if}
                </div>
            </div>


            <div class="flex flex-col gap-y-2 items-center my-6">
                <h2 class="h4 font-bold text-center">
                    {
                    'Your secret ' +
                        (restoreMethod === RestoreMethod.Seed ? 'words' : 'key') +
                        ' will be stored locally in encrypted form and unencrypted until your session ends.'
                    }
                </h2>
                <h4 class="h4 text-center">Provide a strong passphrase for encryption at rest(min. 14chars):</h4>
                <!-- Todo: autocomplete -->
                <div class="flex justify-between items-center ">
                    <input 
                        class="input {passphraseValid ? 'input-success' : 'input-error'}" 
                        title="Passphrase(min. 14chars):" 
                        type={ showPassword? 'text' : 'password' }
                        placeholder="Enter Passphrase..."
                        on:input={ (event) => {
                            passphrase = event.currentTarget.value;
                            validatePassphrase();
                        }}
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

                <div class="flex justify-between items-center my-4">
                    <input 
                        class="input {confirmPassphraseValid ? 'input-success' : 'input-error'} " 
                        title="Confirm Passphrase:" 
                        type={ showConfirmPassword ? 'text' : 'password' }
                        placeholder="Confirm Passphrase..." 
                        disabled={!passphraseValid}
                        on:input={ (event) => {
                            confirmPassphrase = event.currentTarget.value;
                            validateConfirmPassphrase();
                        }}
                    />

                    <button
                        type="button" 
                        class="btn btn-icon-sm"
                        on:click={ () => showConfirmPassword = !showConfirmPassword }>
                        <span>
                            <i class="fa-solid { showConfirmPassword ? 'fa-eye' : 'fa-eye-slash' }"></i>
                        </span>
                    </button>
                </div>

                <button 
                    type="submit"
                    class="btn font-bold bg-success-400-500-token w-72 mt-4" 
                    disabled={!restoreMethod || !passphraseValid || !confirmPassphraseValid || encrypting} 
                >
                {#if encrypting}
                    <span>
                        <ProgressRadial value={undefined} stroke={60} meter="stroke-tertiary-500"
                            track="stroke-tertiary-500/30" strokeLinecap="round" width="w-8" />
                    </span>
                {:else}
                    <span>Finish</span>
                {/if}
                </button>
            </div>
        </form>
    {/if}
    {#if statusMessage}
        <h5 class="h5 font-bold text-center {statusColor} mt-2" >{statusMessage}</h5>
    {/if}
</div>
