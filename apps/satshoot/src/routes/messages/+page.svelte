<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/state';

    import ChatHead from '$lib/components/ChatHead.svelte';
    import Card from '$lib/components/UI/Card.svelte';

    import { BidEvent } from '$lib/events/BidEvent';
    import { JobEvent } from '$lib/events/JobEvent';

    import ndk, { sessionInitialized } from '$lib/stores/session';
    import currentUser, { loggedIn, userMode, UserMode } from '$lib/stores/user';

    import { checkRelayConnections } from '$lib/utils/helpers';
    import { NDKEvent, NDKKind, NDKSubscriptionCacheUsage, type NDKUser } from '@nostr-dev-kit/ndk';
    import { OrderEvent } from '$lib/events/OrderEvent';
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import { wotFilteredMessageFeed } from '$lib/stores/messages';

    interface ConversationData {
        jobConversations: Array<[JobEvent, NDKUser]>;
        serviceConversations: Array<[ServiceEvent, NDKUser]>;
        loading: boolean;
        error: string | null;
    }

    let searchQuery = $derived(page.url.searchParams.get('searchQuery'));
    let pageTop = $state<HTMLDivElement>();
    let mounted = $state(false);
    let initialized = $state(false);
    let canStartFetchingJobsFromMessages = $state(false);
    let canStartFetchingServicesFromMessages = $state(false);

    let conversationData = $state<ConversationData>({
        jobConversations: [],
        serviceConversations: [],
        loading: true,
        error: null,
    });
    let noConversations = $state(false);

    const defaultFetchOptions = {
        groupable: true,
        groupableDelay: 500,
        cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
    };

    $effect(() => {
        if ($loggedIn && $sessionInitialized && mounted && !initialized) {
            initialized = true;
            init();
            checkRelayConnections();
        }
    });

    async function init() {
        try {
            if ($userMode === UserMode.Client) {
                await fetchClientConversations();
                canStartFetchingServicesFromMessages = true
            } else if ($userMode === UserMode.Freelancer) {
                await fetchFreelancerConversations();
                canStartFetchingJobsFromMessages = true
            }
        } catch (error) {
            conversationData.error =
                error instanceof Error ? error.message : 'Failed to load conversations';
            conversationData.loading = false;
        }
    }

    // This effectively fetches conversations with the following conditions:
    // 1. No deal has been made, and NO BID/ORDER has been placed
    // 2. In freelance mode, conversations related to the Job
    // 3. In client mode, conversations related to the Service
    // This is necessary when people write to someone but not yet ready to 
    // commit with and Order or Bid, only after some initial conversation
    // These conversations are already covered for (Clients X Jobs) and
    // (Freelancers X Services) but not for (Clients X Orders) and (Freelancers X Jobs)
    $effect(() => {
        if ($wotFilteredMessageFeed) {
            if (canStartFetchingJobsFromMessages) {
                fetchJobsFromMessages()
            } else if (canStartFetchingServicesFromMessages) {
                fetchServicesFromMessages()
            }
        }
    })

    const fetchJobsFromMessages = async () => {
        const dtags = getDtagsFromMessages(
            NDKKind.FreelanceJob.toString(), conversationData.jobConversations
        )

        if (dtags.length === 0) return 

        const events = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceJob],
                '#d': dtags
            },
            defaultFetchOptions
        );

        const newConversations: Array<[JobEvent, NDKUser]> = [];
        events.forEach((event) => {
            const job = JobEvent.from(event);
            const user = $ndk.getUser({ pubkey: job.pubkey });
            newConversations.push([job, user]);
        });
        
        conversationData = {
            ...conversationData,
            jobConversations: [
                ...conversationData.jobConversations,
                ...newConversations
            ]
        };
    }

    const fetchServicesFromMessages = async () => {
        const dtags = getDtagsFromMessages(
            NDKKind.FreelanceService.toString(), conversationData.serviceConversations
        )

        if (dtags.length === 0) return 

        const events = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceService],
                '#d': dtags
            },
            defaultFetchOptions
        );

        const newConversations: Array<[ServiceEvent, NDKUser]> = [];
        events.forEach((event) => {
            const service = ServiceEvent.from(event);
            const user = $ndk.getUser({ pubkey: service.pubkey });
            newConversations.push([service, user]);
        });
        
        conversationData = {
            ...conversationData,
            serviceConversations: [
                ...conversationData.serviceConversations,
                ...newConversations
            ]
        };
    }

    const getDtagsFromMessages = (
        kindToCheck: string, existingData: Array<[JobEvent | ServiceEvent, NDKUser]>
    ): string[] => {
        const dtags = []
        for (const dm of $wotFilteredMessageFeed) {
            const dtag = (dm.tagValue('a') as string).split(':')[2]
            if (
                (dm.tagValue('a') as string).includes(kindToCheck)
            ) {
                // Don't fetch jobs we already have
                let mustContinue = false
                for (const [event, user] of existingData) {
                    if (event.tagValue('d') === dtag) {
                        mustContinue = true
                        break
                    }
                }

                if (mustContinue) continue

                dtags.push(dtag)
            }
        }
        return dtags
    }

    async function fetchClientConversations() {
        const events = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceJob, NDKKind.FreelanceOrder],
                authors: [$currentUser!.pubkey],
            },
            defaultFetchOptions
        );

        const jobConversations = new Map<JobEvent, NDKUser>();
        const serviceConversations = new Map<ServiceEvent, NDKUser>();
        const servicesToFetch = new Set<string>();

        events.forEach((event) => {
            if (event.kind === NDKKind.FreelanceJob) {
                const job = JobEvent.from(event);
                if (job.acceptedBidAddress && job.winnerFreelancer) {
                    const user = $ndk.getUser({ pubkey: job.winnerFreelancer });
                    jobConversations.set(job, user);
                } else {
                    jobConversations.set(job, $ndk.getUser({ pubkey: job.pubkey }));
                }
            } else if (event.kind === NDKKind.FreelanceOrder) {
                const order = OrderEvent.from(event);
                const dTag = order.referencedServiceDTag;
                if (dTag) {
                    servicesToFetch.add(dTag);
                }
            }
        });

        const serviceEvents = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceService],
                '#d': Array.from(servicesToFetch),
            },
            { ...defaultFetchOptions, groupableDelay: 800 }
        );

        serviceEvents.forEach((event) => {
            const service = ServiceEvent.from(event);
            const user = $ndk.getUser({ pubkey: service.pubkey });
            serviceConversations.set(service, user);
        });

        if (jobConversations.size === 0 && serviceConversations.size === 0) {
            noConversations = true;
        }

        conversationData = {
            jobConversations: Array.from(jobConversations.entries()),
            serviceConversations: Array.from(serviceConversations.entries()),
            loading: false,
            error: null,
        };
    }

    async function fetchFreelancerConversations() {
        const events = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceBid, NDKKind.FreelanceService],
                authors: [$currentUser!.pubkey],
            },
            defaultFetchOptions
        );

        const jobConversations = new Map<JobEvent, NDKUser>();
        const serviceConversations = new Map<ServiceEvent, NDKUser>();

        // Collect job DTags to fetch all related jobs in one request
        const jobsToFetch: string[] = [];
        const bidMap = new Map<string, BidEvent>();

        for (const event of events) {
            if (event.kind === NDKKind.FreelanceBid) {
                const bid = BidEvent.from(event);
                if (bid.referencedJobDTag) {
                    jobsToFetch.push(bid.referencedJobDTag);
                    bidMap.set(bid.bidAddress, bid);
                }
            } else if (event.kind === NDKKind.FreelanceService) {
                const service = ServiceEvent.from(event);
                serviceConversations.set(service, $ndk.getUser({ pubkey: service.pubkey }));
            }
        }

        const jobEvents = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceJob],
                '#d': jobsToFetch,
            },
            { ...defaultFetchOptions, groupableDelay: 800 }
        );

        jobEvents.forEach((jobEvent: NDKEvent) => {
            const job = JobEvent.from(jobEvent);
            const user = $ndk.getUser({ pubkey: job.pubkey });
            jobConversations.set(job, user);
        });

        if (jobConversations.size === 0 && serviceConversations.size === 0) {
            noConversations = true;
        }

        conversationData = {
            jobConversations: Array.from(jobConversations.entries()),
            serviceConversations: Array.from(serviceConversations.entries()),
            loading: false,
            error: null,
        };
    }

    /**
     * Renders loading skeleton UI elements
     */
    function LoadingSkeleton() {
        return {
            length: 6,
        };
    }

    onMount(() => {
        // Scroll to top when component mounts
        if (pageTop) {
            pageTop.scrollIntoView(true);
        }
        mounted = true;
    });
