<script lang="ts">
    import {
        getModalStore,
        getToastStore,
        ProgressRadial,
        type ToastSettings,
    } from '@skeletonlabs/skeleton';
    import CloseModal from '../UI/Buttons/CloseModal.svelte';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import { OfferEvent, OfferStatus, Pricing } from '$lib/events/OfferEvent';
    import { TicketEvent } from '$lib/events/TicketEvent';
    import { onMount } from 'svelte';
    import ndk from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import { NDKEvent, NDKKind, type NDKSigner } from '@nostr-dev-kit/ndk';
    import { offerTabStore } from '$lib/stores/tab-store';
    import { goto } from '$app/navigation';
    import { wallet } from '$lib/stores/wallet';
    import { insertThousandSeparator } from '$lib/utils/misc';
    import Card from '../UI/Card.svelte';
    import Button from '../UI/Buttons/Button.svelte';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    export let ticket: TicketEvent;
    export let offerToEdit: OfferEvent | undefined = undefined;

    const ticketAddress = ticket.ticketAddress;

    let validPledgePercent = true;
    let pricingMethod: Pricing;
    let amount = 0;
    let pledgeSplit = 0;

    $: pledgedShare = Math.floor(amount * (pledgeSplit / 100));
    $: freelancerShare = amount - pledgedShare;

    let description = '';
    let sendDm = true;

    let errorText = '';
    let posting = false;

    $: if (pledgeSplit >= 0 && pledgeSplit <= 100) {
        validPledgePercent = true;
        errorText = '';
    } else {
        validPledgePercent = false;
        errorText = 'Set a valid Pledge Split percent!';
    }

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

            $offerTabStore = OfferStatus.Pending;

            const t: ToastSettings = {
                message: 'Offer Posted!',
                timeout: 4000,
                background: 'bg-success-300-600-token',
            };
            toastStore.trigger(t);

            if (!$currentUser?.profile?.lud16) {
                console.log($currentUser?.profile);

                let toastId: string;
                const t: ToastSettings = {
                    message: 'Set up an LN Address to receive payments!',
                    background: 'bg-warning-300-600-token',
                    autohide: false,
                    action: {
                        label: 'Go to Profile',
                        response: () => {
                            goto('/' + $currentUser!.npub);
                        },
                    },
                };
                toastId = toastStore.trigger(t);
            }

            if ($currentUser && !$wallet) {
                const t: ToastSettings = {
                    message: 'Set up a cashu wallet to receive payments in ecash tokens!',
                    background: 'bg-warning-300-600-token',
                    autohide: false,
                    action: {
                        label: 'Go to Wallet',
                        response: () => {
                            goto('/my-cashu-wallet');
                        },
                    },
                };
                toastStore.trigger(t);
            }

            if ($modalStore[0].response) {
                $modalStore[0].response(true);
                modalStore.close();
            }

            modalStore.close();

            goto('/my-offers');
        } catch (e) {
            posting = false;
            const errorMessage = 'Error happened while publishing Offer:' + e;

            const t: ToastSettings = {
                message: errorMessage,
                timeout: 7000,
                background: 'bg-error-300-600-token',
            };
            toastStore.trigger(t);

            if ($modalStore[0].response) {
                $modalStore[0].response(false);
                modalStore.close();
            }
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
        'transition ease duration-[0.3s] w-full outline outline-[1px] outline-[rgb(0,0,0,0.1)] py-[6px] px-[12px] rounded-[6px] ' +
        'transform scale-100 whitespace-nowrap flex flex-row justify-between items-center gap-[8px] hover:bg-[#3b82f6] hover:text-white';

    const selectOptionClasses =
        'transition-all ease duration-[0.2s] w-[100%] rounded-[4px] px-[8px] py-[4px] hover:bg-[rgb(59,115,246)] hover:text-white';

    const inputClasses =
        'transition ease duration-[0.3s] w-full bg-[rgb(0,0,0,0.05)] border-[2px] border-[rgb(0,0,0,0.1)] rounded-[6px] ' +
        'px-[10px] py-[5px] outline-[0px] outline-[rgb(59,115,246,0.0)] focus:border-[rgb(59,115,246)] focus:bg-[rgb(0,0,0,0.08)]';

    const textareaInputClasses =
        'transition ease duration-[0.3s] w-full min-h-[100px] bg-[rgb(0,0,0,0.05)] border-[2px] border-[rgb(0,0,0,0.1)] ' +
        'rounded-[6px] px-[10px] py-[5px] outline-[0px] outline-[rgb(59,115,246,0.0)] focus:border-[rgb(59,115,246)] focus:bg-[rgb(0,0,0,0.08)]';
</script>

{#if $modalStore[0]}
    <div
        class="fixed inset-[0] z-[90] bg-[rgb(0,0,0,0.5)] backdrop-blur-[10px] flex flex-col justify-start items-center py-[25px] overflow-auto"
    >
        <div
            class="max-w-[1400px] w-full flex flex-col justify-start items-center px-[10px] relative"
        >
            <div class="w-full flex flex-col justify-start items-center">
                <div class="w-full max-w-[500px] justify-start items-center">
                    <Card>
                        <div class="flex flex-row justify-between gap-[10px] pb-[5px]">
                            <p class="font-[500] text-[18px]">Create Offer</p>
                            <CloseModal />
                        </div>
                        <div class="w-full flex flex-col gap-[15px]">
                            <div
                                class="w-full flex flex-col gap-[5px] rounded-[6px] border-[1px] border-[rgb(0,0,0,0.15)]"
                            >
                                <div class="w-full flex flex-col gap-[10px] p-[10px]">
                                    <div class="flex flex-col gap-[5px] grow-[1]">
                                        <div class="">
                                            <label class="font-[600]" for="">
                                                Pricing method
                                            </label>
                                        </div>
                                        <div class="w-full flex flex-row items-center">
                                            <select
                                                class={selectInputClasses}
                                                bind:value={pricingMethod}
                                            >
                                                <option
                                                    value={Pricing.Absolute}
                                                    class={selectOptionClasses}
                                                >
                                                    Absolute Price(sats)
                                                </option>
                                                <option
                                                    value={Pricing.SatsPerMin}
                                                    class={selectOptionClasses}
                                                >
                                                    Time-based Price(sats/minute)
                                                </option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="flex flex-col gap-[5px] grow-[1]">
                                        <div class="">
                                            <label class="font-[600]" for="">
                                                Price({pricingMethod ? 'sats/min' : 'sats'})
                                            </label>
                                        </div>
                                        <div class="w-full flex flex-row items-center">
                                            <input
                                                type="number"
                                                step="1"
                                                min="0"
                                                max="100_000_000"
                                                placeholder="Amount"
                                                class={inputClasses}
                                                bind:value={amount}
                                            />
                                        </div>
                                    </div>
                                    <div class="flex flex-col gap-[5px] grow-[1]">
                                        <div class="">
                                            <label class="font-[600]" for=""> Pledge split </label>
                                        </div>
                                        <div class="w-full flex flex-row items-center relative">
                                            <input
                                                type="number"
                                                step="1"
                                                min="0"
                                                max="100"
                                                placeholder="Percentage"
                                                class={inputClasses}
                                                bind:value={pledgeSplit}
                                            />
                                            <span
                                                class="absolute top-1/2 right-[40px] transform -translate-y-1/2 text-[rgb(0,0,0,0.5)] pointer-events-none"
                                            >
                                                %
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div
                                    class="w-full flex flex-row gap-[15px] flex-wrap p-[10px] border-t-[1px] border-t-[rgb(0,0,0,0.15)]"
                                >
                                    <div class="grow-[1]">
                                        <p class="font-[500]">
                                            You'd get:
                                            <span class="font-[400]">
                                                {insertThousandSeparator(freelancerShare) +
                                                    (pricingMethod ? 'sats/min' : 'sats')}
                                            </span>
                                        </p>
                                    </div>
                                    <div class="grow-[1]">
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
                            <div class="flex flex-col gap-[5px] grow-[1]">
                                <div class="">
                                    <label class="font-[600]" for="description"> Your Pitch </label>
                                </div>

                                <textarea
                                    placeholder="Describe why you should get this job"
                                    class={textareaInputClasses}
                                    bind:value={description}
                                />
                            </div>
                            <Checkbox
                                id="dm-checkbox"
                                label="Send offer as a Direct Message (DM) to the job poster"
                                bind:checked={sendDm}
                            />
                            <div class="w-full flex flex-row justify-center">
                                <Button
                                    on:click={postOffer}
                                    disabled={posting || !validPledgePercent}
                                >
                                    {#if posting}
                                        <span>
                                            <ProgressRadial
                                                value={undefined}
                                                stroke={60}
                                                meter="stroke-tertiary-500"
                                                track="stroke-tertiary-500/30"
                                                strokeLinecap="round"
                                                width="w-8"
                                            />
                                        </span>
                                    {:else}
                                        Publish offer
                                    {/if}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    </div>
{/if}
