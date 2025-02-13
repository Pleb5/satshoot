<script lang="ts">
    import EyeIcon from '$lib/components/Icons/EyeIcon.svelte';
    import QuestionIcon from '$lib/components/Icons/QuestionIcon.svelte';
    import ClearCacheModal from '$lib/components/Modals/ClearCacheModal.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import { sessionPK } from '$lib/stores/ndk';
    import { useSatShootWoT } from '$lib/stores/wot';
    import { hexToBytes } from '@noble/ciphers/utils';
    import {
        clipboard,
        getModalStore,
        LightSwitch,
        type ModalSettings,
    } from '@skeletonlabs/skeleton';
    import { nsecEncode } from 'nostr-tools/nip19';

    const modalStore = getModalStore();

    let nsec = '';
    let showing = false;
    let copiedNsec = false;

    async function clearCache() {
        const modal: ModalSettings = {
            type: 'component',
            component: { ref: ClearCacheModal },
        };
        modalStore.trigger(modal);
    }

    function showPrivateKey() {
        showing = !showing;
        if ($sessionPK) {
            nsec = nsecEncode(hexToBytes($sessionPK));
        }
    }

    function onCopyNsec(): void {
        copiedNsec = true;
        setTimeout(() => {
            copiedNsec = false;
        }, 1000);
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
    <div class="w-full flex flex-col gap-[15px]">
        <div class="w-full flex flex-row gap-[10px] items-center">
            <label class="grow-[1] font-[500]" for="toggle-dark-mode"> Dark Mode </label>
            <LightSwitch
                bgLight="bg-black-100"
                bgDark="bg-white-100"
                fillLight="fill-blue-500"
                width="w-16"
                height="h-8"
            />
        </div>
        <div class="w-full flex flex-row gap-[10px] items-center">
            <label class="grow-[1] font-[500]" for="clear-cache-btn">Cache</label>
            <Button on:click={clearCache}>Clear Cache</Button>
        </div>
        <div class="w-full flex flex-row gap-[10px] items-center">
            <div class="flex flex-row gap-[5px] grow-[1]">
                <label class="font-[500]" for="attach-satshoot-wot">
                    Attach SatShoot Web of Trust
                </label>
                <QuestionIcon
                    extraClasses="text-2xl [&>*]:pointer-events-none"
                    triggerEvent="click"
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
                />
            </div>
        </div>
        {#if $sessionPK}
            <div class="w-full flex flex-col gap-[10px] items-center">
                <button
                    class="w-full flex justify-center items-center gap-[10px] bg-blue-500 text-white font-[500] py-[8px] px-[16px] rounded-[4px] hover:bg-blue-600 transition-colors"
                    type="button"
                    on:click={showPrivateKey}
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
                            on:click={onCopyNsec}
                            classes="bg-red-500 hover:bg-red-600 transition-colors"
                        >
                            <span use:clipboard={nsec}>
                                {copiedNsec ? 'Copied!' : 'Dangerously Copy'}
                            </span>
                        </Button>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>
