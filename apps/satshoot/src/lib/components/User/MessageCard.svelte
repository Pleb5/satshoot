<script lang="ts">
import ndk from "$lib/stores/ndk";
import { type NDKUser } from "@nostr-dev-kit/ndk";
import { Avatar } from '@skeletonlabs/skeleton';
import { onMount } from "svelte";
import type { Message } from '$lib/stores/messages';


export let avatarRight = true;
export let message: Message;

const user = $ndk.getUser({pubkey: message.sender});
let name: string = (user as NDKUser).npub.substring(0,10);
let avatarImage: string = `https://robohash.org/${message.sender}`;

let extraClasses = 'variant-soft-primary rounded-tr-none'

onMount(async () => {
    if (avatarRight) {
        extraClasses = 'variant-soft rounded-tl-none'
    }
    const profile = await user.fetchProfile();
    if (profile) {
        if (profile.name) name = profile.name;
        if (profile.image) avatarImage = profile.image;
    }

});


</script>

{#if message}
    <div class="grid grid-cols-{avatarRight ? '[1fr_auto]' : '[auto_1fr]'} gap-2">
        {#if !avatarRight}
            <Avatar
            src={avatarImage}
            width="w-12" />
        {/if}
        <div class="card p-4 space-y-2 {extraClasses}">
            <header class="flex justify-between items-center gap-x-4">
                <p class="font-bold text-sm md:text-lg">{name}</p>
                <small class="opacity-50">{message.timestamp}</small>
            </header>
            <p>{message.message}</p>
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
