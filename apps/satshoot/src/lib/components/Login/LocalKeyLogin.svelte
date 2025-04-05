<script lang="ts">
    import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
    import Passphrase from '../Passphrase.svelte';
    import TabSelector from '../UI/Buttons/TabSelector.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import SeedWords from './SeedWords.svelte';
    import { privateKeyFromNsec } from '$lib/utils/nip19';
    import { privateKeyFromSeedWords, validateWords } from 'nostr-tools/nip06';
    import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
    import { encryptSecret } from '$lib/utils/crypto';
    import { loginMethod } from '$lib/stores/user';
    import ndk, { LoginMethod, sessionPK } from '$lib/stores/ndk';
    import { initializeUser } from '$lib/utils/helpers';
    import { redirectAfterLogin } from '$lib/stores/gui';
    import { goto } from '$app/navigation';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    enum LocalKeyLoginTabs {
        SecretKey,
        SeedWords,
    }

    const localKeyLoginTabs = [
        {
            id: LocalKeyLoginTabs.SecretKey,
            label: 'Secret Key',
        },
        {
            id: LocalKeyLoginTabs.SeedWords,
            label: 'Seed Words',
        },
    ];

    let activeTabForLocalKeyLogin = $state(LocalKeyLoginTabs.SecretKey);

    let nsecForLocalKey = $state('');
    let seedWordsForLocalKey = $state(Array(12).fill(''));
    let passphraseForNsec = $state('');
    let confirmPassphraseForNsec = $state('');
    let passphraseForSeedWords = $state('');
    let confirmPassphraseForSeedWords = $state('');

    let statusMessage = $state('');
    let statusColor = $state('text-tertiary-200-700-token');

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
            initializeUser($ndk, toastStore);

            // Display success toast
            toastStore.trigger({
                message: 'Encrypted Secret saved in local storage!',
                timeout: 7000,
                background: 'bg-success-300-600-token',
            });

            handleRedirection();
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

    const inputWrapperClasses =
        'w-full flex flex-col gap-[5px] bg-black-50 dark:bg-white-50 border-[1px] border-black-100 dark:border-white-100 rounded-tr-[6px] p-[5px] overflow-hidden';
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
        Local keys are stored in an easily-accessible place in the browser called Local storage.
        This makes local keys the most convenient and stable way to grant permission.
        <span class="text-yellow-600">
            BUT ALSO MAKES THIS METHOD VULNERABLE TO MOST KINDS OF BROWSER OR WEBSITE BUGS AND
            EXPLOITS
        </span>
    </p>
</div>

<!-- tabs start-->
<div class="w-full flex flex-col gap-[10px]">
    <TabSelector tabs={localKeyLoginTabs} bind:selectedTab={activeTabForLocalKeyLogin} />
    {#if activeTabForLocalKeyLogin === LocalKeyLoginTabs.SecretKey}
        <div class="w-full flex flex-col">
            <div class="w-full flex flex-row gap-[5px]">
                <p class={labelClasses}>Secret key</p>
            </div>
            <div class={inputWrapperClasses}>
                <Input
                    bind:value={nsecForLocalKey}
                    placeholder="nsec..."
                    classes="focus:ring-0 bg-transparent"
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
    {:else if activeTabForLocalKeyLogin === LocalKeyLoginTabs.SeedWords}
        <div class="w-full flex flex-col">
            <SeedWords bind:words={seedWordsForLocalKey} />
            <Passphrase
                bind:passphrase={passphraseForSeedWords}
                bind:confirmPassphrase={confirmPassphraseForSeedWords}
                btnLabel="Login"
                on:submit={loginWithSeedWords}
            />
        </div>
    {/if}
</div>
