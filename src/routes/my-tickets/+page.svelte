<script lang="ts">
import { TabGroup, Tab } from '@skeletonlabs/skeleton';
import tabStore from "$lib/stores/tab-store";

import Tickets from "$lib/components/my-tickets/tickets.svelte";
import Offers from "$lib/components/my-tickets/offers.svelte";

</script>

<TabGroup justify='justify-evenly' flex='flex-grow'>
    <Tab bind:group={$tabStore} name="tab1" value={0}>
        <div class="flex items-center justify-center gap-x-2">
            <i class="fa-solid fa-clipboard-question text-3xl"></i>
            <span class="text-lg">My Tickets</span>
        </div>
    </Tab>
	<Tab bind:group={$tabStore} name="tab2" value={1}>
        <div class="flex items-center justify-center gap-x-2">
            <i class="fa-brands fa-bitcoin text-3xl"/>
            <span class="text-lg">My Offers</span>
        </div>
    </Tab>
	<!-- Tab Panels --->
	<svelte:fragment slot="panel">
		{#if $tabStore === 0}
            <Tickets />
		{:else if $tabStore === 1}
            <Offers />
		{/if}
	</svelte:fragment>
</TabGroup>
