<script lang="ts">
    import Orderbook from "$lib/components/OrderBook/orderbook.svelte";
    import { InputChip } from "@skeletonlabs/skeleton";

    let list: string[] = ['foo', 'bar', 'fizz', 'buzz'];

</script>

<a href="/post-ticket" class="btn fixed bottom-20 right-10 xl:btn-xl lg:btn-lg md:btn-md bg-primary-300-600-token">
    <span>Get Help</span>
</a>


<div class="flex flex-col justify-center gap-y-2 ">
    <div class="sticky top-0 mx-auto flex items-center justify-center bg-surface-100-800-token">
        <InputChip bind:value={list} name="chips" placeholder="Filter Tickets" />
    </div>
    <Orderbook />
</div>
