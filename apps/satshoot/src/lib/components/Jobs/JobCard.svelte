<script lang="ts">
    import { TicketEvent } from '$lib/events/TicketEvent';
    import Button from '../UI/Buttons/Button.svelte';
    import Card from '../UI/Card.svelte';
    import Author from './Author.svelte';
    import JobActions from './JobActions.svelte';
    import JobDetails from './JobDetails.svelte';

    export let ticket: TicketEvent;
    let bech32ID = '';

    $: if (ticket) {
        bech32ID = ticket.encode();
    }

    enum Tabs {
        JobDescription,
        Author,
        Actions,
    }

    const tabs = [
        {
            icon: 'bxs-card',
            name: Tabs.JobDescription,
        },
        {
            icon: 'bxs-user',
            name: Tabs.Author,
        },
        {
            icon: 'bxs-grid-alt',
            name: Tabs.Actions,
        },
    ];

    let selectedTab = Tabs.JobDescription;

    const jobCardBtnClasses = 'border-0 scale-100 ' + 'flex-grow ';
</script>

<Card classes="border-[1px_solid_rgba(0,0,0,0.1)] gap-[0px]  overflow-hidden p-[0px]">
    <div class="jobCardDetails w-full flex flex-col gap-[0px] p-[10px] min-h-[165px]">
        {#if selectedTab === Tabs.JobDescription}
            <JobDetails title={ticket.title} description={ticket.description} {bech32ID} />
        {:else if selectedTab === Tabs.Author}
            <Author user={ticket.pubkey} />
        {:else if selectedTab === Tabs.Actions}
            <JobActions job={ticket} />
        {/if}
    </div>
    <div
        class="w-full flex flex-col gap-[0px] p-[8px] border-t-[1px_solid_rgba(0,0,0,0.1)] bg-[rgba(0,0,0,0.05)]"
    >
        <div class="jobCardButtons w-full flex flex-row gap-[5px] p-[0px] h-full overflow-hidden">
            {#each tabs as tab}
                <Button
                    variant={tab.name === selectedTab ? 'contained' : 'outlined'}
                    classes={jobCardBtnClasses}
                    on:click={() => (selectedTab = tab.name)}
                >
                    <i class={`bx ${tab.icon}`} />
                </Button>
            {/each}
        </div>
    </div>
    <div class="w-full flex flex-row gap-[0px] border-t-[1px_solid_rgba(0,0,0,0.11)]">
        <Button href={'/' + bech32ID + '/'} variant="text" classes="rounded-[0]" fullWidth>
            <i class="bx bxs-show" />
        </Button>
    </div>
</Card>
