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
import { Accordion, AccordionItem, type ToastSettings, getToastStore } from '@skeletonlabs/skeleton';
import UserReviewCard from "$lib/components/Cards/UserReviewCard.svelte";
import ZapCard from "$lib/components/Cards/ZapCard.svelte";
import { ReviewType } from "$lib/events/ReviewEvent";
import { onMount } from "svelte";
import ZapIcon from "$lib/components/Icons/ZapIcon.svelte";
    import TicketIcon from "$lib/components/Icons/TicketIcon.svelte";
    import BitcoinIcon from "$lib/components/Icons/BitcoinIcon.svelte";
    import MessagesIcon from "$lib/components/Icons/MessagesIcon.svelte";

const toastStore = getToastStore();
const accordionBaseClasses = 'card p-4 bg-surface-300-600-token'
                            + ' w-[90vw] sm:w-[70vw] lg:w-[60vw]';

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
    <div class="flex flex-col items-center px-4 gap-y-8 mb-8">
        <Accordion class='{accordionBaseClasses}'>
            <AccordionItem open={false}>
                <svelte:fragment slot="lead">
                    <ZapIcon />
                </svelte:fragment>
                <svelte:fragment slot="summary">
                    <div class="flex items-center justify-center">
                        <h3 class="h3 text-center underline my-4 relative inline-block">
                            <span>Zaps</span>
                            <span 
                                class="badge-icon variant-filled-error 
                                         absolute -top-1 -right-6 z-10"
                                style="font-size:8pt; width: 20px; height: 20px;"
                            >
                                {$receivedZapsNotifications.length}
                            </span>
                        </h3>
                    </div>
                </svelte:fragment>
                <svelte:fragment slot="content">
                    {#if $receivedZapsNotifications.length > 0}
                        <div class="space-y-4 p-1">
                            {#each $receivedZapsNotifications as zap(zap.id)}
                                <div class="flex flex-col items-center">
                                    <div class="">
                                        <ZapCard zapEvent={zap} />
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
                </svelte:fragment>
            </AccordionItem>
        </Accordion>
        <Accordion class='{accordionBaseClasses}'>
            <AccordionItem open={false}>
                <svelte:fragment slot="lead">
                    <TicketIcon />
                </svelte:fragment>
                <svelte:fragment slot="summary">
                    <div class="flex items-center justify-center">
                        <h3 class="h3 text-center underline my-4 relative inline-block">
                            <span>Tickets</span>
                            <span 
                                class="badge-icon variant-filled-error 
                                absolute -top-1 -right-6 z-10"
                                style="font-size:8pt; width: 20px; height: 20px;"
                            >
                                {$ticketNotifications.length}
                            </span>
                        </h3>
                    </div>
                </svelte:fragment>
                <svelte:fragment slot="content">
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
                </svelte:fragment>
            </AccordionItem>
        </Accordion>
        <Accordion class='{accordionBaseClasses}'>
            <AccordionItem open={false}>
                <svelte:fragment slot="lead">
                    <BitcoinIcon extraClasses={'text-xl'}/>
                </svelte:fragment>
                <svelte:fragment slot="summary">
                    <div class="flex items-center justify-center">
                        <h3 class="h3 text-center underline my-4 relative inline-block">
                            <span>Offers</span>
                            <span 
                                class="badge-icon variant-filled-error 
                                absolute -top-1 -right-6 z-10"
                                style="font-size:8pt; width: 20px; height: 20px;"
                            >
                                {$offerNotifications.length}
                            </span>
                        </h3>
                    </div>
                </svelte:fragment>
                <svelte:fragment slot="content">
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
                </svelte:fragment>
            </AccordionItem>
        </Accordion>
        <Accordion class='{accordionBaseClasses}'>
            <AccordionItem open={false}>
                <svelte:fragment slot="lead">
                    <MessagesIcon />
                </svelte:fragment>
                <svelte:fragment slot="summary">
                    <div class="flex items-center justify-center">
                        <h3 class="h3 text-center underline my-4 relative inline-block">
                            <span>Messages</span>
                            <span 
                                class="badge-icon variant-filled-error 
                                absolute -top-1 -right-6 z-10"
                                style="font-size:8pt; width: 20px; height: 20px;"
                            >
                                {$messageNotifications.length}
                            </span>
                        </h3>
                    </div>
                </svelte:fragment>
                <svelte:fragment slot="content">
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
                </svelte:fragment>
            </AccordionItem>
        </Accordion>
        <Accordion class='{accordionBaseClasses}'>
            <AccordionItem open={false}>
                <svelte:fragment slot="lead">
                    <MessagesIcon />
                </svelte:fragment>
                <svelte:fragment slot="summary">
                    <div class="flex items-center justify-center">
                        <h3 class="h3 text-center underline my-4 relative inline-block">
                            <span>Reviews</span>
                            <span 
                                class="badge-icon variant-filled-error 
                                absolute -top-1 -right-6 z-10"
                                style="font-size:8pt; width: 20px; height: 20px;"
                            >
                                {$reviewNotifications.length}
                            </span>
                        </h3>
                    </div>
                </svelte:fragment>
                <svelte:fragment slot="content">
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
                </svelte:fragment>
            </AccordionItem>
        </Accordion>
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
