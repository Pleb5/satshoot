<script lang="ts">
    import Orderbook from "./orderbook/orderbook.svelte";
    import { InputChip } from "@skeletonlabs/skeleton";

    function postTicket() {
    }
    let list: string[] = ['foo', 'bar', 'fizz', 'buzz'];
</script>

<!-- modify me to skeleton: need sticky!-->


<div class="flex flex-col justify-center gap-y-2 ">
    <div class="sticky top-0 mx-auto flex items-center justify-center bg-surface-100-800-token">
        <InputChip bind:value={list} name="chips" placeholder="Filter Tickets" />

        <button type="button" class="btn fixed bottom-12 right-4 h-16 xl:btn-xl lg:btn-lg md:btn-md bg-gradient-to-br variant-gradient-primary-tertiary">
            <span>Get Help</span>
        </button>
    </div>
    <Orderbook />
</div>
