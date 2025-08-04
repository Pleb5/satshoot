<script lang="ts">
    import { OrderStatus, type OrderEvent } from '$lib/events/OrderEvent';
    import { ReviewType } from '$lib/events/ReviewEvent';
    import {
        type NDKFilter,
        NDKKind,
        NDKSubscriptionCacheUsage,
        NDKUser,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import Button from '../UI/Buttons/Button.svelte';
    import Card from '../UI/Card.svelte';
    import ExpandableText from '../UI/Display/ExpandableText.svelte';
    import UserProfile from '../UI/Display/UserProfile.svelte';
    import ReputationCard from './ReputationCard.svelte';
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import { onDestroy } from 'svelte';
    import { toaster } from '$lib/stores/toaster';
    import currentUser from '$lib/stores/user';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import { nip19 } from 'nostr-tools';
    import ProfileImage from '../UI/Display/ProfileImage.svelte';
    import { clientReviews } from '$lib/stores/reviews';
    import ReviewClientModal from '../Modals/ReviewClientModal.svelte';
    import ReviewModal from '../Notifications/ReviewModal.svelte';
    import SELECTED_QUERY_PARAM from '$lib/services/messages';
    import { goto } from '$app/navigation';
    import CloseEntityModal from '../Modals/CloseEntityModal.svelte';
    import ConfirmationDialog from '../UI/ConfirmationDialog.svelte';

    interface Props {
        order: OrderEvent;
        showServiceDetail?: boolean;
    }

    const { order, showServiceDetail = false }: Props = $props();

    let showReviewClientModal = $state(false);
    let showReviewModal = $state(false);
    let showCloseModal = $state(false);
    let showAcceptOrderConfirmationModal = $state(false);

    let servicePoster = $state<NDKUser | null>(null);
    let servicePosterProfile = $state<NDKUserProfile | null>(null);

    let servicePosterImage = $derived.by(() => {
        if (!servicePosterProfile) return '';

        return (
            servicePosterProfile?.picture ??
            servicePosterProfile?.image ??
            getRoboHashPicture(servicePoster!.pubkey)
        );
    });

    let servicePosterName = $derived.by(() => {
        if (!servicePosterProfile) return '?';

        return servicePosterProfile?.name ?? servicePoster!.npub.substring(0, 8);
    });

    const serviceFilter: NDKFilter<NDKKind.FreelanceService> = {
        kinds: [NDKKind.FreelanceService],
        '#d': [order.referencedServiceAddress.split(':')[2]],
    };

    const serviceStore = $ndk.storeSubscribe<ServiceEvent>(
        serviceFilter,
        {
            autoStart: false,
            closeOnEose: false,
            groupable: true,
            groupableDelay: 1000,
        },
        ServiceEvent
    );

    const service = $derived.by(() => {
        if ($serviceStore.length > 0) {
            return $serviceStore[0];
        }

        return null;
    });

    const myService = $derived(!!service && service.pubkey === $currentUser?.pubkey);

    const myOrder = $derived(order.pubkey === $currentUser?.pubkey);

    const review = $derived(
        $clientReviews.find((review) => review.reviewedEventAddress === order.orderAddress)
    );

    const canAcceptOrder = $derived(
        order.status === OrderStatus.Open
        && myService 
        && !service?.orders.includes(order.orderAddress)
    );

    const canReviewClient = $derived(
        !review &&
            myService &&
            order.status !== OrderStatus.Open &&
            service?.orders.includes(order.orderAddress)
    );

    const canPay = $derived(myOrder && service?.orders.includes(order.orderAddress));

    const canClose = $derived(
        order.status === OrderStatus.Open
        && canPay
    );

    let initialized = $state(false);
    $effect(() => {
        if ($sessionInitialized && !initialized) {
            initialized = true;
            serviceStore.startSubscription();
        }
    });

    $effect(() => {
        if (service) {
            setupServicePoster($ndk.getUser({ pubkey: service.pubkey }));
        }
    });

    const setupServicePoster = async (poster: NDKUser) => {
        servicePoster = poster;
        servicePosterProfile = await poster.fetchProfile({
            cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
        });
    };

    onDestroy(() => {
        if (serviceStore) serviceStore.empty();
    });

    async function handleAcceptOrder() {
        if (!service) {
            toaster.error({
                title: 'Service is not initialized yet!',
            });
            return;
        }


        service.tags.push(['a', order.orderAddress]);
        try {
            await service.publishReplaceable();
            toaster.success({
                title: 'Order Accepted',
            });
        } catch (error) {
            console.error(error);
            toaster.error({
                title: `Failed to accept order: ${error}`,
            });
        }
    }

    function handleReviewClient() {
        showReviewClientModal = true;
    }

    function handlePreviewReview() {
        showReviewModal = true;
    }

    function goToPay() {
        if (order) {
            const url = new URL('/payments/' + order.encode(), window.location.origin);
            goto(url.toString());
        } else {
            throw new Error('Cannot pay, Order not found!')
        }
    }

    function handleCloseOrder() {
        showCloseModal = true;
    }

    function goToChat() {
        if (!service) return;

        const url = new URL('/messages/' + service.encode(), window.location.origin);
        url.searchParams.append(SELECTED_QUERY_PARAM, order.pubkey);
        goto(url.toString());
    }
</script>

<div>
    <Card classes="flex-wrap gap-[15px]">
        <UserProfile pubkey={order.pubkey} />
        <ReputationCard user={order.pubkey} type={ReviewType.Client} />
        <div
            class="w-full border-[1px] border-black-100 dark:border-white-100 rounded-[4px] bg-black-50"
        >
            <ExpandableText text={order.description} maxCharacters={200} renderAsMarkdown />
        </div>
        {#if showServiceDetail && service}
            <div
                class="w-full flex flex-row flex-wrap items-center gap-[10px] border-t-[1px] border-t-black-100 dark:border-t-white-100 pl-[5px] pr-[5px] pt-[10px]"
            >
                <div class="font-[500] grow-1 flex flex-row items-center flex-wrap gap-[10px]">
                    <p>Service Title:</p>
                    <a href={'/' + service.encode() + '/'} class="link">
                        <h4 class="font-semibold text-[18px] overflow-hidden line-clamp-2">
                            {service.title}
                        </h4>
                    </a>
                </div>

                <div class="font-[500] grow-1 flex flex-row items-center flex-wrap gap-[10px]">
                    <p>Service Posted By:</p>
                    <a
                        href={'/' + nip19.npubEncode(service.pubkey)}
                        class="flex flex-row items-center grow-1 gap-[10px]"
                    >
                        {#if servicePosterImage}
                            <ProfileImage src={servicePosterImage} size="xs" />
                        {/if}
                        <span>{servicePosterName}</span>
                    </a>
                </div>
            </div>
        {/if}
        <div
            class="w-full flex flex-row justify-center flex-wrap gap-2 border-t-[1px] border-t-black-100 dark:border-t-white-100 pl-[5px] pr-[5px] pt-[10px]"
        >
            {#if canAcceptOrder}
                <Button 
                    onClick={
                        () => showAcceptOrderConfirmationModal = true
                    }>
                    Accept
                </Button>
            {/if}

            {#if canReviewClient}
                <Button onClick={handleReviewClient}>Review</Button>
            {:else if review}
                <Button onClick={handlePreviewReview}>Preview Review</Button>
            {/if}
            {#if canPay}
                <Button onClick={goToPay}>Pay</Button>
            {/if}
            {#if canClose}
                <Button onClick={handleCloseOrder}>Close</Button>
            {/if}
            {#if myService || myOrder}
                <Button onClick={goToChat}>Message</Button>
            {/if}
        </div>
    </Card>

    <ReviewClientModal bind:isOpen={showReviewClientModal} eventAddress={order.orderAddress} />

    {#if review}
        <ReviewModal bind:isOpen={showReviewModal} {review} />
    {/if}
</div>

{#if service}
    <CloseEntityModal
        bind:isOpen={showCloseModal}
        targetEntity={service!}
        secondaryEntity={order}
    />

    <ConfirmationDialog 
        bind:isOpen={showAcceptOrderConfirmationModal}
        title={"Do you really want to accept the Order?"}
        confirmText={"Accept Order"}
        onConfirm={handleAcceptOrder}
        onCancel={
            ()=>showAcceptOrderConfirmationModal = !showAcceptOrderConfirmationModal
        }
    />
{/if}

