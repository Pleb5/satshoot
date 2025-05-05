<script lang="ts">
    // Core imports
    import { onMount } from 'svelte';
    import { page } from '$app/state';

    // Component imports
    import ChatHead from '$lib/components/ChatHead.svelte';
    import Card from '$lib/components/UI/Card.svelte';

    // Data models
    import { OfferEvent } from '$lib/events/OfferEvent';
    import { TicketEvent } from '$lib/events/TicketEvent';

    // Store imports
    import ndk, { sessionInitialized } from '$lib/stores/session';
    import currentUser, { loggedIn, userMode, UserMode } from '$lib/stores/user';

    // Utilities
    import { checkRelayConnections } from '$lib/utils/helpers';
    import { NDKEvent, NDKKind, NDKSubscriptionCacheUsage, type NDKUser } from '@nostr-dev-kit/ndk';

    // Types and interfaces
    interface ConversationData {
        users: NDKUser[];
        jobs: TicketEvent[];
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
        users: [],
        jobs: [],
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
        const jobEvents = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceTicket],
                authors: [$currentUser!.pubkey],
            },
            defaultFetchOptions
        );

        if (jobEvents.size === 0) {
            noConversations = true;
            conversationData.loading = false;
            return;
        }

        const users: NDKUser[] = [];
        const jobs: TicketEvent[] = [];

        jobEvents.forEach((jobEvent: NDKEvent) => {
            const job = TicketEvent.from(jobEvent);
            if (job.acceptedOfferAddress && job.winnerFreelancer) {
                const user = $ndk.getUser({ pubkey: job.winnerFreelancer });
                users.push(user);
                jobs.push(job);
            }
        });

        conversationData = {
            users,
            jobs,
            loading: false,
            error: null,
        };
    }

    /**
     * Fetch conversations for a freelancer user
     */
    async function fetchFreelancerConversations() {
        const offers = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceOffer],
                authors: [$currentUser!.pubkey],
            },
            defaultFetchOptions
        );

        if (offers.size === 0) {
            noConversations = true;
            conversationData.loading = false;
            return;
        }

        // Collect ticket DTags to fetch all related jobs in one request
        const jobsToFetch: string[] = [];
        const offerMap = new Map<string, OfferEvent>();

        for (const offerEvent of offers) {
            const offer = OfferEvent.from(offerEvent);
            if (offer.referencedTicketDTag) {
                jobsToFetch.push(offer.referencedTicketDTag);
                offerMap.set(offer.offerAddress, offer);
            }
        }

        // Fetch all related jobs
        const jobEvents = await $ndk.fetchEvents(
            {
                kinds: [NDKKind.FreelanceTicket],
                '#d': jobsToFetch,
            },
            { ...defaultFetchOptions, groupableDelay: 800 }
        );

        const users: NDKUser[] = [];
        const jobs: TicketEvent[] = [];

        jobEvents.forEach((jobEvent: NDKEvent) => {
            const job = TicketEvent.from(jobEvent);
            if (job.acceptedOfferAddress && offerMap.has(job.acceptedOfferAddress)) {
                const user = $ndk.getUser({ pubkey: job.pubkey });
                users.push(user);
                jobs.push(job);
            }
        });

        conversationData = {
            users,
            jobs,
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
                                {:else if $userMode === UserMode.Client}
                                    {#if conversationData.users.length > 0}
                                        {#each conversationData.users as user, i}
                                            <ChatHead
                                                {searchQuery}
                                                {user}
                                                ticket={conversationData.jobs[i]}
                                            />
                                        {/each}
                                    {:else if noConversations}
                                        <div class="h4 text-center col-start-2">
                                            No Conversations!
                                        </div>
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
                                {:else if $userMode === UserMode.Freelancer}
                                    {#if conversationData.users.length > 0}
                                        {#each conversationData.users as user, i}
                                            <ChatHead
                                                {searchQuery}
                                                {user}
                                                ticket={conversationData.jobs[i]}
                                            />
                                        {/each}
                                    {:else if noConversations}
                                        <div class="h4 text-center col-start-2">
                                            No Conversations!
                                        </div>
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
