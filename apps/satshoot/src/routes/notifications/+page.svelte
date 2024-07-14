<script lang="ts">
import { type NDKEvent } from "@nostr-dev-kit/ndk";
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
import { onDestroy, tick } from "svelte";
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

async function removeNotification(event: NDKEvent) {
    let found = false;
    for (let i = 0; i < $notifications.length; i++) {
        const notif = $notifications[i];
        if (notif.id === event.id) {
            found = true;
            $notifications.splice(i, 1);
            $notifications = $notifications;
            $ticketNotifications = $ticketNotifications;
            $offerNotifications = $offerNotifications;
            $messageNotifications = $messageNotifications;
            $reviewNotifications = $reviewNotifications;
            $receivedZapsNotifications = $receivedZapsNotifications;
            await tick();
            break;
        }
    }
    if (!found) {
        console.log('event not found in notifications');
    }
}

onDestroy(()=>{
    // $notifications = [];
});

</script>

{#if $currentUser}
    <h3 class="h3 text-center mb-4 underline">Notifications</h3>
    <div class="grid grid-cols-1 gap-y-2 mb-8">
        <h3 class="h3 text-center underline my-4">
            Zaps
        </h3>
        {#if $receivedZapsNotifications.length > 0}
            {#each $receivedZapsNotifications as zap(zap.id)}
                <div class="flex justify-center">
                    <ZapCard {zap} />
                    <div>
                        <button 
                            class="btn btn-icon"
                            type="button" 
                            on:click={()=>{removeNotification(zap)}}>
                            <i class="fa-solid fa-circle-xmark text-3xl text-error-500"></i>
                        </button>
                    </div>
                </div>
            {/each}
            {:else}
            <div class="text-center">No New Zaps!</div>
        {/if}
        <h3 class="h3 text-center underline my-4">
            Tickets
        </h3>
        {#if $ticketNotifications.length > 0}
            {#each $ticketNotifications as ticket(ticket.id)}
                <div class="flex justify-center">
                    <TicketCard {ticket} countAllOffers={true}/>
                    <div>
                        <button 
                            class="btn btn-icon"
                            type="button" 
                            on:click={()=>{removeNotification(ticket)}}>
                            <i class="fa-solid fa-circle-xmark text-3xl text-error-500"></i>
                        </button>
                    </div>
                </div>
            {/each}
        {:else}
            <div class="text-center">No New Tickets!</div>
        {/if}
        <h3 class="h3 text-center underline my-4">
            Offers
        </h3>
        {#if $offerNotifications.length > 0}
            {#each $offerNotifications as offer(offer.id)}
                <div class="flex justify-center">
                    <OfferCard 
                        {offer}
                        showTicket={true}
                        enableChat={true}
                        countAllOffers={true}
                    />
                    <div>
                        <button 
                            class="btn btn-icon"
                            type="button" 
                            on:click={()=>{removeNotification(offer)}}>
                            <i class="fa-solid fa-circle-xmark text-3xl text-error-500"></i>
                        </button>
                    </div>
                </div>
            {/each}
        {:else}
            <div class="text-center">No New Offers!</div>
        {/if}
        <h3 class="h3 text-center underline my-4">
            Messages
        </h3>
        {#if $messageNotifications.length > 0}
            {#each $messageNotifications as message(message.id)}
                <div class="flex justify-center">
                    <div>
                        <button 
                            class="btn btn-icon"
                            type="button" 
                            on:click={()=>{removeNotification(message)}}>
                            <i class="fa-solid fa-circle-xmark text-3xl text-error-500"></i>
                        </button>
                    </div>
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
            {#each $reviewNotifications as review(review.id)}
                {#if review.ratings}
                    <div class="flex justify-center">
                        <UserReviewCard review={review.ratings} reviewer={review.author} />
                        <div>
                            <button 
                                class="btn btn-icon"
                                type="button" 
                                on:click={()=>{removeNotification(review)}}>
                                <i class="fa-solid fa-circle-xmark text-3xl text-error-500"></i>
                            </button>
                        </div>
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
