<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import { sessionPK } from "$lib/stores/ndk";
    import { NDKPrivateKeySigner, NDKUser } from "@nostr-dev-kit/ndk";
    import { privateKeyFromSeedWords, validateWords } from "nostr-tools/nip06";
    import { wordlist } from '@scure/bip39/wordlists/english';

    import { myTickets, myOffers, myTicketFilter, myOfferFilter } from "$lib/stores/troubleshoot-eventstores";
    
    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { goto } from '$app/navigation';
    import { tick } from 'svelte';
    
    const toastStore = getToastStore();

    let seedWords: string[] = new Array(12).fill('');
    let passphrase:string;
    let confirmPassphrase:string;
    let passphraseValid: boolean = false;
    let confirmPassphraseValid: boolean = false;
    let showPassword: boolean = false;
    let showConfirmPassword: boolean = false;

    let statusMessage: string;
    let statusColor = 'text-blue-500';

    let disable = false;

    function validateSingleSeedWord(seedWord: string):boolean {
        return wordlist.includes(seedWord);
    }

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

    async function encryptAndSaveSeed() {
        statusMessage = 'Encrypting and saving Seed in browser storage...';
        statusColor = 'text-blue-500';
        try {
            const privateKey = privateKeyFromSeedWords(seedWords.join(' ')); 
            $ndk.signer = new NDKPrivateKeySigner(privateKey); 

            $sessionPK = privateKey;

            
            // Fetch user
            const user:NDKUser = await $ndk.signer.user();

            myTicketFilter.authors?.push(user.pubkey);
            myOfferFilter.authors?.push(user.pubkey);
            myTickets.startSubscription();
            myOffers.startSubscription();

            // Update UI as soon as profile arrives but start encryption in the meantime
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
                const encryptedSeed = m.data['encryptedSeed'];
                if (encryptedSeed) {
                    localStorage.setItem('nostr-seedwords', encryptedSeed);
                    localStorage.setItem('nostr-npub', user.npub);
                    localStorage.setItem('login-method', "ephemeral");
                    
                    const t: ToastSettings = {
                        message: 'Encrypted Seed saved in local storage!',
                        timeout: 7000,
                        background: 'bg-success-300-600-token',
                    };
                    toastStore.trigger(t);
                    goto('/my-tickets');
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
            // Disable Finish button until we get a result from the encryption process
            disable = true;
            await tick();

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

</script>

<div class="p-4 flex justify-center items-center">
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
                </div>
            </div>


            <div class="flex flex-col gap-y-2 items-center my-6">
                <h2 class="h4 font-bold text-center">Your secret words will be stored locally in encrypted form and unencrypted until your session ends.</h2>
                <h4 class="h4 text-center">Provide a strong passphrase for encryption at rest(min. 14chars):</h4>
                <!-- Todo: autocomplete -->
                <div class="flex justify-between items-center ">
                    <input 
                        class="input {passphraseValid ? 'input-success' : 'input-error'} w-80" 
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

                <div class="flex justify-between items-center m-4">
                    <input 
                        class="input {confirmPassphraseValid ? 'input-success' : 'input-error'} w-80" 
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
                    disabled={!passphraseValid || !confirmPassphraseValid || disable} 
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
