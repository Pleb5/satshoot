<script lang="ts">
    // Core imports
    import { onMount } from 'svelte';
    import { page } from '$app/state';

    // Component imports
    import ChatHead from '$lib/components/ChatHead.svelte';
    import Card from '$lib/components/UI/Card.svelte';

    // Data models
    import { BidEvent } from '$lib/events/BidEvent';
    import { JobEvent } from '$lib/events/JobEvent';

    // Store imports
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import currentUser, { loggedIn, userMode, UserMode } from '$lib/stores/user';

    // Utilities
    import { checkRelayConnections } from '$lib/utils/helpers';
    import { NDKEvent, NDKKind, NDKSubscriptionCacheUsage, type NDKUser } from '@nostr-dev-kit/ndk';
    import { OrderEvent } from '$lib/events/OrderEvent';
    import { ServiceEvent } from '$lib/events/ServiceEvent';

    // Types and interfaces
    interface ConversationData {
        jobConversations: Map<JobEvent, NDKUser>;
        serviceConversations: Map<ServiceEvent, NDKUser>;
        loading: boolean;
        error: string | null;
    }

    // Component state
    let searchQuery = $derived(page.url.searchParams.get('searchQuery'));
    let pageTop = $state<HTMLDivElement>();
    let mounted = $state(false);
    let initialized = $state(false);

    // Conversation state
    let conversationData = $state<ConversationData>({
        jobConversations: new Map(),
        serviceConversations: new Map(),
        loading: true,
        error: null,
    });
    let noConversations = $state(false);

    // Standard fetch options to reduce duplication
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

    /**
     * Initialize the messages view based on user mode
     */
    async function init() {
        try {
            if ($userMode === UserMode.Client) {
                await fetchClientConversations();
            } else if ($userMode === UserMode.Freelancer) {
                await fetchFreelancerConversations();
            }
        } catch (error) {
            conversationData.error =
                error instanceof Error ? error.message : 'Failed to load conversations';
            conversationData.loading = false;
        }
    }

    /**
     * Fetch conversations for a client user
     */
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

        // Fetch all related services
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
            jobConversations,
            serviceConversations,
            loading: false,
            error: null,
        };
    }

    /**
     * Fetch conversations for a freelancer user
     */
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

        // Fetch all related jobs
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
            jobConversations,
            serviceConversations,
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
                                {#if conversationData.error}
                                    <div class="h4 text-center col-start-2 text-error">
                                        {conversationData.error}
                                    </div>
                                {:else if conversationData.jobConversations.size > 0 || conversationData.serviceConversations.size > 0}
                                    <!-- Display job conversations -->
                                    {#each conversationData.jobConversations as [job, user]}
                                        <ChatHead {searchQuery} {user} event={job} />
                                    {/each}
                                    <!-- Display service conversations -->
                                    {#each conversationData.serviceConversations as [service, user]}
                                        <ChatHead {searchQuery} {user} event={service} />
                                    {/each}
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
