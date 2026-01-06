<script lang="ts">
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import ndk, { BLACKLISTED_RELAYS, discoveredRelays as sessionDiscoveredRelays } from '$lib/stores/session';
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
    let fetchedUsers = $state(0);
    let totalUsers = $state(0);
    let currentBatch = $state(0);
    let totalBatches = $state(0);

    const steps = [
        '1/2: Fetching relay lists from your Web of Trust...',
        '2/2: Adding optimal relays to pool...',
    ];

    async function startDiscovery() {
        isRunning = true;
        currentStep = 0;

        try {
            // Step 1: Fetch relay lists from WoT
            currentStep = 1;

            const wotPubkeys = Array.from($wot);

            if (wotPubkeys.length === 0) {
                throw new Error('No pubkeys in Web of Trust');
            }

            totalUsers = wotPubkeys.length;

            const relayUrls = await calculateRelaySet(wotPubkeys, $ndk, (progress) => {
                fetchedUsers = progress.fetchedUsers;
                currentBatch = progress.currentBatch;
                totalBatches = progress.totalBatches;
            });
            console.log('relayUrls', relayUrls);

            const sanitizedRelays = relayUrls
                .map((relay) => relay.trim())
                .filter((relay) => relay.length > 0)
                .filter((relay) => !BLACKLISTED_RELAYS.has(relay));

            // Save top 5 relays to session storage
            sessionDiscoveredRelays.set(sanitizedRelays.slice(0, 5));

            // Step 2: Add relays to pool
            currentStep = 2;
            await addRelaysToPool(sanitizedRelays);

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

    async function addRelaysToPool(relayUrls: WebSocket['url'][]) {
        console.log(`Adding ${relayUrls.length} optimal relays to pool...`);
        discoveredRelays = relayUrls.length;

        // Add relays to the pool
        for (const relayUrl of relayUrls) {
            if (BLACKLISTED_RELAYS.has(relayUrl.trim())) continue;
            $ndk.addExplicitRelay(relayUrl, undefined, true);
        }

        // Small delay to show step completion
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    function resetModal() {
        currentStep = 0;
        isRunning = false;
        discoveredRelays = 0;
        fetchedUsers = 0;
        totalUsers = 0;
        currentBatch = 0;
        totalBatches = 0;
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

                {#if currentStep === 1 && totalUsers > 0}
                    <p class="text-sm text-center text-surface-600 dark:text-surface-400">
                        Batch {currentBatch}/{totalBatches} • Found relays for {fetchedUsers}/{totalUsers}
                        users
                    </p>
                {/if}

                {#if discoveredRelays > 0 && currentStep === 2}
                    <p class="text-sm text-center text-surface-600 dark:text-surface-400">
                        Adding {discoveredRelays} optimal relays
                    </p>
                {/if}
            </div>
        {/if}

        {#if !isRunning}
            <Button variant="outlined" onClick={handleClose}>Close</Button>
        {/if}
    </div>
</ModalWrapper>
