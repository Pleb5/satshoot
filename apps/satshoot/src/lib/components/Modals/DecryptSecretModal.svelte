<script lang="ts">
    import { type SvelteComponent } from 'svelte';
    import { tick } from 'svelte';

    import { getModalStore } from '@skeletonlabs/skeleton';

    import { DataLoadError } from '$lib/utils/errors';
    import { RestoreMethod } from '$lib/stores/ndk';
    import { logout } from '$lib/utils/helpers';
    import Popup from '../UI/Popup.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';

    const modalStore = getModalStore();

    let passphrase: string = $state('');
    let statusMessage: string = $state('');
    let statusColor = $state('text-tertiary-200-700');

    let decrypting = $state(false);

    async function loadSecret() {
        decrypting = true;
        await tick();

        statusColor = 'text-tertiary-200-700';
        statusMessage = 'Decrypting...';
        try {
            let restoreMethod: RestoreMethod | undefined = undefined;
            const encryptedSeed: string | null = localStorage.getItem('nostr-seedwords');
            const encryptedNsec: string | null = localStorage.getItem('nostr-nsec');
            const salt: string | null = localStorage.getItem('nostr-npub');

            // Restore method depends on the local storage key(nostr-seedwords/nsec)
            if (encryptedSeed) {
                restoreMethod = RestoreMethod.Seed;
            } else if (encryptedNsec) {
                restoreMethod = RestoreMethod.Nsec;
            }

            if (!encryptedSeed && !encryptedNsec) {
                throw new DataLoadError(
                    'Could not fetch encrypted secret from local storage!',
                    'tried: nostr-seedwords, nostr-nsec'
                );
            }
            if (!salt) {
                throw new DataLoadError(
                    'Could not fetch npub from local storage! Npub necessary for decryption!',
                    'nostr-npub'
                );
            }

            const cryptWorker = new Worker(
                new URL('$lib/utils/crypto.worker.ts', import.meta.url),
                {
                    type: 'module',
                }
            );

            cryptWorker.onmessage = (m) => {
                const decryptedSecret = m.data['decryptedSecret'];
                decrypting = false;
                if (decryptedSecret) {
                    if ($modalStore[0].response) {
                        $modalStore[0].response({
                            decryptedSecret: decryptedSecret,
                            restoreMethod: restoreMethod,
                        });
                        modalStore.close();
                    }
                } else {
                    statusMessage = 'Unexpected response from decryption process:' + m.data;
                    setTimeout(() => {
                        statusColor = 'text-red-500';
                    }, 800);
                }
            };

            cryptWorker.onerror = (e) => {
                decrypting = false;
                console.log('Error happened in cryptWorker:', e.message);
                statusMessage = `Error while decrypting secret! Incorrect Passphrase!`;
                setTimeout(() => {
                    statusColor = 'text-red-500';
                }, 800);
            };

            cryptWorker.onmessageerror = (me) => {
                decrypting = false;
                console.log('Message error:', me);
                statusMessage = 'Received malformed message: ' + me.data;

                setTimeout(() => {
                    statusColor = 'text-red-500';
                }, 800);
            };

            // Start worker in background and wait for decryption result in onmessage
            cryptWorker.postMessage({
                encrpytedSecret: encryptedSeed ?? encryptedNsec,
                passphrase: passphrase,
                salt: salt,
            });
        } catch (e) {
            decrypting = false;
            if (e instanceof DataLoadError) {
                const error = e as DataLoadError;
                statusMessage = error.message;
            } else {
                statusMessage = 'Unkown Error happened:' + e;
            }
            setTimeout(() => {
                statusColor = 'text-red-500';
            }, 800);
        }
    }

    let showPassword: boolean = $state(false);
</script>

{#if $modalStore[0]}
    <Popup title="Decrypt Local Seed">
        <h4 class="h4 mt-2">Found Seed in browser local storage, provide passphrase to load it:</h4>
        <div class="flex justify-between items-center m-4">
            <input
                class="input"
                title="Passphrase:"
                required
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter Passphrase..."
                oninput={(event) => (passphrase = event.currentTarget.value)}
            />
            <button
                type="button"
                class="btn btn-icon-sm"
                onclick={() => (showPassword = !showPassword)}
            >
                <span>
                    <i class="fa-solid {showPassword ? 'fa-eye' : 'fa-eye-slash'}"></i>
                </span>
            </button>
        </div>
        <div class="flex justify-between h-10 mt-4">
            <Button
                variant="outlined"
                on:click={() => {
                    if ($modalStore[0].response) {
                        $modalStore[0].response({
                            decryptedSecret: undefined,
                            restoreMethod: undefined,
                        });
                    }
                    modalStore.close();
                    logout();
                }}
            >
                Logout
            </Button>
            <Button on:click={loadSecret} disabled={!passphrase || decrypting}>
                {#if decrypting}
                    <span>
                        <ProgressRing color="primary" />
                    </span>
                {:else}
                    <span>Decrypt</span>
                {/if}
            </Button>
        </div>
        {#if statusMessage}
            <h5 class="h5 font-bold text-center {statusColor} mt-2">{statusMessage}</h5>
        {/if}
    </Popup>
{/if}
