<script lang="ts">
import ndk from "$lib/stores/ndk";
import { type NDKUser, type NDKUserProfile } from "@nostr-dev-kit/ndk";
import { Avatar } from '@skeletonlabs/skeleton';
import { onMount } from "svelte";
import type { Message } from '$lib/stores/messages';


export let avatarRight = true;
export let message: Message;

const user = $ndk.getUser({pubkey: message.sender});
let name: string;
let avatarImage: string;

let extraClasses = 'variant-soft-primary rounded-tr-none'
let templateColumn = 'grid-cols-[auto_1fr]';

onMount(async () => {
    if (avatarRight) {
        extraClasses = 'variant-soft rounded-tl-none'
        templateColumn = 'grid-cols-[1fr_auto]';
    }

    name = (user as NDKUser).npub.substring(0,10);
    avatarImage = `https://robohash.org/${message.sender}`

    await user.fetchProfile();
    if (user.profile) {
        console.log('user profile', user.profile)
        let profile:NDKUserProfile;
        // NDK bug: If user profile is not in LRU cache iti is served from 
        // dexie which stores profiles NOT identically to an NDKEvent but 
        // {pubkey:...; created_at:...; ... ; profile: ... instead of content:...}
        if (user.profile.name) {
            profile = user.profile;
        } else {
            profile = user.profile.profile;
        }

        if (profile.displayName) name = profile.displayName;
        if (profile.name) name = profile.name;
        if (profile.image) avatarImage = profile.image;

    } else {
        console.log('no profile')
    }
});


</script>

{#if message}
    <div class="grid {templateColumn} gap-x-2">
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
