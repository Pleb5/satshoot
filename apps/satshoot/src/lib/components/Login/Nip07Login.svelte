<script lang="ts">
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { redirectAfterLogin } from '$lib/stores/gui';
    import ndk, { LoginMethod } from '$lib/stores/session';
    import { loginMethod, UserMode, userMode } from '$lib/stores/user';
    import { initializeUser } from '$lib/utils/helpers';
    import { NDKNip07Signer } from '@nostr-dev-kit/ndk';

    import { tick } from 'svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import { toaster } from '$lib/stores/toaster';

    interface Props {
        isOpen: boolean;
    }

    let { isOpen = $bindable() }: Props = $props();

    let askingForNip07Permission = $state(false);

    async function nip07Login() {
        if (browser && window.nostr) {
            const nip07Signer = new NDKNip07Signer();

            try {
                await tick();

                askingForNip07Permission = true;

                const returnedUser = await nip07Signer.blockUntilReady();

                if (returnedUser.npub) {
                    loginMethod.set(LoginMethod.Nip07);
                    $ndk.signer = nip07Signer;
                    initializeUser($ndk);
                    handleRedirection();
                    askingForNip07Permission = false;
                    isOpen = false;
                }
            } catch (e) {
                askingForNip07Permission = false;
                toaster.error({
                    title: 'Browser extension rejected access!',
                    duration: 60000, // 1 min
                });
            }
        } else if (!window.nostr) {
            toaster.error({
                title: 'No Compatible Extension!',
                description:
                    'No nip07-compatible browser extension found! See Alby, nos2x or similar!',
            });
        }
    }

    function handleRedirection() {
        // redirect to jobs page
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
        'w-full flex flex-row bg-black-50 dark:bg-white-50 border-[1px] border-black-100 dark:border-white-100 rounded-tr-[6px] rounded-b-[6px] p-[5px] overflow-hidden';
</script>

<div
    class="rounded-[6px] bg-black-50 dark:bg-white-50 border-[2px] border-black-100 dark:border-white-100"
>
    <p class="w-full px-[10px] py-[5px]">
        Browser extensions can communicate fairly securely with any website locally in your browser.
        Connection to them is much more stable than Bunkers. However, extensions have access to any
        sensitive data you might load on any website.
    </p>
</div>

<div class="w-full flex flex-col">
    <div class="w-full flex flex-row items-center gap-[5px]">
        <p class={labelClasses}>Extension</p>
    </div>
    <div class={btnWrapperClasses}>
        <Button grow disabled={askingForNip07Permission} onClick={nip07Login}>
            {#if askingForNip07Permission}
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
