<script lang="ts">
import OfferCard from "$lib/components/OrderBook/OfferCard.svelte";
import TicketCard from "$lib/components/OrderBook/TicketCard.svelte";
import MessageCard from "$lib/components/User/MessageCard.svelte";
import {
        ticketNotifications,
        offerNotifications,
        messageNotifications,
} from "$lib/stores/notifications";


</script>

<h3 class="h3">Notifications</h3>
<div class="flex flex-col justify-center gap-y-2">
    {#each $ticketNotifications as ticket}
        <TicketCard {ticket} />
    {/each}
    {#each $offerNotifications as offer}
        <OfferCard {offer} />
    {/each}
    {#each $messageNotifications as message}
        <MessageCard {message} />
    {/each}
</div>
