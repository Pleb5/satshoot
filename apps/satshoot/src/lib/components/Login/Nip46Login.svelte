<script lang="ts">
    import { goto } from '$app/navigation';
    import { redirectAfterLogin } from '$lib/stores/gui';
    import ndk, { nut13SeedStorage, bunkerNDK, LoginMethod, NOSTRCONNECTRELAYURLS } from '$lib/stores/session';
    import { loginMethod, UserMode, userMode } from '$lib/stores/user';
    import { initializeUser } from '$lib/utils/helpers';
    import { parseRelaysFromBunkerUrl, parseRemotePubkeyFromBunkerUrl } from '$lib/utils/login';
    import { nip46SignerPerms } from '$lib/utils/misc';
    import NDK, { NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';

    import { tick } from 'svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import { toaster } from '$lib/stores/toaster';
    import QRCode from 'qrcode';
    import CopyButton from '../UI/Buttons/CopyButton.svelte';

    interface Props {
        isOpen: boolean;
    }

    let { isOpen = $bindable() }: Props = $props();

    let statusMessage = $state('');
    let statusColor = $state('text-tertiary-200-700');

    let bunkerUrlString = $state('');
    let attemptingBunkerConnection = $state(false);
    let nostrConnectUri = $state('');
    let qrCanvas = $state<HTMLCanvasElement>();

    // NostrConnect signer instance
    let nostrConnectSigner: NDKNip46Signer | null = null;

    // Auto-initialize NostrConnect when component opens
    $effect(() => {
        if (isOpen && !nostrConnectSigner) {
            initializeNostrConnect();
        }
    });

    // Generate QR code when URI is available
    $effect(() => {
        if (qrCanvas && nostrConnectUri) {
            QRCode.toCanvas(qrCanvas, nostrConnectUri, {
                width: 300, // Increased size for better scanning
                margin: 4, // Increased margin for better scanning
                errorCorrectionLevel: 'M', // Medium error correction for better reliability
                color: {
                    dark: '#000000',
                    light: '#ffffff',
                },
            }).catch((error) => {
                console.error('Failed to generate QR code with optimal params:', error);

                // Fallback with even more conservative parameters
                QRCode.toCanvas(qrCanvas, nostrConnectUri, {
                    width: 400, // Even larger for maximum compatibility
                    margin: 8, // Larger margin
                    errorCorrectionLevel: 'H', // High error correction
                    color: {
                        dark: '#000000',
                        light: '#ffffff',
                    },
                }).catch((fallbackError) => {
                    console.error(
                        'Failed to generate QR code with fallback params:',
                        fallbackError
                    );
                });
            });
        }
    });

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
            $bunkerNDK.addExplicitRelay(url, undefined, true);
        });
        await $bunkerNDK.connect();

        console.log('remote signer bunker connected!', $bunkerNDK.pool.connectedRelays());

        const bunkerUrl = new URL(bunkerUrlString);
        bunkerUrl.searchParams.set('permissions', nip46SignerPerms.join(','));

        const remoteSigner = NDKNip46Signer.bunker($bunkerNDK, bunkerUrl.toString(), localSigner);

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
            if (returnedUser?.npub) {
                $ndk.signer = remoteSigner;
                console.log('user logged in');

                loginMethod.set(LoginMethod.Nip46);

                // Store connection info for persistence using NDK's built-in serialization
                localStorage.setItem('nip46SignerPayload', remoteSigner.toPayload());

                toaster.success({
                    title: 'Bunker Connection Successful!',
                });

                initializeUser($ndk, $nut13SeedStorage);
                handleRedirection();

                isOpen = false;
            } else {
                throw new Error('No user returned from bunker connection');
            }
        } catch (error) {
            console.error('Bunker connection error:', error);

            // Provide more specific error messages
            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }

            toaster.error({
                title: 'Could not connect to Bunker!',
                description: `Reason: ${errorMessage}`,
                duration: 60000, // 1 min
            });

            // Reset state on error
            statusMessage = '';
            statusColor = 'text-tertiary-200-700';
        } finally {
            attemptingBunkerConnection = false;
        }
    }

    async function initializeNostrConnect() {
        try {
            statusMessage = 'Initializing connection...';
            statusColor = 'text-blue-600 dark:text-blue-400';
            await tick();

            const ndkInstance = new NDK({
                explicitRelayUrls: NOSTRCONNECTRELAYURLS,
            });
            await ndkInstance.connect();

            // Create NostrConnect signer using the latest NDK API
            nostrConnectSigner = NDKNip46Signer.nostrconnect(
                ndkInstance,
                NOSTRCONNECTRELAYURLS[0], // Use first relay
                undefined, // Generate new local signer
                {
                    name: 'SatShoot',
                    url: window.location.origin,
                    perms: nip46SignerPerms.join(','),
                    image: 'https://satshoot.com/img/satshoot.svg',
                }
            );

            // Get the NostrConnect URI for QR code display
            nostrConnectUri = nostrConnectSigner.nostrConnectUri || '';

            if (!nostrConnectUri) {
                throw new Error('Failed to generate connection URI');
            }

            // Wait for connection
            await waitForNostrConnect();
        } catch (error) {
            console.error('NostrConnect initialization failed:', error);

            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }

            toaster.error({
                title: 'Failed to initialize NostrConnect',
                description: errorMessage,
            });
            statusMessage = 'Failed to initialize connection';
            statusColor = 'text-red-600 dark:text-red-400';
        }
    }

    async function waitForNostrConnect() {
        if (!nostrConnectSigner) return;

        try {
            statusMessage = 'Waiting for connection...';
            statusColor = 'text-yellow-600 dark:text-yellow-400';
            await tick();

            // Use the new NDK method to wait for NostrConnect connection
            const user = await nostrConnectSigner.blockUntilReadyNostrConnect();

            if (user && nostrConnectSigner.bunkerPubkey) {
                statusMessage = 'Connection successful!';
                statusColor = 'text-green-600 dark:text-green-400';

                $ndk.signer = nostrConnectSigner;
                console.log('NostrConnect user logged in');

                loginMethod.set(LoginMethod.Nip46);

                // Store connection info for persistence using NDK's built-in serialization
                localStorage.setItem('nip46SignerPayload', nostrConnectSigner.toPayload());

                toaster.success({
                    title: 'NostrConnect connection successful!',
                });

                initializeUser($ndk, $nut13SeedStorage);
                handleRedirection();

                isOpen = false;
            } else {
                throw new Error('Invalid user or missing bunker pubkey');
            }
        } catch (error) {
            console.error('NostrConnect connection failed:', error);

            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }

            toaster.error({
                title: 'NostrConnect connection failed',
                description: errorMessage,
                duration: 60000,
            });
            statusMessage = 'Connection failed';
            statusColor = 'text-red-600 dark:text-red-400';
        }
    }

    function copyToClipboard() {
        if (nostrConnectUri) {
            navigator.clipboard
                .writeText(nostrConnectUri)
                .then(() => {
                    toaster.success({
                        title: 'Connection string copied to clipboard!',
                    });
                })
                .catch(() => {
                    toaster.error({
                        title: 'Failed to copy to clipboard',
                    });
                });
        }
    }

    function handleRedirection() {
        if ($redirectAfterLogin) {
            if ($userMode === UserMode.Client) {
                goto('/services');
            } else {
                goto('/jobs');
            }
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
    <h5 class="h5 font-bold text-center mt-4 mb-6 {statusColor}">
        {statusMessage}
    </h5>
{/if}

<div
    class="rounded-[6px] bg-black-50 dark:bg-white-50 border-[2px] border-black-100 dark:border-white-100 mb-6"
>
    <p class="w-full px-[10px] py-[5px]">
        A central place where apps go to ask for data to be signed via nostr relays. Considered to
        be the most secure but connection to the Remote Signer can be unreliable.
    </p>
</div>

<!-- NostrConnect Login Section -->
<div class="w-full flex flex-col items-center justify-center gap-[16px]">
    <div class="text-center">
        <h3 class="text-lg font-semibold mb-2">Connect with Remote Signer</h3>
        <p class="text-sm text-gray-600 dark:text-gray-400">
            Scan the QR code or copy the connection string to your remote signer app
        </p>
    </div>

    <!-- QR Code Container -->
    <div class="relative">
        <div
            class="bg-white p-4 rounded-xl border-2 border-black-100 dark:border-white-100 shadow-sm"
        >
            {#if nostrConnectUri}
                <canvas
                    bind:this={qrCanvas}
                    width="300"
                    height="300"
                    class="block rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                    onclick={copyToClipboard}
                    role="button"
                    tabindex="0"
                    onkeydown={(e) =>
                        e.key === 'Enter' || e.key === ' ' ? copyToClipboard() : null}
                    title="Click to copy connection string"
                ></canvas>
                <!-- Click indicator -->
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div
                        class="bg-black/10 dark:bg-white/10 rounded-full p-2 opacity-0 hover:opacity-100 transition-opacity"
                    >
                        <i class="bx bxs-copy text-white text-xl"></i>
                    </div>
                </div>
            {:else}
                <!-- Loading state -->
                <div
                    class="w-[300px] h-[300px] flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg"
                >
                    <div class="flex flex-col items-center gap-2">
                        <ProgressRing color="primary" />
                        <span class="text-sm text-gray-500">Generating QR code...</span>
                    </div>
                </div>
            {/if}
        </div>
    </div>

    <!-- Connection String Display -->
    {#if nostrConnectUri}
        <div class="w-full max-w-md">
            <div
                class="bg-black-50 dark:bg-white-50 border border-black-100 dark:border-white-100 rounded-lg p-3"
            >
                <div class="flex items-center justify-between gap-2 mb-2">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Connection String
                    </span>
                    <CopyButton
                        text={nostrConnectUri}
                        feedbackMessage="Connection string copied!"
                        classes="!py-1 !px-2 !text-xs"
                    />
                </div>
                <div
                    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 overflow-x-auto"
                >
                    <code
                        class="text-xs text-gray-600 dark:text-gray-400 font-mono whitespace-nowrap"
                    >
                        {nostrConnectUri}
                    </code>
                </div>
            </div>
        </div>
    {/if}
</div>

<!-- Divider -->
<div class="w-full my-8">
    <div class="relative">
        <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-300 dark:border-gray-600"></div>
        </div>
        <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-white dark:bg-gray-900 text-gray-500">or</span>
        </div>
    </div>
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

<div class="mt-6">
    <Button variant="outlined" href="https://nostrapps.com/#signers" target="_blank" grow>
        <i class="bx bx-link-external mr-2"></i>
        Browse Signer Apps
    </Button>
</div>
