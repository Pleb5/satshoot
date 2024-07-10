<script lang="ts">
import currentUser from "$lib/stores/user";
import OfferCard from "$lib/components/OrderBook/OfferCard.svelte";
import TicketCard from "$lib/components/OrderBook/TicketCard.svelte";
import MessageCard from "$lib/components/User/MessageCard.svelte";
import {
    notificationsEnabled,
    notifications,
    ticketNotifications,
    offerNotifications,
    messageNotifications,
    reviewNotifications,
    receivedZapsNotifications,
} from "$lib/stores/notifications";
import { type ToastSettings, getToastStore } from '@skeletonlabs/skeleton';
import UserReviewCard from "$lib/components/User/UserReviewCard.svelte";
import { onDestroy } from "svelte";
import ZapCard from "$lib/components/User/ZapCard.svelte";

const toastStore = getToastStore();

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

$: if ($receivedZapsNotifications) {
    console.log('received a zap notification', $receivedZapsNotifications);
}

// Decrypt incoming DM-s
$: if ($messageNotifications) {
    console.log('received message notification')
}

$: if (!$notificationsEnabled) {
    const t: ToastSettings = {
        message: 'Notifications are Disabled!',
        timeout: 7000,
        background: 'bg-error-300-600-token',
    };
    toastStore.trigger(t);
}

onDestroy(()=>{
    $notifications = [];
});

</script>

{#if $currentUser}
    <h3 class="h3 text-center mb-4 underline">Notifications</h3>
    <div class="grid grid-cols-1 gap-y-2 mb-8">
        <h3 class="h3 text-center underline my-4">
            Zaps
        </h3>
        {#if $receivedZapsNotifications.length > 0}
            {#each $receivedZapsNotifications as zap}
                <div class="flex justify-center">
                    <ZapCard {zap} />
                </div>
            {/each}
            {:else}
            <div class="text-center">No New Zaps!</div>
        {/if}
        <h3 class="h3 text-center underline my-4">
            Tickets
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
            Offers
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
            Messages
        </h3>
        {#if $messageNotifications.length > 0}
            {#each $messageNotifications as message}
                <div class="flex justify-center">
                    <MessageCard {message} />
                </div>
            {/each}
            {:else}
            <div class="text-center">No New Messages!</div>
        {/if}
        <h3 class="h3 text-center underline my-4">
            Reviews
        </h3>
        {#if $reviewNotifications.length > 0}
            {#each $reviewNotifications as review}
                {#if review.ratings}
                    <div class="flex justify-center">
                        <UserReviewCard review={review.ratings} reviewer={review.author} />
                    </div>
                {/if}
            {/each}
        {:else}
            <div class="text-center">No New Reviews!</div>
        {/if}
    </div>
{:else}
    <h2 class="h2 text-center">No logged in User!</h2>
{/if}
