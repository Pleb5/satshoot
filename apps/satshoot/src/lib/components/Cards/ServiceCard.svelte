<script lang="ts">
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import { getServiceStatusColor, getServiceStatusString } from '$lib/utils/service';
    import { formatDate } from 'date-fns';
    import Card from '../UI/Card.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Markdown from './Markdown.svelte';
    import Carousel from '../UI/Display/Carousel.svelte';
    import { insertThousandSeparator } from '$lib/utils/misc';
    import { Pricing } from '$lib/events/types';
    import { wot } from '$lib/stores/wot';
    import ReputationCard from './ReputationCard.svelte';
    import { ReviewType } from '$lib/events/ReviewEvent';
    import UserProfile from '../UI/Display/UserProfile.svelte';
    import ServiceMenu from '../Modals/ServiceMenu.svelte';
    import { OrderStatus, type OrderEvent } from '$lib/events/OrderEvent';
    import OrdersCountBreakdown from '../Modals/OrdersCountBreakdown.svelte';
    import ShareIcon from '../Icons/ShareIcon.svelte';
    import { toaster } from '$lib/stores/toaster';
    import { getPubkeyFromNpubOrNprofile } from '$lib/utils/nip19';

    interface Props {
        service: ServiceEvent;
        allOrders: OrderEvent[];
    }

    let { service, allOrders }: Props = $props();

    let showServiceMenu = $state(false);
    let showOrderPriceBreakdownModal = $state(false);
    let statusString = $derived(getServiceStatusString(service.status));
    let statusColor = $derived(getServiceStatusColor(service.status));

    const pricing = $derived.by(() => {
        if (service.pricing === Pricing.Absolute) return 'sats';
        if (service.pricing === Pricing.Hourly) return 'sats/hour';

        return '';
    });

    const fulfilledOrders = $derived(
        allOrders.filter(
            (order) =>
                $wot.has(order.pubkey) &&
                service.orders.includes(order.orderAddress) &&
                order.status === OrderStatus.Fulfilled
        )
    );

    const sponsoredPubkey = getPubkeyFromNpubOrNprofile(service.sponsoredNpub);

    function handleOptionClick() {
        showServiceMenu = true;
    }

    const shareService = () => {
        const shareURL = `https://satshoot.com/${service.encode()}`;
        navigator.clipboard.writeText(shareURL).then(() =>
            toaster.success({
                title: 'Service Link Copied!',
            })
        );
    };

    const statusRowWrapperClasses =
        'w-full flex flex-row gap-[5px] flex-wrap justify-around rounded-[4px] ' +
        'border-[1px] border-black-100 dark:border-white-100 text-black-500 dark:text-white font-[600] p-[5px]';

    const statusRowItemClasses =
        'transition ease duration-[0.3s] flex flex-row gap-[5px] justify-center grow-1 items-center ' +
        'px-[10px] py-[5px] rounded-[4px] hover:text-white hover:bg-blue-500 max-[768px]:justify-start';

    const tagItemClasses =
        'transition ease duration-[0.3s] flex flex-row px-[10px] py-[5px] border-[1px] border-black-200 dark:border-white-200 ' +
        'rounded-[4px] font-[500] text-black-500 dark:text-white hover:bg-blue-500 hover:text-white hover:border-transparent';
</script>

<ServiceMenu bind:isOpen={showServiceMenu} {service} />

<Card classes="gap-[15px]">
    <div class="w-full flex flex-col gap-[5px]">
        <h1 class="w-full text-center font-[700] max-sm:text-lg sm:text-[32px]">
            {service.title || 'No Title!'}
        </h1>
    </div>
    <div class={statusRowWrapperClasses}>
        <p title="Service Status" class="{statusRowItemClasses} {statusColor}">
            <i class="bx bx-info-circle"></i>
            Service Status: {statusString}
        </p>
        {#if service.publishedAt}
            <p title="Edit Date/Time" class={statusRowItemClasses}>
                <i class="bx bx-edit-alt"></i>
                {formatDate(service.publishedAt * 1000, 'dd-MMM-yyyy, h:m:ss a')}
            </p>
        {/if}
        <Button title="Options" onClick={handleOptionClick}>
            <i class="bx bx-dots-vertical-rounded"></i>
        </Button>
    </div>
    <Button onClick={shareService}>
        Share
        <ShareIcon />
    </Button>
    {#if service.images.length}
        <Carousel imageUrls={service.images} />
    {/if}
    <div
        class="w-full flex flex-col gap-[10px] rounded-[4px] border-[1px] border-black-100 dark:border-white-100"
    >
        <Markdown content={service.description || 'No Description!'} />
    </div>
</Card>

{#if service.tTags.length > 0}
    <Card classes="flex-row flex-wrap">
        {#each service.tTags as tag}
            <button class={tagItemClasses}>
                {tag[1]}
            </button>
        {/each}
    </Card>
{/if}

<Card>
    <div class="w-full flex flex-row flex-wrap gap-[10px] items-center">
        <div class="grow-1">
            <p class="font-[500]">
                Price:
                <span class="font-[300]">
                    {insertThousandSeparator(service.amount) + ' ' + pricing}
                </span>
            </p>
        </div>

        <div class="grow-1">
            <p class="font-[500]">
                Pledge split:
                <span class="font-[300]"> {service.pledgeSplit + ' %'} </span>
            </p>
        </div>

        <div class="grow-1">
            <p class="font-[500]">
                Sponsoring split:
                <span class="font-[300]"> {service.sponsoringSplit + ' %'} </span>
            </p>
        </div>

        {#if sponsoredPubkey}
            <div class="gorw-1 flex flex-row gap-[20px] items-center">
                <p class="font-[500]">for:</p>
                <UserProfile pubkey={sponsoredPubkey} />
            </div>
        {/if}
        <div class="grow-1">
            <Button
                variant="outlined"
                classes="outline-yellow-500 dark:outline-yellow-600"
                onClick={() => (showOrderPriceBreakdownModal = true)}
            >
                <span>Orders: </span>
                <span class="font-[300]">{fulfilledOrders.length}</span>
            </Button>
        </div>
    </div>
</Card>

<Card classes="flex flex-row flex-wrap gap-[10px] items-center">
    <div class="grow-1">
        <UserProfile pubkey={service.pubkey} />
    </div>
    <div class="grow-1">
        <ReputationCard
            user={service.pubkey}
            type={ReviewType.Freelancer}
            serviceAddress={service.serviceAddress}
        />
    </div>
</Card>

<OrdersCountBreakdown bind:isOpen={showOrderPriceBreakdownModal} {fulfilledOrders} />
