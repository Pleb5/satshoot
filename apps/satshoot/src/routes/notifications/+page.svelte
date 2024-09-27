<script lang="ts">
import { type NDKEvent } from "@nostr-dev-kit/ndk";
import { checkRelayConnections } from "$lib/utils/helpers";
import currentUser from "$lib/stores/user";
import OfferCard from "$lib/components/Cards/OfferCard.svelte";
import TicketCard from "$lib/components/Cards/TicketCard.svelte";
import MessageCard from "$lib/components/Cards/MessageCard.svelte";
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
import UserReviewCard from "$lib/components/Cards/UserReviewCard.svelte";
import ZapCard from "$lib/components/Cards/ZapCard.svelte";
import { ReviewType } from "$lib/events/ReviewEvent";
import { onMount } from "svelte";

const toastStore = getToastStore();

$: if ($ticketNotifications) {
    // console.log('ticket notifs', $ticketNotifications);
}
$: if ($offerNotifications) {
    // console.log('offer notifs', $offerNotifications);
}
$: if ($messageNotifications){
    // console.log('message notifs', $messageNotifications);
}
$: if ($reviewNotifications) {
    // console.log('review notifs', $reviewNotifications);
}

$: if ($receivedZapsNotifications) {
    // console.log('received a zap notification', $receivedZapsNotifications);
}

$: if ($messageNotifications) {
    // console.log('received message notification')
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
    $notifications = $notifications.filter(
        (e: NDKEvent) => e.id !== event.id
    );
}

function clearAll() {
    $notifications = [];
}

onMount(() => checkRelayConnections());

</script>

{#if $currentUser}
    <h3 class="h3 text-center mb-4 underline">Notifications</h3>
    <div class="grid grid-cols-1 gap-y-8 mb-8">
        <div>
            <h3 class="h3 text-center underline my-4">
                Zaps
            </h3>
            {#if $receivedZapsNotifications.length > 0}
                <div class="space-y-4">
                    {#each $receivedZapsNotifications as zap(zap.id)}
                        <div class="flex flex-col items-center">
                            <div class="w-[90vw] sm:w-[70vw] lg:w-[60vw]">
                                <ZapCard {zap} />
                            </div>
                            <div>
                                <button 
                                    class="btn btn-icon"
                                    type="button" 
                                    on:click={()=>{removeNotification(zap);}}>
                                    <i class="fa-solid fa-circle-xmark text-3xl text-error-500"></i>
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            {:else}
                <div class="text-center">No New Zaps!</div>
            {/if}
        </div>
        <div>
            <h3 class="h3 text-center underline my-4">
                Tickets
            </h3>
            {#if $ticketNotifications.length > 0}
                <div class="space-y-4">
                    {#each $ticketNotifications as ticket(ticket.id)}
                        <div class="flex flex-col items-center">
                            <div class="w-[90vw] sm:w-[70vw] lg:w-[60vw]">
                                <TicketCard {ticket} countAllOffers={true}/>
                            </div>
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
                </div>
            {:else}
                <div class="text-center">No New Tickets!</div>
            {/if}
        </div>
        <div>
            <h3 class="h3 text-center underline my-4">
                Offers
            </h3>
            {#if $offerNotifications.length > 0}
                <div class="space-y-4">
                    {#each $offerNotifications as offer(offer.id)}
                        <div class="flex flex-col items-center">
                            <div class="w-[90vw] sm:w-[70vw] lg:w-[60vw]">
                                <OfferCard 
                                    {offer}
                                    showTicket={true}
                                    enableChat={true}
                                    countAllOffers={true}
                                />
                            </div>
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
                </div>
            {:else}
                <div class="text-center">No New Offers!</div>
            {/if}
        </div>
        <div>
            <h3 class="h3 text-center underline my-4">
                Messages
            </h3>
            {#if $messageNotifications.length > 0}
                <div class="space-y-4">
                    {#each $messageNotifications as message(message.id)}
                        <div class="flex flex-col items-center">
                            <div class="w-[90vw] sm:w-[40vw]">
                                <MessageCard {message} />
                            </div>
                            <div>
                                <button 
                                    class="btn btn-icon"
                                    type="button" 
                                    on:click={()=>{removeNotification(message);}}>
                                    <i class="fa-solid fa-circle-xmark text-3xl text-error-500"></i>
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            {:else}
                <div class="text-center">No New Messages!</div>
            {/if}
        </div>
        <div>
            <h3 class="h3 text-center underline my-4">
                Reviews
            </h3>
            {#if $reviewNotifications.length > 0}
                <div class="space-y-4">
                    {#each $reviewNotifications as review(review.id)}
                        {#if review.type}
                            <div class="flex flex-col items-center">
                            <div class="w-[90vw] sm:w-[40vw]">
                                <UserReviewCard 
                                    rating={
                                        review.type === ReviewType.Client
                                        ? review.clientRatings
                                        : review.freelancerRatings
                                    } 
                                    reviewer={review.author}
                                />
                            </div>
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
                </div>
            {:else}
                <div class="text-center">No New Reviews!</div>
            {/if}
        </div>
        <div class="justify-self-center mt-4">
            <button class="btn sm:btn-xl bg-primary-300-600-token"
                on:click={()=> {
                    clearAll();
                }}
            >
                Clear all
            </button>
        </div>
    </div>
{:else}
    <h2 class="h2 text-center">No logged in User!</h2>
{/if}
