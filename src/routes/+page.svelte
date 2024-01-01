<script lang="ts">
    import Orderbook from "$lib/components/OrderBook/orderbook.svelte";
    import { InputChip } from "@skeletonlabs/skeleton";

    function postTicket() {
    }
    let list: string[] = ['foo', 'bar', 'fizz', 'buzz'];
</script>

<!-- Get help button needed to style position explicitly, tailwind bugs out on bottom and right properties on this one -->
<a href="/post-ticket" class="btn fixed xl:btn-xl lg:btn-lg md:btn-md bg-gradient-to-br variant-gradient-primary-tertiary" style="bottom: 5rem; right: 2rem;">
    <span>Get Help</span>
</a>


<div class="flex flex-col justify-center gap-y-2 ">
    <div class="sticky top-0 mx-auto flex items-center justify-center bg-surface-100-800-token">
        <InputChip bind:value={list} name="chips" placeholder="Filter Tickets" />
    </div>
    <Orderbook />
</div>
