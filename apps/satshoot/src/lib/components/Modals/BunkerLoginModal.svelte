<script lang="ts">
	import { tick, type SvelteComponent } from 'svelte';
    import ndk from '$lib/stores/ndk';
    import { initializeUser } from '$lib/utils/helpers';
    import { bunkerNDK } from '$lib/stores/ndk';
    import { NDKPrivateKeySigner, NDKNip46Signer } from '@nostr-dev-kit/ndk';
    import { bunkerPerms } from '$lib/utils/misc';

    import {nip19} from 'nostr-tools';
    
	import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ToastSettings } from '@skeletonlabs/skeleton';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { ProgressRadial } from '@skeletonlabs/skeleton';

	// Props
	/** Exposes parent props to this component. */
	export let parent: SvelteComponent;

	const modalStore = getModalStore();
    const toastStore = getToastStore();

    let statusMessage = '';

    let attemptingConnection: boolean = false;
    let token: string = "";

    function parseRelaysFromBunkerToken(token: string): string[] | undefined {
        let relayURLs: string[] = [];

        const params = token.split('?')[1]?.split('&');
        if (!params || params.length === 0) {
            return undefined
        }
        params.forEach((param: string) => {
            const paramValue  = param.split('=')[1]
            if(paramValue?.startsWith('wss://')) {
                relayURLs.push(paramValue);
            }
        });

        if(relayURLs.length === 0) return undefined;

        for (let i = 0; i < relayURLs.length; i++) {
            if(!relayURLs[i].endsWith('/')) {
                relayURLs[i] += '/';
            }
        }

        console.log(relayURLs)
        return relayURLs;
    }

    function parseSecretFromBunkerToken(token: string): string | undefined {
        const params = token.split('?')[1]?.split('&');
        if (!params || params.length === 0) {
            return undefined
        }
        
        let secret: string | undefined = undefined;
        params.forEach((param: string) => {
            const paramName = param.split('=')[0];
            if(paramName === 'secret') secret = param.split('=')[1];
        });

        return secret;
    }

    function parseRemotePubkeyFromBunkerToken(token: string): string | undefined {
        return token.split('?')[0].replace('bunker://', '');
    }

    async function connectBunker() {
        if (token && token.includes('bunker://')) {
            attemptingConnection = true;
            const localSigner = NDKPrivateKeySigner.generate();
            // Parse relays from connection token and connect bunkerNDK to them
            const relayURLs: string[] | undefined = parseRelaysFromBunkerToken(token);
            const remotePubkey: string | undefined = parseRemotePubkeyFromBunkerToken(token);
            const secret: string | undefined = parseSecretFromBunkerToken(token);
            console.log('remotePubkey', remotePubkey)
            console.log('secret', secret)
            if(!relayURLs) {
                attemptingConnection = false;
                statusMessage = 'Error: No Relay URLs specified in Bunker token!';
                return;
            } else if(!remotePubkey) {
                attemptingConnection = false;
                statusMessage = 'Error: No Remote Pubkey specified in Bunker token!';
                return;
            }
            
            // Add parsed relays and connect to remote signer
            relayURLs.forEach((url: string) => {
                // ONLY WORKS WITH EXPLICIT RELAYS, NOT WITH SIMPLE POOL.ADDRELAY() CALL
                $bunkerNDK.addExplicitRelay(url);
            });
            await $bunkerNDK.connect();
            
            console.log('remote signer bunker connected!', $bunkerNDK.pool.connectedRelays());

            // Here we transform pubkey to npub for NDK to transform it back to pubkey...
            // NDK should actually handle pubkeys directly 
            // bc the token strings contain just that
            const remoteUserNpub = nip19.npubEncode(remotePubkey);
            let connectionParams = remoteUserNpub;

            if (secret) {
                // NDK parses 'remoteUserOrToken' using a '#' as a separator
                // 'Token is mistakenly called like this though.
                // It is the SECRET according to nip46 spec'
                connectionParams += '#' + secret;
            }

            connectionParams += '#' + bunkerPerms.join(',');

            const remoteSigner = new NDKNip46Signer(
                $bunkerNDK,
                connectionParams,
                localSigner
            );

            // remoteSigner.on('authUrl', (url) => { 
            //     window.open(url, "auth", "width=600, height=600"); 
            // });
            
            statusMessage = "Check your Bunker!";
            await tick();

            try {
                // Connect to remote signer
                console.log('remoteSigner', remoteSigner)
                const returnedUser = await remoteSigner.blockUntilReady();

                // Since the blockUntilReady could reject with error
                // this check is necessary
                if (returnedUser.npub) {
                    $ndk.signer = remoteSigner;
                    console.log('user logged in')

                    localStorage.setItem('login-method', 'bunker');
                    localStorage.setItem("bunkerLocalSignerPK", localSigner.privateKey as string);
                    localStorage.setItem("bunkerTargetNpub", remoteUserNpub);
                    localStorage.setItem("bunkerRelayURLs", relayURLs.join(','));

                    const t: ToastSettings = {
                        message: 'Bunker Connection Successful!',
                        timeout: 7000,
                        background: 'bg-success-300-600-token',
                    };
                    toastStore.trigger(t);

                    initializeUser($ndk);

                    modalStore.close();
                } else {
                    const t: ToastSettings = {
                        message: 'Could not connect to Bunker!',
                        timeout: 7000,
                        background: 'bg-error-300-600-token',
                    };
                    toastStore.trigger(t);
                    modalStore.close();
                }
            } catch (error) {
                const t: ToastSettings = {
                    message:`
                        <p>Could not connect to Bunker!</p>
                        <p>
                        <span> Reason: </span>
                        <span> ${error} </span>
                        </p>
                    `,
                    autohide: false,
                    background: 'bg-error-300-600-token',
                    classes: 'font-bold',
                };
                toastStore.trigger(t);
                console.error(error);
                modalStore.close();
            }
        } else {
            // User tried to submit invalid token string
            attemptingConnection = false;
            statusMessage = 'Invalid Bunker token! URL must start with "bunker://"';
        }
    }

</script>

{#if $modalStore[0]}
	<div class="card p-8 grid grid-cols-1 justify-center bg-surface-400-500-token">
        <h3 class="h3 text-center font-bold">Connect Nsec Bunker</h3>
        <h4 class="h4 mt-2">
            Enter your Bunker connection token:
        </h4>
        <form 
            on:submit|preventDefault={ connectBunker }>
            <div class="flex justify-between items-center m-4">
                    <input 
                        class="input" 
                        title="Bunker Token:" 
                        required
                        bind:value={token}
                        type='text'
                        placeholder="bunker://..."
                    />
            </div>
            <div class="flex justify-between h-10">
                <button 
                    type="button"
                    class="btn btn-sm sm:btn-md bg-error-300-600-token"
                    on:click={()=> modalStore.close()}
                >
                    Cancel
                </button>
                <button 
                    type="submit"
                    class="btn btn-lg font-bold bg-success-400-500-token"
                    disabled={!token || attemptingConnection}
                >
                    {#if attemptingConnection}
                        <span>
                            <ProgressRadial value={undefined} stroke={60} meter="stroke-primary-500"
                                track="stroke-primary-500/30" strokeLinecap="round" width="w-8" />
                        </span>
                    {:else}
                        <span>Connect</span>
                    {/if}
                </button>
            </div>
        </form>
        {#if statusMessage}
           <h4 class="h4 mt-4 text-error-500 text-center font-bold">{statusMessage}</h4> 
        {/if}
    </div>
{/if}
