<script lang="ts">
    import { Pricing, type OfferEvent } from '$lib/events/OfferEvent';
    import { ReviewType } from '$lib/events/ReviewEvent';
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
    import { offerMakerToSelect } from '$lib/stores/messages';
    import ndk from '$lib/stores/ndk';
    import { paymentDetail } from '$lib/stores/payment';
    import currentUser from '$lib/stores/user';
    import { wot } from '$lib/stores/wot';
    import { insertThousandSeparator, SatShootPubkey } from '$lib/utils/misc';
    import {
        NDKKind,
        NDKNutzap,
        zapInvoiceFromEvent,
        type NDKEvent,
        type NDKFilter,
    } from '@nostr-dev-kit/ndk';
    import type { ExtendedBaseType, NDKEventStore } from '@nostr-dev-kit/ndk-svelte';
    import { getModalStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
    import { formatDate, formatDistanceToNow } from 'date-fns';
    import { onDestroy, onMount } from 'svelte';
    import PaymentModal from '../Modals/PaymentModal.svelte';
    import TakeOfferModal from '../Modals/TakeOfferModal.svelte';
    import ExpandableText from '../UI/Display/ExpandableText.svelte';
    import UserProfile from '../UI/Display/UserProfile.svelte';
    import NewReputationCard from './NewReputationCard.svelte';

    const modalStore = getModalStore();

    export let offer: OfferEvent;

    let freelancerPaid = 0;
    let satshootPaid = 0;
    let freelancerPaymentStore: NDKEventStore<NDKEvent>;
    let satshootPaymentStore: NDKEventStore<NDKEvent>;

    let jobFilter: NDKFilter<NDKKind.FreelanceTicket> = {
        kinds: [NDKKind.FreelanceTicket],
        '#d': [],
    };
    let dTagOfJob: string;
    let jobStore: NDKEventStore<ExtendedBaseType<TicketEvent>>;
    let job: TicketEvent | undefined = undefined;
    let pricing: string = '';

    let winner = false;
    let status = '?';
    let statusColor = 'text-primary-400-500-token';

    let myJob = false;
    $: if ($currentUser && job && $currentUser.pubkey === job.pubkey) {
        myJob = true;
    } else {
        myJob = false;
    }

    let showPaymentButton = false;
    $: if (myJob && winner) {
        showPaymentButton = true;
    } else {
        showPaymentButton = false;
    }

    $: if (offer) {
        dTagOfJob = offer.referencedTicketAddress.split(':')[2];
        jobFilter['#d'] = [dTagOfJob];

        switch (offer.pricing) {
            case Pricing.Absolute:
                pricing = 'sats';
                break;
            case Pricing.SatsPerMin:
                pricing = 'sats/min';
                break;
        }

        freelancerPaymentStore = $ndk.storeSubscribe(
            [
                { kinds: [NDKKind.Zap], '#e': [offer.id] },
                { kinds: [NDKKind.Nutzap], '#a': [offer.offerAddress] },
            ],
            {
                closeOnEose: false,
                groupable: true,
                groupableDelay: 1500,
                autoStart: true,
            }
        );

        satshootPaymentStore = $ndk.storeSubscribe(
            [
                {
                    kinds: [NDKKind.Zap],
                    '#p': [SatShootPubkey],
                    '#a': [offer.referencedTicketAddress],
                },
                {
                    kinds: [NDKKind.Nutzap],
                    '#p': [SatShootPubkey],
                    '#a': [offer.referencedTicketAddress],
                },
            ],
            {
                closeOnEose: false,
                groupable: true,
                groupableDelay: 1500,
                autoStart: true,
            }
        );
    }

    $: if ($jobStore?.length > 0) {
        job = $jobStore[0];
        const winnerId = job.acceptedOfferAddress;
        if (winnerId === offer!.offerAddress) {
            winner = true;
            status = 'Won';
            statusColor = 'text-warning-500';
        } else if (winnerId || job.isClosed()) {
            status = 'Lost';
            statusColor = 'text-error-500';
        } else {
            // The winner is defined but it is not us so our offer lost
            // OR the ticket does not have a winner but it is closed
            status = 'Pending';
            statusColor = 'text-primary-400-500-token';
        }
    }

    $: if ($freelancerPaymentStore) {
        freelancerPaid = 0;
        $freelancerPaymentStore.forEach((zap: NDKEvent) => {
            if (zap.kind === NDKKind.Zap) {
                const zapInvoice = zapInvoiceFromEvent(zap);
                if (zapInvoice) {
                    const zappee = zapInvoice.zappee;
                    if ($wot.has(zappee)) {
                        freelancerPaid += Math.round(zapInvoice.amount / 1000);
                    }
                }
            } else if (zap.kind === NDKKind.Nutzap) {
                const nutzap = NDKNutzap.from(zap);
                if (nutzap) {
                    if ($wot.has(nutzap.pubkey)) {
                        freelancerPaid += Math.round(nutzap.amount / 1000);
                    }
                }
            }
        });
    }

    $: if ($satshootPaymentStore) {
        satshootPaid = 0;
        $satshootPaymentStore.forEach((zap: NDKEvent) => {
            if (zap.kind === NDKKind.Zap) {
                const zapInvoice = zapInvoiceFromEvent(zap);
                if (zapInvoice) {
                    const zappee = zapInvoice.zappee;
                    if ($wot.has(zappee)) {
                        satshootPaid += Math.round(zapInvoice.amount / 1000);
                    }
                }
            } else if (zap.kind === NDKKind.Nutzap) {
                const nutzap = NDKNutzap.from(zap);
                if (nutzap) {
                    if ($wot.has(nutzap.pubkey)) {
                        satshootPaid += Math.round(nutzap.amount / 1000);
                    }
                }
            }
        });
    }

    function startJobSub() {
        if (jobFilter['#d']!.length > 0) {
            jobStore = $ndk.storeSubscribe<TicketEvent>(
                jobFilter,
                {
                    autoStart: true,
                    closeOnEose: false,
                    groupable: true,
                    groupableDelay: 1000,
                },
                TicketEvent
            );
        } else {
            console.log('Cannot start job sub! Filter does not contain a job d-tag!');
        }
    }

    function setChatPartner() {
        $offerMakerToSelect = offer.pubkey;
    }

    onMount(async () => {
        startJobSub();
    });

    onDestroy(() => {
        if (jobStore) jobStore.empty();
        if (freelancerPaymentStore) freelancerPaymentStore.empty();
        if (satshootPaymentStore) satshootPaymentStore.empty();
    });

    function takeOffer() {
        if (job) {
            const modalComponent: ModalComponent = {
                ref: TakeOfferModal,
                props: { ticket: job, offer: offer },
            };

            const modal: ModalSettings = {
                type: 'component',
                component: modalComponent,
            };
            modalStore.trigger(modal);
        }
    }

    function handlePay() {
        $paymentDetail = {
            ticket: job!,
            offer,
        };

        const modalComponent: ModalComponent = {
            ref: PaymentModal,
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.clear();
        modalStore.trigger(modal);
    }

    const offerActionBtnClasses =
        'transition ease duration-[0.3s] outline outline-[1px] outline-[rgb(0,0,0,0.1)] py-[6px] px-[12px] ' +
        'rounded-[4px] transform whitespace-nowrap flex flex-row justify-center items-center gap-[8px] font-[600] ' +
        'text-[rgb(255,255,255,0.5)] bg-[rgb(59,115,246)] hover:bg-[#3b82f6] hover:text-white max-[768px]:grow-[1]';
</script>

<div
    class="w-full flex flex-col gap-[15px] rounded-[8px] p-[15px] shadow-[0_0_4px_0_rgba(0,0,0,0.1)] bg-white flex-wrap"
>
    <UserProfile pubkey={offer.pubkey} />
    <NewReputationCard user={offer.pubkey} type={ReviewType.Freelancer} />
    <div class="w-full border-[1px] border-[rgb(0,0,0,0.1)] rounded-[4px] bg-[rgb(0,0,0,0.05)]">
        <ExpandableText text={offer.description} maxCharacters={200} />
        <div
            class="w-full flex flex-row flex-wrap gap-[10px] justify-between p-[5px] border-t-[1px] border-t-[rgb(0,0,0,0.1)]"
        >
            <div class="grow-[1]">
                <p class="font-[500]">
                    Offer cost:
                    <span class="font-[300]">
                        {insertThousandSeparator(offer.amount) + ' ' + pricing}
                    </span>
                </p>
            </div>
            <div class="grow-[1]">
                <p class="font-[500]">
                    Pledge split:
                    <span class="font-[300]"> {offer.pledgeSplit + ' %'} </span>
                </p>
            </div>
        </div>
    </div>
    <div
        class="w-full flex flex-row flex-wrap gap-[5px] border-t-[1px] border-t-[rgb(0,0,0,0.1)] pl-[5px] pr-[5px] pt-[10px]"
    >
        {#if offer.created_at}
            <p class="font-[500] grow-[1] flex flex-row flex-wrap">
                Offer published on:
                <span class="font-[300]">
                    {formatDate(offer.created_at * 1000, 'dd-MMM-yyyy, h:m a') +
                        ', ' +
                        formatDistanceToNow(offer.created_at * 1000) +
                        ' Ago'}
                </span>
            </p>
        {/if}
        <p class="font-[500] grow-[1] flex flex-row flex-wrap">
            Status:
            <span class="ml-[5px] font-[300] {statusColor}"> {status} </span>
        </p>
    </div>
    <div
        class="w-full flex flex-row flex-wrap gap-[5px] border-t-[1px] border-t-[rgb(0,0,0,0.1)] pl-[5px] pr-[5px] pt-[10px] justify-end"
    >
        {#if myJob && job && job.status === TicketStatus.New}
            <button class={offerActionBtnClasses} on:click={takeOffer}> Take offer </button>
        {/if}

        {#if showPaymentButton}
            <button class={offerActionBtnClasses} on:click={handlePay}> Pay </button>
        {/if}

        {#if job && myJob}
            <a
                on:click={setChatPartner}
                href={'/messages/' + job.encode()}
                class={offerActionBtnClasses}
            >
                Message
            </a>
        {/if}
    </div>
</div>
