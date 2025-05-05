<script lang="ts">
    import type { JobEvent } from '$lib/events/JobEvent';
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import currentUser from '$lib/stores/user';
    import { loggedIn } from '$lib/stores/user';
    import {
        NDKKind,
        NDKSubscriptionCacheUsage,
        type NDKUser,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';
    import Fuse from 'fuse.js';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import Button from './UI/Buttons/Button.svelte';
    import { Avatar } from '@skeletonlabs/skeleton-svelte';
    import SELECTED_QUERY_PARAM from '$lib/services/messages';

    interface Props {
        searchQuery?: string | null;
        user: NDKUser;
        job: JobEvent;
    }

    let { searchQuery = null, user, job }: Props = $props();
    job.encode();

    const naddr = job.encode();

    const messageLink = $derived.by(() => {
        const url = new URL('/messages/' + naddr, window.location.origin);
        if (job.winnerFreelancer) {
            url.searchParams.append(SELECTED_QUERY_PARAM, job.winnerFreelancer);
        }
        return url.toString();
    });

    let userProfile = $state<NDKUserProfile | null>(null);
    let latestMessage = $state('');
    let avatarImage = $derived.by(() => {
        if (userProfile?.picture) return userProfile.picture;
        return getRoboHashPicture(user.pubkey);
    });

    async function fetchProfile() {
        userProfile = await user.fetchProfile({
            groupable: true,
            groupableDelay: 800,
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });
    }

    async function fetchLatestMessage() {
        const jobMessages = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.EncryptedDirectMessage],
                authors: [user.pubkey, $currentUser!.pubkey],
                '#t': [job.jobAddress],
            },
            {
                groupable: true,
                groupableDelay: 1000,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            }
        );
        if (jobMessages.size > 0) {
            const jobMessagesArr = Array.from(jobMessages);
            let encryptedMessage = jobMessagesArr[0];
            // Get the latest message event
            for (const msg of jobMessagesArr) {
                if (msg.created_at! > encryptedMessage.created_at!) {
                    encryptedMessage = msg;
                }
            }

            const decryptedMessage = await $ndk.signer?.decrypt(user, encryptedMessage.content);
            if (decryptedMessage) {
                latestMessage =
                    decryptedMessage.length > 20
                        ? decryptedMessage.substring(0, 20) + '...'
                        : decryptedMessage;
            } else {
                latestMessage = 'Could not decrypt latest message!';
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
                {userProfile?.name ?? userProfile?.displayName ?? user.npub.substring(0, 15)}
            </div>
            <div class="sm:text-lg">
                {job.title.length > 20 ? job.title.substring(0, 20) + '...' : job.title}
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
