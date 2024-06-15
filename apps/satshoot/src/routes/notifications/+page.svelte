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

let messagesLoading = false;

const toastStore = getToastStore();

const messages: Message[] = [];

$: if ($ticketNotifications) {
    console.log('ticket notifs', $ticketNotifications);
}
$: if ($offerNotifications) {
    console.log('offer notifs', $offerNotifications);
}
$: if ($messageNotifications){
    console.log('message notifs', $messageNotifications);
}
$: if ($reviewNotifications) {
    console.log('review notifs', $reviewNotifications);
}
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

<h3 class="h3 text-center mb-4 underline">Notifications</h3>
<div class="grid grid-cols-1 gap-y-2 mb-8">
    <h3 class="h3 text-center underline my-4">
        Tickets:
    </h3>
    {#if $ticketNotifications.length > 0}
        {#each $ticketNotifications as ticket}
            <div class="flex justify-center">
                <TicketCard {ticket} countAllOffers={true}/>
            </div>
        {/each}
    {:else}
        <div class="text-center">No New Tickets!</div>
    {/if}
    <h3 class="h3 text-center underline my-4">
        Offers:
    </h3>
    {#if $offerNotifications.length > 0}
        {#each $offerNotifications as offer}
            <div class="flex justify-center">
                <OfferCard {offer} showTicket={true} enableChat={true} countAllOffers={true} />
            </div>
        {/each}
    {:else}
        <div class="text-center">No New Offers!</div>
    {/if}
    <h3 class="h3 text-center underline my-4">
        Messages:
    </h3>
    {#if messages.length > 0}
        {#each messages as message}
            <div class="flex justify-center">
                <MessageCard {message} />
            </div>
        {/each}
    {:else if messagesLoading}
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
    {:else}
        <div class="text-center">No New Messages!</div>
    {/if}
<!-- {#if messages.length > 0} -->
    <!-- {:else} -->
    <!-- {/if} -->
    <h3 class="h3 text-center underline my-4">
        Reviews:
    </h3>
    {#if $reviewNotifications.length > 0}
        {#each $reviewNotifications as review}
            <div class="flex justify-center">
                <UserReviewCard {review} reviewer={review.author} />
            </div>
        {/each}
    {:else}
        <div class="text-center">No New Reviews!</div>
    {/if}
</div>
