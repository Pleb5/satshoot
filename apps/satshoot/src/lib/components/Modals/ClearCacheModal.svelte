<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';
    import { getModalStore, getToastStore, type ToastSettings } from '@skeletonlabs/skeleton';
    import Dexie from 'dexie';
    import Button from '../UI/Buttons/Button.svelte';
    import Popup from '../UI/Popup.svelte';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    async function handleConfirm() {
        try {
            await Dexie.delete('satshoot-db');
            // Must reload to open a brand new DB
            location.href = location.pathname + '?v=' + new Date().getTime();
            const t: ToastSettings = {
                message:
                    '\
                    <p class="text-center">Cache cleared!</p>\
                    <p>Refreshing page in 3 seconds...</p>\
                    ',
                timeout: 3000,
                background: 'bg-primary-300-600-token',
            };
            setTimeout(() => {
            }, 3000);

            $ndk.cacheAdapter = new NDKCacheAdapterDexie({ dbName: 'satshoot-db' });

            modalStore.clear();
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
</script>

{#if $modalStore[0]}
    <Popup title="Clear local Cache?">
        <div class="w-full flex flex-col">
            <div class="w-full py-[10px] px-[5px]">
                <div class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[10px]">
                    <div
                        class="w-full py-[5px] px-[10px] rounded-[6px] bg-orange-500 border-[2px] border-black-100 dark:border-white-100 flex flex-col justify-center items-center"
                    >
                        <p class="font-[600] text-[16px] text-white">
                            This can solve some data loading problems but will slow down App until
                            cache is filled again
                        </p>
                    </div>

                    <div class="flex flex-row gap-[10px] p-[5px]">
                        <Button grow variant="outlined" on:click={() => modalStore.close()}>
                            Cancel
                        </Button>
                        <Button grow on:click={handleConfirm}>
                            <i class="bx bx-trash" />
                            <span>Clear</span>
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    </Popup>
{/if}
