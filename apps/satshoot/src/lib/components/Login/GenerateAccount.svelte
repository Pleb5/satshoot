<script lang="ts">
    import { goto } from '$app/navigation';
    import { OnboardingStep, onboardingStep, redirectAfterLogin } from '$lib/stores/gui';
    import ndk, { LoginMethod, sessionPK } from '$lib/stores/session';
    import { loginMethod, UserMode, userMode } from '$lib/stores/user';
    import { encryptSecret } from '$lib/utils/crypto';
    import { broadcastUserProfile, initializeUser } from '$lib/utils/helpers';
    import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';

    import { nsecEncode } from 'nostr-tools/nip19';
    import { onMount, tick } from 'svelte';
    import Passphrase from '../Passphrase.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import { toaster } from '$lib/stores/toaster';
    import { generateSecretKey } from 'nostr-tools';
    import { bytesToHex } from '@noble/ciphers/utils';
    import { navigating, page } from '$app/state';
    import QuestionIcon from '../Icons/QuestionIcon.svelte';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';

    interface Props {
        isOpen: boolean;
    }

    let { isOpen = $bindable() }: Props = $props();

    const privateKey = generateSecretKey();
    const generatedNsec = nsecEncode(privateKey);

    let copiedNsec = $state(false);
    let savedNsec = $state(false);
    let userName = $state("")
    let generatedNpub = $state('');

    const mimeType = 'text/plain';
    const blob = $derived(new Blob([generatedNsec], { type: mimeType }));
    const url = $derived(URL.createObjectURL(blob));
    const filename = $derived(userName + "-SatShoot-Nostr-Secret-Key.txt")

    let passphraseForGeneratedAccount = $state('');
    let confirmPassphraseForGeneratedAccount = $state('');
    let redirectPath = $state($userMode === UserMode.Freelancer
        ? 'post-service'
        : 'post-job'
    )
    let inProgress = $state(false)

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

            inProgress = true
            await tick()
            await handleRedirection();

            inProgress = false;
            isOpen = false;
        }
    }

    async function handleRedirection() {
        if ($redirectAfterLogin) {
            console.log('redirecting to:', redirectPath)
            await goto(redirectPath);
        } else {
            console.log('not redirecting :(')
            $redirectAfterLogin = true;
        }
    }

    function onCopyNsec(): void {
        navigator.clipboard.writeText(generatedNsec).then(() => {
            copiedNsec = true;
            setTimeout(() => {
                copiedNsec = false;
            }, 1000);
        });
    }

    let nsecTooltip =
        '<div>' +
            '<div class="font-bold">This Secret is makes You unstoppable on Nostr... as long as You take care of it!</div>' +
        '<ul class="list-inside list-disc space-y-2">' +
            '<li>Save it to a safe place for now</li>' +
            '<li>' +
                "Don't send your secret key to anyone, ever!" +
            '</li>' +
            '<li>' +
                'You will need it to use your nostr account' +
            '</li>' +
        '</ul>' +
        '</div>';

    let passPhraseTooltip =
        '<div>' +
            '<div class="">SatShoot saves your Secret key locally encrypted in the Browser</div>' +
        '<ul class="list-inside list-disc space-y-2">' +
            '<li>You will be able to restore your Secret key after a session ends</li>' +
            '<li>' +
                "During active sessions SatShoot uses it therefore it's unencrypted" +
            '</li>' +
        '</ul>' +
        '</div>';

    const labelClasses =
        'px-[10px] py-[5px] rounded-t-[6px] overflow-hidden border-[1px] border-black-200 dark:border-white-200 border-b-[0px] text-[14px]';

    const inputWrapperClasses =
        'w-full flex flex-col gap-[5px] bg-black-50 dark:bg-white-50 border-[1px] border-black-100 dark:border-white-100 rounded-tr-[6px] p-[5px] overflow-hidden';

    const btnWrapperClasses =
        'w-full flex flex-row gap-x-2 flex-wrap overflow-hidden rounded-b-[6px] border-[1px] border-black-200 dark:border-white-200 border-t-[0px] mb-2';
    const downloadBtnClasses = 'btn flex gap-x-2 rounded-[0] justify-center items-center bg-blue-500 font-bold text-white dark:text-white hover:bg-blue-600 hover:text-white whitespace-nowrap '

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
    <div class="w-full flex flex-col mt-[10px]">
        <div class="w-full flex flex-row gap-[5px]">
            <p class={labelClasses}>Secret key</p>

            <QuestionIcon
                extraClasses="text-[14px] p-[3px]"
                placement="bottom-start"
                popUpText={nsecTooltip}
            />
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
            <a 
                class={downloadBtnClasses}
                href={url}
                download={filename}>
                <span>Download</span>

            </a>
        </div>
        <Checkbox
            id="save-nsec"
            label="Saved Secret key"
            bind:checked={savedNsec}
        />
    </div>
    <div class="flex gap-x-2">
        <span>Password: min. 14 chars</span>
        <QuestionIcon
            extraClasses="text-[14px] p-[3px]"
            placement="bottom-start"
            popUpText={passPhraseTooltip}
        />
    </div>
    <Passphrase
        bind:passphrase={passphraseForGeneratedAccount}
        bind:confirmPassphrase={confirmPassphraseForGeneratedAccount}
        btnLabel="Next"
        onSubmit={finalizeAccountGeneration}
        disabled={!savedNsec}
        inProgress={inProgress}
        roundedTop
    />
</div>
