<script lang="ts">
    import { TicketEvent } from '$lib/events/TicketEvent';
    import { getJobStatusColor, getJobStatusString } from '$lib/utils/job';
    import { linkifyText } from '$lib/utils/misc';
    import { getModalStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
    import { formatDate } from 'date-fns';
    import JobPostMenu from '../Modals/JobPostMenu.svelte';

    const modalStore = getModalStore();

    export let job: TicketEvent;
    export let tagCallback: ((tag: string) => void) | null = null;

    $: statusString = getJobStatusString(job.status);
    $: statusColor = getJobStatusColor(job.status);
    $: processedDescription = job.description ? linkifyText(job.description) : 'No description!';

    function handleOptionClick() {
        const modalComponent: ModalComponent = {
            ref: JobPostMenu,
            props: { job },
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.trigger(modal);
    }

    const statusRowWrapperClasses =
        'w-full flex flex-row gap-[5px] flex-wrap justify-around rounded-[4px] ' +
        'border-[1px] border-[rgb(0,0,0,0.1)] text-[rgb(0,0,0,0.5)] font-[600] p-[5px]';

    const statusRowItemClasses =
        'transition ease duration-[0.3s] flex flex-row gap-[5px] justify-center grow-[1] items-center ' +
        'px-[10px] py-[5px] rounded-[4px] hover:text-white hover:bg-[#3b73f6] max-[768px]:justify-start';

    const optionsBtnClasses =
        'transition ease duration-[0.3s] flex flex-row gap-[5px] justify-center items-center px-[10px] ' +
        'py-[5px] rounded-[4px] hover:text-white hover:bg-[#3b73f6] max-[768px]:justify-start';

    const tagsWrapperClasses =
        'w-full flex flex-row gap-[10px] rounded-[8px] ' +
        'p-[15px] shadow-[0_0_4px_0_rgba(0,0,0,0.1)] bg-white flex-wrap';

    const tagItemClasses =
        'transition ease duration-[0.3s] flex flex-row px-[10px] py-[5px] border-[1px] border-[rgb(0,0,0,0.15)] ' +
        'rounded-[4px] font-[500] text-[rgb(0,0,0,0.5)] hover:bg-[rgb(59,115,246)] hover:text-white hover:border-[rgb(0,0,0,0.0)]';
</script>

<div
    class="w-full flex flex-col gap-[15px] rounded-[8px] p-[15px] shadow-[0_0_4px_0_rgba(0,0,0,0.1)] bg-white"
>
    <div class="w-full flex flex-col gap-[5px]">
        <h1 class="w-full text-center font-[700] text-[32px]">{job.title || 'No Title!'}</h1>
    </div>
    <div class={statusRowWrapperClasses}>
        <p title="Publication Date/Time" class="{statusRowItemClasses} {statusColor}">
            <i class="bx bx-info-circle" />
            Status: {statusString}
        </p>
        {#if job.created_at}
            <p title="Publication Date/Time" class={statusRowItemClasses}>
                <i class="bx bxs-news" />
                {formatDate(job.created_at * 1000, 'dd-MMM-yyyy, h:m:ss a')}
            </p>
        {/if}
        {#if job.created_at}
            <p title="Edit Date/Time" class={statusRowItemClasses}>
                <i class="bx bx-edit-alt" />
                {formatDate(job.created_at * 1000, 'dd-MMM-yyyy, h:m:ss a')}
            </p>
        {/if}
        <a
            title="Publication Source"
            href="https://satshoot.com/"
            target="_blank"
            class={statusRowItemClasses}
        >
            <i class="bx bx-globe" />
            satshoot.com
        </a>
        <button title="Options" class={optionsBtnClasses} on:click={handleOptionClick}>
            <i class="bx bx-dots-vertical-rounded" />
        </button>
    </div>
    <div class="w-full flex flex-col gap-[10px]">
        {@html processedDescription}
    </div>
</div>
{#if job.tTags.length > 0}
    <div class={tagsWrapperClasses}>
        {#each job.tTags as tag}
            <button
                class={tagItemClasses}
                on:click={() => {
                    if (tagCallback) tagCallback(tag[1]);
                }}
            >
                {tag[1]}
            </button>
        {/each}
    </div>
{/if}
