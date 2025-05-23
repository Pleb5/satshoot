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
    import currentUser, { UserMode, userMode } from '$lib/stores/user';
    import { sessionInitialized } from '$lib/stores/session';
    import { NDKKind, type NDKFilter } from '@nostr-dev-kit/ndk';
    import { nip19 } from 'nostr-tools';
    import { onDestroy, onMount } from 'svelte';
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

    let searchQuery = $derived(page.url.searchParams.get('searchQuery'));
    let npub = page.params.npub;
    let pubkey = nip19.decode(npub).data as string;
    let user = $ndk.getUser({ npub: npub });

    // Subscription setup
    const subOptions = {
        autoStart: false,
    };

    // Jobs subscriptions
    const allJobsFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceJob],
    };
    const allJobsOfUser = $ndk.storeSubscribe<JobEvent>(allJobsFilter, subOptions, JobEvent);

    // Bids subscriptions
    const allBidsFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceBid],
    };
    const allBidsOfUser = $ndk.storeSubscribe<BidEvent>(allBidsFilter, subOptions, BidEvent);

    // Services subscriptions
    const allServicesFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceService],
    };
    const allServicesOfUser = $ndk.storeSubscribe<ServiceEvent>(
        allServicesFilter,
        subOptions,
        ServiceEvent
    );

    // Orders subscriptions
    const allOrdersFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceOrder],
    };
    const allOrdersOfUser = $ndk.storeSubscribe<OrderEvent>(
        allOrdersFilter,
        subOptions,
        OrderEvent
    );

    // D-Tags for related subscriptions
    const dTagOfJobs = $derived(
        $allBidsOfUser.map((bid) => bid.referencedJobAddress.split(':')[2])
    );
    const dTagOfServices = $derived(
        $allOrdersOfUser.map((order) => order.referencedServiceAddress.split(':')[2])
    );

    // Applied jobs subscription (jobs on which user has made bids)
    const appliedJobsFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceJob],
    };
    const appliedJobs = $ndk.storeSubscribe<JobEvent>(
        appliedJobsFilter,
        {
            autoStart: false,
            closeOnEose: false,
            groupable: true,
            groupableDelay: 1000,
        },
        JobEvent
    );

    // Applied services subscription (services on which user has placed orders)
    const appliedServicesFilter: NDKFilter = {
        kinds: [NDKKind.FreelanceService],
    };
    const appliedServices = $ndk.storeSubscribe<ServiceEvent>(
        appliedServicesFilter,
        {
            autoStart: false,
            closeOnEose: false,
            groupable: true,
            groupableDelay: 1000,
        },
        ServiceEvent
    );

    let debouncedUserJobs = $state<JobEvent[]>([]);
    let debouncedUserBids = $state<BidEvent[]>([]);
    let debouncedUserServices = $state<ServiceEvent[]>([]);
    let debouncedUserOrders = $state<OrderEvent[]>([]);

    $effect(() => {
        const jobs = $allJobsOfUser;
        let timer: NodeJS.Timeout | null = null;

        if (timer) clearTimeout(timer);

        timer = setTimeout(() => {
            debouncedUserJobs = [...jobs];
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
            debouncedUserBids = [...bids];
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
            debouncedUserServices = [...services];
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
            debouncedUserOrders = [...orders];
        }, 300);

        return () => {
            if (timer) clearTimeout(timer);
        };
    });

    // Update applied jobs filter when tag list changes
    $effect(
        debounce(() => {
            if (dTagOfJobs.length > 0) {
                appliedJobs.subscription?.stop();
                appliedJobsFilter['#d'] = dTagOfJobs;
                appliedJobs.startSubscription();
            }
        }, 800)
    );

    // Update applied services filter when tag list changes
    $effect(
        debounce(() => {
            if (dTagOfServices.length > 0) {
                appliedServices.subscription?.stop();
                appliedServicesFilter['#d'] = dTagOfServices;
                appliedServices.startSubscription();
            }
        }, 800)
    );

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
    const bidStatusFilter = createBidStatusFilter($appliedJobs);
    // Create an order status filter with access to applied services
    const orderStatusFilter = createOrderStatusFilter($appliedServices);

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
    let initialized = $state(false);
    $effect(() => {
        if (pubkey && $sessionInitialized && !initialized) {
            initialized = true;
            allJobsFilter.authors = [pubkey];
            allBidsFilter.authors = [pubkey];
            allServicesFilter.authors = [pubkey];
            allOrdersFilter.authors = [pubkey];

            allJobsOfUser.startSubscription();
            allBidsOfUser.startSubscription();
            allServicesOfUser.startSubscription();
            allOrdersOfUser.startSubscription();
        }
    });

    // Handle scrolling to the jobs and bids section
    let myJobsAndMyBidsElement = $state<HTMLDivElement>();
    $effect(() => {
        if (myJobsAndMyBidsElement && $scrollToMyJobsAndMyBids) {
            $scrollToMyJobsAndMyBids = false;
            setTimeout(() => {
                if (myJobsAndMyBidsElement) {
                    myJobsAndMyBidsElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                    });
                }
            }, 600);
        }
    });

    // Cleanup on component destruction
    onDestroy(() => {
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
                        id="job-and-bids"
                        class="w-full flex flex-col gap-[15px] relative"
                        bind:this={myJobsAndMyBidsElement}
                    >
                        <div class="w-full flex flex-col gap-[10px]">
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
