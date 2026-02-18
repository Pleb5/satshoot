<script lang="ts">
    import { page } from '$app/state';
    import UserCard from '$lib/components/Cards/UserCard.svelte';
    import {
        jobFilter,
        bidFilter,
        scrollToMyJobsAndMyBids,
        servicesFilter,
        ordersFilter,
    } from '$lib/stores/gui';
    import ndk from '$lib/stores/session';
    import currentUser, { userMode } from '$lib/stores/user';
    import { sessionInitialized } from '$lib/stores/session';
    import { NDKSubscriptionCacheUsage, type NDKFilter } from '@nostr-dev-kit/ndk';
    import { nip19 } from 'nostr-tools';
    import { onDestroy } from 'svelte';
    import { debounce } from '$lib/utils/misc';
    import ServicesAndBids from '$lib/components/ProfilePage/ServicesAndBids.svelte';
    import OrdersAndJobs from '$lib/components/ProfilePage/OrdersAndJobs.svelte';
    import { BidEvent } from '$lib/events/BidEvent';
    import { JobEvent } from '$lib/events/JobEvent';
    import { ServiceEvent } from '$lib/events/ServiceEvent';
    import { OrderEvent } from '$lib/events/OrderEvent';
    import {
        createSearchFunction,
        getComponentOrder,
        jobStatusFilter,
        serviceStatusFilter,
        createBidStatusFilter,
        createOrderStatusFilter,
    } from '$lib/utils/profilePage';
    import { ExtendedNDKKind } from '$lib/types/ndkKind';

    let searchQuery = $derived(page.url.searchParams.get('searchQuery'));
    let npub = $derived(page.params.npub as `npub1${string}`);
    let pubkey = $derived.by(() => {
        try {
            return nip19.decode(npub).data as string;
        } catch {
            return '';
        }
    });
    let user = $derived($ndk.getUser({ npub: npub }));

    // Subscription setup
    const subOptions = {
        autoStart: false,
        closeOnEose: false,
        groupable: false,
        cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
    };

    // Jobs subscriptions
    const allJobsFilter: NDKFilter = {
        kinds: [ExtendedNDKKind.FreelanceJob],
    };
    const allJobsOfUser = $ndk.storeSubscribe<JobEvent>(allJobsFilter, subOptions, JobEvent);

    // Bids subscriptions
    const allBidsFilter: NDKFilter = {
        kinds: [ExtendedNDKKind.FreelanceBid],
    };
    const allBidsOfUser = $ndk.storeSubscribe<BidEvent>(allBidsFilter, subOptions, BidEvent);

    // Services subscriptions
    const allServicesFilter: NDKFilter = {
        kinds: [ExtendedNDKKind.FreelanceService],
    };
    const allServicesOfUser = $ndk.storeSubscribe<ServiceEvent>(
        allServicesFilter,
        subOptions,
        ServiceEvent
    );

    // Orders subscriptions
    const allOrdersFilter: NDKFilter = {
        kinds: [ExtendedNDKKind.FreelanceOrder],
    };
    const allOrdersOfUser = $ndk.storeSubscribe<OrderEvent>(
        allOrdersFilter,
        subOptions,
        OrderEvent
    );

    // D-Tags for related subscriptions
    const extractDTag = (address?: string) => {
        if (!address) return undefined;
        const parts = address.split(':');
        return parts.length >= 3 ? parts[2] : undefined;
    };

    const unique = <T,>(items: T[]) => Array.from(new Set(items));

    const dTagOfJobs = $derived.by(() => {
        const tags = $allBidsOfUser
            .map((bid) => extractDTag(bid.referencedJobAddress))
            .filter((tag): tag is string => Boolean(tag));
        return unique(tags);
    });

    const dTagOfServices = $derived.by(() => {
        const tags = $allOrdersOfUser
            .map((order) => extractDTag(order.referencedServiceAddress))
            .filter((tag): tag is string => Boolean(tag));
        return unique(tags);
    });

    // Applied jobs subscription (jobs on which user has made bids)
    const appliedJobsFilter: NDKFilter = {
        kinds: [ExtendedNDKKind.FreelanceJob],
    };
    const appliedJobs = $ndk.storeSubscribe<JobEvent>(
        appliedJobsFilter,
        {
            autoStart: false,
            closeOnEose: false,
            groupable: true,
            groupableDelay: 1000,
            cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
        },
        JobEvent
    );

    // Applied services subscription (services on which user has placed orders)
    const appliedServicesFilter: NDKFilter = {
        kinds: [ExtendedNDKKind.FreelanceService],
    };
    const appliedServices = $ndk.storeSubscribe<ServiceEvent>(
        appliedServicesFilter,
        {
            autoStart: false,
            closeOnEose: false,
            groupable: true,
            groupableDelay: 1000,
            cacheUsage: NDKSubscriptionCacheUsage.PARALLEL,
        },
        ServiceEvent
    );

    let appliedJobsStarted = $state(false);
    let appliedServicesStarted = $state(false);
    let lastAppliedJobsKey = $state('');
    let lastAppliedServicesKey = $state('');

    const dedupeById = <T extends { id?: string }>(events: T[]) => {
        const seen = new Set<string>();
        return events.filter((event) => {
            if (!event.id) return true;
            if (seen.has(event.id)) return false;
            seen.add(event.id);
            return true;
        });
    };

    const dedupeLatestJobs = (events: JobEvent[]) => {
        const byAddress = new Map<string, JobEvent>();
        events.forEach((event) => {
            const address = event.jobAddress;
            const existing = byAddress.get(address);
            const createdAt = event.created_at ?? 0;
            const existingCreatedAt = existing?.created_at ?? 0;
            if (!existing || createdAt >= existingCreatedAt) {
                byAddress.set(address, event);
            }
        });
        return Array.from(byAddress.values());
    };

    const dedupeLatestServices = (events: ServiceEvent[]) => {
        const byAddress = new Map<string, ServiceEvent>();
        events.forEach((event) => {
            const address = event.serviceAddress;
            const existing = byAddress.get(address);
            const createdAt = event.created_at ?? 0;
            const existingCreatedAt = existing?.created_at ?? 0;
            if (!existing || createdAt >= existingCreatedAt) {
                byAddress.set(address, event);
            }
        });
        return Array.from(byAddress.values());
    };

    const dedupeLatestOrders = (events: OrderEvent[]) => {
        const byAddress = new Map<string, OrderEvent>();
        events.forEach((event) => {
            const address = event.orderAddress;
            const existing = byAddress.get(address);
            const createdAt = event.created_at ?? 0;
            const existingCreatedAt = existing?.created_at ?? 0;
            if (!existing || createdAt >= existingCreatedAt) {
                byAddress.set(address, event);
            }
        });
        return Array.from(byAddress.values());
    };

    let debouncedUserJobs = $state<JobEvent[]>([]);
    let debouncedUserBids = $state<BidEvent[]>([]);
    let debouncedUserServices = $state<ServiceEvent[]>([]);
    let debouncedUserOrders = $state<OrderEvent[]>([]);

    $effect(() => {
        const jobs = $allJobsOfUser;
        let timer: NodeJS.Timeout | null = null;

        if (timer) clearTimeout(timer);

        timer = setTimeout(() => {
            debouncedUserJobs = dedupeLatestJobs(jobs);
        }, 300);

        return () => {
            if (timer) clearTimeout(timer);
        };
    });

    $effect(() => {
        const bids = $allBidsOfUser;
        let timer: NodeJS.Timeout | null = null;

        if (timer) clearTimeout(timer);

        timer = setTimeout(() => {
            debouncedUserBids = dedupeById(bids);
        }, 300);

        return () => {
            if (timer) clearTimeout(timer);
        };
    });

    $effect(() => {
        const services = $allServicesOfUser;
        let timer: NodeJS.Timeout | null = null;

        if (timer) clearTimeout(timer);

        timer = setTimeout(() => {
            debouncedUserServices = dedupeLatestServices(services);
        }, 300);

        return () => {
            if (timer) clearTimeout(timer);
        };
    });

    $effect(() => {
        const orders = $allOrdersOfUser;
        let timer: NodeJS.Timeout | null = null;

        if (timer) clearTimeout(timer);

        timer = setTimeout(() => {
            debouncedUserOrders = dedupeLatestOrders(orders);
        }, 300);

        return () => {
            if (timer) clearTimeout(timer);
        };
    });

    const updateAppliedJobs = debounce((tags: string[]) => {
        const nextKey = tags.slice().sort().join('|');
        if (nextKey === lastAppliedJobsKey) return;
        lastAppliedJobsKey = nextKey;

        if (tags.length === 0) {
            appliedJobs.empty();
            appliedJobs.unsubscribe?.();
            appliedJobsStarted = false;
            return;
        }

        appliedJobsFilter['#d'] = tags;
        appliedJobs.changeFilters?.([appliedJobsFilter]);
        appliedJobs.startSubscription();
        appliedJobsStarted = true;
    }, 800);

    const updateAppliedServices = debounce((tags: string[]) => {
        const nextKey = tags.slice().sort().join('|');
        if (nextKey === lastAppliedServicesKey) return;
        lastAppliedServicesKey = nextKey;

        if (tags.length === 0) {
            appliedServices.empty();
            appliedServices.unsubscribe?.();
            appliedServicesStarted = false;
            return;
        }

        appliedServicesFilter['#d'] = tags;
        appliedServices.changeFilters?.([appliedServicesFilter]);
        appliedServices.startSubscription();
        appliedServicesStarted = true;
    }, 800);

    // Update applied jobs filter when tag list changes
    $effect(() => {
        updateAppliedJobs(dTagOfJobs);
    });

    // Update applied services filter when tag list changes
    $effect(() => {
        updateAppliedServices(dTagOfServices);
    });

    // Create search functions for each data type
    const searchJobs = createSearchFunction<JobEvent>({
        keys: [
            { name: 'title', weight: 0.4 },
            { name: 'description', weight: 0.2 },
            { name: 'tags', weight: 0.4 },
        ],
    });

    const searchServices = createSearchFunction<ServiceEvent>({
        keys: [
            { name: 'title', weight: 0.4 },
            { name: 'description', weight: 0.2 },
            { name: 'tags', weight: 0.4 },
        ],
    });

    const searchBids = createSearchFunction<BidEvent>({
        keys: [
            { name: 'description', weight: 0.3 },
            { name: 'tags', weight: 0.7 },
        ],
    });

    const searchOrders = createSearchFunction<OrderEvent>({
        keys: [
            { name: 'description', weight: 0.3 },
            { name: 'tags', weight: 0.7 },
        ],
    });

    // Create a bid status filter function with access to applied jobs
    const bidStatusFilter = $derived.by(() => createBidStatusFilter(dedupeLatestJobs($appliedJobs)));
    // Create an order status filter with access to applied services
    const orderStatusFilter = $derived.by(() =>
        createOrderStatusFilter(dedupeLatestServices($appliedServices))
    );

    // Create filtered data using our utility functions
    const filteredJobs = $derived.by(() => {
        let copied = [...debouncedUserJobs];
        let filtered = jobStatusFilter
            ? copied.filter((job) => jobStatusFilter(job, $jobFilter))
            : copied;

        if (searchQuery && searchQuery.length > 0) {
            filtered = searchJobs(filtered, searchQuery);
        }

        return filtered;
    });

    const filteredServices = $derived.by(() => {
        let copied = [...debouncedUserServices];
        let filtered = serviceStatusFilter
            ? copied.filter((service) => serviceStatusFilter(service, $servicesFilter))
            : copied;

        if (searchQuery && searchQuery.length > 0) {
            filtered = searchServices(filtered, searchQuery);
        }

        return filtered;
    });

    const filteredBids = $derived.by(() => {
        let copied = [...debouncedUserBids];
        let filtered = bidStatusFilter
            ? copied.filter((bid) => bidStatusFilter(bid, $bidFilter))
            : copied;

        if (searchQuery && searchQuery.length > 0) {
            filtered = searchBids(filtered, searchQuery);
        }

        return filtered;
    });

    const filteredOrders = $derived.by(() => {
        let copied = [...debouncedUserOrders];
        let filtered = orderStatusFilter
            ? copied.filter((order) => orderStatusFilter(order, $ordersFilter))
            : copied;

        if (searchQuery && searchQuery.length > 0) {
            filtered = searchOrders(filtered, searchQuery);
        }

        return filtered;
    });

    // Initialization
    let initializedPubkey = $state<string | null>(null);
    $effect(() => {
        if (!pubkey || !$sessionInitialized) return;
        if (initializedPubkey === pubkey) return;
        initializedPubkey = pubkey;

        lastAppliedJobsKey = '';
        lastAppliedServicesKey = '';

        allJobsFilter.authors = [pubkey];
        allBidsFilter.authors = [pubkey];
        allServicesFilter.authors = [pubkey];
        allOrdersFilter.authors = [pubkey];

        allJobsOfUser.unsubscribe?.();
        allBidsOfUser.unsubscribe?.();
        allServicesOfUser.unsubscribe?.();
        allOrdersOfUser.unsubscribe?.();

        allJobsOfUser.empty?.();
        allBidsOfUser.empty?.();
        allServicesOfUser.empty?.();
        allOrdersOfUser.empty?.();

        allJobsOfUser.changeFilters?.([allJobsFilter]);
        allBidsOfUser.changeFilters?.([allBidsFilter]);
        allServicesOfUser.changeFilters?.([allServicesFilter]);
        allOrdersOfUser.changeFilters?.([allOrdersFilter]);

        allJobsOfUser.startSubscription();
        allBidsOfUser.startSubscription();
        allServicesOfUser.startSubscription();
        allOrdersOfUser.startSubscription();
    });

    // Handle scrolling to the jobs and bids section
    let eventContainerElement = $state<HTMLDivElement>();
    $effect(() => {
        if (eventContainerElement && $scrollToMyJobsAndMyBids) {
            $scrollToMyJobsAndMyBids = false;
            setTimeout(() => {
                if (eventContainerElement) {
                    eventContainerElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                    });
                }
            }, 600);
        }
    });

    // Cleanup on component destruction
    onDestroy(() => {
        allJobsOfUser?.unsubscribe?.();
        allBidsOfUser?.unsubscribe?.();
        allServicesOfUser?.unsubscribe?.();
        allOrdersOfUser?.unsubscribe?.();
        appliedJobs?.unsubscribe?.();
        appliedServices?.unsubscribe?.();

        allJobsOfUser?.empty?.();
        allBidsOfUser?.empty?.();
        allServicesOfUser?.empty?.();
        allOrdersOfUser?.empty?.();
        appliedJobs?.empty?.();
        appliedServices?.empty?.();
    });

    // Determine if the user is viewing their own profile
    let isOwnProfile = $derived($currentUser && $currentUser?.pubkey === pubkey);

    // Determine the component order based on user mode and profile ownership
    const componentOrder = $derived(getComponentOrder(!!isOwnProfile, $userMode));
