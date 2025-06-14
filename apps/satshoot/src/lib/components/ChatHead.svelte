<script lang="ts">
    import { JobEvent } from '$lib/events/JobEvent';
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import currentUser from '$lib/stores/user';
    import { loggedIn } from '$lib/stores/user';
    import {
        NDKSubscriptionCacheUsage,
        type NDKUser,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import Fuse from 'fuse.js';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import Button from './UI/Buttons/Button.svelte';
    import { Avatar } from '@skeletonlabs/skeleton-svelte';
    import SELECTED_QUERY_PARAM, { MessageService } from '$lib/services/messages';
    import type { ServiceEvent } from '$lib/events/ServiceEvent';
    import { onDestroy } from 'svelte';

    interface Props {
        searchQuery?: string | null;
        user: NDKUser;
        event: JobEvent | ServiceEvent;
    }

    let { searchQuery = null, user, event }: Props = $props();

    const naddr = event.encode();

    const messageLink = $derived.by(() => {
        const url = new URL('/messages/' + naddr, window.location.origin);
        if (event instanceof JobEvent && event.winnerFreelancer) {
            url.searchParams.append(SELECTED_QUERY_PARAM, event.winnerFreelancer);
        }
        return url.toString();
    });

    let initialized = $state(false);
    let latestMessage = $state('');
    let userProfile = $state<NDKUserProfile | null>(null);

    // Initialize services
    const messageService = $state(new MessageService(event.tagAddress()));
    const wotFilteredMessages = $derived(messageService.messages);

    let avatarImage = $derived.by(() => {
        if (userProfile?.picture) return userProfile.picture;
        return getRoboHashPicture(user.pubkey);
    });

    // Initialize when session is ready
    $effect(() => {
        if ($sessionInitialized && $currentUser && !initialized) {
            initialized = true;

            messageService.initialize($currentUser.pubkey);
        }
    });

    // Cleanup on destroy
    onDestroy(() => {
        messageService.unsubscribe();
    });

    async function fetchProfile() {
        userProfile = await user.fetchProfile({
            groupable: true,
            groupableDelay: 800,
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });
    }

    async function fetchLatestMessage() {
        const orderedMessages = messageService.orderMessages(wotFilteredMessages);

        if (orderedMessages.length > 0) {
            const encryptedMessage = orderedMessages[orderedMessages.length - 1];
            const peerPubkey = messageService.peerFromMessage(encryptedMessage);
            if (peerPubkey) {
                const peerUser = $ndk.getUser({ pubkey: peerPubkey });
                const decryptedMessage = await $ndk.signer?.decrypt(
                    peerUser,
                    encryptedMessage.content
                );
                if (decryptedMessage) {
                    latestMessage =
                        decryptedMessage.length > 20
                            ? decryptedMessage.substring(0, 20) + '...'
                            : decryptedMessage;
                } else {
                    latestMessage = 'Could not decrypt latest message!';
                }
            }
        } else {
            latestMessage = 'No messages';
        }
    }

    $effect(() => {
        if ($loggedIn && $sessionInitialized) {
            fetchProfile();
            fetchLatestMessage();
        }
    });

    const display = $derived.by(() => {
        if (searchQuery && searchQuery.length > 0) {
            const dataToSearch = [
                {
                    npub: user.npub,
                    ...userProfile,
                },
            ];

            const fuse = new Fuse(dataToSearch, {
                isCaseSensitive: false,
                ignoreLocation: true, // When true, search will ignore location and distance, so it won't matter where in the string the pattern appears
                threshold: 0.6,
                minMatchCharLength: 2, // Only the matches whose length exceeds this value will be returned
                keys: [
                    {
                        name: 'npub',
                        weight: 0.4,
                    },
                    {
                        name: 'name',
                        weight: 0.3,
                    },
                    {
                        name: 'displayName',
                        weight: 0.3,
                    },
                ],
            });
            const searchResult = fuse.search(searchQuery);
            return searchResult.length > 0;
        }

        return true;
    });
</script>

<Button variant="outlined" classes="justify-start {display ? '' : 'hidden'}" href={messageLink}>
    <div class="flex gap-x-2">
        <div>
            <Avatar
                classes="rounded-full border-white"
                src={userProfile?.image || avatarImage}
                name={userProfile?.displayName || 'user avatar'}
            />
        </div>
        <div class="flex flex-col items-start">
            <div class="h5 sm:h4 text-center font-bold text-lg sm:text-2xl">
                {event.title.length > 20 ? event.title.substring(0, 20) + '...' : event.title}
            </div>
            <div class="sm:text-lg">
                {userProfile?.name ?? userProfile?.displayName ?? user.npub.substring(0, 15)}
            </div>
            <!-- Latest message -->
            {#if latestMessage}
                <div class="opacity-50">
                    {latestMessage}
                </div>
            {:else}
                <div class="placeholder bg-blue-600 animate-pulse w-40"></div>
            {/if}
        </div>
    </div>
</Button>
