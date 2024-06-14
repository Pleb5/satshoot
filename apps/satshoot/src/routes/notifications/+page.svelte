<script lang="ts">
import ndk from "$lib/stores/ndk";
import OfferCard from "$lib/components/OrderBook/OfferCard.svelte";
import TicketCard from "$lib/components/OrderBook/TicketCard.svelte";
import MessageCard from "$lib/components/User/MessageCard.svelte";
import {
        notificationsEnabled,
        ticketNotifications,
        offerNotifications,
        messageNotifications,
        reviewNotifications,
} from "$lib/stores/notifications";
import { type Message } from "$lib/stores/messages";
import { type ToastSettings, getToastStore } from '@skeletonlabs/skeleton';
import UserReviewCard from "$lib/components/User/UserReviewCard.svelte";


const toastStore = getToastStore();

const messages: Message[] = [];

// Decrypt incoming DM-s
$: if ($messageNotifications) {

}

$: if (!$notificationsEnabled) {
    const t: ToastSettings = {
        message: 'Notifications are Disabled!',
        timeout: 7000,
        background: 'bg-error-300-600-token',
    };
    toastStore.trigger(t);
}

</script>

<h3 class="h3 text-center">Notifications</h3>
<div class="flex flex-col items-center min-w-[60%] gap-y-2 mb-8">
    {#each $ticketNotifications as ticket}
        <TicketCard {ticket} />
    {/each}
    {#each $offerNotifications as offer}
        <OfferCard {offer} />
    {/each}
    {#if messages.length > 0}
        {#each messages as message}
            <MessageCard {message} />
        {/each}
    {:else}
        <div class="p-4 space-y-4">
            <div class="placeholder animate-pulse" />
            <div class="grid grid-cols-3 gap-8">
                <div class="placeholder animate-pulse" />
                <div class="placeholder animate-pulse" />
                <div class="placeholder animate-pulse" />
            </div>
            <div class="grid grid-cols-4 gap-4">
                <div class="placeholder animate-pulse" />
                <div class="placeholder animate-pulse" />
                <div class="placeholder animate-pulse" />
                <div class="placeholder animate-pulse" />
            </div>
        </div>
    {/if}
    {#each $reviewNotifications as review}
        <div class="text-lg">Review:</div>
        <UserReviewCard {review} reviewer={review.author} />
        <hr/>
    {/each}
</div>
