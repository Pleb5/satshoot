<script lang="ts">
    import { Popover } from '@skeletonlabs/skeleton-svelte';
    import UserProfile from '../UI/Display/UserProfile.svelte';
    import { JobEvent } from '$lib/events/JobEvent';
    import { BidEvent } from '$lib/events/BidEvent';
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import { OrderEvent } from '$lib/events/OrderEvent';
    import { PaymentManagerService } from '$lib/services/payments';
    import { insertThousandSeparator } from '$lib/utils/misc';
    import { goto } from '$app/navigation';
    import { onDestroy } from 'svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import Card from '../UI/Card.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    interface Props {
        isOpen: boolean;
        targetEntity: JobEvent | ServiceEvent;
        secondaryEntity: BidEvent | OrderEvent;
    }

    let { isOpen = $bindable(), targetEntity, secondaryEntity }: Props = $props();

    let cashuPopoverState = $state(false);
    let paymentManager = $state<PaymentManagerService | undefined>(undefined);

    // Initialize payment manager when entities are available
    $effect(() => {
        if (targetEntity && secondaryEntity) {
            paymentManager = new PaymentManagerService(targetEntity, secondaryEntity);
        }
    });

    const bech32ID = $derived(targetEntity.encode());

    const freelancerPubkey = $derived(
        secondaryEntity instanceof BidEvent ? secondaryEntity.pubkey : targetEntity.pubkey
    );

    const pledgeSplit = $derived.by(() => {
        if (secondaryEntity instanceof BidEvent) {
            return secondaryEntity.pledgeSplit;
        } else if (targetEntity instanceof ServiceEvent) {
            return targetEntity.pledgeSplit;
        }

        return 0;
    });

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
    async function payWithLN() {
        if (!paymentManager) return;
        await paymentManager.payWithLightning();
    }

    async function payWithEcash() {
        if (!paymentManager) return;
        await paymentManager.payWithCashu();
    }

    function setupEcash() {
        goto('/my-cashu-wallet/');
    }

    onDestroy(() => {
        paymentManager?.destroy();
    });
</script>

<ModalWrapper bind:isOpen title="Pay Freelancer">
    {#if targetEntity && secondaryEntity && paymentManager}
        <div class="w-full flex flex-col">
            <!-- popups Share Job Post start -->
            <div class="w-full pt-[10px] px-[5px] flex flex-col gap-[10px]">
                <div
                    class="w-full flex flex-col gap-[10px] rounded-[4px] border-[1px] border-black-100 dark:border-white-100 p-[10px]"
                >
                    <UserProfile pubkey={freelancerPubkey} />
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
                                <span class="font-[300]"> {pledgeSplit} %</span>
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
                                    {$satshootPaid ? insertThousandSeparator($satshootPaid) : '?'} sats
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
                <div
                    class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[5px] border-[1px] border-black-100 dark:border-white-100 rounded-[4px] px-[10px] py-[10px]"
                >
                    <p class="">Compensation for:</p>

                    <a href={'/' + bech32ID + '/'} class="anchor font-[600]">
                        {targetEntity.title}
                    </a>
                </div>
                <div
                    class="w-full max-h-[50vh] overflow-auto flex flex-col gap-[5px] border-[1px] border-black-100 dark:border-white-100 rounded-[4px] px-[10px] py-[10px]"
                >
                    <div class="w-full flex flex-col gap-[5px]">
                        <div class="w-full flex flex-col gap-[5px]">
                            <label class="font-[500]" for="service-payment">Pay for service</label>
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
                    </div>
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
                                insertThousandSeparator(paymentManager.payment.pledgedAmount ?? 0) +
                                ' = ' +
                                insertThousandSeparator(paymentShares?.totalSatshootAmount ?? 0) +
                                ' sats'}
                        </p>
                    </div>
                </div>
                <div class="flex flex-row justify-center">
                    <div class="flex flex-col gap-[5px]">
                        <div class="flex flex-row">
                            <Button
                                grow
                                classes="w-[200px] max-w-[200px]"
                                onClick={payWithLN}
                                disabled={paying}
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
                        </div>
                        <div class="flex flex-row items-center gap-[2px]">
                            {#if hasSenderEcashSetup}
                                <Button
                                    grow
                                    classes="w-[200px] max-w-[200px]"
                                    onClick={payWithEcash}
                                    disabled={paying || !canPayWithCashu}
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
                                <Button grow classes="w-[200px] max-w-[200px]" onClick={setupEcash}>
                                    {#if paying}
                                        <span>
                                            <ProgressRing />
                                        </span>
                                    {/if}
                                    <span> Setup Nostr Wallet </span>
                                </Button>
                            {/if}

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
                        </div>
                    </div>
                </div>
            </div>
            <!-- popups Share Job Post end -->
        </div>
    {:else}
        <h2 class="h2 font-bold text-center text-error-300-600">Error: Job & Bid is missing!</h2>
    {/if}
</ModalWrapper>
