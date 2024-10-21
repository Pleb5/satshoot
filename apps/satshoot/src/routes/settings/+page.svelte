<script lang="ts">
import ndk, { sessionPK } from '$lib/stores/ndk';
import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';
import {
    getToastStore,
    getModalStore,
    LightSwitch,
    type ModalSettings 
} from '@skeletonlabs/skeleton';
import type { ToastSettings } from '@skeletonlabs/skeleton';
import { clipboard } from '@skeletonlabs/skeleton';
import Dexie from 'dexie';
import { onDestroy } from 'svelte';
import { nsecEncode } from "nostr-tools/nip19"
import { hexToBytes } from '@noble/ciphers/utils';
import TrashIcon from '$lib/components/Icons/TrashIcon.svelte';
import EyeIcon from '$lib/components/Icons/EyeIcon.svelte';
import QuestionIcon from '$lib/components/Icons/QuestionIcon.svelte';
import { useSatShootWoT } from '$lib/stores/wot';


const modalStore = getModalStore();
const toastStore = getToastStore();

let nsec = '';
let showing = false;

let baseClasses = "grid grid-cols-[auto_1fr_auto]"
                + " items-center gap-y-4 my-4 w-[70vw] md:w-[40vw]";

let wotTooltip = "<div>"
                + "Add trusted people from SatShoot nostr account to your Web of Trust. "
                + "This helps users with low number of follows to have a broader "
                + "view of the network but <strong>you still need to get people to follow "
                + "You to BE seen by OTHERS</strong>. And of course, you trust "
                + "people that SatShoot trusts which has tradeoffs."
                + "</div>";

async function clearCache() {
    let clearCacheResponse = async function(r: boolean){
        if (r) {
            try {
                await Dexie.delete('satshoot-db');
                // Must reload to open a brand new DB
                const t: ToastSettings = {
                    message: '\
                                <p class="text-center">Cache cleared!</p>\
                                <p>Refreshing page in 4 seconds...</p>\
                    ',
                    timeout: 4000,
                    background: 'bg-primary-300-600-token',
                };
                setTimeout(
                    ()=>{window.location.reload();},
                    4000,
                );
                
                $ndk.cacheAdapter = new NDKCacheAdapterDexie({ dbName: 'satshoot-db' });

                toastStore.trigger(t);
            } catch (e) {
                const t: ToastSettings = {
                    message: 'Could not clear cache: ' + e,
                    timeout: 7000,
                    background: 'bg-error-300-600-token',
                };
                toastStore.trigger(t);
            }
        }
    }

    const modal: ModalSettings = {
        type: 'confirm',
        title: `<p class='text-center'>Clear local Cache?</p>`,
        body: `
            <p>
                This can solve some data loading problems but will slow down App
                until cache is filled again
            </p>
        `,
        response: clearCacheResponse,
    };
    modalStore.trigger(modal);

}

function showPrivateKey() {
    showing = !showing;
    if ($sessionPK) {
        nsec = nsecEncode(hexToBytes($sessionPK));
    }
}

let copiedNsec = false;
function onCopyNsec(): void {
    copiedNsec = true;
    setTimeout(() => {
        copiedNsec = false;
    }, 1000);
}

onDestroy(() => {
    nsec = '';
});

</script>
<div class="flex flex-col items-center">
    <div class="{baseClasses}">
        <div class="bg-primary-300-600-token col-start-2 flex justify-center
            gap-x-2 items-center mb-8 p-4 rounded-xl"
        >
            <LightSwitch />
            <span>Theme</span>
        </div>

        <button 
            class="btn bg-primary-300-600-token col-start-2"
            type="button"
            on:click={ clearCache }
        >
            <div class="flex gap-x-2 justify-between">
                <TrashIcon />
                <div>Clear Cache</div>
            </div>
        </button>

        {#if $sessionPK}
            <div class="col-start-2 flex flex-col items-center gap-y-2">
                <button
                    class="btn bg-primary-300-600-token w-full"
                    type="button"
                    on:click={ showPrivateKey }
                >
                    <div class="flex justify-center gap-x-2">
                        <EyeIcon show={showing} />
                    </div>
                    <div>
                        Show Private key (nsec)
                    </div>
                </button>
                {#if nsec && showing}
                    <div class="flex flex-col items-center gap-y-4">
                        <div class="font-bold">
                            {
                            nsec.substring(0,10)
                                + '...'
                                + nsec.substring(nsec.length - 11, nsec.length - 1)
                            }
                        </div>
                        <button
                            class="btn text-sm btn-sm bg-red-500 font-bold"
                            use:clipboard={nsec}
                            on:click={onCopyNsec}
                        >
                            {copiedNsec ? 'Copied!' : 'Dangerously Copy'}
                        </button>
                    </div>
                {/if}
            </div>
        {/if}
        <div class="col-start-2 w-full bg-primary-300-600-token p-4 rounded-xl flex items-center justify-center space-x-2">
            <label class="col-start-2 flex items-center space-x-2">
                <input type="checkbox" class="checkbox" bind:checked={$useSatShootWoT} />
                <p>Attach SatShoot Web of Trust</p>
            </label>
            <QuestionIcon 
                extraClasses = "text-2xl [&>*]:pointer-events-none"
                triggerEvent = 'click'
                placement = 'top'
                popUpText = {wotTooltip}
            />
        </div>
    </div>
</div>
