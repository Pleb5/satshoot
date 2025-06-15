<script lang="ts">
    import { page } from '$app/state';
    import currentUser, { loggedIn } from '$lib/stores/user';
    import LoginModal from '$lib/components/Modals/LoginModal.svelte';
    import { redirectAfterLogin } from '$lib/stores/gui';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import { idFromNaddr, relaysFromNaddr } from '$lib/utils/nip19';
    import { NDKRelay, NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
    import { JobEvent } from '$lib/events/JobEvent';
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import { BidEvent } from '$lib/events/BidEvent';
    import { checkRelayConnections } from '$lib/utils/helpers';
    import { PaymentManagerService, UserEnum } from '$lib/services/payments';
    import { goto } from '$app/navigation';
    import { onDestroy } from 'svelte';
    import UserProfile from '$lib/components/UI/Display/UserProfile.svelte';
    import { insertThousandSeparator } from '$lib/utils/misc';
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import Input from '$lib/components/UI/Inputs/input.svelte';
    import ProgressRing from '$lib/components/UI/Display/ProgressRing.svelte';
    import { Popover } from '@skeletonlabs/skeleton-svelte';
    import Card from '$lib/components/UI/Card.svelte';
    import { toaster } from '$lib/stores/toaster';

    // Parse URL parameters
    const primaryEntityAddress = idFromNaddr(page.params.entityId);
    const relaysFromPrimary = relaysFromNaddr(page.params.entityId).split(',');

    // Component state
    let initialized = $state(false);
    let showLoginModal = $state(false);
    let isUserLoggedIn = $derived(!!$currentUser && $loggedIn);
    let targetEntity = $state<JobEvent>();
    let secondaryEntity = $state<BidEvent | ServiceEvent>();
    let cashuPopoverState = $state(false);
    let paymentManager = $state<PaymentManagerService | undefined>(undefined);

    $effect(() => {
        if ($sessionInitialized && !initialized) {
            checkRelayConnections();

            const naddr = page.params.entityId;
            const relaysFromURL = relaysFromNaddr(naddr).split(',');

            // Add relays from URL
            relaysFromURL.forEach((relayURL: string) => {
                if (relayURL) {
                    $ndk.pool.addRelay(new NDKRelay(relayURL, undefined, $ndk));
                }
            });

            $ndk.fetchEvent(primaryEntityAddress, {
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            })
                .then((event) => {
                    if (event) {
                        targetEntity = JobEvent.from(event);
                        return targetEntity.acceptedBidAddress;
                    }
                })
                .then((bidNaddr) => {
                    if (bidNaddr) {
                        $ndk.fetchEvent(bidNaddr, {
                            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                        }).then((event) => {
                            if (event) {
                                secondaryEntity = BidEvent.from(event);
                                initialized = true;
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

    // Initialize payment manager when entities are available
    $effect(() => {
        if (initialized && !!targetEntity && !!secondaryEntity) {
            paymentManager = new PaymentManagerService(targetEntity, secondaryEntity);
        }
    });

    const bech32ID = $derived(
        targetEntity instanceof JobEvent
            ? targetEntity.encode()
            : secondaryEntity
              ? secondaryEntity.encode()
              : ''
    );

    // Derived values from payment manager
    const paymentShares = $derived(paymentManager?.payment?.paymentShares);
    const pricingInfo = $derived(paymentManager?.pricingInfo);
    const freelancerPaid = $derived(paymentManager?.freelancerPaid);
    const satshootPaid = $derived(paymentManager?.satshootPaid);
    const paying = $derived(paymentManager?.payment?.paying ?? false);
    const hasSenderEcashSetup = $derived(paymentManager?.hasSenderEcashSetup ?? false);
    const canPayWithCashu = $derived(paymentManager?.canPayWithCashu ?? false);
    const cashuTooltipText = $derived(paymentManager?.cashuTooltipText ?? '');

    // Payment functions
    async function payWithLN(payeeType: UserEnum) {
        if (!paymentManager) return;
        await paymentManager.payWithLightning(payeeType);
    }

    async function payFreelancerWithLN() {
        await payWithLN(UserEnum.Freelancer);
    }

    async function paySatshootWithLN() {
        await payWithLN(UserEnum.Satshoot);
    }

    async function payWithEcash(payeeType: UserEnum) {
        if (!paymentManager) return;
        await paymentManager.payWithCashu(payeeType);
    }

    async function payFreelancerWithCashu() {
        await payWithEcash(UserEnum.Freelancer);
    }

    async function paySatshootWithCashu() {
        await payWithEcash(UserEnum.Satshoot);
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
</script>

<div class="w-full flex flex-col justify-center items-center py-[25px]">
    <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
        {#if !isUserLoggedIn}
            <Button onClick={handleLogin}>Log in To Pay</Button>
        {:else if targetEntity && secondaryEntity && paymentManager}
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
                        <UserProfile pubkey={secondaryEntity.pubkey} />
                        <div
                            class="w-full flex flex-row flex-wrap gap-[10px] justify-between p-[5px] mt-[5px] border-t-[1px] border-t-black-100"
                        >
                            <div class="grow-1">
                                <p class="font-[500]">
                                    {pricingInfo?.costLabel}
                                    <span class="font-[300]">
                                        {insertThousandSeparator(paymentManager.payment.amount) +
                                            ' ' +
                                            pricingInfo?.pricing}
                                    </span>
                                </p>
                            </div>
                            <div class="grow-1">
                                <p class="font-[500]">
                                    Pledge split:
                                    <span class="font-[300]"> {secondaryEntity.pledgeSplit} %</span>
                                </p>
                            </div>
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
                        </div>
                    </div>
                    <div
                        class="w-full flex flex-col rounded-[8px] p-[15px] shadow-subtle bg-white dark:bg-brightGray gap-[15px]"
                    >
                        <p class="">Compensation for:</p>

                        <a href={'/' + bech32ID + '/'} class="anchor font-[600]">
                            {targetEntity instanceof JobEvent
                                ? targetEntity.title
                                : (secondaryEntity as ServiceEvent).title}
                        </a>
                    </div>
                    <div
                        class="w-full flex flex-col rounded-[8px] p-[15px] shadow-subtle bg-white dark:bg-brightGray gap-[15px]"
                    >
                        {#if cashuTooltipText}
                            <Popover
                                open={cashuPopoverState}
                                onOpenChange={(e) => (cashuPopoverState = e.open)}
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
                            </Popover>
                        {/if}
                        <div class="w-full flex flex-col gap-[5px]">
                            <div class="w-full flex flex-col gap-[5px]">
                                <label class="font-[500]" for="service-payment"
                                    >Pay for service</label
                                >
                                <Input
                                    id="service-payment"
                                    type="number"
                                    step="1"
                                    min="0"
                                    placeholder="000,000"
                                    bind:value={paymentManager.payment.amount}
                                    fullWidth
                                />
                            </div>
                            <!-- Payment Buttons for first Payee -->
                            <div class="flex flex-row justify-center gap-[5px]">
                                <Button
                                    grow
                                    classes="w-[200px] max-w-[200px]"
                                    onClick={payFreelancerWithLN}
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
                                    <Button
                                        grow
                                        classes="w-[200px] max-w-[200px]"
                                        onClick={payFreelancerWithCashu}
                                        disabled={paying ||
                                            !canPayWithCashu ||
                                            !paymentManager.payment.amount}
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
                                    </Button>
                                {:else}
                                    <Button
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
                                    </Button>
                                {/if}
                            </div>
                            {#if cashuTooltipText}
                                <Popover
                                    open={cashuPopoverState}
                                    onOpenChange={(e) => (cashuPopoverState = e.open)}
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
                                </Popover>
                            {/if}
                            <div class="w-full flex flex-col gap-[5px]">
                                <label class="font-[500]" for="plattform-contribution"
                                    >Contribute to SatShoot</label
                                >
                                <Input
                                    id="plattform-contribution"
                                    type="number"
                                    step="1"
                                    min="0"
                                    placeholder="000,000"
                                    bind:value={paymentManager.payment.pledgedAmount}
                                    fullWidth
                                />
                            </div>
                            <!-- Payment Buttons for second Payee -->
                            <div class="flex flex-row justify-center gap-[5px]">
                                <Button
                                    grow
                                    classes="w-[200px] max-w-[200px]"
                                    onClick={paySatshootWithLN}
                                    disabled={paying || !paymentManager.payment.pledgedAmount}
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
                                    <Button
                                        grow
                                        classes="w-[200px] max-w-[200px]"
                                        onClick={paySatshootWithCashu}
                                        disabled={paying ||
                                            !canPayWithCashu ||
                                            !paymentManager.payment.pledgedAmount}
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
                                    </Button>
                                {:else}
                                    <Button
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
                                    </Button>
                                {/if}
                            </div>
                        </div>
                        <!-- Payment Summary -->
                        <div
                            class="w-full flex flex-row flex-wrap gap-[10px] pt-[10px] mt-[10px] border-t-[1px] border-black-100 dark:border-white-100"
                        >
                            <p class="grow-1 text-center">
                                Freelancer gets: {insertThousandSeparator(
                                    paymentShares?.freelancerShare ?? 0
                                )} sats
                            </p>
                            <p class="grow-1 text-center">
                                SatShoot gets: {insertThousandSeparator(
                                    paymentShares?.satshootShare ?? 0
                                ) +
                                    ' + ' +
                                    insertThousandSeparator(
                                        paymentManager.payment.pledgedAmount ?? 0
                                    ) +
                                    ' = ' +
                                    insertThousandSeparator(
                                        paymentShares?.totalSatshootAmount ?? 0
                                    ) +
                                    ' sats'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>

<LoginModal bind:isOpen={showLoginModal} />