</script>

<div class="w-full flex flex-col gap-0 grow mt-0 sm:mt-5 mb-20 sm:mb-0">
    <!-- Section start -->
    <div class="w-full flex flex-col justify-center items-center">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[50px] max-[576px]:gap-[25px]">
                <div class="w-full flex flex-row gap-[25px] max-[768px]:flex-col max-[768px]:gap-0">
                    <UserCard {user} />
                    <div
                        id="event-container"
                        class="w-full flex flex-col gap-[15px] relative"
                        bind:this={eventContainerElement}
                    >
                        <div class="w-full flex flex-col gap-y-6">
                            {#if componentOrder && componentOrder.first === 'ServicesAndBids'}
                                <ServicesAndBids
                                    isOwnProfile={!!isOwnProfile}
                                    services={filteredServices}
                                    bids={filteredBids}
                                />
                                <OrdersAndJobs
                                    isOwnProfile={!!isOwnProfile}
                                    orders={filteredOrders}
                                    jobs={filteredJobs}
                                />
                            {:else}
                                <OrdersAndJobs
                                    isOwnProfile={!!isOwnProfile}
                                    orders={filteredOrders}
                                    jobs={filteredJobs}
                                />
                                <ServicesAndBids
                                    isOwnProfile={!!isOwnProfile}
                                    services={filteredServices}
                                    bids={filteredBids}
                                />
                            {/if}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
