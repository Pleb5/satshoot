<script lang="ts">
    import type { TicketEvent } from '$lib/events/TicketEvent';
    import { offerMakerToSelect } from '$lib/stores/messages';
    import ndk from '$lib/stores/session';
    import currentUser from '$lib/stores/user';
    import { loggedIn } from '$lib/stores/user';
    import {
        NDKKind,
        NDKSubscriptionCacheUsage,
        type NDKUser,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';

    import { navigating } from '$app/state';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import Button from './UI/Buttons/Button.svelte';
    import { Avatar } from '@skeletonlabs/skeleton-svelte';

    interface Props {
        searchTerms?: string[];
        user: NDKUser;
        ticket: TicketEvent;
    }

    let { searchTerms = [], user, ticket }: Props = $props();
    const naddr = ticket.encode();

    let userProfile = $state<NDKUserProfile | null>(null);
    let latestMessage = $state('');
    let avatarImage = $derived.by(()=>{
        if (userProfile?.picture) return userProfile.picture;
        return getRoboHashPicture(user.pubkey)
    });

    async function fetchProfile() {
        userProfile = await user.fetchProfile({
            groupable: true,
            groupableDelay: 800,
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });
    }

    async function fetchLatestMessage() {
        const ticketMessages = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.EncryptedDirectMessage],
                authors: [user.pubkey, $currentUser!.pubkey],
                '#t': [ticket.ticketAddress],
            },
            {
                groupable: true,
                groupableDelay: 1000,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            }
        );
        if (ticketMessages.size > 0) {
            const ticketMessagesArr = Array.from(ticketMessages);
            let encryptedMessage = ticketMessagesArr[0];
            // Get the latest message event
            for (const msg of ticketMessagesArr) {
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
        if ($loggedIn) {
            fetchProfile();
            fetchLatestMessage();
        }
    });

    $effect(() => {
        if (navigating) {
            if (navigating.to?.url.pathname === '/messages/' + naddr) {
                if (ticket.acceptedOfferAddress) {
                    $offerMakerToSelect = ticket.winnerFreelancer as string;
                }
            }
        }
    });

    const display = $derived.by(() => {
        if (searchTerms.length > 0) {
            return searchTerms.some((term) => {
                if (term.startsWith('npub1')) {
                    return term === user.npub;
                }
                const name = userProfile?.name ?? userProfile?.displayName ?? '';
                return name.toLowerCase().includes(term.toLowerCase());
            });
        }

        return true;
    });
</script>

<Button
    variant="outlined"
    classes="justify-start {display ? '' : 'hidden'}"
    href={'/messages/' + naddr}
>
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
                {ticket.title.length > 20 ? ticket.title.substring(0, 20) + '...' : ticket.title}
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
