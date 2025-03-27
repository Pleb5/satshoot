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

    interface Props {
        offer: OfferEvent;
        skipUserProfile?: boolean;
        skipReputation?: boolean;
        showJobDetail?: boolean;
        showPayments?: boolean;
    }

    let {
        offer,
        skipUserProfile = false,
        skipReputation = false,
        showJobDetail = false,
        showPayments = false,
    }: Props = $props();

    let freelancerPaid = $state(0);
    let satshootPaid = $state(0);

    const freelancerPaymentStore = $derived.by(() => {
        const freelancerFilters = createPaymentFilters(offer, 'freelancer');
        return createPaymentStore(freelancerFilters);
    });

    const satshootPaymentStore = $derived.by(() => {
        const satshootFilters = createPaymentFilters(offer, 'satshoot');
        return createPaymentStore(satshootFilters);
    });

    const jobStore = $derived.by(() => {
        const jobFilter: NDKFilter<NDKKind.FreelanceTicket> = {
            kinds: [NDKKind.FreelanceTicket],
            '#d': [offer.referencedTicketAddress.split(':')[2]],
        };

        return $ndk.storeSubscribe<TicketEvent>(
            jobFilter,
            {
                autoStart: true,
                closeOnEose: false,
                groupable: true,
                groupableDelay: 1000,
            },
            TicketEvent
        );
    });

    const job = $derived.by(() => {
        if ($jobStore.length > 0) {
            return $jobStore[0];
        }

        return undefined;
    });

    const winner = $derived(!!job && job.acceptedOfferAddress === offer.offerAddress);

    const { status, statusColor } = $derived.by(() => {
        if (!job)
            return {
                status: '?',
                statusColor: 'text-primary-400-500-token',
            };

        const winnerId = job.acceptedOfferAddress;
        if (winnerId === offer!.offerAddress) {
            return { status: 'Won', statusColor: 'text-warning-500' };
        } else if (winnerId || job.isClosed()) {
            return { status: 'Lost', statusColor: 'text-error-500' };
        } else {
            return { status: 'Pending', statusColor: 'text-primary-400-500-token' };
        }
    });

    const pricing = $derived.by(() => {
        if (offer.pricing === Pricing.Absolute) return 'sats';
        if (offer.pricing === Pricing.SatsPerMin) return 'sats/min';

        return '';
    });

    const myJob = $derived(!!$currentUser && !!job && $currentUser.pubkey === job.pubkey);

    const showPaymentButton = $derived(myJob && winner);

    const review = $derived.by(() => {
        if ($freelancerReviews) {
            return $freelancerReviews.find(
                (review) => review.reviewedEventAddress === offer.offerAddress
            );
        }
        return undefined;
    });

    const jobPoster = $derived(job ? $ndk.getUser({ pubkey: job.pubkey }) : null);

    let jobPosterImage = $state('');
    let jobPosterName = $state('?');

    // Reactive effect to handle profile fetching
    $effect(() => {
        if (jobPoster) {
            // Set initial values
            jobPosterImage = getRoboHashPicture(jobPoster.pubkey);
            jobPosterName = jobPoster.npub.substring(0, 8);

            // Fetch and update profile asynchronously
            jobPoster.fetchProfile().then((profile) => {
                if (profile) {
                    if (profile.name) jobPosterName = profile.name;
                    if (profile.image) jobPosterImage = profile.image;
                }
            });
        }
    });

    $effect(() => {
        const unSubscribe = freelancerPaymentStore.totalPaid.subscribe((value) => {
            freelancerPaid = value;
        });

        return () => {
            unSubscribe();
        };
    });

    $effect(() => {
        const unSubscribe = satshootPaymentStore.totalPaid.subscribe((value) => {
            satshootPaid = value;
        });

        return () => {
            unSubscribe();
        };
    });

    function setChatPartner() {
        $offerMakerToSelect = offer.pubkey;
    }

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
