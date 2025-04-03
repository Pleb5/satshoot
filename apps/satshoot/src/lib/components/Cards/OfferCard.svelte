<script lang="ts">
    import { Pricing, type OfferEvent } from '$lib/events/OfferEvent';
    import { ReviewEvent, ReviewType } from '$lib/events/ReviewEvent';
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
    import { offerMakerToSelect } from '$lib/stores/messages';
    import ndk from '$lib/stores/ndk';
    import {
        createPaymentFilters,
        createPaymentStore,
        paymentDetail,
        type PaymentStore,
    } from '$lib/stores/payment';
    import { freelancerReviews } from '$lib/stores/reviews';
    import currentUser from '$lib/stores/user';
    import { insertThousandSeparator } from '$lib/utils/misc';
    import { NDKKind, type NDKFilter } from '@nostr-dev-kit/ndk';
    import type { ExtendedBaseType, NDKEventStore } from '@nostr-dev-kit/ndk-svelte';
    import { getModalStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
    import { formatDate, formatDistanceToNow } from 'date-fns';
    import { nip19 } from 'nostr-tools';
    import { onDestroy, onMount } from 'svelte';
    import PaymentModal from '../Modals/PaymentModal.svelte';
    import TakeOfferModal from '../Modals/TakeOfferModal.svelte';
    import ReviewModal from '../Notifications/ReviewModal.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Card from '../UI/Card.svelte';
    import ExpandableText from '../UI/Display/ExpandableText.svelte';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import UserProfile from '../UI/Display/UserProfile.svelte';
    import ReputationCard from './ReputationCard.svelte';
    import { getRoboHashPicture } from '$lib/utils/helpers';

    const modalStore = getModalStore();

    export let offer: OfferEvent;
    export let skipUserProfile = false;
    export let skipReputation = false;
    export let showJobDetail = false;
    export let showPayments = false;

    let freelancerPaid = 0;
    let satshootPaid = 0;
    let freelancerPaymentStore: PaymentStore;
    let satshootPaymentStore: PaymentStore;

    let jobFilter: NDKFilter<NDKKind.FreelanceTicket> = {
        kinds: [NDKKind.FreelanceTicket],
        '#d': [],
    };
    let dTagOfJob: string;
    let jobStore: NDKEventStore<ExtendedBaseType<TicketEvent>>;
    let job: TicketEvent | undefined = undefined;
    let pricing: string = '';

    let jobPosterImage = '';
    let jobPosterName = '?';

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

    let review: ReviewEvent | undefined = undefined;
    $: if ($freelancerReviews) {
        review = $freelancerReviews.find(
            (review) => review.reviewedEventAddress === offer.offerAddress
        );
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

        const freelancerFilters = createPaymentFilters(offer, 'freelancer');
        const satshootFilters = createPaymentFilters(offer, 'satshoot');

        freelancerPaymentStore = createPaymentStore(freelancerFilters);
        satshootPaymentStore = createPaymentStore(satshootFilters);

        freelancerPaymentStore.totalPaid.subscribe((value) => {
            freelancerPaid = value;
        });

        satshootPaymentStore.totalPaid.subscribe((value) => {
            satshootPaid = value;
        });
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

    $: if (job) {
        const jobPoster = $ndk.getUser({ pubkey: job.pubkey });

        jobPosterImage = getRoboHashPicture(jobPoster.pubkey);
        jobPosterName = jobPoster.npub.substring(0, 8);

        jobPoster.fetchProfile().then((profile) => {
            if (profile) {
                if (profile.name) jobPosterName = profile.name;
                if (profile.picture) jobPosterImage = profile.picture;
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
        if (freelancerPaymentStore) freelancerPaymentStore.paymentStore.empty();
        if (satshootPaymentStore) satshootPaymentStore.paymentStore.empty();
    });

    function takeOffer() {
        if (job) {
            const modalComponent: ModalComponent = {
                ref: TakeOfferModal,
                props: { job, offer },
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

    function handlePreviewReview() {
        const modalComponent: ModalComponent = {
            ref: ReviewModal,
            props: { review },
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.clear();
        modalStore.trigger(modal);
    }
</script>

<Card classes="flex-wrap gap-[15px]">
    {#if !skipUserProfile}
        <UserProfile pubkey={offer.pubkey} />
    {/if}
    {#if !skipReputation}
        <ReputationCard user={offer.pubkey} type={ReviewType.Freelancer} />
    {/if}
    <div
        class="w-full border-[1px] border-black-100 dark:border-white-100 rounded-[4px] bg-black-50"
    >
        <ExpandableText text={offer.description} maxCharacters={200} renderAsMarkdown />
        <div
            class="w-full flex flex-row flex-wrap gap-[10px] justify-between p-[5px] border-t-[1px] border-t-black-100 dark:border-t-white-100"
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
            {#if showPayments}
                <div class="grow-[1]">
                    <p class="font-[500]">
                        Freelancer Paid:
                        <span class="font-[300]">
                            {insertThousandSeparator(freelancerPaid)} sats
                        </span>
                    </p>
                </div>
                <div class="grow-[1]">
                    <p class="font-[500]">
                        SatShoot Paid:
                        <span class="font-[300]">
                            {insertThousandSeparator(satshootPaid)} sats
                        </span>
                    </p>
                </div>
            {/if}
        </div>
    </div>
    <div
        class="w-full flex flex-row flex-wrap gap-[5px] border-t-[1px] border-t-black-100 dark:border-t-white-100 pl-[5px] pr-[5px] pt-[10px]"
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
            Offer Status:
            <span class="ml-[5px] font-[300] {statusColor}"> {status} </span>
        </p>
    </div>
    {#if showJobDetail && job}
        <div
            class="w-full flex flex-row flex-wrap items-center gap-[10px] border-t-[1px] border-t-black-100 dark:border-t-white-100 pl-[5px] pr-[5px] pt-[10px]"
        >
            <div class="font-[500] grow-[1] flex flex-row items-center flex-wrap gap-[10px]">
                <p>Job Title:</p>
                <a
                    href={'/' + job.encode() + '/'}
                    class="text-blue-600 hover:text-blue-800 hover:underline"
                >
                    <h4 class="font-semibold text-[18px] overflow-hidden line-clamp-2">
                        {job.title}
                    </h4>
                </a>
            </div>

            <div class="font-[500] grow-[1] flex flex-row items-center flex-wrap gap-[10px]">
                <p>Job Posted By:</p>
                <a
                    href={'/' + nip19.npubEncode(job.pubkey)}
                    class="flex flex-row items-center grow-[1] gap-[10px]"
                >
                    {#if jobPosterImage}
                        <ProfileImage src={jobPosterImage} size="xs" />
                    {/if}
                    <span>{jobPosterName}</span>
                </a>
            </div>
        </div>
    {/if}

    <div
        class="w-full flex flex-row flex-wrap gap-[5px] border-t-[1px] border-t-black-100 dark:border-t-white-100 pl-[5px] pr-[5px] pt-[10px] justify-end"
    >
        {#if myJob && job && job.status === TicketStatus.New}
            <Button on:click={takeOffer}>Take offer</Button>
        {/if}

        {#if showPaymentButton}
            <Button on:click={handlePay}>Pay</Button>
        {/if}

        {#if job && myJob}
            <Button on:click={setChatPartner} href={'/messages/' + job.encode()}>Message</Button>
        {/if}

        {#if review}
            <Button on:click={handlePreviewReview}>Preview Review</Button>
        {/if}
    </div>
</Card>
