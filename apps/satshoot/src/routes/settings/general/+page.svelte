<script lang="ts">
    import { browser } from '$app/environment';
    import EyeIcon from '$lib/components/Icons/EyeIcon.svelte';
    import QuestionIcon from '$lib/components/Icons/QuestionIcon.svelte';
    import ClearCacheModal from '$lib/components/Modals/ClearCacheModal.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import LightSwitch from '$lib/components/UI/Inputs/LightSwitch.svelte';
    import { sessionPK } from '$lib/stores/session';
    import browserNotificationsEnabled from '$lib/stores/notifications';
    import { toaster } from '$lib/stores/toaster';
    import { useSatShootWoT } from '$lib/stores/wot';
    import { hexToBytes } from '@noble/ciphers/utils';

    import { nsecEncode } from 'nostr-tools/nip19';
    import { UserMode, userMode } from '$lib/stores/user';

    let showClearCacheModal = $state(false);
    let nsec = $state('');
    let showing = $state(false);
    let copiedNsec = $state(false);

    async function clearCache() {
        showClearCacheModal = true;
    }

    let browserNotifsToastTriggered = false;
    $effect(() => {
        if (browser && Number($browserNotificationsEnabled) >= 0) {
            // If there is no permission for notifications yet, ask for it
            // If it is denied then return and turn notifications off
            if (Notification.permission !== 'granted') {
                Notification.requestPermission().then((permission: NotificationPermission) => {
                    if (permission !== 'granted') {
                        browserNotificationsEnabled.set(false);
                        if (!browserNotifsToastTriggered) {
                            browserNotifsToastTriggered = true;
                            toaster.info({
                                title: 'Notifications Settings are Disabled in the Browser!',
                                description:
                                'Click small icon left of browser search bar to enable this setting!',
                                duration: 60000, // 1 min
                            });
                        }
                    }
                    // User enabled notification settings, set user choice in local storage too
                    browserNotificationsEnabled.set($browserNotificationsEnabled);
                });
            }
        }
    });

    function showPrivateKey() {
        showing = !showing;
        if ($sessionPK) {
            nsec = nsecEncode(hexToBytes($sessionPK));
        }
    }

    function onCopyNsec(): void {
        navigator.clipboard.writeText(nsec).then(() => {
            copiedNsec = true;
            setTimeout(() => {
                copiedNsec = false;
            }, 1000);
        });
    }

    let wotTooltip =
        '<div>' +
        'Add trusted people from SatShoot nostr account to your Web of Trust. ' +
        'This helps users with low number of follows to have a broader ' +
        'view of the network but <strong>you still need to get people to follow ' +
        'You to BE seen by OTHERS</strong>. And of course, you trust ' +
        'people that SatShoot trusts which has tradeoffs.' +
        '</div>';
</script>

<div class="w-full flex flex-col gap-[15px] overflow-y-auto">
    <div class="w-full flex flex-col gap-[15px] p-2">
        <div class="w-full flex flex-row gap-[10px] items-center pt-[5px] pr-[5px]">
            <label class="grow-1 font-[500]" for="toggle-dark-mode"> Theme </label>

            <LightSwitch />
        </div>
        <div class="w-full flex flex-row gap-[10px] items-center">
            <label class="grow-1 font-[500]" for="user-mode-switch">User Mode</label>
            <div
                class="flex flex-row outline-[1px] outline-black-100 dark:outline-white-100 rounded-[6px]"
            >
                <Button
                    variant={$userMode === UserMode.Freelancer ? 'contained' : 'text'}
                    onClick={() => ($userMode = UserMode.Freelancer)}
                    classes="grow "
                >
                    Freelancer
                </Button>
                <Button
                    variant={$userMode === UserMode.Client ? 'contained' : 'text'}
                    onClick={() => ($userMode = UserMode.Client)}
                    classes="grow "
                >
                    Client
                </Button>
            </div>
        </div>
        <div class="w-full flex flex-row gap-[10px] items-center">
            <label class="grow-1 font-[500]" for="clear-cache-btn">Cache</label>
            <Button onClick={clearCache}>Clear Cache</Button>
        </div>
        <div class="w-full flex flex-row gap-[10px] items-center">
            <div class="flex flex-row gap-2 grow-1">
                <label class="font-[500]" for="attach-satshoot-wot">
                    Attach SatShoot Web of Trust
                </label>
                <QuestionIcon
                    extraClasses="w-6 h-6 text-lg *:pointer-events-none text-center"
                    placement="top"
                    popUpText={wotTooltip}
                />
            </div>

            <div class="flex flex-row justify-center items-center relative">
                <input
                    id="attach-satshoot-wot"
                    type="checkbox"
                    class="appearance-none h-[20px] w-[20px] border-[1px] border-black-200 dark:border-white-200 rounded-[4px] checked:bg-blue-500 checked:border-white peer"
                    bind:checked={$useSatShootWoT}
                />
                <i
                    class="bx bx-check hidden peer-checked:block absolute pointer-events-none text-white"
                ></i>
            </div>
        </div>
        <div class="w-full flex flex-row gap-[10px] items-center">
            <div class="flex flex-row gap-[5px] grow-1">
                <label class="font-[500]" for="browser-notifications-enabled">
                    Browser Notifications
                </label>
            </div>
            <div class="flex flex-row justify-center items-center relative">
                <input
                    id="browser-notifications-enabled"
                    type="checkbox"
                    class="appearance-none h-[20px] w-[20px] border-[1px] border-black-200 dark:border-white-200 rounded-[4px] checked:bg-blue-500 checked:border-white peer"
                    bind:checked={$browserNotificationsEnabled}
                />
            </div>
        </div>
        {#if $sessionPK}
            <div class="w-full flex flex-col gap-[10px] items-center">
                <button
                    class="w-full flex justify-center items-center gap-[10px] bg-blue-500 text-white font-[500] py-[8px] px-[16px] rounded-[4px] hover:bg-blue-600 transition-colors"
                    type="button"
                    onclick={showPrivateKey}
                >
                    <EyeIcon show={showing} />
                    <span>Show Private Key (nsec)</span>
                </button>
                {#if nsec && showing}
                    <div class="w-full flex flex-col gap-[10px] items-center">
                        <div class="font-[500]">
                            {nsec.substring(0, 10) +
                                '...' +
                                nsec.substring(nsec.length - 11, nsec.length - 1)}
                        </div>
                        <Button
                            classes="bg-red-500 hover:bg-red-600 transition-colors"
                            onClick={onCopyNsec}
                        >
                            <span class="w-full h-full">
                                {copiedNsec ? 'Copied!' : 'Dangerously Copy'}
                            </span>
                        </Button>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>

<ClearCacheModal bind:isOpen={showClearCacheModal} />
