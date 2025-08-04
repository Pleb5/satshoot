<script lang="ts">
    import type { BidEvent } from '$lib/events/BidEvent';
    import type { ServiceEvent } from '$lib/events/ServiceEvent';
    import { bidFilter, servicesFilter } from '$lib/stores/gui';
    import { FreelancerTabs, freelancerTabStore } from '$lib/stores/tab-store';
    import BidCard from '../Cards/BidCard.svelte';
    import ServiceCard from '../Services/ServiceCard.svelte';
    import TabSelector from '../UI/Buttons/TabSelector.svelte';
    import Card from '../UI/Card.svelte';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';

    interface Props {
        isOwnProfile: boolean;
        services: ServiceEvent[];
        bids: BidEvent[];
    }

    let { isOwnProfile, services, bids }: Props = $props();

    let tabs = $derived([
        { id: FreelancerTabs.Services, label: `${isOwnProfile ? 'My' : ''} Services` },
        { id: FreelancerTabs.Bids, label: `${isOwnProfile ? 'My' : ''} Bids` },
    ]);
</script>

<div class="w-full flex flex-col gap-y-1">
    <TabSelector {tabs} bind:selectedTab={$freelancerTabStore} />
    {#if $freelancerTabStore === FreelancerTabs.Services}
        <div class="w-full flex flex-col gap-[10px]">
            <Card classes="flex-row flex-wrap gap-[10px] p-[5px]">
                <Checkbox
                    id="active-services"
                    label="Active"
                    bind:checked={$servicesFilter.active}
                />
                <Checkbox
                    id="inactive-services"
                    label="In-active"
                    bind:checked={$servicesFilter.inActive}
                />
            </Card>
            <div class="w-full flex flex-col gap-[15px]">
                <div
                    class="w-full gap-[25px] grid max-lg:grid-cols-1  grid-cols-2"
                >
                    {#each services as service (service.id)}
                        <ServiceCard {service} />
                    {/each}
                </div>
                <!-- Pagination -->
            </div>
        </div>
    {:else}
        <div class="w-full flex flex-col gap-[10px]">
            <Card classes="flex-row flex-wrap gap-[10px] p-[5px]">
                <Checkbox id="pending-bids" label="Pending" bind:checked={$bidFilter.pending} />
                <Checkbox id="success-bids" label="Success" bind:checked={$bidFilter.success} />
                <Checkbox id="lost-bids" label="Lost" bind:checked={$bidFilter.lost} />
            </Card>
            <div class="w-full flex flex-col gap-[15px]">
                <div
                    class="w-full gap-[25px] grid max-lg:grid-cols-1  grid-cols-2"
                >
                    {#each bids as bid (bid.id)}
                        <BidCard {bid} skipUserProfile skipReputation showJobDetail />
                    {/each}
                </div>
                <!-- Pagination -->
            </div>
        </div>
    {/if}
</div>
