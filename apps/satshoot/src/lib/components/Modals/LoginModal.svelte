<script lang="ts">
    import { browser } from '$app/environment';
    import ndk, { bunkerNDK, sessionPK, LoginMethod } from '$lib/stores/ndk';
    import { loginMethod } from '$lib/stores/user';
    import { broadcastUserProfile, initializeUser } from '$lib/utils/helpers';
    import {
        parseRelaysFromBunkerUrl,
        parseRemotePubkeyFromBunkerUrl,
        parseSecretFromBunkerUrl,
    } from '$lib/utils/login';
    import { bunkerPerms } from '$lib/utils/misc';
    import {
        NDKNip07Signer,
        NDKNip46Signer,
        NDKPrivateKeySigner,
        NDKUser,
    } from '@nostr-dev-kit/ndk';
    import {
        clipboard,
        getModalStore,
        getToastStore,
        popup,
        ProgressRadial,
        type ModalSettings,
        type PopupSettings,
        type ToastSettings,
    } from '@skeletonlabs/skeleton';
    import { nip19 } from 'nostr-tools';
    import { generateSeedWords, privateKeyFromSeedWords, validateWords } from 'nostr-tools/nip06';
    import { tick } from 'svelte';
    import Passphrase from '../Passphrase.svelte';
    import SeedWords from '../SeedWords.svelte';
    import { nsecEncode } from 'nostr-tools/nip19';
    import { hexToBytes } from '@noble/hashes/utils';
    import { encryptSecret } from '$lib/utils/crypto';
    import { privateKeyFromNsec } from '$lib/utils/nip19';
    import Card from '../UI/Card.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import Popup from '../UI/Popup.svelte';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    // For tooltip
    const bunkerTooltip: PopupSettings = {
        event: 'click',
        target: 'bunkerTooltip',
        placement: 'top',
    };

    const extensionTooltip: PopupSettings = {
        event: 'click',
        target: 'extensionTooltip',
        placement: 'top',
    };

    const localKeyTooltip: PopupSettings = {
        event: 'click',
        target: 'localKeyTooltip',
        placement: 'top',
    };

    let aboutSectionExpanded = false;

    let statusMessage = '';
    let statusColor = 'text-tertiary-200-700-token';

    let bunkerUrl = '';
    let attemptingBunkerConnection = false;

    let askingForNip07Permission = false;

    let displayLocalKeyLogin = false;
    let nsecForLocalKey = '';
    let seedWordsForLocalKey = Array(12).fill('');
    let passphraseForNsec = '';
    let confirmPassphraseForNsec = '';
    let passphraseForSeedWords = '';
    let confirmPassphraseForSeedWords = '';

    let displayGeneratedAccount = false;
    let generatedSeedWords: string[] | undefined;
    let generatedNsec = '';
    let generatedNpub = '';
    let passphraseForGeneratedAccount = '';
    let confirmPassphraseForGeneratedAccount = '';
    let copiedNpub = false;
    let copiedNsec = false;

    function toggleLocalKey() {
        displayLocalKeyLogin = !displayLocalKeyLogin;
    }

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
            };
            toastStore.trigger(t);
            console.error(error);
            modalStore.close();
        }
    }

    async function nip07Login() {
        if (browser && window.nostr) {
            const nip07Signer = new NDKNip07Signer();

            try {
                await tick();

                askingForNip07Permission = true;

                const returnedUser = await nip07Signer.blockUntilReady();

                if (returnedUser.npub) {
                    $loginMethod = LoginMethod.Nip07;
                    $ndk.signer = nip07Signer;
                    localStorage.setItem('login-method', $loginMethod);
                    initializeUser($ndk);
                    askingForNip07Permission = false;
                    modalStore.close();
                }
            } catch (e) {
                askingForNip07Permission = false;
                const t: ToastSettings = {
                    message: 'Browser extension rejected access!',
                    autohide: false,
                    background: 'bg-error-300-600-token',
                };
                toastStore.trigger(t);
            }
        } else if (!window.nostr) {
            const modal: ModalSettings = {
                type: 'alert',
                title: 'No Compatible Extension!',
                body: 'No nip07-compatible browser extension found! See Alby, nos2x or similar!',
                buttonTextCancel: 'Cancel',
            };
            modalStore.trigger(modal);
        }
    }

    async function loginWithNsec() {
        if (passphraseForNsec.length < 14) {
            toastStore.trigger({
                message: 'Passphrase should be at least 14 characters long',
                background: 'bg-error-300-600-token',
                timeout: 5000,
            });

            return;
        }

        if (confirmPassphraseForNsec !== passphraseForNsec) {
            toastStore.trigger({
                message: 'Confirm passphrase does not match passphrase',
                background: 'bg-error-300-600-token',
                timeout: 5000,
            });

            return;
        }

        await loginWithSecret(
            nsecForLocalKey,
            passphraseForNsec,
            'nostr-nsec',
            'Could not create Private Key! Probably incorrect nsec!'
        );
    }

    async function loginWithSeedWords() {
        if (passphraseForSeedWords.length < 14) {
            toastStore.trigger({
                message: 'Passphrase should be at least 14 characters long',
                background: 'bg-error-300-600-token',
                timeout: 5000,
            });

            return;
        }

        if (confirmPassphraseForSeedWords !== passphraseForSeedWords) {
            toastStore.trigger({
                message: 'Confirm passphrase does not match passphrase',
                background: 'bg-error-300-600-token',
                timeout: 5000,
            });

            return;
        }

        if (!validateSeedWordInputs(seedWordsForLocalKey)) {
            toastStore.trigger({
                message: 'Invalid seed words input!',
                background: 'bg-error-300-600-token',
                timeout: 5000,
            });
            return;
        }

        await loginWithSecret(
            seedWordsForLocalKey.join(' '),
            passphraseForSeedWords,
            'nostr-seedwords',
            'Could not create Private Key! Probably incorrect Seed Words!'
        );
    }

    async function loginWithSecret(
        secret: string,
        passphrase: string,
        storageKey: string,
        failureMessage: string
    ) {
        statusMessage = 'Encrypting and saving Secret in browser storage...';
        statusColor = 'text-tertiary-200-700-token';

        try {
            const privateKey =
                storageKey === 'nostr-nsec'
                    ? privateKeyFromNsec(secret)
                    : privateKeyFromSeedWords(secret);

            if (!privateKey) {
                throw new Error('Creating Private Key from input failed!');
            }

            const signer = new NDKPrivateKeySigner(privateKey);
            const user = await signer.user();
            const npub = user.npub;

            // Encrypt secret for local storage
            const encryptedSecret = encryptSecret(secret, passphrase, npub);
            localStorage.setItem(storageKey, encryptedSecret);
            localStorage.setItem('nostr-npub', npub);
            $loginMethod = LoginMethod.Local;
            localStorage.setItem('login-method', $loginMethod);

            $sessionPK = privateKey;

            // Set NDK signer
            $ndk.signer = signer;

            // Initialize user
            initializeUser($ndk);

            // Display success toast
            const toastSettings: ToastSettings = {
                message: 'Encrypted Secret saved in local storage!',
                timeout: 7000,
                background: 'bg-success-300-600-token',
            };
            toastStore.trigger(toastSettings);

            // Close login modal
            modalStore.close();
        } catch (e) {
            toastStore.trigger({
                message: `${failureMessage} ${e}`,
                background: 'bg-error-300-600-token',
                timeout: 5000,
            });
        }
    }

    $: if (displayGeneratedAccount) {
        (async () => {
            const seedWords = generateSeedWords();

            generatedSeedWords = seedWords.split(' ');
            const privateKey = privateKeyFromSeedWords(seedWords);

            generatedNsec = nsecEncode(hexToBytes(privateKey));

            const signer = new NDKPrivateKeySigner(generatedNsec);
            const user = await signer.user();
            generatedNpub = user.npub;
        })();
    }

    async function finalizeAccountGeneration() {
        if (passphraseForGeneratedAccount.length < 14) {
            toastStore.trigger({
                message: 'Passphrase should be at least 14 characters long',
                background: 'bg-error-300-600-token',
                timeout: 5000,
            });

            return;
        }

        if (confirmPassphraseForGeneratedAccount !== passphraseForGeneratedAccount) {
            toastStore.trigger({
                message: 'Confirm passphrase does not match passphrase',
                background: 'bg-error-300-600-token',
                timeout: 5000,
            });

            return;
        }

        if (generatedSeedWords && generatedNpub) {
            const encryptedSeed = encryptSecret(
                generatedSeedWords.join(' '),
                passphraseForGeneratedAccount,
                generatedNpub
            );

            localStorage.setItem('nostr-seedwords', encryptedSeed);
            localStorage.setItem('nostr-npub', generatedNpub);
            $loginMethod = LoginMethod.Local;
            localStorage.setItem('login-method', $loginMethod);

            // assign ndk signer
            $ndk.signer = new NDKPrivateKeySigner(generatedNsec);

            // broadcast profile
            const user = await $ndk.signer.user();
            user.profile = {
                created_at: Math.floor(Date.now() / 1000),
                name: 'name?',
                displayName: 'name?',
                about: '',
                bio: '',
                lud16: '',
                website: '',
            };
            broadcastUserProfile($ndk, user.profile);

            // initialize user
            initializeUser($ndk);

            const t: ToastSettings = {
                message: '<strong>Nostr Keypair Created!</strong>',
                timeout: 7000,
                background: 'bg-success-300-600-token',
            };
            toastStore.trigger(t);

            modalStore.close();
        }
    }

    function onCopyNpub(): void {
        copiedNpub = true;
        setTimeout(() => {
            copiedNpub = false;
        }, 1000);
    }

    function onCopyNsec(): void {
        copiedNsec = true;
        setTimeout(() => {
            copiedNsec = false;
        }, 1000);
    }

    function validateSeedWordInputs(seedWords: string[]): boolean {
        // Validate all words filled in
        let allFilledIn = true;
        seedWords.forEach((value) => {
            if (!value) {
                allFilledIn = false;
            }
        });

        if (!allFilledIn) {
            toastStore.trigger({
                message: 'Fill in all seed words!',
                background: 'bg-error-300-600-token',
                timeout: 5000,
            });
            return false;
        }

        // validate valid bip39 wordlist provided
        if (!validateWords(seedWords.join(' '))) {
            toastStore.trigger({
                message: 'Check the seed words again! Not a valid bip39 wordlist!',
                background: 'bg-error-300-600-token',
                timeout: 5000,
            });
            return false;
        }

        return true;
    }

    const labelClasses =
        'px-[10px] py-[5px] rounded-t-[6px] overflow-hidden border-[1px] border-black-200 border-b-[0px] text-[14px]';

    const inputWrapperClasses =
        'w-full flex flex-row bg-black-50 border-[1px] border-black-100 rounded-tr-[6px] overflow-hidden';

    const btnWrapperClasses =
        'w-full flex flex-row flex-wrap overflow-hidden rounded-b-[6px] border-[1px] border-black-200 border-t-[0px]';
