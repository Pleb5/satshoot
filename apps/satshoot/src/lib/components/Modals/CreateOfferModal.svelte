<script lang="ts">
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import { OfferEvent, OfferStatus, Pricing } from '$lib/events/OfferEvent';
    import { TicketEvent } from '$lib/events/TicketEvent';
    import { onMount } from 'svelte';
    import ndk from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import { NDKEvent, NDKKind, type NDKSigner } from '@nostr-dev-kit/ndk';
    import { ProfilePageTabs, profileTabStore } from '$lib/stores/tab-store';
    import { goto } from '$app/navigation';
    import { wallet } from '$lib/wallet/wallet';
    import { insertThousandSeparator } from '$lib/utils/misc';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { toaster } from '$lib/stores/toaster';

    interface Props {
        isOpen: boolean;
        ticket: TicketEvent;
        offerToEdit?: OfferEvent | undefined;
    }

    let { isOpen = $bindable(), ticket, offerToEdit = undefined }: Props = $props();

    const ticketAddress = ticket.ticketAddress;

    let validPledgePercent = $state(true);
    let pricingMethod: Pricing = $state(Pricing.Absolute);
    let amount = $state(0);
    let pledgeSplit = $state(0);

    let pledgedShare = $derived(Math.floor(amount * (pledgeSplit / 100)));
    let freelancerShare = $derived(amount - pledgedShare);

    let description = $state('');
    let sendDm = $state(true);

    let errorText = $state('');
    let posting = $state(false);

    $effect(() => {
        if (pledgeSplit >= 0 && pledgeSplit <= 100) {
            validPledgePercent = true;
            errorText = '';
        } else {
            validPledgePercent = false;
            errorText = 'Set a valid Pledge Split percent!';
        }
    });

    onMount(() => {
        if (offerToEdit) {
            pricingMethod = offerToEdit.pricing;
            amount = offerToEdit.amount;
            pledgeSplit = offerToEdit.pledgeSplit;
            description = offerToEdit.description;
        }
    });

    async function postOffer() {
        if (!validate()) {
            return;
        }
        posting = true;
        const offer = new OfferEvent($ndk);

        offer.pricing = pricingMethod;
        offer.amount = amount;
        offer.setPledgeSplit(pledgeSplit, $currentUser!.pubkey);
        offer.description = description;

        offer.referencedTicketAddress = ticketAddress as string;

        // Only generate new d-tag if we are not editing an existing one
        if (!offerToEdit) {
            // generate unique d-tag
            offer.generateTags();
        } else {
            offer.removeTag('d');
            offer.tags.push(['d', offerToEdit.tagValue('d') as string]);
        }

        try {
            console.log('offer', offer);
            const relaysPublished = await offer.publish();

            if (sendDm) {
                const dm = new NDKEvent($ndk);
                dm.kind = NDKKind.EncryptedDirectMessage;
                dm.tags.push(['t', ticketAddress!]);
                const ticketHolder = ticket.pubkey;
                const ticketHolderUser = $ndk.getUser({ pubkey: ticketHolder });

                if (!ticketHolder || !ticketHolderUser) {
                    throw new Error('Could not identify Ticket Holder, sending DM failed!');
                }

                dm.tags.push(['p', ticketHolder]);

                const content =
                    `SatShoot Offer update on Ticket: ${ticket.title} | \n\n` +
                    `Amount: ${offer.amount}${offer.pricing === Pricing.Absolute ? 'sats' : 'sats/min'} | \n` +
                    `Description: ${offer.description}`;
                dm.content = await ($ndk.signer as NDKSigner).encrypt(ticketHolderUser, content);

                await dm.publish();
            }

            posting = false;

            toaster.success({ title: 'Offer Posted!' });

            if (!$currentUser?.profile?.lud16) {
                console.log($currentUser?.profile);

                toaster.warning({
                    title: 'Set up an LN Address to receive payments!',
                    action: {
                        label: 'Go to Profile',
                        onClick: () => goto('/' + $currentUser!.npub),
                    },
                });
            }

            if ($currentUser && !$wallet) {
                toaster.warning({
                    title: 'Set up a Nostr Wallet to receive payments in ecash tokens!',
                    action: {
                        label: 'Go to Wallet',
                        onClick: () => goto('/my-cashu-wallet'),
                    },
                });
            }

            isOpen = false;

            $profileTabStore = ProfilePageTabs.Offers;
            goto('/' + $currentUser?.npub + '/');
        } catch (e) {
            posting = false;
            const errorMessage = 'Error happened while publishing Offer:' + e;

            toaster.error({
                title: errorMessage,
            });
        }
    }

    function validate(): boolean {
        let valid = true;
        errorText = '';
        if (amount < 0) {
            valid = false;
            errorText = 'Amount below 0!';
        } else if (amount > 100_000_000) {
            valid = false;
            errorText = 'Amount cannot exceed 100M sats!';
        } else if (pledgeSplit < 0) {
            valid = false;
            errorText = 'Pledge split below 0!';
        } else if (pledgeSplit > 100) {
            valid = false;
            errorText = 'Pledge split above 100% !';
        }
        return valid;
    }

    const selectInputClasses =
        'w-full px-[10px] py-[5px] bg-black-50 focus:bg-black-100 rounded-[6px] ' +
        'border-[2px] border-black-100 dark:border-white-100 focus:border-blue-500 focus:outline-[0px]';

    const selectOptionClasses =
        'bg-white dark:bg-brightGray transition-all ease duration-[0.2s] w-[100%] rounded-[4px] px-[8px] py-[4px] hover:bg-blue-500 hover:text-white';
