<script lang="ts">
    import { browser } from '$app/environment';
    import ndk, { bunkerNDK, sessionPK, type LoginMethod } from '$lib/stores/ndk';
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
        ProgressRadial,
        type ModalSettings,
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
    import CloseModal from '../UI/Buttons/CloseModal.svelte';
    import Card from '../UI/Card.svelte';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

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
            statusMessage = 'Invalid Bunker token! URL must start with "bunker://"';

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
            statusMessage = 'Error: No Relay URLs specified in Bunker token!';
            return;
        } else if (!remotePubkey) {
            attemptingBunkerConnection = false;
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

                $loginMethod = 'bunker';
                localStorage.setItem('login-method', $loginMethod as LoginMethod);
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
                    $loginMethod = 'nip07';
                    $ndk.signer = nip07Signer;
                    localStorage.setItem('login-method', $loginMethod as LoginMethod);
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
        await loginWithSecret(
            nsecForLocalKey,
            passphraseForNsec,
            'nostr-nsec',
            'Could not create Private Key! Probably incorrect nsec!'
        );
    }

    async function loginWithSeedWords() {
        if (!validateSeedWordInputs(seedWordsForLocalKey)) {
            statusMessage = 'Invalid seed words input!';
            statusColor = 'text-red-500';
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
            $loginMethod = 'local';
            localStorage.setItem('login-method', $loginMethod as LoginMethod);

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
            statusMessage = `${failureMessage} ${e}`;
            setTimeout(() => {
                statusColor = 'text-red-500';
            }, 800);
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
        if (generatedSeedWords && generatedNpub) {
            const encryptedSeed = encryptSecret(
                generatedSeedWords.join(' '),
                passphraseForGeneratedAccount,
                generatedNpub
            );

            localStorage.setItem('nostr-seedwords', encryptedSeed);
            localStorage.setItem('nostr-npub', generatedNpub);
            $loginMethod = 'local';
            localStorage.setItem('login-method', $loginMethod as LoginMethod);

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
            statusMessage = 'Fill in all words!';
            setTimeout(() => {
                statusColor = 'text-red-500';
            }, 800);
            return false;
        }

        // validate valid bip39 wordlist provided
        if (!validateWords(seedWords.join(' '))) {
            statusMessage = 'Check the seed words again! Not a valid bip39 wordlist!';
            setTimeout(() => {
                statusColor = 'text-red-500';
            }, 800);
            return false;
        }

        return true;
    }

    const bunkerExamples = [
        {
            label: 'nsec.app (Web)',
            href: 'https://nsec.app/',
        },
        {
            label: 'Amber (Android)',
            href: 'https://github.com/greenart7c3/Amber',
        },
    ];

    const extensionExamples = [
        {
            label: 'Alby',
            href: 'https://getalby.com/',
        },
        {
            label: 'nos2x',
            href: 'https://chromewebstore.google.com/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp?pli=1',
        },
        {
            label: 'horse',
            href: 'https://chromewebstore.google.com/detail/horse/ogdjeglchjlenflecdcoonkngmmipcoe',
        },
        {
            label: 'Flamingo',
            href: 'https://www.getflamingo.org/',
        },
    ];

    const learnMoreBtnClasses =
        'transition ease duration-[0.3s] w-full border-[2px] border-[rgb(0,0,0,0.1)] p-[5px] font-[500] flex justify-center ' +
        'text-[rgb(0,0,0,0.5)] rounded-b-[6px] hover:bg-[rgb(59,115,246)] hover:text-white hover:border-[rgb(59,115,246)]';

    const labelClasses =
        'px-[10px] py-[5px] rounded-t-[6px] overflow-hidden border-[1px] border-[rgb(0,0,0,0.15)] border-b-[0px] text-[14px]';

    const inputWrapperClasses =
        'w-full flex flex-row bg-[rgb(0,0,0,0.05)] border-[1px] border-[rgb(0,0,0,0.1)] rounded-tr-[6px] overflow-hidden';

    const inputClasses =
        'grow-[1] border-[0px] border-[rgb(0,0,0,0.15)] rounded-[0px] outline outline-[0px] py-[5px] px-[10px] bg-[rgb(0,0,0,0)]';

    const btnWrapperClasses =
        'w-full flex flex-row flex-wrap overflow-hidden rounded-b-[6px] border-[1px] border-[rgb(0,0,0,0.15)] border-t-[0px]';

    const btnClasses =
        'transition ease duration-[0.3s] grow-[1] p-[5px] font-[500] flex justify-center ' +
        'text-[rgb(0,0,0,0.5)] hover:bg-[rgb(59,115,246)] hover:text-white hover:border-[rgb(59,115,246)]';

    const bunkerLogoBtnClasses =
        'transition ease duration-[0.3s] text-[rgb(0,0,0,0.5)] px-[10px] border-l-[1px] border-l-[rgb(0,0,0,0.1)] ' +
        'flex flex-row justify-center items-center hover:bg-[rgb(59,115,246)] hover:text-white hover:border-l-[rgb(0,0,0,0.0)]';

    const loginBtnClasses =
        'transition ease duration-[0.3s] grow-[1] text-[rgb(0,0,0,0.5)] px-[10px] py-[5px] ' +
        'flex flex-row justify-center items-center font-[500] gap-[10px] hover:bg-[rgb(59,115,246)] hover:text-white';

    const advLoginBtnClasses =
        'transition ease duration-[0.3s] grow-[1] p-[5px] font-[500] text-[rgb(0,0,0,0.5)] ' +
        'flex flex-row justify-center items-center gap-[10px] bg-[rgb(59,115,246)] text-white hover:text-white hover:bg-blue-500';

    const showPasswordBtnClasses =
        'transition ease duration-[0.3s] text-[rgb(0,0,0,0.5)] px-[10px] border-l-[1px] border-l-[rgb(0,0,0,0.1)] ' +
        'flex flex-row justify-center items-center hover:bg-[rgb(59,115,246)] hover:text-white hover:border-l-[rgb(0,0,0,0.0)]';
</script>

{#if $modalStore[0]}
    <div
        class="fixed inset-[0] z-[90] bg-[rgb(0,0,0,0.5)] backdrop-blur-[10px] flex flex-col justify-start items-center py-[25px] overflow-auto"
    >
        {#if askingForNip07Permission}
            <div
                class="absolute top-1/2 left-1/2 z-[100] transform -translate-x-1/2 -translate-y-1/2 card p-8 flex flex-col items-center bg-surface-400-500-token"
            >
                <h3 class="h3 text-center font-bold mb-8">Asking for permission</h3>
                <ProgressRadial
                    value={undefined}
                    stroke={60}
                    meter="stroke-primary-500"
                    track="stroke-primary-500/30"
                    strokeLinecap="round"
                    width="w-16"
                />
                <button
                    type="button"
                    class="btn btn-sm sm:btn-md bg-error-300-600-token w-24 mt-8"
                    on:click={() => (askingForNip07Permission = false)}
                >
                    Cancel
                </button>
            </div>
        {/if}

        <div
            class="max-w-[1400px] w-full flex flex-col justify-start items-center px-[10px] relative"
        >
            <div class="w-full flex flex-col justify-start items-center">
                <div class="w-full max-w-[500px] justify-start items-center">
                    <Card>
                        <div
                            class="flex flex-row justify-between gap-[10px] pb-[5px] border-b-[1px] border-b-[rgb(0,0,0,0.1)]"
                        >
                            <p class="font-[500] text-[18px]">Login</p>
                            <CloseModal />
                        </div>
                        <div class="w-full flex flex-col">
                            <div class="w-full flex flex-col gap-[10px] pt-[10px]">
                                {#if statusMessage}
                                    <h5 class="h5 font-bold text-center mt-4 {statusColor}">
                                        {statusMessage}
                                    </h5>
                                {/if}
                                <div
                                    class="w-full flex flex-col bg-[rgb(0,0,0,0.05)] rounded-[6px]"
                                >
                                    <p
                                        class="w-full px-[10px] py-[5px] border-[2px] border-b-[0px] border-[rgb(0,0,0,0.1)] rounded-t-[6px]"
                                    >
                                        SatShoot is built on Nostr, which has its own unique way of
                                        account creation and login
                                    </p>
                                    <a href="/about" target="_blank" class={learnMoreBtnClasses}>
                                        Learn More
                                    </a>
                                </div>
                                <div class="w-full flex flex-col">
                                    <div class="w-full flex flex-row gap-[5px]">
                                        <p class={labelClasses}>Bunker</p>
                                    </div>
                                    <div class={inputWrapperClasses}>
                                        <input
                                            type="url"
                                            bind:value={bunkerUrl}
                                            placeholder="bunker://..."
                                            class={inputClasses}
                                        />
                                        <button
                                            class={bunkerLogoBtnClasses}
                                            on:click={connectBunker}
                                        >
                                            <i class="bx bx-log-in-circle" />
                                        </button>
                                    </div>
                                    <div class={btnWrapperClasses}>
                                        {#each bunkerExamples as { href, label }}
                                            <a {href} target="_blank" class={btnClasses}>
                                                {label}
                                            </a>
                                        {/each}
                                    </div>
                                </div>
                                <div class="w-full flex flex-col">
                                    <div class="w-full flex flex-row gap-[5px]">
                                        <p class={labelClasses}>Extension</p>
                                    </div>
                                    <div class={inputWrapperClasses}>
                                        <button class={loginBtnClasses} on:click={nip07Login}>
                                            <i class="bx bx-log-in-circle" />
                                            Connect
                                        </button>
                                    </div>
                                    <div class={btnWrapperClasses}>
                                        {#each extensionExamples as { href, label }}
                                            <a {href} target="_blank" class={btnClasses}>
                                                {label}
                                            </a>
                                        {/each}
                                    </div>
                                </div>
                                <div class="w-full flex flex-col rounded-[6px] overflow-hidden">
                                    {#if displayLocalKeyLogin}
                                        <div
                                            class="w-full rounded-t-[6px] p-[10px] border-[2px] border-[rgb(0,0,0,0.15)] border-b-[0px] flex flex-col gap-[10px]"
                                        >
                                            <div
                                                class="w-full flex flex-col bg-[rgb(0,0,0,0.05)] rounded-[6px]"
                                            >
                                                <p
                                                    class="w-full px-[10px] py-[5px] border-[2px] border-[rgb(0,0,0,0.1)] rounded-t-[6px]"
                                                >
                                                    Your secret key will be stored locally in
                                                    encrypted form and unencrypted until your
                                                    session ends. For the Passphrase, please provide
                                                    a strong passphrase for encryption at rest(min.
                                                    14chars).
                                                </p>
                                            </div>
                                            <div class="w-full flex flex-col">
                                                <div class="w-full flex flex-row gap-[5px]">
                                                    <p class={labelClasses}>Secret key</p>
                                                </div>
                                                <div class={inputWrapperClasses}>
                                                    <input
                                                        type="text"
                                                        bind:value={nsecForLocalKey}
                                                        placeholder="Your private key..."
                                                        class={inputClasses}
                                                    />
                                                    <button class={showPasswordBtnClasses}>
                                                        <i class="bx bxs-show" />
                                                    </button>
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

                                    <div
                                        class="w-full flex flex-row flex-wrap overflow-hidden rounded-b-[6px]"
                                    >
                                        <button
                                            class={advLoginBtnClasses}
                                            on:click={toggleLocalKey}
                                        >
                                            Local Key
                                        </button>
                                    </div>
                                </div>
                                <div class="w-full flex flex-col rounded-[6px] overflow-hidden">
                                    {#if displayGeneratedAccount && generatedSeedWords}
                                        <div
                                            class="w-full rounded-t-[6px] p-[10px] border-[2px] border-[rgb(255,91,91,0.5)] border-b-[0px] flex flex-col"
                                        >
                                            <div
                                                class="w-full flex flex-col bg-[rgb(0,0,0,0.05)] rounded-[6px] mb-[10px]"
                                            >
                                                <p
                                                    class="w-full px-[10px] py-[5px] border-[2px] border-[rgb(0,0,0,0.1)] rounded-[6px]"
                                                >
                                                    Backup your account. Put these words in a safe
                                                    place to be able to access your account later.
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
                                                    <input
                                                        type="text"
                                                        placeholder="Generated Private Key"
                                                        value={generatedNsec}
                                                        disabled
                                                        class={inputClasses}
                                                    />
                                                </div>
                                                <div class={btnWrapperClasses}>
                                                    <button
                                                        class={btnClasses}
                                                        use:clipboard={generatedNsec}
                                                        on:click={onCopyNsec}
                                                    >
                                                        {copiedNsec ? 'Copied' : 'Copy'}
                                                    </button>
                                                </div>
                                            </div>
                                            <div class="w-full flex flex-col mt-[10px]">
                                                <div class="w-full flex flex-row gap-[5px]">
                                                    <p class={labelClasses}>Public key</p>
                                                </div>
                                                <div class={inputWrapperClasses}>
                                                    <input
                                                        type="text"
                                                        placeholder="Generated Pubkey"
                                                        value={generatedNpub}
                                                        disabled
                                                        class={inputClasses}
                                                    />
                                                </div>
                                                <div class={btnWrapperClasses}>
                                                    <button
                                                        class={btnClasses}
                                                        use:clipboard={generatedNpub}
                                                        on:click={onCopyNpub}
                                                    >
                                                        {copiedNpub ? 'Copied' : 'Copy'}
                                                    </button>
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

                                    <div
                                        class="w-full flex flex-row flex-wrap overflow-hidden rounded-b-[6px]"
                                    >
                                        <button
                                            class={advLoginBtnClasses}
                                            on:click={() =>
                                                (displayGeneratedAccount =
                                                    !displayGeneratedAccount)}
                                        >
                                            Account Generation
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    </div>
{/if}
