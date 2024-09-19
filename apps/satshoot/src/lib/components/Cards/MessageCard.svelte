<script lang="ts">
import ndk from "$lib/stores/ndk";
import currentUser from "$lib/stores/user";
import { 
    NDKEvent,
    NDKSubscriptionCacheUsage,
    type NDKSigner, 
    type NDKUser, 
    type NDKUserProfile 
} from "@nostr-dev-kit/ndk";
import { Avatar } from '@skeletonlabs/skeleton';
import { onMount } from "svelte";
import { TicketEvent } from "$lib/events/TicketEvent";

import { goto } from "$app/navigation";
import { page } from '$app/stores';

export let avatarRight = true;
export let message: NDKEvent;
export let searchText = '';
export let isFirstOfDay = false;

let decryptedDM: string;
const senderUser = $ndk.getUser({pubkey: message.pubkey});
let name = (senderUser as NDKUser).npub.substring(0,10);
let avatarImage = `https://robohash.org/${message.pubkey}`;
const recipient = message.tagValue('p');

const messageDate = new Date(message.created_at as number * 1000);
// Time is shown in local time zone
const timestamp = messageDate.toLocaleString();
const ticketAddress = message.tagValue('t');
let messageLink = '';

let extraClasses = 'variant-soft-primary rounded-tr-none'
let templateColumn = 'grid-cols-[auto_1fr]';

function formatDate(date: Date): string {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 7) {
        return diffDays === 1 ? "Yesterday" : `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString();
    }
}

onMount(async () => {
    if (avatarRight) {
        extraClasses = 'variant-soft rounded-tl-none'
        templateColumn = 'grid-cols-[1fr_auto]';
    }

    // Decrypt message
    // ECDH DEMANDS THAT DECRYPTION ALWAYS USES THE PUBKEY OF THE OTHER PARTY
    // BE IT THE SENDER OR THE RECIPIENT OF THE ACTUAL MESSAGE
    // 
    // let sharedPoint = secp.getSharedSecret(ourPrivateKey, '02' + theirPublicKey)

    // ALWAYS USE OTHER USER REGARDLESS OF WHO SENT THE MESSAGE
    console.log('start decryption', message)
    try {
        const peerPubkey = (
            message.tagValue('p') === $currentUser!.pubkey
            ? message.pubkey : message.tagValue('p')
        )
        const peerUser = $ndk.getUser({pubkey: peerPubkey});
        decryptedDM = await ($ndk.signer as NDKSigner)
                .decrypt(peerUser, message.content); 
    } catch (e) {
        console.trace(e);
    }

    const profile = await senderUser.fetchProfile(
        {
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            closeOnEose: true,
            groupable: true,
            groupableDelay: 500,
        }
    );
    if (senderUser.profile) {
        console.log('profile', profile)
        console.log('pubkey', senderUser.pubkey)
        if (senderUser.profile.displayName) name = senderUser.profile.displayName;
        if (senderUser.profile.name) name = senderUser.profile.name;
        if (senderUser.profile.image) avatarImage = senderUser.profile.image;

    } else {
        console.log('no profile')
    }

    if (ticketAddress) {
        const event = await $ndk.fetchEvent(
            ticketAddress,
            {
                groupable: true,
                groupableDelay: 800,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST
            },
        );
        if (event) {
            const ticketEvent = TicketEvent.from(event);
            messageLink = "/messages/" + ticketEvent.encode();
        }
        console.log('message link', messageLink)
    }
});

let showMyself = false;
$: if (decryptedDM) {
    showMyself = decryptedDM.includes(searchText);
}


</script>

<div class="{showMyself ? '' : 'hidden'}">
    {#if isFirstOfDay}
        <div class="date-separator">
            <hr>
            <span>{formatDate(messageDate)}</span>
            <hr>
        </div>
    {/if}
    {#if decryptedDM}
        <div class="grid {templateColumn} gap-x-2 ">
            {#if !avatarRight}
                <a href={'/' + senderUser.npub}>
                    <Avatar
                    src={avatarImage}
                    width="w-12" />
                </a>
            {/if}
            <div class="card p-4 space-y-2 {extraClasses}">
                <header class="flex justify-between items-center gap-x-4">
                    <p class="font-bold text-sm md:text-lg">{name}</p>
                    <small class="opacity-50">{timestamp}</small>
                </header>
                <p>{decryptedDM}</p>
                {#if messageLink && !$page.url.pathname.includes('/messages')}
                    <div class="flex justify-center mr-4">
                        <button
                            type="button" 
                            class="btn btn-icon-lg p-2 text-primary-400-500-token"
                            on:click={()=>{goto(messageLink)}}
                        >
                            <span>Reply</span>
                            <span>
                                <i class="fa-solid fa-reply"></i>
                            </span>
                        </button>
                    </div>
                {/if}
            </div>
            {#if avatarRight}
                <a href={'/' + senderUser.npub}>
                    <Avatar
                    src={avatarImage}
                    width="w-12" />
                </a>
            {/if}
        </div>
    {:else} 
        <div class="p-4 space-y-4 w-32">
            <div class="grid grid-cols-1">
                <div class="placeholder animate-pulse" />
            </div>
            <div class="grid grid-cols-1">
                <div class="placeholder animate-pulse" />
            </div>
            <div class="grid grid-cols-1">
                <div class="placeholder animate-pulse" />
            </div>
        </div>
    {/if}
</div>

<style>
    .date-separator {
        display: flex;
        align-items: center;
        margin: 1rem 0;
    }
    .date-separator hr {
        flex-grow: 1;
        border: none;
        border-top: 1px solid #ccc;
    }
    .date-separator span {
        padding: 0 10px;
        color: #888;
        font-size: 0.9em;
    }
</style>
