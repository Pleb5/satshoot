<script lang="ts">
    import { page } from '$app/state';
    import currentUser, { loggedIn } from '$lib/stores/user';
    import LoginModal from '$lib/components/Modals/LoginModal.svelte';
    import { redirectAfterLogin } from '$lib/stores/gui';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import { idFromNaddr, relaysFromNaddr } from '$lib/utils/nip19';
    import { NDKEvent, NDKKind, NDKRelay, NDKRelaySet, NDKSubscriptionCacheUsage, profileFromEvent } from '@nostr-dev-kit/ndk';
    import { JobEvent } from '$lib/events/JobEvent';
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import { BidEvent } from '$lib/events/BidEvent';
    import { checkRelayConnections } from '$lib/utils/helpers';
    import { PaymentManagerService, PaymentService, UserEnum } from '$lib/services/payments';
    import { goto } from '$app/navigation';
    import { onDestroy } from 'svelte';
    import UserProfile from '$lib/components/UI/Display/UserProfile.svelte';
    import { formatNumber, insertThousandSeparator, parseNumber, SatShootPubkey } from '$lib/utils/misc';
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import Input from '$lib/components/UI/Inputs/input.svelte';
    import ProgressRing from '$lib/components/UI/Display/ProgressRing.svelte';
    import { Popover } from '@skeletonlabs/skeleton-svelte';
    import Card from '$lib/components/UI/Card.svelte';
    import { toaster } from '$lib/stores/toaster';
    import { OrderEvent } from '$lib/events/OrderEvent';
    import { FreelancerTabs } from '$lib/stores/tab-store';
    import ConfirmPaymentModal from '$lib/components/Modals/ConfirmPaymentModal.svelte';
    import { nip19 } from 'nostr-tools';
    import { Pricing } from '$lib/events/types';
    import Checkbox from '$lib/components/UI/Inputs/Checkbox.svelte';

    // Component state
    let initialized = $state(false);
    let showLoginModal = $state(false);
    let isUserLoggedIn = $derived(!!$currentUser && $loggedIn);
    let primaryEntity = $state<JobEvent | ServiceEvent>();
    let secondaryEntity = $state<BidEvent | OrderEvent>();
    const pricingText = $derived.by(() => {
        let pricing = '?'
        if (primaryEntity?.kind === NDKKind.FreelanceService) {
            pricing = (primaryEntity as ServiceEvent).pricing === Pricing.Hourly
                ? 'sats/hour'
                : 'sats'
        } else if (secondaryEntity?.kind === NDKKind.FreelanceBid) {
            pricing = (secondaryEntity as BidEvent).pricing === Pricing.Hourly
                ? 'sats/hour'
                : 'sats'
        }
        return pricing
    })
    let cashuPopoverStateFreelancer = $state(false);
    let cashuPopoverStateSatshoot = $state(false);
    let cashuPopoverStateSponsored = $state(false);

    let paymentManager = $state<PaymentManagerService | undefined>(undefined);

    let inputTotalAmount = $state<number|null>(null);
    let displayedTotalAmount = $state<string>('')
    let calculateSplits = $state(true)

    let isSponsoring = $state(false);
    let pledgeSplit = $state<number|null>(null);
    let sponsoringSplit = $state<number|null>(null);
    let sponsoredNpub = $state('');
    let sponsoredPubkey = $derived.by(() => {
        if (!sponsoredNpub) return null

        try {
            const decodedNpubResult = nip19.decode(sponsoredNpub)
            return decodedNpubResult.type == 'npub'
                ? decodedNpubResult.data : null;
        } catch (e) {
            console.error('Decode sponsoredNpub failed: ' + e)
            return null
        }
    })
    let sponsoredName = $state('Sponsored')
    let freelancerPubkey = $state('');
    // pay confirm model props
    let showPayConfirm = $state(false);
    let payConfirmPubkey = $state('');
    let payAmount = $state(0);
    let payFunc = $state(async () => {});

    $effect(() => {
        if ($sessionInitialized && !initialized) {
            checkRelayConnections();

            const naddr = page.params.entityId;
            const relaysFromURL = relaysFromNaddr(naddr).split(',');
            const decodedAddr = idFromNaddr(naddr);

            // Add relays from URL
            relaysFromURL.forEach((relayURL: string) => {
                if (relayURL) {
                    $ndk.pool.addRelay(new NDKRelay(relayURL, undefined, $ndk));
                }
            });

            $ndk.fetchEvent(decodedAddr, {
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            })
                .then((event) => {
                    if (event) {
                        switch (event.kind) {
                            case NDKKind.FreelanceBid:
                                secondaryEntity = BidEvent.from(event);
                                return secondaryEntity.referencedJobAddress;
                            case NDKKind.FreelanceOrder:
                                secondaryEntity = OrderEvent.from(event);
                                return secondaryEntity.referencedServiceAddress;
                            default:
                                toaster.error({
                                    title: 'Unexpected entity to be paid. Entities not loaded!',
                                    duration: 60000, // 1 min
                                });
                        }
                    }
                })
                .then((primaryNaddr) => {
                    if (primaryNaddr) {
                        $ndk.fetchEvent(primaryNaddr, {
                            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                        }).then((event) => {
                            if (event) {
                                switch (event.kind) {
                                    case NDKKind.FreelanceJob:
                                        primaryEntity = JobEvent.from(event);
                                        initialized = true;
                                        break;
                                    case NDKKind.FreelanceService:
                                        primaryEntity = ServiceEvent.from(event);
                                        initialized = true;
                                        break;
                                    default:
                                        toaster.error({
                                            title: 'Unexpected entity as target. Entities not loaded!',
                                            duration: 60000, // 1 min
                                        });
                                }
                            }
                        });
                    }
                })
                .catch((reason) => {
                    console.log(`Error fetching Entities!: ${reason}`);
                    toaster.error({
                        title: 'Entities not loaded yet!',
                        duration: 60000, // 1 min
                    });
                });
        }
    });

    $effect(() => {
        if (sponsoredPubkey) {
            fetchSponsoredProfile()
        }
    });

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

        if (!profileEvent) return;
        const profile = profileFromEvent(profileEvent)
        sponsoredName = profile.name ?? profile.displayName ?? ''
    }


    // Initialize payment manager when entities are available
    $effect(() => {
        if (initialized && !!primaryEntity && !!secondaryEntity) {
            paymentManager = new PaymentManagerService(primaryEntity, secondaryEntity);
            isSponsoring =
                (secondaryEntity instanceof BidEvent && !!secondaryEntity.sponsoredNpub) ||
                (primaryEntity instanceof ServiceEvent && !!primaryEntity.sponsoredNpub);
            if (secondaryEntity instanceof BidEvent) {
                pledgeSplit = secondaryEntity.pledgeSplit;
                sponsoringSplit = secondaryEntity.sponsoringSplit;
                sponsoredNpub = secondaryEntity.sponsoredNpub

                freelancerPubkey = secondaryEntity.pubkey;
            } else if (primaryEntity instanceof ServiceEvent) {
                pledgeSplit = primaryEntity.pledgeSplit;
                sponsoringSplit = primaryEntity.sponsoringSplit;
                sponsoredNpub = primaryEntity.sponsoredNpub
                freelancerPubkey = primaryEntity.pubkey;
            }
        }
    });

    $effect(() => {
        if (calculateSplits &&
            inputTotalAmount &&
            paymentManager
        ) {
            const paymentShares = PaymentService.computePaymentShares(
                inputTotalAmount,
                pledgeSplit || 0,
                sponsoredNpub,
                sponsoringSplit || 0
            );

            paymentManager.payment.amount = paymentShares.freelancerShare
            paymentManager.payment.satshootAmount = paymentShares.satshootShare
            paymentManager.payment.sponsoredAmount = paymentShares.sponsoredShare
        } else if (!inputTotalAmount) {
            if (paymentManager?.payment) {
                paymentManager.payment.amount = 0
                paymentManager.payment.satshootAmount = 0
                paymentManager.payment.sponsoredAmount = 0
            }
        }
    });

    $effect(() => {
        displayedTotalAmount = formatNumber(inputTotalAmount);
    });

    function handleTotalAmountInput(event: Event): void {
        const target = event.target as HTMLInputElement;
        const parsedValue = parseNumber(target.value);
        
        if (parsedValue === null) {
            inputTotalAmount = null;
            displayedTotalAmount = '';
        } else {
            inputTotalAmount = parsedValue;
            displayedTotalAmount = formatNumber(parsedValue);
        }
    }

    const bech32ID = $derived(primaryEntity?.encode());

    // Derived values from payment manager
    const pricingInfo = $derived(paymentManager?.pricingInfo);
    const freelancerPaid = $derived(paymentManager?.freelancerPaid);
    const satshootPaid = $derived(paymentManager?.satshootPaid);
    const sponsoredPaid = $derived(paymentManager?.sponsoredPaid);
    const paying = $derived(paymentManager?.payment?.paying ?? false);
    const hasSenderEcashSetup = $derived(paymentManager?.hasSenderEcashSetup ?? false);
    const canPayWithCashu = $derived(paymentManager?.canPayWithCashu ?? false);
    const cashuTooltipText = $derived(paymentManager?.cashuTooltipText ?? '');

    // Payment functions
    function openConfirmPayWithLN(payeeType: UserEnum) {
        return () => {
            switch (payeeType) {
                case UserEnum.Freelancer:
                    payConfirmPubkey = freelancerPubkey;
                    payAmount = paymentManager!.payment.amount;
                    break;
                case UserEnum.Satshoot:
                    payConfirmPubkey = SatShootPubkey;
                    payAmount = paymentManager!.payment.satshootAmount;
                    break;
                case UserEnum.Sponsored:
                    if (secondaryEntity instanceof BidEvent) {
                        payConfirmPubkey = nip19.decode(secondaryEntity.sponsoredNpub)
                            .data as string;
                    } else {
                        payConfirmPubkey = nip19.decode(
                            (primaryEntity as ServiceEvent).sponsoredNpub
                        ).data as string;
                    }
                    payAmount = paymentManager!.payment.sponsoredAmount;
                    break;
            }
            payFunc = payWithLN(payeeType);
            showPayConfirm = true;
        };
    }

    function payWithLN(payeeType: UserEnum) {
        return async () => {
            if (!paymentManager) return;
            await paymentManager.payWithLightning(payeeType);
        };
    }

    function payWithEcash(payeeType: UserEnum) {
        return async () => {
            if (!paymentManager) return;
            await paymentManager.payWithCashu(payeeType);
        };
    }

    function setupEcash() {
        goto('/my-cashu-wallet/');
    }

    onDestroy(() => {
        paymentManager?.destroy();
    });

    function handleLogin() {
        $redirectAfterLogin = false;
        showLoginModal = true;
    }

    const amountInputClasses = 'transition ease duration-[0.3s] px-[10px] py-[5px] ' +
    'bg-black-50 focus:bg-black-100 outline-[0px] focus:outline-[0px] border-[2px] ' +
    'border-black-100 dark:border-white-100 focus:border-blue-500 rounded-[6px] ' + 
    'w-full text-lg sm:text-xl'