</script>

<ModalWrapper bind:isOpen title="Create Offer">
    <div class="w-full flex flex-col gap-[15px]">
        <div
            class="w-full flex flex-col gap-[5px] rounded-[6px] border-[1px] border-black-200 dark:border-white-200"
        >
            <div class="w-full flex flex-col gap-[10px] p-[10px]">
                <div class="flex flex-col gap-[5px] grow-1">
                    <div class="">
                        <label class="font-[600]" for=""> Pricing method </label>
                    </div>
                    <div class="w-full flex flex-row items-center">
                        <select class={selectInputClasses} bind:value={pricingMethod}>
                            <option value={Pricing.Absolute} class={selectOptionClasses}>
                                Absolute Price(sats)
                            </option>
                            <option value={Pricing.SatsPerMin} class={selectOptionClasses}>
                                Time-based Price(sats/minute)
                            </option>
                        </select>
                    </div>
                </div>
                <div class="flex flex-col gap-[5px] grow-1">
                    <div class="">
                        <label class="font-[600]" for="">
                            Price({pricingMethod ? 'sats/min' : 'sats'})
                        </label>
                    </div>
                    <div class="w-full flex flex-row items-center">
                        <Input
                            type="number"
                            step="1"
                            min="0"
                            max="100_000_000"
                            placeholder="Amount"
                            bind:value={amount}
                            fullWidth
                        />
                    </div>
                </div>
                <div class="flex flex-col gap-[5px] grow-1">
                    <div class="">
                        <label class="font-[600]" for=""> Pledge split </label>
                    </div>
                    <div class="w-full flex flex-row items-center relative">
                        <Input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            placeholder="Percentage"
                            bind:value={pledgeSplit}
                            fullWidth
                        />
                        <span
                            class="absolute top-1/2 right-[40px] transform -translate-y-1/2 text-black-500 dark:text-white-500 pointer-events-none"
                        >
                            %
                        </span>
                    </div>
                </div>
            </div>
            <div
                class="w-full flex flex-row gap-[15px] flex-wrap p-[10px] border-t-[1px] border-t-black-200"
            >
                <div class="grow-1">
                    <p class="font-[500]">
                        You'd get:
                        <span class="font-[400]">
                            {insertThousandSeparator(freelancerShare) +
                                (pricingMethod ? 'sats/min' : 'sats')}
                        </span>
                    </p>
                </div>
                <div class="grow-1">
                    <p class="font-[500]">
                        Your pledge:
                        <span class="font-[400]">
                            {insertThousandSeparator(pledgedShare) +
                                (pricingMethod ? 'sats/min' : 'sats')}
                        </span>
                    </p>
                </div>
            </div>
        </div>
        <div class="flex flex-col gap-[5px] grow-1">
            <div class="">
                <label class="font-[600]" for="description"> Your Pitch </label>
            </div>
            <Input
                bind:value={description}
                placeholder="Describe why you should get this job"
                classes="min-h-[100px]"
                fullWidth
                textarea
            />
        </div>
        <Checkbox
            id="dm-checkbox"
            label="Send offer as a Direct Message (DM) to the job poster"
            bind:checked={sendDm}
        />
        <div class="w-full flex flex-row justify-center">
            <Button onClick={postOffer} disabled={posting || !validPledgePercent}>
                {#if posting}
                    <span>
                        <ProgressRing />
                    </span>
                {:else}
                    Publish offer
                {/if}
            </Button>
        </div>
    </div>
</ModalWrapper>
