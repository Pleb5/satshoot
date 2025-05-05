<script lang="ts">
    import { page } from '$app/state';
    import JobCard from '$lib/components/Cards/JobCard.svelte';
    import BidCard from '$lib/components/Cards/BidCard.svelte';
    import UserCard from '$lib/components/Cards/UserCard.svelte';
    import CreateBidModal from '$lib/components/Modals/CreateBidModal.svelte';
    import LoginModal from '$lib/components/Modals/LoginModal.svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import TabSelector from '$lib/components/UI/Buttons/TabSelector.svelte';
    import { BidEvent } from '$lib/events/BidEvent';
    import { JobEvent, JobStatus } from '$lib/events/JobEvent';
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

    enum BidTab {
        Pending,
        Won,
        Lost,
    }

    const jobSubOptions: NDKSubscribeOptions = {
        closeOnEose: false,
    };

    // Component state
    let jobSubscription = $state<NDKSubscription>();
    let jobPost = $state<JobEvent>();

    const bidsFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceBid],
    };
    const bidSubOptions: NDKSubscribeOptions = {
        closeOnEose: false,
        autoStart: false,
    };

    const bidStore = $ndk.storeSubscribe<BidEvent>(bidsFilter, bidSubOptions, BidEvent);

    let alreadySubscribedToBids = $state(false);
    let winningBid = $derived.by(() => {
        if (!jobPost?.acceptedBidAddress || !filteredBids.length) {
            return null;
        }

        // First check in filtered bids
        const found = filteredBids.find((o) => o.bidAddress === jobPost?.acceptedBidAddress);
        if (found) {
            return found;
        }

        // If not found, fetch it
        $ndk.fetchEvent(jobPost.acceptedBidAddress, {
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        }).then((event) => {
            if (event) {
                winningBid = BidEvent.from(event);
            }
        });
    });

    let selectedBidsTab = $derived.by(() => {
        if (winningBid) {
            return BidTab.Won;
        }

        return BidTab.Pending;
    });

    let showLoginModal = $state(false);
    let showCreateBidModal = $state(false);
    let createBidModalProps = $state<{ job: JobEvent; bidToEdit?: BidEvent } | null>(null);

    const myJob = $derived(!!$currentUser && !!jobPost && $currentUser.pubkey === jobPost.pubkey);

    const { allowCreateBid, disallowCreateBidReason } = $derived.by(() => {
        if (!jobPost)
            return {
                allowCreateBid: false,
                disallowCreateBidReason: '',
            };

        if (jobPost.status === JobStatus.New) {
            return {
                allowCreateBid: true,
                disallowCreateBidReason: '',
            };
        }

        return {
            allowCreateBid: false,
            disallowCreateBidReason: "Job status not 'New' anymore!" + ' Cannot Create/Edit Bid!',
        };
    });

    const user = $derived.by(() => {
        if (jobPost) {
            return $ndk.getUser({ pubkey: jobPost.pubkey });
        }
    });

    // Derived bid data
    const filteredBids = $derived.by(() => {
        if (!$bidStore) return [];

        let bids: BidEvent[] = [...$bidStore];

        // Filtering out bids not in the web of Trust
        bids = bids.filter((bid: BidEvent) => {
            return (
                $wot.has(bid.pubkey) ||
                (jobPost?.acceptedBidAddress && jobPost.acceptedBidAddress === bid.bidAddress)
            );
        });
        orderEventsChronologically(bids);

        return bids;
    });

    const bidToEdit = $derived.by(() => {
        if (!filteredBids.length || !$currentUser) return undefined;

        return filteredBids.find((bid) => bid.pubkey === $currentUser.pubkey);
    });

    const btnActionText = $derived(bidToEdit ? 'Edit Your Bid' : 'Create Bid');

    const pendingBids = $derived.by(() => {
        if (!filteredBids.length || !jobPost || jobPost.status !== JobStatus.New) return [];
        return filteredBids;
    });

    const lostBids = $derived.by(() => {
        if (!filteredBids.length || !jobPost || jobPost.status === JobStatus.New) return [];
        return filteredBids.filter((bid) => bid.bidAddress !== jobPost?.acceptedBidAddress);
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

            // Subscribe to job events
            const dTag = idFromNaddr(naddr).split(':')[2];
            const jobFilter: NDKFilter = {
                kinds: [NDKKind.FreelanceJob],
                '#d': [dTag],
            };

            jobSubscription = $ndk.subscribe(jobFilter, jobSubOptions);
            jobSubscription.on('event', handleJobEvent);
        }
    });

    function handleJobEvent(event: NDKEvent) {
        const arrivedJob = JobEvent.from(event);

        if (!alreadySubscribedToBids) {
            alreadySubscribedToBids = true;
            bidsFilter['#a'] = [arrivedJob.jobAddress];
            bidStore.startSubscription();
        }
        // Skip older jobs
        if (jobPost && arrivedJob.created_at! < jobPost.created_at!) {
            return;
        }

        jobPost = arrivedJob;
    }

    let pageTop = $state<HTMLDivElement>();

    onMount(() => {
        if (pageTop) {
            pageTop.scrollIntoView(true);
        }
    });

    onDestroy(() => {
        jobSubscription?.stop();
        bidStore?.empty();
    });

    async function createBid(bid: BidEvent | undefined) {
        if (!jobPost) {
            toaster.error({
                title: 'Job is not loaded yet!',
                duration: 60000, // 1 min
            });

            return;
        }

        createBidModalProps = {
            job: jobPost,
            bidToEdit: bid,
        };
        showCreateBidModal = true;
    }

    function triggerLogin() {
        showLoginModal = true;
    }

    const tabs = [
        { id: BidTab.Pending, label: 'Pending' },
        { id: BidTab.Won, label: 'Won' },
        { id: BidTab.Lost, label: 'Lost' },
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

                                    {#if bidToEdit}
                                        <BidCard bid={bidToEdit} />
                                    {/if}

                                    {#if allowCreateBid}
                                        {#if $loggedIn}
                                            <div class="flex flex-row justify-center">
                                                <Button
                                                    onClick={() => createBid(bidToEdit)}
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
                                                    Login to make bid
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
                                                {disallowCreateBidReason}
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
                                        Bids
                                        <span class="font-[400] text-[16px]"
                                            >({insertThousandSeparator(filteredBids.length)})</span
                                        >
                                    </p>
                                </div>

                                <!-- tabs start-->
                                <div class="w-full flex flex-col gap-[10px]">
                                    <TabSelector {tabs} bind:selectedTab={selectedBidsTab} />
                                    <!-- tabs content start-->
                                    <div class="w-full flex flex-col">
                                        {#if selectedBidsTab === BidTab.Pending}
                                            <div class="w-full flex flex-col">
                                                <div class="w-full flex flex-col gap-[15px]">
                                                    <!-- Bid post start-->
                                                    {#each pendingBids as bid}
                                                        <BidCard {bid} />
                                                    {/each}
                                                </div>
                                            </div>
                                        {:else if selectedBidsTab === BidTab.Won}
                                            {#if winningBid}
                                                <div class="w-full flex flex-col">
                                                    <div class="w-full flex flex-col gap-[15px]">
                                                        <BidCard bid={winningBid} showPayments />
                                                    </div>
                                                </div>
                                            {/if}
                                        {:else}
                                            <div class="w-full flex flex-col">
                                                <div class="w-full flex flex-col gap-[15px]">
                                                    <!-- Bid post start-->
                                                    {#each lostBids as bid}
                                                        <BidCard {bid} />
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

{#if createBidModalProps}
    <CreateBidModal bind:isOpen={showCreateBidModal} {...createBidModalProps} />
{/if}
