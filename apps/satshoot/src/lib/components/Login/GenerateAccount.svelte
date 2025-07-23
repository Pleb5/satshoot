<script lang="ts">
    import { goto } from '$app/navigation';
    import { OnboardingStep, onboardingStep, redirectAfterLogin } from '$lib/stores/gui';
    import ndk, { LoginMethod, sessionPK } from '$lib/stores/session';
    import { loginMethod, UserMode, userMode } from '$lib/stores/user';
    import { encryptSecret } from '$lib/utils/crypto';
    import { broadcastUserProfile, initializeUser } from '$lib/utils/helpers';
    import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';

    import { nsecEncode } from 'nostr-tools/nip19';
    import { onMount } from 'svelte';
    import Passphrase from '../Passphrase.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import { toaster } from '$lib/stores/toaster';
    import { generateSecretKey } from 'nostr-tools';
    import { bytesToHex } from '@noble/ciphers/utils';
    import { page } from '$app/state';

    interface Props {
        isOpen: boolean;
    }

    let { isOpen = $bindable() }: Props = $props();

    const privateKey = generateSecretKey();
    const generatedNsec = nsecEncode(privateKey);

    let generatedNpub = $state('');
    let userName = $state("")
    let passphraseForGeneratedAccount = $state('');
    let confirmPassphraseForGeneratedAccount = $state('');
    let redirectPath = $state($userMode === UserMode.Freelancer
        ? 'post-service'
        : 'post-job'
    )

    onMount(async () => {
        if (page.url.searchParams.get('state') === 'letsgo') {
            console.log('setting redirect after login to true')
            $redirectAfterLogin = true
        }

        const signer = new NDKPrivateKeySigner(generatedNsec);
        const user = await signer.user();
        generatedNpub = user.npub;
    });

    async function finalizeAccountGeneration() {
        if (passphraseForGeneratedAccount.length < 14) {
            toaster.error({
                title: 'Password should be at least 14 characters long',
            });

            return;
        }

        if (confirmPassphraseForGeneratedAccount !== passphraseForGeneratedAccount) {
            toaster.error({
                title: 'Confirm password does not match password',
            });

            return;
        }

        if (generatedNpub) {
            const encryptedSeed = encryptSecret(
                generatedNsec,
                passphraseForGeneratedAccount,
                generatedNpub
            );

            localStorage.setItem('nostr-nsec', encryptedSeed);
            localStorage.setItem('nostr-npub', generatedNpub);
            loginMethod.set(LoginMethod.Local);

            // assign ndk signer
            $ndk.signer = new NDKPrivateKeySigner(generatedNsec);

            $sessionPK = (bytesToHex(privateKey));

            // broadcast profile
            const user = await $ndk.signer.user();
            user.profile = {
                created_at: Math.floor(Date.now() / 1000),
                name: userName ?? "name",
                displayName: userName ?? "name",
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
                title: 'Nostr Keypair Created!',
            });

            handleRedirection();

            isOpen = false;
        }
    }

    function handleRedirection() {
        if ($redirectAfterLogin) {
            console.log('redirecting to:', redirectPath)
            goto(redirectPath);
        } else {
            console.log('not redirecting :(')
            $redirectAfterLogin = true;
        }
    }

</script>

<div class="w-full flex flex-col mt-[10px] gap-y-2">
    <div
        class="flex flex-row outline-[1px] outline-black-100 dark:outline-white-100 rounded-[6px]"
    >
        <Button
            variant={$userMode === UserMode.Freelancer ? 'contained' : 'text'}
            onClick={() => {
                $userMode = UserMode.Freelancer;
                redirectPath = '/post-service';
            }}
            classes="grow "
        >
            Freelancer
        </Button>
        <Button
            variant={$userMode === UserMode.Client ? 'contained' : 'text'}
            onClick={() => {
                $userMode = UserMode.Client;
                redirectPath = '/post-job';
            }}
            classes="grow "
        >
            Client
        </Button>
    </div>
    <div>
        <label class="font-[600]" for="display_name">User Name</label>
    </div>
    <Input
        id="display_name"
        type="text"
        placeholder="User Name"
        bind:value={userName}
        fullWidth
    />
    <div>Password: min. 14 chars</div>
    <Passphrase
        bind:passphrase={passphraseForGeneratedAccount}
        bind:confirmPassphrase={confirmPassphraseForGeneratedAccount}
        btnLabel="Next"
        onSubmit={finalizeAccountGeneration}
        roundedTop
    />
</div>
