<script lang="ts">
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ndk, { discoveredRelays as sessionDiscoveredRelays } from '$lib/stores/session';
    import { wot } from '$lib/stores/wot';
    import { toaster } from '$lib/stores/toaster';
    import { calculateRelaySet } from '$lib/utils/outboxRelays';
    interface Props {
        isOpen: boolean;
    }

    let { isOpen = $bindable() }: Props = $props();

    let currentStep = $state(0);
    let isRunning = $state(false);
    let discoveredRelays = $state(0);

    const steps = [
        '1/3: Calculating relay set...',
        '2/3: Connecting to relays...',
        '3/3: Fetching all events...',
    ];

    async function startDiscovery() {
        isRunning = true;
        currentStep = 0;

        try {
            // Step 1: Calculate relay set
            currentStep = 1;

            const wotPubkeys = Array.from($wot);

            if (wotPubkeys.length === 0) {
                throw new Error('No pubkeys in Web of Trust');
            }
            const relayUrls = await calculateRelaySet(wotPubkeys, $ndk);
            console.log('relayUrls', relayUrls);

            // Save top 5 relays to session storage
            sessionDiscoveredRelays.set(relayUrls.slice(0, 5));

            // Step 2: Connect to relays
            currentStep = 2;
            await connectToRelays(relayUrls);

            // Step 3: Fetch events
            currentStep = 3;
            // Give already opened subscriptions time to fetch events
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // Success!
            toaster.create({
                title: 'Decentralized discovery complete!',
                type: 'success',
                duration: 3000,
            });

            // Close modal after short delay
            setTimeout(() => {
                isOpen = false;
                resetModal();
            }, 1000);
        } catch (error) {
            console.error('Decentralized discovery error:', error);
            toaster.create({
                title: 'Discovery failed',
                description: error instanceof Error ? error.message : 'Unknown error',
                type: 'error',
                duration: 5000,
            });
            isRunning = false;
        }
    }

    async function connectToRelays(relayUrls: WebSocket['url'][]) {
        console.log(`Connecting to ${relayUrls.length} optimal relays...`);
        discoveredRelays = relayUrls.length;

        // Use temporary relays - they won't be permanently added to the pool
        for (const relayUrl of relayUrls) {
            // const relay = new NDKRelay(relayUrl, undefined, $ndk);
            // $ndk.pool.useTemporaryRelay(relay);
            $ndk.addExplicitRelay(relayUrl, undefined, true);
        }

        // Give relays time to connect
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    function resetModal() {
        currentStep = 0;
        isRunning = false;
        discoveredRelays = 0;
    }

    function handleClose() {
        if (!isRunning) {
            isOpen = false;
            resetModal();
        }
    }
</script>

<ModalWrapper bind:isOpen title="Decentralized Discovery">
    <div class="w-full flex flex-col gap-4 p-4">
        {#if !isRunning && currentStep === 0}
            <div class="flex flex-col gap-4">
                <p class="text-sm">
                    This will discover optimal relays from your Web of Trust and fetch all relevant
                    events directly from them.
                </p>
                <p class="text-sm text-surface-600 dark:text-surface-400">
                    This process may take a minute or two depending on your network size.
                </p>
                <Button onClick={startDiscovery}>Start Discovery</Button>
            </div>
        {:else}
            <div class="flex flex-col gap-4 items-center">
                <div class="flex flex-col gap-2 w-full">
                    {#each steps as step, index}
                        <div
                            class="flex items-center gap-2 p-2 rounded {currentStep > index + 1
                                ? 'text-success-500'
                                : currentStep === index + 1
                                  ? 'text-primary-500 font-semibold'
                                  : 'text-surface-400'}"
                        >
                            {#if currentStep > index + 1}
                                <i class="bx bx-check-circle text-xl"></i>
                            {:else if currentStep === index + 1}
                                <i class="bx bx-loader-circle bx-spin text-xl"></i>
                            {:else}
                                <i class="bx bx-circle text-xl"></i>
                            {/if}
                            <span>{step}</span>
                        </div>
                    {/each}
                </div>

                {#if discoveredRelays > 0 && currentStep >= 2}
                    <p class="text-sm text-center text-surface-600 dark:text-surface-400">
                        Using {discoveredRelays} optimal relays
                    </p>
                {/if}
            </div>
        {/if}

        {#if !isRunning}
            <Button variant="outlined" onClick={handleClose}>Close</Button>
        {/if}
    </div>
</ModalWrapper>
