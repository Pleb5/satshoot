<script lang="ts">
    import { page } from '$app/state';
    import ServiceCard from '$lib/components/Cards/ServiceCard.svelte';
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import currentUser from '$lib/stores/user';
    import { checkRelayConnections } from '$lib/utils/helpers';
    import { idFromNaddr, relaysFromNaddr } from '$lib/utils/nip19';
    import {
        NDKRelay,
        NDKSubscription,
        type NDKFilter,
        NDKKind,
        NDKEvent,
    } from '@nostr-dev-kit/ndk';
    import type { NDKSubscribeOptions } from '@nostr-dev-kit/ndk-svelte';
    import { onDestroy, onMount } from 'svelte';

    const serviceSubOptions: NDKSubscribeOptions = {
        closeOnEose: false,
    };

    // Component state
    let serviceSubscription = $state<NDKSubscription>();
    let service = $state<ServiceEvent>();

    let showLoginModal = $state(false);

    const myService = $derived(
        !!$currentUser && !!service && $currentUser.pubkey === service.pubkey
    );

    const user = $derived.by(() => {
        if (service) {
            return $ndk.getUser({ pubkey: service.pubkey });
        }
    });

    let initialized = $state(false);
    $effect(() => {
        if ($sessionInitialized && !initialized) {
            initialized = true;
            checkRelayConnections();

            const naddr = page.params.serviceId;
            const relaysFromURL = relaysFromNaddr(naddr).split(',');

            // Add relays from URL
            relaysFromURL.forEach((relayURL: string) => {
                if (relayURL) {
                    $ndk.pool.addRelay(new NDKRelay(relayURL, undefined, $ndk));
                }
            });

            // Subscribe to job events
            const dTag = idFromNaddr(naddr).split(':')[2];
            const serviceFilter: NDKFilter = {
                kinds: [NDKKind.FreelanceService],
                '#d': [dTag],
            };

            serviceSubscription = $ndk.subscribe(serviceFilter, serviceSubOptions);
            serviceSubscription.on('event', handleServiceEvent);
        }
    });

    function handleServiceEvent(event: NDKEvent) {
        const arrivedService = ServiceEvent.from(event);

        // Skip older jobs
        if (service && arrivedService.created_at! < service.created_at!) {
            return;
        }

        service = arrivedService;
    }

    let pageTop = $state<HTMLDivElement>();

    onMount(() => {
        if (pageTop) {
            pageTop.scrollIntoView(true);
        }
    });

    onDestroy(() => {
        serviceSubscription?.stop();
    });

    function triggerLogin() {
        showLoginModal = true;
    }
</script>

<div bind:this={pageTop} class="w-full flex flex-col gap-0 grow pb-20 sm:pb-5">
    <div class="w-full flex flex-col justify-center items-center">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[50px] max-[576px]:gap-[25px]">
                {#if service}
                    <div class="w-full flex flex-col gap-[15px]">
                        <ServiceCard {service} />
                    </div>
                {:else}
                    <div class="w-[90vw] p-4 space-y-4">
                        <div class="sm:grid sm:grid-cols-[70%_1fr] sm:gap-x-4">
                            <div class="space-y-6">
                                <div class="w-full h-[50vh] card p-8 flex justify-center">
                                    <div class="w-[50%] card placeholder animate-pulse"></div>
                                </div>
                                <div class="w-full h-[20vh] card p-8 flex justify-center">
                                    <div class="w-[50%] card placeholder animate-pulse"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</div>
