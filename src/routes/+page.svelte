<script lang="ts">
    import Orderbook from "$lib/components/OrderBook/orderbook.svelte";
    import { InputChip } from "@skeletonlabs/skeleton";
    import { tickets, offers } from "$lib/stores/troubleshoot-eventstores";
    import { onDestroy, onMount } from "svelte";

    let list: string[] = ['foo', 'bar', 'fizz', 'buzz'];

    onMount( async () => {
        // ref/unref if lots of components start to sub/unsub!
        tickets.startSubscription();
        offers.startSubscription();
    })

    onDestroy( () => {
        // ref/unref if lots of components start to sub/unsub!
        tickets.unsubscribe();
        offers.unsubscribe();
    })

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
