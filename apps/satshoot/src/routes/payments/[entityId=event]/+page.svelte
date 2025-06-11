<script lang="ts">
    import { page } from '$app/state';
    import currentUser, { loggedIn } from '$lib/stores/user';
    import LoginModal from '$lib/components/Modals/LoginModal.svelte';
    import { redirectAfterLogin } from '$lib/stores/gui';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import SELECTED_QUERY_PARAM, { JobService } from '$lib/services/messages';
    import { idFromNaddr, relaysFromNaddr } from '$lib/utils/nip19';
    import type { NDKSubscribeOptions } from '@nostr-dev-kit/ndk-svelte';
    import {
        NDKSubscription,
        type NDKFilter,
        NDKKind,
        NDKRelay,
        NDKEvent,
        NDKSubscriptionCacheUsage,
    } from '@nostr-dev-kit/ndk';
    import { JobEvent } from '$lib/events/JobEvent';
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import { BidEvent } from '$lib/events/BidEvent';
    import { checkRelayConnections } from '$lib/utils/helpers';

    // Parse URL parameters
    const primaryEntityAddress = idFromNaddr(page.params.entityId);
    const relaysFromPrimary = relaysFromNaddr(page.params.entityId).split(',');
    
    // Component state
    let initialized = $state(false);
    let showLoginModal = $state(false);
    let allowPayments = $derived(!!$currentUser && $loggedIn);
    let jobPost = $state<JobEvent>();
    let winningBid = $state<BidEvent>();

    $effect(() => {
        if ($sessionInitialized && !initialized) {
            checkRelayConnections();

            const naddr = page.params.entityId;
            const relaysFromURL = relaysFromNaddr(naddr).split(',');

            // Add relays from URL
            relaysFromURL.forEach((relayURL: string) => {
                if (relayURL) {
                    $ndk.pool.addRelay(new NDKRelay(relayURL, undefined, $ndk));
                }
            });

            $ndk.fetchEvent(primaryEntityAddress, {
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            })
                .then((event) => {
                    if (event) {
                        jobPost = JobEvent.from(event);
                        return jobPost.acceptedBidAddress;
                    }
                })
                .then((bidNaddr) => {
                    if (bidNaddr) {
                        $ndk.fetchEvent(bidNaddr, {
                            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
                        }).then((event) => {
                            if (event) {
                                winningBid = BidEvent.from(event);
                                initialized = true;
                            }
                        });
                    }
                });
        }
    });

    // Initialize services
    const jobService = $state(new JobService(primaryEntityAddress, relaysFromPrimary));

    function handleLogin() {
        $redirectAfterLogin = false;
        showLoginModal = true;
    }
</script>

<div class="w-full flex flex-col gap-0 grow">
    {#if !allowPayments}
        <Button onClick={handleLogin}>Log in To Post</Button>
    {:else}
        Payments!!!<br />
        Naddr: {primaryEntityAddress}<br />
        Relays: {relaysFromPrimary}<br />
        <br>
        Initialized: {initialized}<br />
        Winning Bid: {jobPost?.content}<br />
        Bid-Naddr: {winningBid?.bidAddress}<br />
        Bid: {winningBid?.content}
    {/if}
</div>

<LoginModal bind:isOpen={showLoginModal} />
