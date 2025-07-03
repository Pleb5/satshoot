<script lang="ts">
    import ndk from '$lib/stores/session';
    import currentUser from '$lib/stores/user';
    import {
        NDKEvent,
        NDKSubscriptionCacheUsage,
        type NDKSigner,
        type NDKUser,
    } from '@nostr-dev-kit/ndk';
    import Fuse from 'fuse.js';
    import { onMount } from 'svelte';
    import { JobEvent } from '$lib/events/JobEvent';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import Markdown from './Markdown.svelte';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import { Avatar } from '@skeletonlabs/skeleton-svelte';
    import SELECTED_QUERY_PARAM from '$lib/services/messages';

    interface Props {
        avatarRight?: boolean;
        message: NDKEvent;
        searchQuery?: string | null;
        isFirstOfDay?: boolean;
    }

    let { avatarRight = true, message, searchQuery = null, isFirstOfDay = false }: Props = $props();

    let decryptedDM: string | undefined = $state();
    const senderUser = $ndk.getUser({ pubkey: message.pubkey });
    let name = $state((senderUser as NDKUser).npub.substring(0, 10));
    let avatarImage = $state(getRoboHashPicture(message.pubkey));
    const recipient = message.tagValue('p');

    const messageDate = new Date((message.created_at as number) * 1000);
    // Time is shown in local time zone
    const timestamp = messageDate.toLocaleString();
    const jobAddress = message.tagValue('t');
    let messageLink = $state<URL>();

    function formatDate(date: Date): string {
        const now = new Date();

        // Strip time from both dates
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        const diffTime = today.getTime() - inputDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';

        if (diffDays === 1) return 'Yesterday';

        if (diffDays < 7 && diffDays > 1) return `${diffDays} days ago`;

        return date.toLocaleDateString();
    }

    onMount(async () => {
        // Decrypt message
        // ECDH DEMANDS THAT DECRYPTION ALWAYS USES THE PUBKEY OF THE OTHER PARTY
        // BE IT THE SENDER OR THE RECIPIENT OF THE ACTUAL MESSAGE
        //
        // let sharedPoint = secp.getSharedSecret(ourPrivateKey, '02' + theirPublicKey)

        // ALWAYS USE OTHER USER REGARDLESS OF WHO SENT THE MESSAGE
        try {
            const peerPubkey =
                message.tagValue('p') === $currentUser!.pubkey
                    ? message.pubkey
                    : message.tagValue('p');
            const peerUser = $ndk.getUser({ pubkey: peerPubkey });
            const decrypted = await ($ndk.signer as NDKSigner).decrypt(peerUser, message.content);

            decryptedDM = decrypted
                .split('\n')
                .filter((line) => !line.startsWith('Reply to this message in SatShoot'))
                .join('\n');
        } catch (e) {
            console.trace(e);
        }

        const profile = await senderUser.fetchProfile({
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            closeOnEose: true,
            groupable: true,
            groupableDelay: 500,
        });
        if (senderUser.profile) {
            if (senderUser.profile.displayName) name = senderUser.profile.displayName;
            if (senderUser.profile.name) name = senderUser.profile.name;
            if (senderUser.profile.picture) avatarImage = senderUser.profile.picture;
        } else {
            console.log('no profile');
        }

        if (jobAddress) {
            const event = await $ndk.fetchEvent(jobAddress, {
                groupable: true,
                groupableDelay: 800,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            });
            if (event) {
                const jobEvent = JobEvent.from(event);
                messageLink = new URL('/messages/' + jobEvent.encode(), window.location.origin);
                messageLink.searchParams.append(SELECTED_QUERY_PARAM, senderUser.pubkey);
            }
        }
    });

    const showMyself = $derived.by(() => {
        if (decryptedDM) {
            if (searchQuery && searchQuery.length > 0) {
                const fuse = new Fuse([decryptedDM], {
                    isCaseSensitive: false,
                    ignoreLocation: true, // When true, search will ignore location and distance, so it won't matter where in the string the pattern appears
                    threshold: 0.6,
                    minMatchCharLength: 2, // Only the matches whose length exceeds this value will be returned
                });
                const searchResult = fuse.search(searchQuery);
                return searchResult.length > 0;
            } else {
                return true;
            }
        }
        return false; // Default value if decryptedDM is falsy
    });
</script>

<div class={showMyself ? '' : 'hidden'}>
    {#if isFirstOfDay}
        <div class="date-separator">
            <hr />
            <span>{formatDate(messageDate)}</span>
            <hr />
        </div>
    {/if}
    {#if decryptedDM}
        <div class="grid {avatarRight ? 'grid-cols-[1fr_auto]' : 'grid-cols-[auto_1fr]'} gap-x-2">
            {#if !avatarRight}
                <a href={'/' + senderUser.npub}>
                    <Avatar src={avatarImage} size="size-12" {name} />
                </a>
            {/if}
            <div
                class="card p-4 space-y-2 {avatarRight
                    ? 'preset-tonal rounded-tl-none'
                    : 'preset-tonal-surface rounded-tr-none'}"
            >
                <header class="flex justify-between items-center gap-x-4">
                    <p class="font-bold text-sm md:text-lg">{name}</p>
                    <small class="opacity-50">{timestamp}</small>
                </header>
                <Markdown content={decryptedDM} />
                {#if messageLink && !page.url.pathname.includes('/messages')}
                    <div class="flex justify-center mr-4">
                        <button
                            type="button"
                            class="btn btn-icon-lg p-2 text-primary-400-500"
                            onclick={() => {
                                if (messageLink) {
                                    goto(messageLink);
                                }
                            }}
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
                    <Avatar src={avatarImage} size="size-12" {name} />
                </a>
            {/if}
        </div>
    {:else}
        <div class="p-4 space-y-4 w-32">
            <div class="grid grid-cols-1">
                <div class="placeholder animate-pulse"></div>
            </div>
            <div class="grid grid-cols-1">
                <div class="placeholder animate-pulse"></div>
            </div>
            <div class="grid grid-cols-1">
                <div class="placeholder animate-pulse"></div>
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
