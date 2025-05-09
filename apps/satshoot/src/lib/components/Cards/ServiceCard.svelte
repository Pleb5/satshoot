<script lang="ts">
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import { getServiceStatusColor, getServiceStatusString } from '$lib/utils/service';
    import { formatDate } from 'date-fns';
    // import ServicePostMenu from '../Modals/ServicePostMenu.svelte';
    import Card from '../UI/Card.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Markdown from './Markdown.svelte';
    import Carousel from '../UI/Display/Carousel.svelte';
    import { insertThousandSeparator } from '$lib/utils/misc';
    import { Pricing } from '$lib/events/types';

    interface Props {
        service: ServiceEvent;
    }

    let { service }: Props = $props();

    let showServicePostMenu = $state(false);

    let statusString = $derived(getServiceStatusString(service.status));
    let statusColor = $derived(getServiceStatusColor(service.status));

    const pricing = $derived.by(() => {
        if (service.pricing === Pricing.Absolute) return 'sats';
        if (service.pricing === Pricing.SatsPerMin) return 'sats/min';

        return '';
    });

    function handleOptionClick() {
        showServicePostMenu = true;
    }

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

<Card classes="gap-[15px]">
    <div class="w-full flex flex-col gap-[5px]">
        <h1 class="w-full text-center font-[700] text-[32px]">{service.title || 'No Title!'}</h1>
    </div>
    <div class={statusRowWrapperClasses}>
        <p title="Service Status" class="{statusRowItemClasses} {statusColor}">
            <i class="bx bx-info-circle"></i>
            Service Status: {statusString}
        </p>
        {#if service.created_at}
            <p title="Edit Date/Time" class={statusRowItemClasses}>
                <i class="bx bx-edit-alt"></i>
                {formatDate(service.created_at * 1000, 'dd-MMM-yyyy, h:m:ss a')}
            </p>
        {/if}
        <a
            title="Publication Source"
            href="https://satshoot.com/"
            target="_blank"
            class={statusRowItemClasses}
        >
            <i class="bx bx-globe"></i>
            satshoot.com
        </a>
        <Button title="Options" onClick={handleOptionClick}>
            <i class="bx bx-dots-vertical-rounded"></i>
        </Button>
    </div>
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
    <div class="w-full flex flex-row flex-wrap gap-[10px]">
        <div class="grow-1">
            <p class="font-[500]">
                Service cost:
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
    </div>
</Card>

<!-- <ServicePostMenu bind:isOpen={showServicePostMenu} {service} /> -->
