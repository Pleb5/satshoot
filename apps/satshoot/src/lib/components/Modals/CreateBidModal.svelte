<script lang="ts">
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import { BidEvent, BidStatus } from '$lib/events/BidEvent';
    import { JobEvent } from '$lib/events/JobEvent';
    import { onMount } from 'svelte';
    import ndk from '$lib/stores/session';
    import currentUser from '$lib/stores/user';
    import { NDKEvent, NDKKind, type NDKSigner } from '@nostr-dev-kit/ndk';
    import { ProfilePageTabs, profileTabStore } from '$lib/stores/tab-store';
    import { goto } from '$app/navigation';
    import { wallet } from '$lib/wallet/wallet';
    import { insertThousandSeparator, PablosNpub } from '$lib/utils/misc';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { toaster } from '$lib/stores/toaster';
    import { Pricing, type ZapSplit } from '$lib/events/types';
    import { nip19 } from 'nostr-tools';
    import UserProfile from '../UI/Display/UserProfile.svelte';

    interface Props {
        isOpen: boolean;
        job: JobEvent;
        bidToEdit?: BidEvent | undefined;
    }

    let { isOpen = $bindable(), job, bidToEdit = undefined }: Props = $props();

    const jobAddress = job.jobAddress;

    let validInputs = $state(true);
    let pricingMethod: Pricing = $state(Pricing.Absolute);
    let amount = $state(0);
    let pledgeSplit = $state(0);
    let sponsoredNpub = $state(PablosNpub);
    let sponsoredPubkey = $state('');
    let sponsoringSplit = $state(50);
    let validSponsoredNpub = $derived(/^^(npub1)[a-zA-Z0-9]*/.test(sponsoredNpub));

    let pledgedShare = $derived(Math.floor(amount * (pledgeSplit / 100)));
    let freelancerShare = $derived(amount - pledgedShare);
    let sponsoredShare = $derived(
        validSponsoredNpub ? Math.floor(pledgedShare * (sponsoringSplit / 100)) : 0
    );
    let satshootShare = $derived(pledgedShare - sponsoredShare);

    let description = $state('');
    let sendDm = $state(true);

    let errorText = $state('');
    let posting = $state(false);

    $effect(() => {
        if (validate()) {
            if (sponsoredNpub) {
                try {
                    const decodeResult = nip19.decode(sponsoredNpub);
                    switch (decodeResult.type) {
                        case "npub":
                            sponsoredPubkey = decodeResult.data;
                            validInputs = true;
                            errorText = '';
                            break;
                        default:
                            sponsoredPubkey = '';
                            validInputs = false;
                            errorText = 'Expecting an npub but got a different nip-19 entity.';
                    }
                } catch(error) {
                    sponsoredPubkey = '';
                    validInputs = false;
                    errorText = 'Invalid npub.';
                }
            } else {
                sponsoredPubkey = '';
            }
        } else {
            validInputs = false;
        }
    });

    onMount(() => {
        if (bidToEdit) {
            pricingMethod = bidToEdit.pricing;
            amount = bidToEdit.amount;
            pledgeSplit = bidToEdit.pledgeSplit;
            sponsoredNpub = bidToEdit.sponsoredNpub;
            sponsoredPubkey = bidToEdit.sponsoredNpub ? nip19.decode(bidToEdit.sponsoredNpub).data as string : '';
            sponsoringSplit = bidToEdit.sponsoringSplit;
            description = bidToEdit.description;
        }
    });

    function buildSponsoredZapSplit(npub: string, percentage: number): ZapSplit {
        const decodedData = nip19.decode(npub);
        let sponsoredPubkey = "";
        if (decodedData.type  === "npub") {
            sponsoredPubkey = decodedData.data;
        } else {
            const errorMessage = 'Error happened while decoding sponsored npub:' + sponsoredNpub;
            throw Error(errorMessage);
        }
        return { pubkey: sponsoredPubkey, percentage: percentage };
    }

    async function postBid() {
        if (!validate()) {
            return;
        }
        posting = true;
        const bid = new BidEvent($ndk);

        bid.pricing = pricingMethod;
        bid.amount = amount;
        try {
            const sponsoredZapSplit = sponsoredNpub && pledgeSplit ? buildSponsoredZapSplit(sponsoredNpub, sponsoringSplit) : undefined;
            bid.setZapSplits(pledgeSplit, $currentUser!.pubkey, sponsoredZapSplit);
            bid.description = description;

            bid.referencedJobAddress = jobAddress as string;

            // Only generate new d-tag if we are not editing an existing one
            if (!bidToEdit) {
                // generate unique d-tag
                bid.generateTags();
            } else {
                bid.removeTag('d');
                bid.tags.push(['d', bidToEdit.tagValue('d') as string]);
            }

            console.log('bid', bid);
            const relaysPublished = await bid.publish();

            if (sendDm) {
                const dm = new NDKEvent($ndk);
                dm.kind = NDKKind.EncryptedDirectMessage;
                dm.tags.push(['t', jobAddress!]);
                const jobHolder = job.pubkey;
                const jobHolderUser = $ndk.getUser({ pubkey: jobHolder });

                if (!jobHolder || !jobHolderUser) {
                    throw new Error('Could not identify Job Holder, sending DM failed!');
                }

                dm.tags.push(['p', jobHolder]);

                const content =
                    `SatShoot Bid update on Job: ${job.title} | \n\n` +
                    `Amount: ${bid.amount}${bid.pricing === Pricing.Absolute ? 'sats' : 'sats/min'} | \n` +
                    `Description: ${bid.description}`;
                dm.content = await ($ndk.signer as NDKSigner).encrypt(jobHolderUser, content);

                await dm.publish();
            }

            posting = false;

            toaster.success({ title: 'Bid Posted!' });

            if (!$currentUser?.profile?.lud16) {
                console.log($currentUser?.profile);

                toaster.warning({
                    title: 'Set up an LN Address to receive payments!',
                    duration: 60000, // 1 min
                    action: {
                        label: 'Go to Profile',
                        onClick: () => goto('/settings/profile'),
                    },
                });
            }

            if ($currentUser && !$wallet) {
                toaster.warning({
                    title: 'Set up a Nostr Wallet to receive payments in ecash tokens!',
                    duration: 60000, // 1 min
                    action: {
                        label: 'Go to Wallet',
                        onClick: () => goto('/my-cashu-wallet'),
                    },
                });
            }

            isOpen = false;

            $profileTabStore = ProfilePageTabs.Bids;
            goto('/' + $currentUser?.npub + '/');
        } catch (e) {
            posting = false;
            const errorMessage = 'Error happened while publishing Bid:' + e;

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
            errorText = 'Price below 0!';
        } else if (amount > 100_000_000) {
            valid = false;
            errorText = 'Price cannot exceed 100M sats!';
        } else if (pledgeSplit < 0) {
            valid = false;
            errorText = 'Pledge split below 0!';
        } else if (pledgeSplit > 100) {
            valid = false;
            errorText = 'Pledge split above 100% !';
        } else if (sponsoredNpub) {
            if (!validSponsoredNpub) {
                valid = false;
                errorText = 'Invalid npub!';
            } else if (sponsoringSplit < 0) {
                valid = false;
                errorText = 'Sponsoring split below 0!';
            } else if (sponsoringSplit > 100) {
                valid = false;
                errorText = 'Sponsoring split above 100% !';
            }
        }
        return valid;
    }

    const selectInputClasses =
        'w-full px-[10px] py-[5px] bg-black-50 focus:bg-black-100 rounded-[6px] ' +
        'border-[2px] border-black-100 dark:border-white-100 focus:border-blue-500 focus:outline-[0px]';

    const selectOptionClasses =
        'bg-white dark:bg-brightGray transition-all ease duration-[0.2s] w-[100%] rounded-[4px] px-[8px] py-[4px] hover:bg-blue-500 hover:text-white';
