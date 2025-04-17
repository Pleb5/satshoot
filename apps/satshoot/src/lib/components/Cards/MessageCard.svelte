<script lang="ts">
    import { run } from 'svelte/legacy';

    import ndk from '$lib/stores/session';
    import currentUser from '$lib/stores/user';
    import {
        NDKEvent,
        NDKSubscriptionCacheUsage,
        type NDKSigner,
        type NDKUser,
    } from '@nostr-dev-kit/ndk';
    import { onMount } from 'svelte';
    import { TicketEvent } from '$lib/events/TicketEvent';

    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import { selectedPerson } from '$lib/stores/messages';
    import Markdown from './Markdown.svelte';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import { Avatar } from '@skeletonlabs/skeleton-svelte';

    interface Props {
        avatarRight?: boolean;
        message: NDKEvent;
        searchTerms?: string[];
        isFirstOfDay?: boolean;
    }

    let { avatarRight = true, message, searchTerms = [], isFirstOfDay = false }: Props = $props();

    let decryptedDM: string | undefined = $state();
    const senderUser = $ndk.getUser({ pubkey: message.pubkey });
    let name = $state((senderUser as NDKUser).npub.substring(0, 10));
    let avatarImage = $state(getRoboHashPicture(message.pubkey));
    const recipient = message.tagValue('p');

    const messageDate = new Date((message.created_at as number) * 1000);
    // Time is shown in local time zone
    const timestamp = messageDate.toLocaleString();
    const ticketAddress = message.tagValue('t');
    let messageLink = $state('');

    let extraClasses = $state('preset-soft-primary rounded-tr-none');
    let templateColumn = $state('grid-cols-[auto_1fr]');

    function formatDate(date: Date): string {
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 7) {
            return diffDays === 1 ? 'Yesterday' : `${diffDays} days ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    onMount(async () => {
        if (avatarRight) {
            extraClasses = 'preset-soft rounded-tl-none';
            templateColumn = 'grid-cols-[1fr_auto]';
        }

        // Decrypt message
        // ECDH DEMANDS THAT DECRYPTION ALWAYS USES THE PUBKEY OF THE OTHER PARTY
        // BE IT THE SENDER OR THE RECIPIENT OF THE ACTUAL MESSAGE
        //
        // let sharedPoint = secp.getSharedSecret(ourPrivateKey, '02' + theirPublicKey)

        // ALWAYS USE OTHER USER REGARDLESS OF WHO SENT THE MESSAGE
        console.log('start decryption', message);
        try {
            const peerPubkey =
                message.tagValue('p') === $currentUser!.pubkey
                    ? message.pubkey
                    : message.tagValue('p');
            const peerUser = $ndk.getUser({ pubkey: peerPubkey });
            decryptedDM = await ($ndk.signer as NDKSigner).decrypt(peerUser, message.content);
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
            console.log('profile', profile);
            console.log('pubkey', senderUser.pubkey);
            if (senderUser.profile.displayName) name = senderUser.profile.displayName;
            if (senderUser.profile.name) name = senderUser.profile.name;
            if (senderUser.profile.picture) avatarImage = senderUser.profile.picture;
        } else {
            console.log('no profile');
        }

        if (ticketAddress) {
            const event = await $ndk.fetchEvent(ticketAddress, {
                groupable: true,
                groupableDelay: 800,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            });
            if (event) {
                const ticketEvent = TicketEvent.from(event);
                messageLink = '/messages/' + ticketEvent.encode();
            }
            console.log('message link', messageLink);
        }
    });

    const showMyself = $derived.by(() => {
        if (decryptedDM) {
            if (searchTerms.length > 0) {
                return searchTerms.some((term) => decryptedDM!.includes(term));
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
        <div class="grid {templateColumn} gap-x-2">
            {#if !avatarRight}
                <a href={'/' + senderUser.npub}>
                    <Avatar src={avatarImage} size="size-12" {name} />
                </a>
            {/if}
            <div class="card p-4 space-y-2 {extraClasses}">
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
                                $selectedPerson = message.pubkey + '$' + ticketAddress;
                                goto(messageLink);
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
        grow: 1;
        border: none;
        border-top: 1px solid #ccc;
    }
    .date-separator span {
        padding: 0 10px;
        color: #888;
        font-size: 0.9em;
    }
</style>
