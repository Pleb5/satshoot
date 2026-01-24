<script lang="ts">
    import { get } from 'svelte/store';
    import { NDKKind, profileFromEvent } from '@nostr-dev-kit/ndk';
    import ndk from '$lib/stores/session';
    import { toaster } from '$lib/stores/toaster';
    import { fetchEventFromRelaysFirst, insertThousandSeparator } from '$lib/utils/misc';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import UserProfile from '../UI/Display/UserProfile.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    interface Props {
        isOpen: boolean;
        payeePubkey: string;
        amount: number;
        paymentMethod: 'LN' | 'Cashu';
        onConfirm: (lightningAddress?: string) => Promise<void>; // Callback function to invoke on confirmation
    }

    let {
        isOpen = $bindable(),
        payeePubkey = $bindable(),
        amount = $bindable(),
        paymentMethod = $bindable('LN'),
        onConfirm = $bindable(),
    }: Props = $props();

    let lightningAddress = $state('');
    let defaultLightningAddress = $state('');
    let hasManualLightningAddress = $state(false);

    $effect(() => {
        if (!isOpen || !payeePubkey || paymentMethod !== 'LN') return;
        hasManualLightningAddress = false;
        fetchLightningAddress();
    });

    async function fetchLightningAddress() {
        const ndkInstance = get(ndk);

        const metadataFilter = {
            kinds: [NDKKind.Metadata],
            authors: [payeePubkey],
        };

        const metadataRelays = [
            ...ndkInstance.outboxPool!.connectedRelays(),
            ...ndkInstance.pool!.connectedRelays(),
        ];

        const metadataEvent = await fetchEventFromRelaysFirst(ndkInstance, metadataFilter, {
            relayTimeoutMS: 5000,
            fallbackToCache: false,
            explicitRelays: metadataRelays,
        });

        const profile = metadataEvent ? profileFromEvent(metadataEvent) : null;
        defaultLightningAddress = profile?.lud16 || profile?.lud06 || '';

        if (!hasManualLightningAddress) {
            lightningAddress = defaultLightningAddress;
        }
    }

    function handleLightningAddressInput() {
        hasManualLightningAddress = true;
    }

    async function handleConfirm() {
        try {
            isOpen = false;
            const trimmedAddress = lightningAddress.trim();
            await onConfirm(trimmedAddress ? trimmedAddress : undefined); // Invoke the parent's callback function
        } catch (e) {
            toaster.error({
                title: 'Error: ' + e,
            });
        }
    }
</script>

<ModalWrapper bind:isOpen title="Confirm Payment">
    <div class="w-full flex flex-col gap-[15px]">
        <div class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[10px] mt-[10px]">
            <div
                class="w-full py-[5px] px-[10px] rounded-[6px] border-[2px] border-black-100 dark:border-white-100 flex flex-col justify-center items-center"
            >
                <p class="lg:text-[28px] text-[22px]">
                    You are about to pay
                    <span class="font-bold">{insertThousandSeparator(amount)} sats </span> to
                    {#if payeePubkey}
                        <UserProfile pubkey={payeePubkey} showLNAddress={paymentMethod !== 'LN'} />
                    {/if}
                </p>
            </div>
            {#if paymentMethod === 'LN'}
                <div class="w-full flex flex-col gap-[5px]">
                    <label class="font-[500]" for="lightning-address">Lightning address</label>
                    <Input
                        id="lightning-address"
                        placeholder={defaultLightningAddress || 'name@domain'}
                        bind:value={lightningAddress}
                        onInput={handleLightningAddressInput}
                        fullWidth
                    />
                </div>
            {/if}
        </div>

        <div class="w-full flex items-center justify-center gap-[10px]">
            <Button grow variant="outlined" onClick={() => (isOpen = false)}>Cancel</Button>
            <Button grow onClick={handleConfirm}>Confirm</Button>
        </div>
    </div>
</ModalWrapper>
