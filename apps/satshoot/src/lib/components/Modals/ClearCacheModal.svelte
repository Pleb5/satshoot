<script lang="ts">
    import ndk from '$lib/stores/ndk';
    import NDKCacheAdapterDexie from '@nostr-dev-kit/ndk-cache-dexie';

    import Dexie from 'dexie';
    import Button from '../UI/Buttons/Button.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { toaster } from '$lib/stores/toaster';

    interface Props {
        isOpen: boolean;
    }

    let { isOpen = $bindable() }: Props = $props();

    async function handleConfirm() {
        try {
            await Dexie.delete('satshoot-db');
            // Must reload to open a brand new DB
            location.href = location.pathname + '?v=' + new Date().getTime();
            setTimeout(() => {}, 3000);

            $ndk.cacheAdapter = new NDKCacheAdapterDexie({ dbName: 'satshoot-db' });

            isOpen = false;
            toaster.info({
                title: '\
                    <p class="text-center">Cache cleared!</p>\
                    <p>Refreshing page in 3 seconds...</p>\
                    ',
                duration: 3000,
            });
        } catch (e) {
            toaster.error({ title: 'Could not clear cache: ' + e });
        }
    }
</script>

<ModalWrapper bind:isOpen title="Clear local Cache?">
    <div class="w-full flex flex-col">
        <div class="w-full py-[10px] px-[5px]">
            <div class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[10px]">
                <div
                    class="w-full py-[5px] px-[10px] rounded-[6px] bg-orange-500 border-[2px] border-black-100 dark:border-white-100 flex flex-col justify-center items-center"
                >
                    <p class="font-[600] text-[16px] text-white">
                        This can solve some data loading problems but will slow down App until cache
                        is filled again
                    </p>
                </div>

                <div class="flex flex-row gap-[10px] p-[5px]">
                    <Button grow variant="outlined" onClick={() => (isOpen = false)}>Cancel</Button>
                    <Button grow onClick={handleConfirm}>
                        <i class="bx bx-trash"></i>
                        <span>Clear</span>
                    </Button>
                </div>
            </div>
        </div>
    </div>
</ModalWrapper>
