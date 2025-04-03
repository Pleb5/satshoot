<script lang="ts">
    import type { TicketEvent } from '$lib/events/TicketEvent';
    import { offerMakerToSelect } from '$lib/stores/messages';
    import ndk from '$lib/stores/ndk';
    import currentUser from '$lib/stores/user';
    import { loggedIn } from '$lib/stores/user';
    import {
        NDKKind,
        NDKSubscriptionCacheUsage,
        type NDKUser,
        type NDKUserProfile,
    } from '@nostr-dev-kit/ndk';

    import { Avatar } from '@skeletonlabs/skeleton';

    import { navigating } from '$app/stores';
    import { onMount } from 'svelte';
    import { getRoboHashPicture } from '$lib/utils/helpers';
    import Button from './UI/Buttons/Button.svelte';

    export let searchTerms: string[] = [];
    export let user: NDKUser;
    export let ticket: TicketEvent;
    const naddr = ticket.encode();

    let userProfile: NDKUserProfile;
    let latestMessage = '';
    $: avatarImage = getRoboHashPicture(user.pubkey);

    onMount(async () => {});

    async function fetchProfile() {
        const profile = await user.fetchProfile({
            groupable: true,
            groupableDelay: 800,
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        });
        if (profile) {
            userProfile = profile;
            if (userProfile.picture) {
                avatarImage = userProfile.picture;
            }
        }
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

    $: if ($loggedIn) {
        fetchProfile();
        fetchLatestMessage();
    }

    $: if ($navigating) {
        if ($navigating.to?.url.pathname === '/messages/' + naddr) {
            if (ticket.acceptedOfferAddress) {
                $offerMakerToSelect = ticket.winnerFreelancer as string;
            }
        }
    }

    let display = true;
    $: if (searchTerms.length > 0) {
        display = searchTerms.some((term) => {
            if (term.startsWith('npub1')) {
                return term === user.npub;
            }
            const name = userProfile?.name ?? userProfile?.displayName ?? '';
            return name.toLowerCase().includes(term.toLowerCase());
        });
    }
</script>

<Button
    variant="outlined"
    classes="justify-start {display ? '' : 'hidden'}"
    href={'/messages/' + naddr}
>
    <div class="flex gap-x-2">
        <div>
            <Avatar class="rounded-full border-white" src={avatarImage} />
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
                <div class="placeholder bg-blue-600 animate-pulse w-40" />
            {/if}
        </div>
    </div>
</Button>
