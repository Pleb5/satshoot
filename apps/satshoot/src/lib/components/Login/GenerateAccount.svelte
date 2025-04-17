<script lang="ts">
    import { goto } from '$app/navigation';
    import { OnboardingStep, onboardingStep, redirectAfterLogin } from '$lib/stores/gui';
    import ndk, { LoginMethod } from '$lib/stores/session';
    import { loginMethod } from '$lib/stores/user';
    import { encryptSecret } from '$lib/utils/crypto';
    import { broadcastUserProfile, initializeUser } from '$lib/utils/helpers';
    import { hexToBytes } from '@noble/hashes/utils';
    import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';

    import { generateSeedWords, privateKeyFromSeedWords } from 'nostr-tools/nip06';
    import { nsecEncode } from 'nostr-tools/nip19';
    import { onMount } from 'svelte';
    import Passphrase from '../Passphrase.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import SeedWords from './SeedWords.svelte';
    import { toaster } from '$lib/stores/toaster';

    interface Props {
        isOpen: boolean;
    }

    let { isOpen = $bindable() }: Props = $props();

    const seedWords = generateSeedWords();
    const generatedSeedWords = seedWords.split(' ');
    const privateKey = privateKeyFromSeedWords(seedWords);
    const generatedNsec = nsecEncode(hexToBytes(privateKey));

    let generatedNpub = $state('');
    let passphraseForGeneratedAccount = $state('');
    let confirmPassphraseForGeneratedAccount = $state('');
    let copiedNpub = $state(false);
    let copiedNsec = $state(false);

    onMount(async () => {
        const signer = new NDKPrivateKeySigner(generatedNsec);
        const user = await signer.user();
        generatedNpub = user.npub;
    });

    async function finalizeAccountGeneration() {
        if (passphraseForGeneratedAccount.length < 14) {
            toaster.error({
                title: 'Passphrase should be at least 14 characters long',
            });

            return;
        }

        if (confirmPassphraseForGeneratedAccount !== passphraseForGeneratedAccount) {
            toaster.error({
                title: 'Confirm passphrase does not match passphrase',
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
            broadcastUserProfile($ndk, user);

            $onboardingStep = OnboardingStep.Account_Created;

            // initialize user
            initializeUser($ndk);

            toaster.success({
                title: '<strong>Nostr Keypair Created!</strong>',
            });

            handleRedirection();

            isOpen = false;
        }
    }

    function handleRedirection() {
        // redirect to jobs page
        if ($redirectAfterLogin) {
            goto('/settings/profile');
        } else {
            $redirectAfterLogin = true;
        }
    }

    function onCopyNpub(): void {
        navigator.clipboard.writeText(generatedNpub).then(() => {
            copiedNpub = true;
            setTimeout(() => {
                copiedNpub = false;
            }, 1000);
        });
    }

    function onCopyNsec(): void {
        navigator.clipboard.writeText(generatedNsec).then(() => {
            copiedNsec = true;
            setTimeout(() => {
                copiedNsec = false;
            }, 1000);
        });
    }

    const labelClasses =
        'px-[10px] py-[5px] rounded-t-[6px] overflow-hidden border-[1px] border-black-200 dark:border-white-200 border-b-[0px] text-[14px]';

    const inputWrapperClasses =
        'w-full flex flex-col gap-[5px] bg-black-50 dark:bg-white-50 border-[1px] border-black-100 dark:border-white-100 rounded-tr-[6px] p-[5px] overflow-hidden';

    const btnWrapperClasses =
        'w-full flex flex-row flex-wrap overflow-hidden rounded-b-[6px] border-[1px] border-black-200 dark:border-white-200 border-t-[0px]';
</script>

<div
    class="rounded-[6px] bg-black-50 dark:bg-white-50 border-[2px] border-black-100 dark:border-white-100"
>
    <p class="w-full px-[10px] py-[5px]">
        Backup your account. Put these words in a safe place to be able to access your account
        later.
    </p>
</div>

<div class="w-full flex flex-col">
    <SeedWords words={generatedSeedWords} inputsDisabled showCopyButton />
</div>

<div class="w-full flex flex-col mt-[10px]">
    <div class="w-full flex flex-row gap-[5px]">
        <p class={labelClasses}>Private key</p>
    </div>
    <div class={inputWrapperClasses}>
        <Input value={generatedNsec} disabled grow noBorder notRounded />
    </div>
    <div class={btnWrapperClasses}>
        <Button
            variant="outlined"
            onClick={onCopyNsec}
            classes="rounded-[0] bg-red-500 hover:bg-red-600 text-white"
            grow
        >
            <span class="w-full h-full">
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
        <Input value={generatedNpub} disabled grow noBorder notRounded />
    </div>
    <div class={btnWrapperClasses}>
        <Button variant="outlined" onClick={onCopyNpub} classes="rounded-[0]" grow>
            <span class="w-full h-full">
                {copiedNpub ? 'Copied' : 'Copy'}
            </span>
        </Button>
    </div>
</div>

<div class="w-full flex flex-col mt-[10px]">
    <Passphrase
        bind:passphrase={passphraseForGeneratedAccount}
        bind:confirmPassphrase={confirmPassphraseForGeneratedAccount}
        btnLabel="Login"
        onSubmit={finalizeAccountGeneration}
        roundedTop
    />
</div>
