<script lang="ts">
import ndk from "$lib/stores/ndk";
import currentUser from "$lib/stores/user";
import { 
    NDKEvent,
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

    await senderUser.fetchProfile();
    if (senderUser.profile) {
        console.log('user profile', senderUser.profile)
        let profile:NDKUserProfile;
        // NDK bug: If user profile is not in LRU cache iti is served from 
        // dexie which stores profiles NOT identically to an NDKEvent but 
        // {pubkey:...; created_at:...; ... ; profile: ... instead of content:...}
        if (senderUser.profile.name) {
            profile = senderUser.profile;
        } else {
            profile = senderUser.profile.profile;
        }

        if (profile.displayName) name = profile.displayName;
        if (profile.name) name = profile.name;
        if (profile.image) avatarImage = profile.image;

    } else {
        console.log('no profile')
    }

    if (ticketAddress) {
        const event = await $ndk.fetchEvent(ticketAddress);
        if (event) {
            const ticketEvent = TicketEvent.from(event);
            messageLink = "/messages/"
                + ticketEvent.encode() + ":" + ticketEvent.title;
        }
        console.log('message link', messageLink)
    }
});

let showMyself = false;
$: if (decryptedDM) {
    showMyself = decryptedDM.includes(searchText);
}


</script>

{#if decryptedDM}
    <div class="grid {templateColumn} gap-x-2 {showMyself ? '' : 'hidden'}">
        {#if !avatarRight}
            <Avatar
            src={avatarImage}
            width="w-12" />
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
            <Avatar
            src={avatarImage}
            width="w-12" />
        {/if}
    </div>
{:else} 
    <div class="p-4 space-y-4">
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
        <div class="grid grid-cols-3 gap-8">
            <div class="placeholder animate-pulse" />
            <div class="placeholder animate-pulse" />
            <div class="placeholder animate-pulse" />
        </div>
    </div>
{/if}
