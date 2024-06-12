<script lang="ts">
import ndk from "$lib/stores/ndk";
import { Avatar } from '@skeletonlabs/skeleton';
import { type NDKSigner } from "@nostr-dev-kit/ndk";
import currentUser from "$lib/stores/user";
import { onMount } from "svelte";
import type { Message } from '$lib/stores/messages';


export let avatarRight = true;
export let message: Message;
export let name: string;
export let avatarImage: string;

const color = 'variant-soft-primary'
onMount(async () => {
});



</script>

{#if message}
    <div class="grid grid-cols-[auto_1fr] gap-2">
        {#if !avatarRight}
            <Avatar
            src={message.avatar
                ?? `https://robohash.org/${message.pubkey}`}
            width="w-12" />
        {/if}
        <div class="card p-4 variant-soft rounded-tl-none space-y-2">
            <header class="flex justify-between items-center gap-x-4">
                <p class="font-bold text-sm md:text-lg">{message.name}</p>
                <small class="opacity-50">{message.timestamp}</small>
            </header>
            <p>{message.message}</p>
        </div>
        {#if avatarRight}
            <Avatar
            src={message.avatar
                ?? `https://robohash.org/${message.pubkey}`}
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
