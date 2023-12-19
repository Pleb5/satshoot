<script lang="ts">
    import Orderbook from "./orderbook/orderbook.svelte";
    import { InputChip } from "@skeletonlabs/skeleton";

    function postTicket() {
    }
    let list: string[] = ['foo', 'bar', 'fizz', 'buzz'];
</script>

<!-- modify me to skeleton: need sticky!-->


<div class="flex flex-col justify-center gap-y-2 ">
    <div class="sticky top-0 px-2 mx-auto mt-2 ">
        <InputChip bind:value={list} name="chips" placeholder="Filter Tickets" />
    </div>
    <Orderbook />
    <button type="button" class="btn fixed bottom-4 right-4 mx-auto mt-4 z-20 xl:btn-xl lg:btn-lg md:btn-md bg-gradient-to-br variant-gradient-primary-tertiary">
        <span>Get Help</span>
    </button>
</div>
