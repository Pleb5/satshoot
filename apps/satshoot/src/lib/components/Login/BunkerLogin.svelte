<script lang="ts">
    import { goto } from '$app/navigation';
    import { redirectAfterLogin } from '$lib/stores/gui';
    import ndk, { bunkerNDK, LoginMethod } from '$lib/stores/session';
    import { loginMethod } from '$lib/stores/user';
    import { initializeUser } from '$lib/utils/helpers';
    import { parseRelaysFromBunkerUrl, parseRemotePubkeyFromBunkerUrl } from '$lib/utils/login';
    import { bunkerPerms } from '$lib/utils/misc';
    import { NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';

    import { tick } from 'svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import { toaster } from '$lib/stores/toaster';

    interface Props {
        isOpen: boolean;
    }

    let { isOpen = $bindable() }: Props = $props();

    let statusMessage = $state('');
    let statusColor = 'text-tertiary-200-700';

    let bunkerUrlString = $state('');
    let attemptingBunkerConnection = $state(false);

    async function connectBunker() {
        if (!bunkerUrlString || !bunkerUrlString.startsWith('bunker://')) {
            // User tried to submit invalid token string
            attemptingBunkerConnection = false;
            toaster.error({
                title: 'Invalid Bunker token! URL must start with "bunker://"',
            });
            return;
        }

        attemptingBunkerConnection = true;
        const localSigner = NDKPrivateKeySigner.generate();
        // Parse relays from connection token and connect bunkerNDK to them
        const relayURLs: string[] | undefined = parseRelaysFromBunkerUrl(bunkerUrlString);
        const remotePubkey: string | undefined = parseRemotePubkeyFromBunkerUrl(bunkerUrlString);

        if (!relayURLs) {
            attemptingBunkerConnection = false;
            toaster.error({
                title: 'Error: No Relay URLs specified in Bunker token!',
            });
            return;
        } else if (!remotePubkey) {
            attemptingBunkerConnection = false;
            toaster.error({
                title: 'Error: No Remote Pubkey specified in Bunker token!',
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

        const bunkerUrl = new URL(bunkerUrlString);
        bunkerUrl.searchParams.set('permissions', bunkerPerms.join(','));

        const remoteSigner = new NDKNip46Signer($bunkerNDK, bunkerUrl.toString(), localSigner);

        remoteSigner.on('authUrl', (url) => {
            window.open(url, 'auth', 'width=600, height=600');
        });

        statusMessage = 'Check your Bunker!';
        await tick();

        try {
            // Connect to remote signer
            const returnedUser = await remoteSigner.blockUntilReady();

            // Since the blockUntilReady could reject with error
            // this check is necessary
            if (returnedUser.npub) {
                $ndk.signer = remoteSigner;
                console.log('user logged in');

                $loginMethod = LoginMethod.Bunker;
                localStorage.setItem('login-method', $loginMethod);
                localStorage.setItem('bunkerUrl', bunkerUrl.toString());
                localStorage.setItem('bunkerLocalSignerPK', localSigner.privateKey as string);
                localStorage.setItem('bunkerRelayURLs', relayURLs.join(','));

                toaster.success({
                    title: 'Bunker Connection Successful!',
                });

                initializeUser($ndk);
                handleRedirection();

                isOpen = false;
            } else {
                toaster.error({
                    title: 'Could not connect to Bunker!',
                });
                isOpen = false;
            }
        } catch (error) {
            toaster.error({
                title: `Could not connect to Bunker!`,
                description: `Reason: ${error}`,
                duration: 60000, // 1 min
            });
            console.error(error);
            isOpen = false;
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
            bind:value={bunkerUrlString}
            placeholder="bunker://..."
            type="url"
            classes="focus:ring-0 border-[0px] border-b-[1px] border-black-100 dark:border-white-100 bg-transparent"
            grow
            noBorder
            notRounded
        />
        <Button grow onClick={connectBunker} disabled={attemptingBunkerConnection}>
            {#if attemptingBunkerConnection}
                <ProgressRing color="primary" />
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
