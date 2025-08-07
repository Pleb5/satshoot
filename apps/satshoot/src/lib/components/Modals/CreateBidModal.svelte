<script lang="ts">
    import Checkbox from '../UI/Inputs/Checkbox.svelte';
    import { BidEvent } from '$lib/events/BidEvent';
    import { JobEvent } from '$lib/events/JobEvent';
    import { onMount } from 'svelte';
    import ndk from '$lib/stores/session';
    import currentUser from '$lib/stores/user';
    import { NDKEvent, NDKKind, NDKRelaySet, NDKSubscriptionCacheUsage, profileFromEvent, type NDKSigner } from '@nostr-dev-kit/ndk';
    import { ProfilePageTabs, profileTabStore } from '$lib/stores/tab-store';
    import { goto } from '$app/navigation';
    import { wallet } from '$lib/wallet/wallet';
    import { fetchBTCUSDPrice, insertThousandSeparator, PablosNpub } from '$lib/utils/misc';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';
    import { toaster } from '$lib/stores/toaster';
    import { Pricing, type ZapSplit } from '$lib/events/types';
    import { nip19 } from 'nostr-tools';
    import UserProfile from '../UI/Display/UserProfile.svelte';
    import { PaymentService } from '$lib/services/payments';

    interface Props {
        isOpen: boolean;
        job: JobEvent;
        bidToEdit?: BidEvent | undefined;
    }

    let { isOpen = $bindable(), job, bidToEdit = undefined }: Props = $props();

    const jobAddress = job.jobAddress;

    let pricingMethod: Pricing = $state(Pricing.Absolute);
    let amount = $state<number|null>(null);
    let BTCUSDPrice = -1;
    // USD price with decimals cut off and thousand separators
    let usdPrice = $derived(Math.floor((amount || 0) / 100_000_000 * BTCUSDPrice))
    let pledgeSplit = $state<number|null>(null);
    let sponsoredNpub = $state(PablosNpub);
    let sponsoredName = $state('Sponsored')
    let sponsoredPubkey = $state('');
    let sponsoringSplit = $state<number|null>(null);

    let pledgedShare = $state(0);
    let freelancerShare = $state(0);
    let sponsoredShare = $state(0);
    let satshootShare = $state(0);

    $effect(() => {
        const paymentShares = PaymentService.computePaymentShares(
            amount || 0,
            pledgeSplit || 0,
            sponsoredNpub,
            sponsoringSplit || 0
        );
        freelancerShare = paymentShares.freelancerShare;
        satshootShare = paymentShares.satshootShare;
        sponsoredShare = paymentShares.sponsoredShare;
        pledgedShare = paymentShares.pledgeShare;
    });

    let description = $state('');
    let sendDm = $state(true);

    let errorText = $state('');
    let posting = $state(false);

    $effect(() => {
        if (sponsoredNpub) {
            try {
                const decodeResult = nip19.decode(sponsoredNpub);
                if (decodeResult.type === 'npub') {
                    sponsoredPubkey = decodeResult.data
                    fetchSponsoredProfile()
                } else {
                    sponsoredPubkey = ''
                    sponsoredName = '?'
                }
            } catch (e) {
                console.warn("Invalid sponsoredNpub")
                sponsoredPubkey = ''
                sponsoredName = '?'
            }
        } else {
            sponsoredPubkey = ''
            sponsoredName = '?'
        } 
    })

    const fetchSponsoredProfile = async () => {
        const metadataFilter = {
            kinds: [NDKKind.Metadata],
            authors: [sponsoredPubkey as string],
        };

        const metadataRelays = [
            ...$ndk.pool!.connectedRelays(),
        ];

        const profileEvent: NDKEvent|null = await $ndk.fetchEvent(
            metadataFilter,
            {cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST},
            new NDKRelaySet(new Set(metadataRelays), $ndk)
        )

        if (!profileEvent) {
            sponsoredName = ''
            return
        }
        const profile = profileFromEvent(profileEvent)
        sponsoredName = profile.name ?? profile.displayName ?? ''
    }

    onMount(() => {
        if (bidToEdit) {
            pricingMethod = bidToEdit.pricing;
            amount = bidToEdit.amount;
            pledgeSplit = bidToEdit.pledgeSplit;
            sponsoredNpub = bidToEdit.sponsoredNpub;
            sponsoredPubkey = bidToEdit.sponsoredNpub
                ? (nip19.decode(bidToEdit.sponsoredNpub).data as string)
                : '';
            sponsoringSplit = bidToEdit.sponsoringSplit;
            description = bidToEdit.description;
        }
    });

    $effect(()=>{
        if (isOpen) {
            fetchBTCUSDPrice().then((price) => BTCUSDPrice = price)
        }
    })

    function buildSponsoredZapSplit(npub: string, percentage: number): ZapSplit {
        const decodedData = nip19.decode(npub);
        let sponsoredPubkey = '';
        if (decodedData.type === 'npub') {
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
        bid.amount = amount!;
        try {
            const sponsoredZapSplit =
                sponsoredNpub && pledgeSplit
                    ? buildSponsoredZapSplit(sponsoredNpub, sponsoringSplit||0)
                    : undefined;
            bid.setZapSplits(pledgeSplit!, $currentUser!.pubkey, sponsoredZapSplit);
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
                    `Amount: ${bid.amount}${bid.pricing === Pricing.Absolute ? 'sats' : 'sats/hour'} | \n` +
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
        errorText = '';
        if (!amount) {
            errorText = 'Please set the Bid Price';
            return false
        }
        if (amount < 0) {
            errorText = 'Price below 0!';
            return false
        }

        if (pledgeSplit === null) {
            errorText = 'Please set the Pledge Split';
            return false
        }

        if (pledgeSplit < 0) {
            errorText = 'Pledge split below 0!';
            return false
        }
        if (pledgeSplit > 100) {
            errorText = 'Pledge split above 100% !';
            return false
        }
        if (sponsoredNpub) {
            if (!sponsoredPubkey) {
                errorText = 'Invalid sponsored npub!';
                return false
            } 
            if (sponsoringSplit === null) {
                errorText = 'Please set the Sponsoring Split!';
                return false
            }
            if (sponsoringSplit < 0) {
                errorText = 'Sponsoring split below 0!';
                return false
            } else if (sponsoringSplit > 100) {
                errorText = 'Sponsoring split above 100% !';
                return false
            }
        }

        return true
    }

    $effect(() => {
        if (errorText) {
            toaster.error({
                title: errorText,
            });
        }
    })

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
                <div class="flex flex-col gap-[5px] grow-1">
                    <div class="">
                        <label class="font-[600]" for=""> Pricing method </label>
                    </div>
                    <div class="w-full flex flex-row items-center">
                        <select class={selectInputClasses} bind:value={pricingMethod}>
                            <option value={Pricing.Absolute} class={selectOptionClasses}>
                                Product Price (sats)
                            </option>
                            <option value={Pricing.Hourly} class={selectOptionClasses}>
                                Service fee (sats/hour)
                            </option>
                        </select>
                    </div>
                </div>
                <div class="flex flex-col gap-[5px] grow-1">
                    <div class="">
                        <label class="font-[600]" for="">
                            Price({pricingMethod ? 'sats/hour' : 'sats'})
                        </label>
                    </div>
                    <div class="w-full flex flex-row items-center relative">
                        <Input
                            type="number"
                            step="1"
                            min="0"
                            placeholder={pricingMethod === Pricing.Hourly 
                            ? '50,000' : '1,000,000'}
                            bind:value={amount}
                            fullWidth
                        />
                        <span
                            class="absolute top-1/2 right-[40px] transform -translate-y-1/2 text-black-500 dark:text-white-500 pointer-events-none"
                        >
                            {
                            usdPrice < 0
                                ? '?'
                                : '$' + usdPrice.toString()
                                    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
                                    + ' USD'
                            } 
                        </span>
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
                            placeholder="1%"
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
                            You get:
                            <span class="font-[400]">
                                {insertThousandSeparator(freelancerShare) +
                                    (pricingMethod ? ' sats/hour' : ' sats')}
                            </span>
                        </p>
                    </div>
                    <div class="grow-1">
                        <p class="font-[500]">
                            Your pledge:
                            <span class="font-[400]">
                                {insertThousandSeparator(pledgedShare) +
                                    (pricingMethod ? ' sats/hour' : ' sats')}
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
                        <label class="font-[600]" for=""> Sponsoring </label>
                    </div>
                    {#if sponsoredPubkey}
                        <UserProfile pubkey={sponsoredPubkey} />
                    {/if}
                    <div class="w-full flex flex-row items-center relative">
                        <Input
                            type="text"
                            placeholder="npub to sponsor"
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
                            placeholder="20%"
                            bind:value={sponsoringSplit}
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
                            Satshoot gets:
                            <span class="font-[400]">
                                {insertThousandSeparator(satshootShare) +
                                    (pricingMethod ? ' sats/hour' : ' sats')}
                            </span>
                        </p>
                    </div>
                    <div class="grow-1">
                        <p class="font-[500]">
                            {sponsoredName} gets:
                            <span class="font-[400]">
                                {insertThousandSeparator(sponsoredShare) +
                                    (pricingMethod ? ' sats/hour' : ' sats')}
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
            <Button onClick={postBid} disabled={posting}>
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