</script>

{#if $modalStore[0]}
    <Popup title="Login">
        <div class="w-full flex flex-col">
            <div class="w-full flex flex-col gap-[10px] pt-[10px]">
                {#if statusMessage}
                    <h5 class="h5 font-bold text-center mt-4 {statusColor}">
                        {statusMessage}
                    </h5>
                {/if}
                <div class="w-full flex flex-col bg-black-50 rounded-[6px]">
                    <div
                        class="w-full px-[10px] py-[5px] border-[2px] border-black-100 border-b-[0px] rounded-t-[6px]"
                    >
                        <p>
                            SatShoot is built on Nostr, which has its own unique way of account
                            creation and login
                        </p>

                        {#if aboutSectionExpanded}
                            <div class="mt-3 space-y-3">
                                <p class="text-sm text-gray-700">
                                    Nostr enables
                                    <strong> sovereign identities </strong>
                                    through cryptographic keys. Your
                                    <strong> "secret" or "private" key </strong>
                                    is used by Nostr apps to digitally sign all actions you take.
                                </p>
                                <p class="text-sm text-gray-700">
                                    In the case of
                                    <strong> SatShoot </strong>
                                    , these actions include:
                                </p>
                                <ul class="pl-5 list-disc text-sm text-gray-700">
                                    <li>Posting a Job or an Offer</li>
                                    <li>Taking Offers</li>
                                    <li>Sending messages</li>
                                    <li>Creating reviews</li>
                                </ul>
                                <p class="text-sm text-gray-700">
                                    This ensures that your data is cryptographically verifiable,
                                    proving it belongs solely to you. You generate your private key,
                                    and it's
                                    <strong> your responsibility </strong>
                                    to keep it secure.
                                </p>
                                <p class="text-sm text-gray-700">
                                    Apps require your permission to get signatures for publishing
                                    data to Nostr relays. You can grant this permission in various
                                    ways, meaning there are multiple
                                    <strong>"login"</strong>
                                    methods with different security tradeoffs.
                                    <em>Do your own research and choose wisely.</em>
                                </p>
                            </div>
                        {/if}
                    </div>

                    <Button
                        variant="outlined"
                        classes="rounded-b-[6px]"
                        on:click={() => (aboutSectionExpanded = !aboutSectionExpanded)}
                    >
                        {aboutSectionExpanded ? 'Collapse' : 'Learn More'}
                    </Button>
                </div>
                <div class="w-full flex flex-col">
                    <div class="w-full flex flex-row items-center gap-[5px]">
                        <p class={labelClasses}>Bunker</p>
                        <i
                            class="bx bx-question-mark bg-blue-500 text-white p-[3px] rounded-[50%]"
                            use:popup={bunkerTooltip}
                        />
                        <div data-popup="bunkerTooltip">
                            <Card>
                                <p>
                                    A central place where apps go to ask for data to be signed via
                                    nostr relays. Considered to be the most secure but connection to
                                    the Bunker can be unreliable.
                                </p>
                            </Card>
                        </div>
                    </div>
                    <div class={inputWrapperClasses}>
                        <Input
                            bind:value={bunkerUrl}
                            placeholder="bunker://..."
                            type="url"
                            grow
                            noBorder
                            notRounded
                        />
                        <Button
                            variant="outlined"
                            classes="border-l-[1px] border-l-black-100 rounded-[0px]"
                            on:click={connectBunker}
                        >
                            <i class="bx bx-log-in-circle" />
                        </Button>
                    </div>
                    <div class={btnWrapperClasses}>
                        <Button
                            variant="outlined"
                            href="https://nostrapps.com/#signers"
                            target="_blank"
                            classes="rounded-[0]"
                            grow
                        >
                            Browse Signer Apps
                        </Button>
                    </div>
                </div>
                <div class="w-full flex flex-col">
                    <div class="w-full flex flex-row items-center gap-[5px]">
                        <p class={labelClasses}>Extension</p>
                        <i
                            class="bx bx-question-mark bg-blue-500 text-white p-[3px] rounded-[50%]"
                            use:popup={extensionTooltip}
                        />
                        <div data-popup="extensionTooltip">
                            <Card>
                                <p>
                                    Browser extensions can communicate fairly securely with any
                                    website locally in your browser. Connection to them is much more
                                    stable than Bunkers. However, extensions have access to any
                                    sensitive data you might load on any website.
                                </p>
                            </Card>
                        </div>
                    </div>
                    <div class={inputWrapperClasses}>
                        <Button
                            variant="outlined"
                            classes="rounded-[0]"
                            grow
                            disabled={askingForNip07Permission}
                            on:click={nip07Login}
                        >
                            {#if askingForNip07Permission}
                                <ProgressRadial
                                    value={undefined}
                                    stroke={60}
                                    meter="stroke-primary-500"
                                    track="stroke-primary-500/30"
                                    strokeLinecap="round"
                                    width="w-16"
                                />
                            {:else}
                                <i class="bx bx-log-in-circle" />
                                Connect
                            {/if}
                        </Button>
                    </div>
                    <div class={btnWrapperClasses}>
                        <Button
                            variant="outlined"
                            href="https://nostrapps.com/#signers"
                            target="_blank"
                            classes="rounded-[0]"
                            grow
                        >
                            Browse Signer Apps
                        </Button>
                    </div>
                </div>
                <div class="w-full flex flex-col rounded-[6px] overflow-hidden">
                    {#if displayLocalKeyLogin}
                        <div
                            class="w-full rounded-t-[6px] p-[10px] border-[2px] border-black-200 border-b-[0px] flex flex-col gap-[10px]"
                        >
                            <div class="w-full flex flex-col bg-black-50 rounded-[6px]">
                                <p
                                    class="w-full px-[10px] py-[5px] border-[2px] border-black-100 rounded-t-[6px]"
                                >
                                    Local keys are stored in an easily-accessible place in the
                                    browser called Local storage. This makes local keys the most
                                    convenient and stable way to grant permission.
                                    <span class="text-yellow-600">
                                        BUT ALSO MAKES THIS METHOD VULNERABLE TO MOST KINDS OF
                                        BROWSER OR WEBSITE BUGS AND EXPLOITS
                                    </span>
                                </p>
                            </div>
                            <div class="w-full flex flex-col">
                                <div class="w-full flex flex-row gap-[5px]">
                                    <p class={labelClasses}>Secret key</p>
                                </div>
                                <div class={inputWrapperClasses}>
                                    <Input
                                        bind:value={nsecForLocalKey}
                                        placeholder="nsec..."
                                        grow
                                        noBorder
                                        notRounded
                                    />
                                </div>
                                <Passphrase
                                    bind:passphrase={passphraseForNsec}
                                    bind:confirmPassphrase={confirmPassphraseForNsec}
                                    btnLabel="Login"
                                    on:submit={loginWithNsec}
                                />
                            </div>
                            <div class="w-full flex flex-col">
                                <SeedWords bind:words={seedWordsForLocalKey} />
                                <Passphrase
                                    bind:passphrase={passphraseForSeedWords}
                                    bind:confirmPassphrase={confirmPassphraseForSeedWords}
                                    btnLabel="Login"
                                    on:submit={loginWithSeedWords}
                                />
                            </div>
                        </div>
                    {/if}

                    <div class="w-full flex flex-row flex-wrap overflow-hidden rounded-b-[6px]">
                        <Button classes="rounded-[0]" grow on:click={toggleLocalKey}>
                            Local Key
                        </Button>
                    </div>
                </div>
                <div class="w-full flex flex-col rounded-[6px] overflow-hidden">
                    {#if displayGeneratedAccount && generatedSeedWords}
                        <div
                            class="w-full rounded-t-[6px] p-[10px] border-[2px] border-[red-500] border-b-[0px] flex flex-col"
                        >
                            <div class="w-full flex flex-col bg-black-50 rounded-[6px] mb-[10px]">
                                <p
                                    class="w-full px-[10px] py-[5px] border-[2px] border-black-100 rounded-[6px]"
                                >
                                    Backup your account. Put these words in a safe place to be able
                                    to access your account later.
                                </p>
                            </div>
                            <div class="w-full flex flex-col">
                                <SeedWords
                                    words={generatedSeedWords}
                                    inputsDisabled
                                    showCopyButton
                                />
                            </div>
                            <div class="w-full flex flex-col mt-[10px]">
                                <div class="w-full flex flex-row gap-[5px]">
                                    <p class={labelClasses}>Private key</p>
                                </div>
                                <div class={inputWrapperClasses}>
                                    <Input
                                        value={generatedNsec}
                                        disabled
                                        grow
                                        noBorder
                                        notRounded
                                    />
                                </div>
                                <div class={btnWrapperClasses}>
                                    <Button
                                        variant="outlined"
                                        on:click={onCopyNsec}
                                        classes="rounded-[0] bg-red-500 hover:bg-red-600 text-white"
                                        grow
                                    >
                                        <span use:clipboard={generatedNsec}>
                                            {copiedNsec ? 'Copied' : 'Dangerously Copy'}
                                        </span>
                                    </Button>
                                </div>
                            </div>
                            <div class="w-full flex flex-col mt-[10px]">
                                <div class="w-full flex flex-row gap-[5px]">
                                    <p class={labelClasses}>Public key</p>
                                </div>
                                <div class={inputWrapperClasses}>
                                    <Input
                                        value={generatedNpub}
                                        disabled
                                        grow
                                        noBorder
                                        notRounded
                                    />
                                </div>
                                <div class={btnWrapperClasses}>
                                    <Button
                                        variant="outlined"
                                        on:click={onCopyNpub}
                                        classes="rounded-[0]"
                                        grow
                                    >
                                        <span use:clipboard={generatedNpub}>
                                            {copiedNpub ? 'Copied' : 'Copy'}
                                        </span>
                                    </Button>
                                </div>
                            </div>
                            <div class="w-full flex flex-col mt-[10px]">
                                <Passphrase
                                    bind:passphrase={passphraseForGeneratedAccount}
                                    bind:confirmPassphrase={confirmPassphraseForGeneratedAccount}
                                    btnLabel="Finish"
                                    on:submit={finalizeAccountGeneration}
                                    roundedTop
                                />
                            </div>
                        </div>
                    {/if}

                    <div class="w-full flex flex-row flex-wrap overflow-hidden rounded-b-[6px]">
                        <Button
                            classes="rounded-[0]"
                            grow
                            on:click={() => (displayGeneratedAccount = !displayGeneratedAccount)}
                        >
                            Account Generation
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    </Popup>
{/if}
