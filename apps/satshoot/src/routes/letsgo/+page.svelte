<script lang="ts">
    import { goto } from '$app/navigation';
    import {
        onBoarding,
        onBoardingName,
        onBoardingNsec,
        UserMode,
        userMode 
    } from '$lib/stores/user';
    import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
    import { nsecEncode } from 'nostr-tools/nip19';
    import { onMount, tick } from 'svelte';
    import { toaster } from '$lib/stores/toaster';
    import { generateSecretKey } from 'nostr-tools';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import QuestionIcon from '$lib/components/Icons/QuestionIcon.svelte';
    import Checkbox from '$lib/components/UI/Inputs/Checkbox.svelte';
    import Input from '$lib/components/UI/Inputs/input.svelte';
    import ProgressRing from '$lib/components/UI/Display/ProgressRing.svelte';
    import { showLoginModal } from '$lib/stores/modals';

    const generatedNsec = $onBoardingNsec 
        ? $onBoardingNsec
        : nsecEncode(generateSecretKey());

    function maskSecretKey(nsec: string): string {
        const trimmed = nsec.trim();
        if (!trimmed) return '';

        const prefixLength = 10;
        const suffixLength = 8;
        if (trimmed.length <= prefixLength + suffixLength) return trimmed;

        return `${trimmed.slice(0, prefixLength)}...${trimmed.slice(-suffixLength)}`;
    }

    const displayedNsec = $derived.by(() => maskSecretKey(generatedNsec));

    let nsecSaved = $state(false);

    let userName = $state(
        $onBoardingName
            ? $onBoardingName
            : ""
    )
    let generatedNpub = $state('');

    const filename = $derived(`SatShoot-${userName}-login.txt`)

    const fileContent = $derived(`
    # This is your SatShoot Nostr login configuration.
    # It contains your nsec, npub and a few important bits.

    # This is your secret key
    # Nostr apps use this key to digitally sign your actions.
    # SatShoot uses it to sign the following events
    # - setting up your profile
    # - posting jobs and services
    # - taking bids and orders
    # - sending messages
    # - leaving a reviews
    # - managing your wallet and paying with zaps
    # This is private information. Keep it safe!
    nsec=${generatedNsec}

    # This is your public key
    # Other Nostr users use this key to verify your actions on Nostr
    # This is public, you are encouraged to share it with the world.
    npub=${generatedNpub}

    # To learn more about Nostr keys visit https://nstart.me/en

    # P.S. This nsec/npub pair is also good for any app on the Nostr network.
    `
    )

    const mimeType = 'text/plain';
    const blob = $derived(new Blob([fileContent], { type: mimeType }));
    const url = $derived(URL.createObjectURL(blob));

    let redirectPath = $state($userMode === UserMode.Freelancer
        ? '/post-service'
        : '/post-job'
    )
    let inProgress = $state(false)

    onMount(async () => {
        onBoarding.set(true);
        const signer = new NDKPrivateKeySigner(generatedNsec);
        const user = await signer.user();
        generatedNpub = user.npub;
    });


    async function finalize() {
        if (!validate()) return;

        onBoardingNsec.set(generatedNsec)
        onBoardingName.set(userName)

        inProgress = true
        await tick()

        await handleRedirection();

        inProgress = false;
    }

    const validate = ():boolean => {
        if (!userName) {
            toaster.error({
                title: `Must set a User Name!`,
            });
            return false;
        }

        return true;
    }

    const handleRedirection = async () => {
        const url = new URL(redirectPath, window.location.origin)
        url.searchParams.append('state', 'letsgo')
        await goto(url.toString())
    }

    const handleBackToLogin = async () => {
        // Set onBoarding to false
        onBoarding.set(false);

        // Clear onboarding session data
        onBoardingName.set('');
        onBoardingNsec.set('');

        // Navigate back to the previous page (or home page as fallback)
        if (window.history.length > 1) {
            window.history.back();
            // Wait a bit then open the login modal
            setTimeout(() => {
                $showLoginModal = true;

            }, 100);
        } else {
            // If no previous page, go to home and open login modal
            await goto('/');
            $showLoginModal = true

        }
    };

    let userNameTooltip =
        '<div>' +
            '<div class="font-bold">' + 
            'This is how others will see you in SatShoot and Nostr. Learn more about ' + 
                '<a class="anchor" target="_blank" href="https://nostr.how">Nostr.</a>' + 
            '</div>' +
        '</div>';

    let nsecTooltip =
        '<div>' +
        '<ul class="list-inside list-disc space-y-2">' +
            '<li>' +
                '<span class="font-bold">' +
                'A secret piece of information called an `nsec`. You use this to prove ' +
                'your identity to other Nostr users. Think of it like a password for now.' +
                '</span>' +
            '</li>' +
            '<li>Save it to a safe place</li>' +
            '<li>' +
                "Don't share it with anyone" +
            '</li>' +
            '<li>' +
                'Learn more about ' +

                '<a class="anchor" target="_blank" href="https://nostr.how/en/get-started#understanding-keys">' +
                    'nsec.' +
                '</a>' + 
            '</li>' +
        '</ul>' +
        '</div>';

    const labelClasses =
        'px-[10px] py-[5px] rounded-t-[6px] overflow-hidden border-[1px] border-black-200 dark:border-white-200 border-b-[0px] text-[14px]';

    const inputWrapperClasses =
        'w-full flex flex-col gap-[5px] bg-black-50 dark:bg-white-50 border-[1px] border-black-100 dark:border-white-100 rounded-tr-[6px] p-[5px] overflow-hidden';

    const btnWrapperClasses =
        'w-full flex flex-row gap-x-2 flex-wrap overflow-hidden rounded-b-[6px] border-[1px] border-black-200 dark:border-white-200 border-t-[0px] mb-2';
    const downloadBtnClasses = 'w-full btn flex gap-x-2 rounded-[0] justify-center items-center bg-blue-500 font-bold text-white dark:text-white hover:bg-blue-600 hover:text-white whitespace-nowrap '

    