</script>

{#if $currentUser}
    <div bind:this={pageTop} class="w-full flex flex-col gap-0 grow">
        <div class="w-full h-full flex flex-col justify-center items-center py-[25px]">
            <div
                class="max-w-[1400px] w-full h-full flex flex-col justify-start items-end px-[10px] relative"
            >
                <div class="w-full h-full flex flex-col gap-[15px]">
                    <div class="w-full h-full flex gap-[15px] max-h-[calc(100vh-160px)]">
                        <Card classes="gap-[10px]">
                            <!-- Tab Content -->
                            <div class="w-full flex flex-col gap-[10px] p-[5px] overflow-y-auto">
                                {#each conversationData.jobConversations as [job, user]}
                                    <ChatHead {searchQuery} {user} event={job} />
                                {/each}
                                {#each conversationData.serviceConversations as [service, user]}
                                    <ChatHead {searchQuery} {user} event={service} />
                                {/each}
                                {#if conversationData.error}
                                    <div class="h4 text-center col-start-2 text-error">
                                        {conversationData.error}
                                    </div>
                                {:else if noConversations}
                                    <div class="h4 text-center col-start-2">No Conversations!</div>
                                {:else if conversationData.loading}
                                    {#each LoadingSkeleton() as _}
                                        <div class="w-full card flex gap-2 h-28 p-4">
                                            <div
                                                class="w-20 placeholder-circle animate-pulse"
                                            ></div>
                                            <div class="w-28 grid grid-rows-3 gap-2">
                                                <div class="placeholder animate-pulse"></div>
                                                <div class="placeholder animate-pulse"></div>
                                                <div class="placeholder animate-pulse"></div>
                                            </div>
                                        </div>
                                    {/each}
                                {/if}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    </div>
{:else}
    <div class="h3 sm:h2 text-center mt-8">Log in to View your Conversations!</div>
{/if}