</script>

<ModalWrapper bind:isOpen title="Create Bid">
    <div class="w-full flex flex-col gap-[15px]">
        <div
            class="w-full flex flex-col gap-[5px] rounded-[6px] border-[1px] border-black-200 dark:border-white-200"
        >
            <div class="w-full flex flex-col gap-[10px] p-[10px]">
                {#if errorText}
                    <div
                        class="w-full flex flex-row gap-[15px] flex-wrap p-[10px] border-[1px] border-red-500"
                    >
                        <div class="grow-1">
                            <p class="font-[500]">
                                Invalid inputs:
                                <span class="font-[400]">
                                    {errorText}
                                </span>
                            </p>
                        </div>
                    </div>
                {/if}
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
                <div
                    class="w-full flex flex-row gap-[15px] flex-wrap p-[10px] border-t-[1px] border-t-black-200"
                >
                    <div class="grow-1">
                        <p class="font-[500]">
                            You'd get:
                            <span class="font-[400]">
                                {insertThousandSeparator(freelancerShare) +
                                    (pricingMethod ? ' sats/min' : ' sats')}
                            </span>
                        </p>
                    </div>
                    <div class="grow-1">
                        <p class="font-[500]">
                            Your pledge:
                            <span class="font-[400]">
                                {insertThousandSeparator(pledgedShare) +
                                    (pricingMethod ? ' sats/min' : ' sats')}
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
        <div
            class="w-full flex flex-col gap-[5px] rounded-[6px] border-[1px] border-black-200 dark:border-white-200"
        >
            <div class="w-full flex flex-col gap-[10px] p-[10px]">
                <div class="flex flex-col gap-[5px] grow-1">
                    <div class="">
                        <label class="font-[600]" for=""> Sponsored npub </label>
                    </div>
                    {#if sponsoredPubkey}
                        <UserProfile pubkey={sponsoredPubkey} />
                    {/if}
                    <div class="w-full flex flex-row items-center relative">
                        <Input
                            type="text"
                            placeholder="npub to sponsored"
                            bind:value={sponsoredNpub}
                            fullWidth
                        />
                    </div>
                </div>
                <div class="flex flex-col gap-[5px] grow-1">
                    <div class="">
                        <label class="font-[600]" for=""> Sponsoring split </label>
                    </div>
                    <div class="w-full flex flex-row items-center relative">
                        <Input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            placeholder="Percentage"
                            bind:value={sponsoringSplit}
                            disabled={!validSponsoredNpub}
                            fullWidth
                        />
                        <span
                            class="absolute top-1/2 right-[40px] transform -translate-y-1/2 text-black-500 dark:text-white-500 pointer-events-none"
                        >
                            %
                        </span>
                    </div>
                </div>
                <div
                    class="w-full flex flex-row gap-[15px] flex-wrap p-[10px] border-t-[1px] border-t-black-200"
                >
                    <div class="grow-1">
                        <p class="font-[500]">
                            Satshoot'd get:
                            <span class="font-[400]">
                                {insertThousandSeparator(satshootShare) +
                                    (pricingMethod ? ' sats/min' : ' sats')}
                            </span>
                        </p>
                    </div>
                    <div class="grow-1">
                        <p class="font-[500]">
                            Sponsored npub'd get:
                            <span class="font-[400]">
                                {insertThousandSeparator(sponsoredShare) +
                                    (pricingMethod ? ' sats/min' : ' sats')}
                            </span>
                        </p>
                    </div>
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
            label="Send bid as a Direct Message (DM) to the job poster"
            bind:checked={sendDm}
        />
        <div class="w-full flex flex-row justify-center">
            <Button onClick={postBid} disabled={posting || !validInputs}>
                {#if posting}
                    <span>
                        <ProgressRing />
                    </span>
                {:else}
                    Publish bid
                {/if}
            </Button>
        </div>
    </div>
</ModalWrapper>
