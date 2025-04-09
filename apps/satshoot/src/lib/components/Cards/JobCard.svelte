<script lang="ts">
    import { TicketEvent } from '$lib/events/TicketEvent';
    import { getJobStatusColor, getJobStatusString } from '$lib/utils/job';
    import { formatDate } from 'date-fns';
    import JobPostMenu from '../Modals/JobPostMenu.svelte';
    import Card from '../UI/Card.svelte';
    import Button from '../UI/Buttons/Button.svelte';
    import Markdown from './Markdown.svelte';

    interface Props {
        job: TicketEvent;
        tagCallback?: ((tag: string) => void) | null;
    }

    let { job, tagCallback = null }: Props = $props();

    let showJobPostMenu = $state(false);

    let statusString = $derived(getJobStatusString(job.status));
    let statusColor = $derived(getJobStatusColor(job.status));

    function handleOptionClick() {
        showJobPostMenu = true;
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
        <h1 class="w-full text-center font-[700] text-[32px]">{job.title || 'No Title!'}</h1>
    </div>
    <div class={statusRowWrapperClasses}>
        <p title="Job Status" class="{statusRowItemClasses} {statusColor}">
            <i class="bx bx-info-circle"></i>
            Job Status: {statusString}
        </p>
        {#if job.created_at}
            <p title="Edit Date/Time" class={statusRowItemClasses}>
                <i class="bx bx-edit-alt"></i>
                {formatDate(job.created_at * 1000, 'dd-MMM-yyyy, h:m:ss a')}
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
        <Button title="Options" on:click={handleOptionClick}>
            <i class="bx bx-dots-vertical-rounded"></i>
        </Button>
    </div>
    <div class="w-full flex flex-col gap-[10px]">
        <Markdown content={job.description} />
    </div>
</Card>

{#if job.tTags.length > 0}
    <Card classes="flex-row flex-wrap">
        {#each job.tTags as tag}
            <button
                class={tagItemClasses}
                onclick={() => {
                    if (tagCallback) tagCallback(tag[1]);
                }}
            >
                {tag[1]}
            </button>
        {/each}
    </Card>
{/if}

<JobPostMenu bind:isOpen={showJobPostMenu} {job} />
