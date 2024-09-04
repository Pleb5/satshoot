<script lang="ts">
    import ndk, { LoginMethod } from "$lib/stores/ndk";

    import redirectStore from "$lib/stores/network";
    import { NDKPrivateKeySigner, NDKRelay } from "@nostr-dev-kit/ndk";
    import { sessionPK } from "$lib/stores/ndk";
    import { privateKeyFromSeedWords, generateSeedWords } from "nostr-tools/nip06"
    import { hexToBytes } from "@noble/hashes/utils";
    import { nsecEncode } from "nostr-tools/nip19"

    import { clipboard } from '@skeletonlabs/skeleton';
    import { onMount, tick } from "svelte";
    import { goto } from "$app/navigation";

    import { ProgressRadial } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { initializeUser } from "$lib/utils/helpers";

    import { loginMethod } from "$lib/stores/user";

    const toastStore = getToastStore();

    let seedWords = '';
    let seedWordList: string[] = [];
    let nsec: string = '';
    let npub: string = '';

    onMount(async () => {
        // Generate new local private key
        seedWords = generateSeedWords();
        const privateKey = privateKeyFromSeedWords(seedWords); 
        // Store private key in session storage 
        $sessionPK = `${privateKey}`;

        $ndk.signer = new NDKPrivateKeySigner(privateKey);

        seedWordList = seedWords.split(' ');
        nsec = nsecEncode(hexToBytes(privateKey));
        const user = await $ndk.signer.user();
        npub = user.npub;
        user.profile = {
            created_at : Math.floor(Date.now() / 1000),
        };

        const blastrUrl = 'wss://nostr.mutinywallet.com';
        $ndk.pool.useTemporaryRelay(new NDKRelay(blastrUrl, undefined, $ndk));
        user.publish();

        initializeUser($ndk);
    });

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
    let statusColor = 'text-tertiary-200-700-token';

    let encrypting = false;

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
        if (seedWords && npub) {
            // encrypt seed 
            const cryptWorker = new Worker(new URL("$lib/utils/crypto.worker.ts", import.meta.url),{
                type: 'module'
            });

            cryptWorker.onmessage = (m) => {
                const encryptedSeed = m.data['encryptedSecret'];
                if (encryptedSeed && npub) {
                    // Save encrypted seed words in browser localStorage
                    localStorage.setItem('nostr-seedwords', encryptedSeed);
                    localStorage.setItem('nostr-npub', npub);
                    $loginMethod = LoginMethod.Ephemeral;
                    localStorage.setItem('login-method', $loginMethod);

                    const t: ToastSettings = {
                        message: '<strong>Nostr Keypair Created!</strong>',
                        timeout: 7000,
                        background: 'bg-success-300-600-token',
                    };
                    toastStore.trigger(t);
                    
                    if ($redirectStore) {
                        goto($redirectStore);
                        $redirectStore = '';
                    } else {
                        goto('/' + npub);
                    }
                } else {
                    statusMessage = 'Unexpected response from encryption process:' + m.data;
                    setTimeout(()=>{
                        statusColor = 'text-red-500';
                    }, 800);            
                }
            };

            cryptWorker.onerror = (e) => {
                statusMessage = `Error while encrypting seed words!`;
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

            encrypting = true;

            await tick();

            // Start worker in background and wait for decryption result in onmessage
            cryptWorker.postMessage({
                secret: seedWords,
                passphrase: passphrase,
                salt: npub
            });
        }

    }

    function finish() {
        // Todo: Loading popup while encrypting
        encryptAndSaveSeed();
    }

</script>
<div class="p-4">
    <h2 class="h2 mb-4 text-center">Backup your Account</h2>
    {#if seedWordList.length > 0 && npub && nsec}
        <h4 class="h4 text-center mb-4">Put these words in a safe place to be able to access your account later:</h4>
        <div class="flex flex-col justify-center items-center gap-y-4 mb-8">
                <div class="card p-4 border-2 border-red-500 ">
                    <div class="grid grid-cols-2 gap-x-6 gap-y-2">
                        {#each seedWordList as word, i}
                            <strong class="max-w-sm">{i+1}{'. ' + word}</strong>
                        {/each}
                    </div>
            </div>
            <button 
                class="btn btn-md w-40 bg-red-500 font-bold "
                use:clipboard={seedWords}
                on:click={onCopySeed}
            >
                {copied ? 'Copied!' : 'Dangerously Copy'}
            </button>
        </div>
        <div class="flex flex-col items-center gap-y-2 mb-8">
            <div class="card p-4 border-2 border-red-500 col-span-2">
                <strong class="">{nsec.substring(0,25) + '...'}</strong>
            </div>
            <button 
                class="btn text-sm btn-sm self-center justify-self-start bg-red-500 font-bold"
                use:clipboard={nsec}
                on:click={onCopyNsec}
            >
                {copiedNsec ? 'Copied!' : 'Dangerously Copy'}
            </button>
        </div>

        <div class="flex flex-col items-center gap-y-2 mb-8">
            <div class="card p-4 border-2 border-red-500">
                <strong class="">{npub.substring(0,25) + '...'}</strong>
            </div>
            <button 
                class="btn btn-sm md:btn-md self-center justify-self-start bg-red-500 font-bold"
                use:clipboard={npub}
                on:click={onCopyNpub}
            >
                {copiedNpub ? 'Copied!' : 'Copy'}
            </button>
        </div>

        <div class="flex flex-col items-center mb-4">
            <h2 class="h4">Your secret words will be stored locally in encrypted form!</h2>
            <h4 class="h4 ">Provide a strong passphrase for encryption at rest(min. 14chars):</h4>
        </div>

        <div class="flex flex-col gap-y-4 justify-center items-center mb-8">
            <div class="flex justify-between max-w-80">
                <input 
                    class="input {passphraseValid ? 'input-success' : 'input-error'}" 
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
            <div class="flex justify-between items-center max-w-80">
                <input 
                    class="input {confirmPassphraseValid ? 'input-success' : 'input-error'}" 
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
        </div>

        <div class="flex justify-center">
            <button 
                class="btn font-bold bg-success-400-500-token w-60" 
                disabled={!passphraseValid || !confirmPassphraseValid || encrypting} 
                on:click={finish}
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
        {#if statusMessage}
            <h5 class="h5 font-bold text-center {statusColor} mt-2" >{statusMessage}</h5>
        {/if}
    {:else}
        <p>Error! Seed words, nsec or npub missing!</p>
    {/if}
</div>
