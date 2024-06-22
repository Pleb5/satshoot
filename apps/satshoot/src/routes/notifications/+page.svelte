<script lang="ts">
import ndk from "$lib/stores/ndk";
import currentUser from "$lib/stores/user";
import type { NDKSigner, NDKTag } from "@nostr-dev-kit/ndk";
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
} from "$lib/stores/notifications";
import { type Message } from "$lib/stores/messages";
import { type ToastSettings, getToastStore } from '@skeletonlabs/skeleton';
import UserReviewCard from "$lib/components/User/UserReviewCard.svelte";
import { onDestroy } from "svelte";
    import { BTCTroubleshootKind } from "$lib/events/kinds";

let messagesLoading = false;

const toastStore = getToastStore();

let messages: Message[] = [];

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
    for (const dm of $messageNotifications) {
        const messageDate = new Date(dm.created_at as number * 1000);
        // Time is shown in local time zone
        const dateString = messageDate.toLocaleString();

        // We dont decrypt already decrypted messages
        let alreadySeen = false;
        for (const m of messages) {
            if (dm.id === m.id) {
                alreadySeen = true;
                console.log('already seen')
                break;
            }
        }
        if (alreadySeen) continue;
        let tTag = '';
        dm.tags.forEach((tag: NDKTag) => {
            if (tag[0] === 't' && tag[1].includes(BTCTroubleshootKind.Ticket.toString())) {
                tTag = tag[1];
            }
        });
        const message = {
            id: dm.id,
            sender: dm.pubkey,
            recipient: dm.tagValue('p') as string,
            timestamp: dateString,
            message: '',
            ticket: tTag,
        };
        // We insert the new decrypted message in the right place
        // that is exactly the index where it was in the original feed
        // because that is inherently ordered by time by ndk-svelte store
        // This insert is important to happen BEFORE decryption to avoid
        // race conditions arising from waiting on the decryption
        messages.splice(0, 0, message);

        // Decryption
        try {
            const peerPubkey = (dm.tagValue('p') === $currentUser!.pubkey
                ? dm.pubkey : dm.tagValue('p')
            ) as string;
            const peerUser = $ndk.getUser({pubkey: peerPubkey});
            ($ndk.signer as NDKSigner).decrypt(peerUser, dm.content).then((decryptedDM: string)=>{
                console.log('decrypted message:', decryptedDM)
                message.message = decryptedDM;
                messages = messages;
            }); 
        } catch (e) {
            // Don't bother if it fails. DM could already be decrypted which
            // makes the double-decryption attempts fail
            console.log(e);
            console.trace();
        }
    };
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
            Reviews
        </h3>
        {#if $reviewNotifications.length > 0}
            {#each $reviewNotifications as review}
                <div class="flex justify-center">
                    <UserReviewCard review={review.ratings} reviewer={review.author} />
                </div>
            {/each}
        {:else}
            <div class="text-center">No New Reviews!</div>
        {/if}
    </div>
{:else}
    <h2 class="h2 text-center">No logged in User!</h2>
{/if}
