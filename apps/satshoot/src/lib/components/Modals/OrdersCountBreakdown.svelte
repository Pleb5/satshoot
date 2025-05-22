<script lang="ts">
    import type { OrderEvent } from '$lib/events/OrderEvent';
    import { Pricing } from '$lib/events/types';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    interface Props {
        isOpen: boolean;
        fulfilledOrders: OrderEvent[];
    }

    let { isOpen = $bindable(), fulfilledOrders }: Props = $props();

    const orderPriceMap = $derived.by(() => {
        const map: Record<string, number> = {};
        fulfilledOrders.forEach((order) => {
            const key =
                order.amount.toString() +
                ' ' +
                (order.pricing === Pricing.SatsPerMin ? 'sats/min' : 'sats');

            if (map[key]) {
                map[key]++;
            } else {
                map[key] = 1;
            }
        });

        return map;
    });
</script>

<ModalWrapper bind:isOpen title="Orders Price Breakdown">
    <div class="w-full flex flex-col">
        <div class="table-wrap">
            <table class="table caption-bottom">
                <caption class="pt-4"
                    >Number of orders user fulfilled against various prices</caption
                >
                <thead>
                    <tr>
                        <th>Price</th>
                        <th>Orders</th>
                    </tr>
                </thead>
                <tbody class="[&>tr]:hover:preset-tonal-primary">
                    {#each Object.entries(orderPriceMap) as [price, ordersCount]}
                        <tr>
                            <td>{price}</td>
                            <td>{ordersCount}</td>
                        </tr>
                    {/each}
                </tbody>
                <tfoot>
                    <tr>
                        <td>Total</td>
                        <td>{fulfilledOrders.length} Orders</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    </div>
</ModalWrapper>
