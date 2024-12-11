<script lang="ts">
    import { TicketEvent } from '$lib/events/TicketEvent';
    import EarningDetails from './EarningDetails.svelte';
    import JobActions from './JobActions.svelte';
    import JobDetails from './JobDetails.svelte';
    import Ratings from './Ratings.svelte';
    import TrustedNetwork from './TrustedNetwork.svelte';

    export let ticket: TicketEvent;

    enum Tabs {
        JobDescription,
        Earning,
        Reputation,
        Network,
        Actions,
    }

    const tabs = [
        {
            icon: 'bxs-card',
            name: Tabs.JobDescription,
        },
        {
            icon: 'bxs-bolt',
            name: Tabs.Earning,
        },
        {
            icon: 'bxs-star',
            name: Tabs.Reputation,
        },
        {
            icon: 'bxs-network-chart',
            name: Tabs.Network,
        },
        {
            icon: 'bxs-grid-alt',
            name: Tabs.Actions,
        },
    ];

    let selectedTab = Tabs.JobDescription;

    const jobCardBtnClasses =
        'transition-all ease duration-[0.3s] border-0 outline-0 font-semibold transform scale-100 ' +
        'whitespace-nowrap gap-[10px] p-[8px] flex flex-col justify-center items-center text-[16px] ' +
        'flex-grow rounded-[4px] hover:text-[rgba(255,255,255,0.5)] hover:bg-[rgba(59,115,246,0.75)]';
</script>

<div
    class="jobCard w-full bg-white border-[1px_solid_rgba(0,0,0,0.1)] flex flex-col gap-[0px] rounded-[8px] overflow-hidden p-[0px] shadow-[0_0_4px_0_rgba(0,0,0,0.1)]"
>
    <div class="jobCardDetails w-full flex flex-col gap-[0px] p-[10px] min-h-[165px]">
        {#if selectedTab === Tabs.JobDescription}
            <JobDetails title={ticket.title} description={ticket.description} />
        {:else if selectedTab === Tabs.Earning}
            <EarningDetails user={ticket.author.pubkey} />
        {:else if selectedTab === Tabs.Reputation}
            <Ratings
                ratingAsClient={4}
                totalClientReviews={250}
                ratingAsFreelancer={4}
                totalFreelancerReviews={250}
            />
        {:else if selectedTab === Tabs.Network}
            <TrustedNetwork />
        {:else if selectedTab === Tabs.Actions}
            <JobActions />
        {/if}
    </div>
    <div
        class="w-full flex flex-col gap-[0px] p-[8px] border-t-[1px_solid_rgba(0,0,0,0.1)] bg-[rgba(0,0,0,0.05)]"
    >
        <div class="jobCardButtons w-full flex flex-row gap-[5px] p-[0px] h-full overflow-hidden">
            {#each tabs as tab}
                <button
                    class={jobCardBtnClasses}
                    class:bg-[rgb(59,115,246)]={tab.name === selectedTab}
                    class:text-[white]={tab.name === selectedTab}
                    class:bg-[rgba(59,115,246,0)]={tab.name !== selectedTab}
                    class:text-[rgba(0,0,0,0.5)]={tab.name !== selectedTab}
                    on:click={() => (selectedTab = tab.name)}
                >
                    <i class={`bx ${tab.icon}`}></i>
                </button>
            {/each}
        </div>
    </div>
    <div class="w-full flex flex-row gap-[0px] border-t-[1px_solid_rgba(0,0,0,0.11)]">
        <button
            class="transition-all ease duration-[0.3s] bg-[rgb(59,115,246)] text-[rgb(255,255,255)] p-[10px_20px] font-semibold text-[18px] whitespace-nowrap flex flex-row justify-center items-center gap-[10px] bg-[rgba(59,115,246,0)] text-[rgba(0,0,0,0.5)] border-r-[1px] border-r-solid border-r-[rgba(0,0,0,0.1)] hover:border-r-[rgba(0,0,0,0.0)] hover:bg-[rgb(59,130,246)] hover:text-white"
        >
            <i class="bx bxs-cog"></i>
        </button>
        <button
            class="transition-all ease duration-[0.3s] bg-[rgb(59,115,246)] text-[rgb(255,255,255)] p-[10px_20px] font-semibold text-[18px] whitespace-nowrap flex flex-row justify-center items-center gap-[10px] bg-[rgba(59,115,246,0)] text-[rgba(0,0,0,0.5)] w-auto hover:bg-[rgb(59,130,246)] hover:text-white"
        >
            <i class="bx bxs-show"></i>
        </button>
    </div>
</div>
