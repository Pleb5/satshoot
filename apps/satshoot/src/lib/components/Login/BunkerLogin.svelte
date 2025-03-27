<script lang="ts">
    import { goto } from '$app/navigation';
    import { redirectAfterLogin } from '$lib/stores/gui';
    import ndk, { bunkerNDK, LoginMethod } from '$lib/stores/ndk';
    import { loginMethod } from '$lib/stores/user';
    import { initializeUser } from '$lib/utils/helpers';
    import {
        parseRelaysFromBunkerUrl,
        parseRemotePubkeyFromBunkerUrl,
        parseSecretFromBunkerUrl,
    } from '$lib/utils/login';
    import { bunkerPerms } from '$lib/utils/misc';
    import { NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
    import { getModalStore, getToastStore, ProgressRadial } from '@skeletonlabs/skeleton';
    import { nip19 } from 'nostr-tools';
    import { tick } from 'svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    let statusMessage = $state('');
    let statusColor = 'text-tertiary-200-700-token';

    let bunkerUrl = $state('');
    let attemptingBunkerConnection = $state(false);

    async function connectBunker() {
        if (!bunkerUrl || !bunkerUrl.startsWith('bunker://')) {
            // User tried to submit invalid token string
            attemptingBunkerConnection = false;
            toastStore.trigger({
                message: 'Invalid Bunker token! URL must start with "bunker://"',
                background: 'bg-error-300-600-token',
                timeout: 5000,
            });
            return;
        }

        attemptingBunkerConnection = true;
        const localSigner = NDKPrivateKeySigner.generate();
        // Parse relays from connection token and connect bunkerNDK to them
        const relayURLs: string[] | undefined = parseRelaysFromBunkerUrl(bunkerUrl);
        const remotePubkey: string | undefined = parseRemotePubkeyFromBunkerUrl(bunkerUrl);
        const secret: string | undefined = parseSecretFromBunkerUrl(bunkerUrl);
        console.log('remotePubkey', remotePubkey);
        console.log('secret', secret);
        if (!relayURLs) {
            attemptingBunkerConnection = false;
            toastStore.trigger({
                message: 'Error: No Relay URLs specified in Bunker token!',
                background: 'bg-error-300-600-token',
                timeout: 5000,
            });
            return;
        } else if (!remotePubkey) {
            attemptingBunkerConnection = false;
            toastStore.trigger({
                message: 'Error: No Remote Pubkey specified in Bunker token!',
                background: 'bg-error-300-600-token',
                timeout: 5000,
            });
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
        let connectionParams = remoteUserNpub + '#';

        if (secret) {
            // NDK parses 'remoteUserOrToken' using a '#' as a separator
            // 'Token is mistakenly called like this though.
            // It is the SECRET according to nip46 spec'
            connectionParams += secret;
        }

        // The connectionParams eventually is split into 3 parts:
        // [<target user npub>, <secret || ''>, <default perms>]
        connectionParams += '#' + bunkerPerms.join(',');

        const remoteSigner = new NDKNip46Signer($bunkerNDK, connectionParams, localSigner);

        // remoteSigner.on('authUrl', (url) => {
        //     window.open(url, "auth", "width=600, height=600");
        // });

        statusMessage = 'Check your Bunker!';
        await tick();

        try {
            // Connect to remote signer
            console.log('remoteSigner', remoteSigner);
            const returnedUser = await remoteSigner.blockUntilReady();

            // Since the blockUntilReady could reject with error
            // this check is necessary
            if (returnedUser.npub) {
                $ndk.signer = remoteSigner;
                console.log('user logged in');

                $loginMethod = LoginMethod.Bunker;
                localStorage.setItem('login-method', $loginMethod);
                localStorage.setItem('bunkerLocalSignerPK', localSigner.privateKey as string);
                localStorage.setItem('bunkerTargetNpub', remoteUserNpub);
                localStorage.setItem('bunkerRelayURLs', relayURLs.join(','));

                toastStore.trigger({
                    message: 'Bunker Connection Successful!',
                    timeout: 7000,
                    background: 'bg-success-300-600-token',
                });

                initializeUser($ndk, toastStore);
                handleRedirection();

                modalStore.close();
            } else {
                toastStore.trigger({
                    message: 'Could not connect to Bunker!',
                    timeout: 7000,
                    background: 'bg-error-300-600-token',
                });
                modalStore.close();
            }
        } catch (error) {
            toastStore.trigger({
                message: `
                        <p>Could not connect to Bunker!</p>
                        <p>
                        <span> Reason: </span>
                        <span> ${error} </span>
                        </p>
                    `,
                autohide: false,
                background: 'bg-error-300-600-token',
                classes: 'font-bold',
            });
            console.error(error);
            modalStore.close();
        }
    }

    function handleRedirection() {
        // redirect to jobs page
        if ($redirectAfterLogin) {
            goto('/jobs');
        } else {
            $redirectAfterLogin = true;
        }
    }

    const labelClasses =
        'px-[10px] py-[5px] rounded-t-[6px] overflow-hidden border-[1px] border-black-200 dark:border-white-200 border-b-[0px] text-[14px]';

    const btnWrapperClasses =
        'w-full flex flex-col gap-[5px] bg-black-50 dark:bg-white-50 border-[1px] border-black-100 dark:border-white-100 rounded-tr-[6px] rounded-b-[6px] p-[5px] overflow-hidden';
</script>

{#if statusMessage}
    <h5 class="h5 font-bold text-center mt-4 {statusColor}">
        {statusMessage}
    </h5>
{/if}

<div
    class="rounded-[6px] bg-black-50 dark:bg-white-50 border-[2px] border-black-100 dark:border-white-100"
>
    <p class="w-full px-[10px] py-[5px]">
        A central place where apps go to ask for data to be signed via nostr relays. Considered to
        be the most secure but connection to the Bunker can be unreliable.
    </p>
</div>

<div class="w-full flex flex-col">
    <div class="w-full flex flex-row items-center gap-[5px]">
        <p class={labelClasses}>Bunker</p>
    </div>
    <div class={btnWrapperClasses}>
        <Input
            bind:value={bunkerUrl}
            placeholder="bunker://..."
            type="url"
            classes="focus:ring-0 border-[0px] border-b-[1px] border-black-100 dark:border-white-100 bg-transparent"
            grow
            noBorder
            notRounded
        />
        <Button grow on:click={connectBunker} disabled={attemptingBunkerConnection}>
            {#if attemptingBunkerConnection}
                <ProgressRadial
                    value={undefined}
                    stroke={60}
                    meter="stroke-primary-500"
                    track="stroke-primary-500/30"
                    strokeLinecap="round"
                    width="w-8"
                />
            {:else}
                <i class="bx bx-log-in-circle"></i>
                Connect
            {/if}
        </Button>
    </div>
</div>

<Button variant="outlined" href="https://nostrapps.com/#signers" target="_blank" grow>
    Browse Signer Apps
</Button>
