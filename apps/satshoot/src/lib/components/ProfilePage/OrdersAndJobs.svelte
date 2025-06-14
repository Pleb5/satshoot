<script lang="ts">
    import type { JobEvent } from '$lib/events/JobEvent';
    import type { OrderEvent } from '$lib/events/OrderEvent';
    import { jobFilter, ordersFilter } from '$lib/stores/gui';
    import { ClientTabs, clientTabStore } from '$lib/stores/tab-store';
    import OrderCard from '../Cards/OrderCard.svelte';
    import JobCard from '../Jobs/JobCard.svelte';
    import TabSelector from '../UI/Buttons/TabSelector.svelte';
    import Card from '../UI/Card.svelte';
    import Checkbox from '../UI/Inputs/Checkbox.svelte';

    interface Props {
        isOwnProfile: boolean;
        orders: OrderEvent[];
        jobs: JobEvent[];
    }

    let { isOwnProfile, orders, jobs }: Props = $props();

    let tabs = $derived([
        { id: ClientTabs.Orders, label: `${isOwnProfile ? 'My' : ''} Orders` },
        { id: ClientTabs.Jobs, label: `${isOwnProfile ? 'My' : ''} Jobs` },
    ]);
</script>

<TabSelector {tabs} bind:selectedTab={$clientTabStore} />
<div class="w-full flex flex-col">
    {#if $clientTabStore === ClientTabs.Orders}
        <div class="w-full flex flex-col gap-[10px]">
            <Card classes="flex-row flex-wrap gap-[10px] p-[5px]">
                <Checkbox
                    id="pending-orders"
                    label="Pending"
                    bind:checked={$ordersFilter.pending}
                />
                <Checkbox
                    id="inProgress-orders"
                    label="In Progress"
                    bind:checked={$ordersFilter.inProgress}
                />
                <Checkbox
                    id="completed-orders"
                    label="Completed"
                    bind:checked={$ordersFilter.completed}
                />
            </Card>
            <div class="w-full flex flex-col gap-[15px]">
                <div
                    class="w-full grid grid-cols-3 gap-[25px] max-[1200px]:grid-cols-2 max-[992px]:grid-cols-1 max-[768px]:grid-cols-1"
                >
                    {#each orders as order (order.id)}
                        <OrderCard {order} showServiceDetail />
                    {/each}
                </div>
                <!-- Pagination -->
            </div>
        </div>
    {:else}
        <div class="w-full flex flex-col gap-[10px]">
            <Card classes="flex-row flex-wrap gap-[10px] p-[5px]">
                <Checkbox id="new-jobs" label="New" bind:checked={$jobFilter.new} />
                <Checkbox
                    id="inProgress-jobs"
                    label="In Progress"
                    bind:checked={$jobFilter.inProgress}
                />
                <Checkbox id="closed-jobs" label="Closed" bind:checked={$jobFilter.closed} />
            </Card>
            <div class="w-full flex flex-col gap-[15px]">
                <div
                    class="w-full grid grid-cols-3 gap-[25px] max-[1200px]:grid-cols-2 max-[992px]:grid-cols-1 max-[768px]:grid-cols-1"
                >
                    {#each jobs as job (job.id)}
                        <JobCard {job} showBidsDetail />
                    {/each}
                </div>
                <!-- Pagination -->
            </div>
        </div>
    {/if}
</div>
