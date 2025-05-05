<script lang="ts">
    import { page } from '$app/state';
    import JobCard from '$lib/components/Cards/JobCard.svelte';
    import OfferCard from '$lib/components/Cards/OfferCard.svelte';
    import UserCard from '$lib/components/Cards/UserCard.svelte';
    import CreateOfferModal from '$lib/components/Modals/CreateOfferModal.svelte';
    import LoginModal from '$lib/components/Modals/LoginModal.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import TabSelector from '$lib/components/UI/Buttons/TabSelector.svelte';
    import { OfferEvent } from '$lib/events/OfferEvent';
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import { toaster } from '$lib/stores/toaster';
    import currentUser, { loggedIn } from '$lib/stores/user';
    import { wot } from '$lib/stores/wot';
    import { checkRelayConnections, orderEventsChronologically } from '$lib/utils/helpers';
    import { insertThousandSeparator } from '$lib/utils/misc';
    import { idFromNaddr, relaysFromNaddr } from '$lib/utils/nip19';
    import {
        NDKRelay,
        type NDKFilter,
        NDKKind,
        NDKSubscription,
        NDKSubscriptionCacheUsage,
        NDKEvent,
    } from '@nostr-dev-kit/ndk';

    import { onDestroy, onMount } from 'svelte';
    import type { NDKSubscribeOptions } from '@nostr-dev-kit/ndk-svelte';

    enum OfferTab {
        Pending,
        Won,
        Lost,
    }

    const jobSubOptions: NDKSubscribeOptions = {
        closeOnEose: false,
    };

    // Component state
    let jobSubscription = $state<NDKSubscription>();
    let jobPost = $state<TicketEvent>();

    const offersFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceOffer],
    };
    const offerSubOptions: NDKSubscribeOptions = {
        closeOnEose: false,
        autoStart: false,
    };

    const offerStore = $ndk.storeSubscribe<OfferEvent>(offersFilter, offerSubOptions, OfferEvent);

    let alreadySubscribedToOffers = $state(false);
    let winningOffer = $derived.by(() => {
        if (!jobPost?.acceptedOfferAddress || !filteredOffers.length) {
            return null;
        }

        // First check in filtered offers
        const found = filteredOffers.find((o) => o.offerAddress === jobPost?.acceptedOfferAddress);
        if (found) {
            return found;
        }

        // If not found, fetch it
        $ndk.fetchEvent(jobPost.acceptedOfferAddress, {
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        }).then((event) => {
            if (event) {
                winningOffer = OfferEvent.from(event);
            }
        });
    });

    let selectedOffersTab = $derived.by(() => {
        if (winningOffer) {
            return OfferTab.Won;
        }

        return OfferTab.Pending;
    });

    let showLoginModal = $state(false);
    let showCreateOfferModal = $state(false);
    let createOfferModalProps = $state<{ ticket: TicketEvent; offerToEdit?: OfferEvent } | null>(
        null
    );

    const myJob = $derived(!!$currentUser && !!jobPost && $currentUser.pubkey === jobPost.pubkey);

    const { allowCreateOffer, disallowCreateOfferReason } = $derived.by(() => {
        if (!jobPost)
            return {
                allowCreateOffer: false,
                disallowCreateOfferReason: '',
            };

        if (jobPost.status === TicketStatus.New) {
            return {
                allowCreateOffer: true,
                disallowCreateOfferReason: '',
            };
        }

        return {
            allowCreateOffer: false,
            disallowCreateOfferReason:
                "Job status not 'New' anymore!" + ' Cannot Create/Edit Offer!',
        };
    });

    const user = $derived.by(() => {
        if (jobPost) {
            return $ndk.getUser({ pubkey: jobPost.pubkey });
        }
    });

    // Derived offer data
    const filteredOffers = $derived.by(() => {
        if (!$offerStore) return [];

        let offers: OfferEvent[] = [...$offerStore];

        // Filtering out offers not in the web of Trust
        offers = offers.filter((offer: OfferEvent) => {
            return (
                $wot.has(offer.pubkey) ||
                (jobPost?.acceptedOfferAddress &&
                    jobPost.acceptedOfferAddress === offer.offerAddress)
            );
        });
        orderEventsChronologically(offers);

        return offers;
    });

    const offerToEdit = $derived.by(() => {
        if (!filteredOffers.length || !$currentUser) return undefined;

        return filteredOffers.find((offer) => offer.pubkey === $currentUser.pubkey);
    });

    const btnActionText = $derived(offerToEdit ? 'Edit Your Offer' : 'Create Offer');

    const pendingOffers = $derived.by(() => {
        if (!filteredOffers.length || !jobPost || jobPost.status !== TicketStatus.New) return [];
        return filteredOffers;
    });

    const lostOffers = $derived.by(() => {
        if (!filteredOffers.length || !jobPost || jobPost.status === TicketStatus.New) return [];
        return filteredOffers.filter(
            (offer) => offer.offerAddress !== jobPost?.acceptedOfferAddress
        );
    });

    let initialized = $state(false);
    $effect(() => {
        if ($sessionInitialized && !initialized) {
            initialized = true;
            checkRelayConnections();

            const naddr = page.params.jobId;
            const relaysFromURL = relaysFromNaddr(naddr).split(',');

            // Add relays from URL
            relaysFromURL.forEach((relayURL: string) => {
                if (relayURL) {
                    $ndk.pool.addRelay(new NDKRelay(relayURL, undefined, $ndk));
                }
            });

            // Subscribe to ticket events
            const dTag = idFromNaddr(naddr).split(':')[2];
            const ticketFilter: NDKFilter = {
                kinds: [NDKKind.FreelanceTicket],
                '#d': [dTag],
            };

            jobSubscription = $ndk.subscribe(ticketFilter, jobSubOptions);
            jobSubscription.on('event', handleTicketEvent);
        }
    });

    function handleTicketEvent(event: NDKEvent) {
        const arrivedTicket = TicketEvent.from(event);

        if (!alreadySubscribedToOffers) {
            alreadySubscribedToOffers = true;
            offersFilter['#a'] = [arrivedTicket.ticketAddress];
            offerStore.startSubscription();
        }
        // Skip older tickets
        if (jobPost && arrivedTicket.created_at! < jobPost.created_at!) {
            return;
        }

        jobPost = arrivedTicket;
    }

    let pageTop = $state<HTMLDivElement>();

    onMount(() => {
        if (pageTop) {
            pageTop.scrollIntoView(true);
        }
    });

    onDestroy(() => {
        jobSubscription?.stop();
        offerStore?.empty();
    });

    async function createOffer(offer: OfferEvent | undefined) {
        if (!jobPost) {
            toaster.error({
                title: 'Job is not loaded yet!',
                duration: 60000, // 1 min
            });

            return;
        }

        createOfferModalProps = {
            ticket: jobPost,
            offerToEdit: offer,
        };
        showCreateOfferModal = true;
    }

    function triggerLogin() {
        showLoginModal = true;
    }

    const tabs = [
        { id: OfferTab.Pending, label: 'Pending' },
        { id: OfferTab.Won, label: 'Won' },
        { id: OfferTab.Lost, label: 'Lost' },
    ];