</script>

<div class="w-full flex flex-col justify-center items-center py-[25px] text-lg sm:text-xl">
    <div class="md:max-w-[60%] w-full flex flex-col justify-start items-end px-[10px] relative">
        {#if !isUserLoggedIn}
            <Button onClick={handleLogin}>Log in To Pay</Button>
        {:else if primaryEntity && secondaryEntity && paymentManager}
            <div class="w-full flex flex-col">
                <!-- Share Job Post start -->
                <div class="w-full flex flex-col">
                    <h1
                        class="w-full text-center font-[700] text-[32px] wrap-normal overflow-hidden"
                    >
                        Make Payments
                    </h1>
                </div>
                <div class="w-full pt-[10px] px-[5px] flex flex-col gap-[10px]">
                    <div
                        class="w-full flex flex-col rounded-[8px] p-[15px] shadow-subtle bg-white dark:bg-brightGray gap-[15px]"
                    >
                        <UserProfile pubkey={freelancerPubkey} />
                        <div
                            class="w-full flex flex-row flex-wrap gap-[10px] justify-between p-[5px] mt-[5px] border-t-[1px] border-t-black-100"
                        >
                            <div class="grow-1">
                                <p class="font-[500]">
                                    {pricingInfo?.costLabel}
                                    <span class="font-[300]">
                                        {insertThousandSeparator(secondaryEntity.amount) +
                                            ' ' +
                                            pricingInfo?.pricing}
                                    </span>
                                </p>
                            </div>
                            <div class="grow-1">
                                <p class="font-[500]">
                                    Pledge split:
                                    <span class="font-[300]"> {pledgeSplit} %</span>
                                </p>
                            </div>
                            {#if isSponsoring}
                                <div class="grow-1">
                                    <p class="font-[500]">
                                        Sponsoring split:
                                        <span class="font-[300]"> {sponsoringSplit} %</span>
                                    </p>
                                </div>
                            {/if}
                        </div>
                        <div
                            class="w-full flex flex-row flex-wrap gap-[10px] justify-between p-[5px] mt-[5px] border-t-[1px] border-t-black-100"
                        >
                            <div class="grow-1">
                                <p class="font-[500]">
                                    Freelancer Paid:
                                    <span class="font-[300]">
                                        {$freelancerPaid
                                            ? insertThousandSeparator($freelancerPaid)
                                            : '?'} sats
                                    </span>
                                </p>
                            </div>
                            <div class="grow-1">
                                <p class="font-[500]">
                                    SatShoot Paid:
                                    <span class="font-[300]">
                                        {$satshootPaid
                                            ? insertThousandSeparator($satshootPaid)
                                            : '?'} sats
                                    </span>
                                </p>
                            </div>
                            {#if isSponsoring}
                                <div class="grow-1">
                                    <p class="font-[500]">
                                        Sponsored Paid:
                                        <span class="font-[300]">
                                            {$sponsoredPaid
                                                ? insertThousandSeparator($sponsoredPaid)
                                                : '?'} sats
                                        </span>
                                    </p>
                                </div>
                            {/if}
                        </div>
                    </div>
                    <div
                        class="w-full flex flex-col rounded-[8px] p-[15px] shadow-subtle bg-white dark:bg-brightGray gap-[15px]"
                    >
                        <p class="">Compensation for:</p>

                        <a href={'/' + bech32ID + '/'} class="anchor font-[600]">
                            {primaryEntity instanceof JobEvent
                                ? primaryEntity.title
                                : (primaryEntity as ServiceEvent).title}
                        </a>
                    </div>
                    <div
                        class="w-full flex flex-col rounded-[8px] p-[15px] shadow-subtle bg-white dark:bg-brightGray gap-[15px]"
                    >
                        {#if cashuTooltipText && paymentManager.payment.amount}
                            <!--Popover TODO (rodant): switched off for up coming release
                                open={cashuPopoverStateFreelancer}
                                onOpenChange={(e) => (cashuPopoverStateFreelancer = e.open)}
                                positioning={{ placement: 'top' }}
                                triggerBase="btn preset-tonal"
                                contentBase="card bg-surface-200-800 p-4 space-y-4 max-w-[320px]"
                                arrow
                                arrowBackground="!bg-surface-200 dark:!bg-surface-800"
                            >
                                {#snippet trigger()}
                                    <i
                                        class="bx bx-question-mark bg-[red] text-white p-[3px] rounded-[50%]"
                                    ></i>
                                {/snippet}
                                {#snippet content()}
                                    <Card>
                                        <p>{cashuTooltipText}</p>
                                    </Card>
                                {/snippet}
                            </Popover-->
                        {/if}
                        <div class="w-full flex flex-col gap-[5px]">
                            <div class="flex flex-col gap-[5px] mb-2">
                                <label class="font-[500]" for="service-payment"
                                >Total Amount to be paid</label
                                >
                                <div class="max-sm:flex max-sm:flex-wrap min-sm:grid min-sm:grid-cols-[1fr_auto] gap-x-2">
                                    <input
                                        class={amountInputClasses}
                                        type="text"
                                        placeholder="000,000"
                                        value={displayedTotalAmount}
                                        oninput={handleTotalAmountInput}
                                    />
                                    <Checkbox 
                                        id={"totalAmount"}
                                        label={"Calculate splits"}
                                        bind:checked={calculateSplits}
                                    />
                                </div>
                            </div>
                            <div class="w-full flex flex-col gap-[5px]">
                                <label class="font-[500]" for="service-payment"
                                    >Freelancer share</label
                                >
                                <Input
                                    id="service-payment"
                                    classes='text-lg sm:text-xl'
                                    type="number"
                                    step="1"
                                    min="0"
                                    placeholder="000,000"
                                    bind:value={paymentManager.payment.amount}
                                    fullWidth
                                />
                            </div>
                            <!-- Payment Buttons for first Payee -->
                            <div class="flex flex-row justify-center gap-[5px] py-[10px]">
                                <Button
                                    grow
                                    classes="w-[200px] max-w-[200px]"
                                    onClick={openConfirmPayWithLN(UserEnum.Freelancer)}
                                    disabled={paying || !paymentManager.payment.amount}
                                >
                                    {#if paying}
                                        <span>
                                            <ProgressRing />
                                        </span>
                                    {:else}
                                        <img
                                            class="h-[20px] w-auto"
                                            src="/img/lightning.png"
                                            alt="Lightning icon"
                                        />
                                        <span> Pay with LN</span>
                                    {/if}
                                </Button>
                                {#if hasSenderEcashSetup}
                                    <!--Button TODO (rodant): switched off for up coming release
                                        grow
                                        classes="w-[200px] max-w-[200px]"
                                        onClick={payWithCashu(UserEnum.Freelancer)}
                                        disabled={paying ||
                                            !canPayWithCashu ||
                                            !paymentManager?.payment.amount}
                                    >
                                        {#if paying}
                                            <ProgressRing />
                                        {:else}
                                            <img
                                                class="h-[20px] w-auto"
                                                src="/img/cashu.png"
                                                alt="Cashu icon"
                                            />
                                            <span>Pay with Cashu</span>
                                        {/if}
                                    </Button-->
                                {:else}
                                    <!--Button TODO (rodant): switched off for up coming release
                                        grow
                                        classes="w-[200px] max-w-[200px]"
                                        onClick={setupEcash}
                                    >
                                        {#if paying}
                                            <span>
                                                <ProgressRing />
                                            </span>
                                        {/if}
                                        <span> Setup Nostr Wallet </span>
                                    </Button-->
                                {/if}
                            </div>
                            {#if cashuTooltipText && paymentManager.payment.satshootAmount}
                                <!--Popover TODO (rodant): switched off for up coming release
                                    open={cashuPopoverStateSatshoot}
                                    onOpenChange={(e) => (cashuPopoverStateSatshoot = e.open)}
                                    positioning={{ placement: 'top' }}
                                    triggerBase="btn preset-tonal"
                                    contentBase="card bg-surface-200-800 p-4 space-y-4 max-w-[320px]"
                                    arrow
                                    arrowBackground="!bg-surface-200 dark:!bg-surface-800"
                                >
                                    {#snippet trigger()}
                                        <i
                                            class="bx bx-question-mark bg-[red] text-white p-[3px] rounded-[50%]"
                                        ></i>
                                    {/snippet}
                                    {#snippet content()}
                                        <Card>
                                            <p>{cashuTooltipText}</p>
                                        </Card>
                                    {/snippet}
                                </Popover-->
                            {/if}
                            <div class="w-full flex flex-col gap-[5px]">
                                <label class="font-[500] flex gap-x-2 items-center" for="platform-contribution">
                                    <span>SatShoot share</span>
                                </label>
                                <Input
                                    id="plattform-contribution"
                                    classes='text-lg sm:text-xl'
                                    type="number"
                                    step="1"
                                    min="0"
                                    placeholder="000,000"
                                    bind:value={paymentManager.payment.satshootAmount}
                                    fullWidth
                                />
                            </div>
                            <!-- Payment Buttons for second Payee -->
                            <div class="flex flex-row justify-center gap-[5px] py-[10px]">
                                <Button
                                    grow
                                    classes="w-[200px] max-w-[200px]"
                                    onClick={openConfirmPayWithLN(UserEnum.Satshoot)}
                                    disabled={paying || !paymentManager.payment.satshootAmount}
                                >
                                    {#if paying}
                                        <span>
                                            <ProgressRing />
                                        </span>
                                    {:else}
                                        <img
                                            class="h-[20px] w-auto"
                                            src="/img/lightning.png"
                                            alt="Lightning icon"
                                        />
                                        <span> Pay with LN</span>
                                    {/if}
                                </Button>
                                {#if hasSenderEcashSetup}
                                    <!--Button TODO (rodant): switched off for up coming release
                                        grow
                                        classes="w-[200px] max-w-[200px]"
                                        onClick={payWithCashu(UserEnum.Satshoot)}
                                        disabled={paying ||
                                            !canPayWithCashu ||
                                            !paymentManager.payment.satshootAmount}
                                    >
                                        {#if paying}
                                            <ProgressRing />
                                        {:else}
                                            <img
                                                class="h-[20px] w-auto"
                                                src="/img/cashu.png"
                                                alt="Cashu icon"
                                            />
                                            <span>Pay with Cashu</span>
                                        {/if}
                                    </Button-->
                                {:else}
                                    <!--Button TODO (rodant): switched off for up coming release
                                        grow
                                        classes="w-[200px] max-w-[200px]"
                                        onClick={setupEcash}
                                    >
                                        {#if paying}
                                            <span>
                                                <ProgressRing />
                                            </span>
                                        {/if}
                                        <span> Setup Nostr Wallet </span>
                                    </Button-->
                                {/if}
                            </div>
                            {#if isSponsoring}
                                {#if cashuTooltipText && paymentManager.payment.sponsoredAmount}
                                    <!--Popover TODO (rodant): switched off for up coming release
                                        open={cashuPopoverStateSponsored}
                                        onOpenChange={(e) => (cashuPopoverStateSponsored = e.open)}
                                        positioning={{ placement: 'top' }}
                                        triggerBase="btn preset-tonal"
                                        contentBase="card bg-surface-200-800 p-4 space-y-4 max-w-[320px]"
                                        arrow
                                        arrowBackground="!bg-surface-200 dark:!bg-surface-800"
                                    >
                                        {#snippet trigger()}
                                            <i
                                                class="bx bx-question-mark bg-[red] text-white p-[3px] rounded-[50%]"
                                            ></i>
                                        {/snippet}
                                        {#snippet content()}
                                            <Card>
                                                <p>{cashuTooltipText}</p>
                                            </Card>
                                        {/snippet}
                                    </Popover-->
                                {/if}
                                <div class="w-full flex flex-col gap-[5px]">
                                    <label class="font-[500] flex gap-x-2 items-center" for="sponsored-contribution">
                                        <span>{sponsoredName} share</span>
                                    </label>
                                    <Input
                                        id="sponsored-contribution"
                                        classes='text-lg sm:text-xl'
                                        type="number"
                                        step="1"
                                        min="0"
                                        placeholder="000,000"
                                        bind:value={paymentManager.payment.sponsoredAmount}
                                        fullWidth
                                    />
                                </div>
                                <!-- Payment Buttons for third Payee -->
                                <div class="flex flex-row justify-center gap-[5px] py-[10px]">
                                    <Button
                                        grow
                                        classes="w-[200px] max-w-[200px]"
                                        onClick={openConfirmPayWithLN(UserEnum.Sponsored)}
                                        disabled={paying || !paymentManager.payment.sponsoredAmount}
                                    >
                                        {#if paying}
                                            <span>
                                                <ProgressRing />
                                            </span>
                                        {:else}
                                            <img
                                                class="h-[20px] w-auto"
                                                src="/img/lightning.png"
                                                alt="Lightning icon"
                                            />
                                            <span> Pay with LN</span>
                                        {/if}
                                    </Button>
                                    {#if hasSenderEcashSetup}
                                        <!--Button TODO (rodant): switched off for up coming release
                                            grow
                                            classes="w-[200px] max-w-[200px]"
                                            onClick={payWithCashu(UserEnum.Sponsored)}
                                            disabled={paying ||
                                                !canPayWithCashu ||
                                                !paymentManager.payment.sponsoredAmount}
                                        >
                                            {#if paying}
                                                <ProgressRing />
                                            {:else}
                                                <img
                                                    class="h-[20px] w-auto"
                                                    src="/img/cashu.png"
                                                    alt="Cashu icon"
                                                />
                                                <span>Pay with Cashu</span>
                                            {/if}
                                        </Button-->
                                    {:else}
                                        <!--Button TODO (rodant): switched off for up coming release
                                            grow
                                            classes="w-[200px] max-w-[200px]"
                                            onClick={setupEcash}
                                        >
                                            {#if paying}
                                                <span>
                                                    <ProgressRing />
                                                </span>
                                            {/if}
                                            <span> Setup Nostr Wallet </span>
                                        </Button-->
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>

<LoginModal bind:isOpen={showLoginModal} />

<ConfirmPaymentModal
    bind:isOpen={showPayConfirm}
    bind:payeePubkey={payConfirmPubkey}
    bind:amount={payAmount}
    bind:onConfirm={payFunc}
/>