</script>

<div class="p-4 flex flex-col items-center gap-y-2">
    <div class="w-full flex justify-center">
        <img
            src="/img/satshoot.svg"
            alt="Satshoot logo"
            class="w-14 sm:w-24 sm:justify-self-end"
        />
    </div>
    <div class="w-full flex justify-center">
        <h2 class="w-full h2 sm:h1 text-center">Welcome to SatShoot</h2>
    </div>
    <div class="flex justify-center text-center h4 sm:h3">
        Where individuals become unstoppable
    </div>
    <div class="mt-4 text-xl sm:text-3xl text-center">
        <span>
            Let's get you set up on the <strong>Free Market!</strong>
        </span>
    </div>
    <div class="mt-4 text-xl sm:text-3xl text-center">
        First, choose a name and save your login information:
    </div>

    <div class="w-full sm:max-w-[60vw] flex flex-col mt-[10px] gap-y-2">
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
        <div class="flex gap-x-2">
            <label class="font-[600]" for="display_name">User Name</label>
            <QuestionIcon
                extraClasses="text-[14px] p-[3px]"
                placement="bottom-start"
                popUpText={userNameTooltip}
            />
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
                <Input value={displayedNsec} disabled grow noBorder notRounded />
            </div>
            <div class={btnWrapperClasses}>
                <a 
                    class={downloadBtnClasses}
                    href={url}
                    download={filename}>
                    <span>Save to File</span>

                </a>
            </div>
            <Checkbox
                id="save-nsec"
                label="Saved Secret key"
                bind:checked={nsecSaved}
            />
        </div>
        <Button
            classes=""
            onClick={finalize}
            disabled={!nsecSaved || inProgress}
        >
            {#if inProgress}
                <ProgressRing color="white" />
            {:else}
                <i class="bx bx-log-in-circle"></i>
                Next
            {/if}
        </Button>
        <Button variant="outlined" classes="mt-2" onClick={handleBackToLogin}>
            <i class="bx bx-arrow-back"></i>
            Back to Login
        </Button>
    </div>
</div>