</script>

<div bind:this={pageTop} class="w-full flex flex-col gap-0 grow">
    <div class="w-full flex flex-col justify-center items-center py-[25px]">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[50px] max-[576px]:gap-[25px]">
                {#if jobPost}
                    <div class="w-full flex flex-row gap-[25px] max-[768px]:flex-col">
                        <!-- Job post main start -->
                        <div class="w-full flex flex-col gap-[15px]">
                            <JobCard job={jobPost} />

                            {#if !myJob}
                                <div class="w-full flex flex-col gap-[15px]">
                                    {#if $loggedIn}
                                        <div
                                            class="w-full flex flex-row flex-wrap gap-[10px] justify-between items-center"
                                        >
                                            <p
                                                class="font-[600] text-[24px] flex flex-row gap-[5px] items-center"
                                            >
                                                My Submission
                                            </p>
                                        </div>
                                    {/if}

                                    {#if offerToEdit}
                                        <OfferCard offer={offerToEdit} />
                                    {/if}

                                    {#if allowCreateOffer}
                                        {#if $loggedIn}
                                            <div class="flex flex-row justify-center">
                                                <Button
                                                    onClick={() => createOffer(offerToEdit)}
                                                    classes="max-[768px]:grow-1"
                                                >
                                                    {btnActionText}
                                                </Button>
                                            </div>
                                        {:else}
                                            <div class="flex flex-row justify-center">
                                                <Button
                                                    onClick={triggerLogin}
                                                    classes="max-[768px]:grow-1"
                                                >
                                                    Login to make offer
                                                </Button>
                                            </div>
                                        {/if}
                                    {:else}
                                        <div
                                            class="w-full min-h-[100px] rounded-[8px] bg-black-100 dark:bg-white-100 border-[4px] border-black-100 dark:border-white-100 flex flex-col justify-center items-center"
                                        >
                                            <p
                                                class="font-[600] text-[18px] text-black-300 dark:text-white-300"
                                            >
                                                {disallowCreateOfferReason}
                                            </p>
                                        </div>
                                    {/if}
                                </div>
                            {/if}

                            <div class="w-full flex flex-col gap-[15px]">
                                <div
                                    class="w-full flex flex-row flex-wrap gap-[10px] justify-between items-center"
                                >
                                    <p
                                        class="font-[600] text-[24px] flex flex-row gap-[5px] items-center"
                                    >
                                        Offers
                                        <span class="font-[400] text-[16px]"
                                            >({insertThousandSeparator(
                                                filteredOffers.length
                                            )})</span
                                        >
                                    </p>
                                </div>

                                <!-- tabs start-->
                                <div class="w-full flex flex-col gap-[10px]">
                                    <TabSelector {tabs} bind:selectedTab={selectedOffersTab} />
                                    <!-- tabs content start-->
                                    <div class="w-full flex flex-col">
                                        {#if selectedOffersTab === OfferTab.Pending}
                                            <div class="w-full flex flex-col">
                                                <div class="w-full flex flex-col gap-[15px]">
                                                    <!-- Offer post start-->
                                                    {#each pendingOffers as offer}
                                                        <OfferCard {offer} />
                                                    {/each}
                                                </div>
                                            </div>
                                        {:else if selectedOffersTab === OfferTab.Won}
                                            {#if winningOffer}
                                                <div class="w-full flex flex-col">
                                                    <div class="w-full flex flex-col gap-[15px]">
                                                        <OfferCard
                                                            offer={winningOffer}
                                                            showPayments
                                                        />
                                                    </div>
                                                </div>
                                            {/if}
                                        {:else}
                                            <div class="w-full flex flex-col">
                                                <div class="w-full flex flex-col gap-[15px]">
                                                    <!-- Offer post start-->
                                                    {#each lostOffers as offer}
                                                        <OfferCard {offer} />
                                                    {/each}
                                                </div>
                                            </div>
                                        {/if}
                                    </div>
                                    <!-- tabs content end -->
                                </div>
                                <!-- tabs end-->
                            </div>
                        </div>
                        <!-- user card -->
                        {#if user}
                            <div class="flex flex-col">
                                <div class="w-full hidden max-[768px]:flex">
                                    <p class="font-[600] text-[24px]">Posted By</p>
                                </div>
                                <UserCard {user} job={jobPost} />
                            </div>
                        {/if}
                    </div>
                {:else}
                    <div class="w-full p-4 space-y-4">
                        <div class="sm:grid sm:grid-cols-[90%_1fr] sm:gap-x-4">
                            <div class="space-y-6">
                                <div class="w-full h-[50vh] card p-8 flex justify-center">
                                    <div class="w-[50%] card placeholder animate-pulse"></div>
                                </div>
                                <div class="w-full h-[20vh] card p-8 flex justify-center">
                                    <div class="w-[50%] card placeholder animate-pulse"></div>
                                </div>
                            </div>
                            <div class="hidden sm:block sm:space-y-6">
                                <div class="w-full h-[70vh] card p-8 flex justify-center">
                                    <div class="w-[50%] card placeholder animate-pulse"></div>
                                </div>
                                <div class="w-full h-[30vh] card p-8 flex justify-center">
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

<LoginModal bind:isOpen={showLoginModal} />

{#if createOfferModalProps}
    <CreateOfferModal bind:isOpen={showCreateOfferModal} {...createOfferModalProps} />
{/if}
