<script lang="ts">
    import { JobEvent, JobStatus } from '$lib/events/JobEvent';

    import ndk, { sessionInitialized } from '$lib/stores/session';
    import { mutedPubkeys, wot } from '$lib/stores/wot';
    import { checkRelayConnections, orderEventsChronologically } from '$lib/utils/helpers';

    import { NDKSubscriptionCacheUsage } from '@nostr-dev-kit/ndk';
    import Fuse from 'fuse.js';
    import { page } from '$app/state';
    import JobCard from '$lib/components/Jobs/JobCard.svelte';
    import { JobsPerPage } from '$lib/utils/misc';
    import { onDestroy } from 'svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';
    import { ExtendedNDKKind } from '$lib/types/ndkKind';
    import { showDecentralizedDiscoveryModal } from '$lib/stores/modals';
    import Checkbox from '$lib/components/UI/Inputs/Checkbox.svelte';
    import QuestionIcon from '$lib/components/Icons/QuestionIcon.svelte';

    let searchQuery = $derived(page.url.searchParams.get('searchQuery'));

    // Track debounced jobs
    let debouncedNewJobs = $state<JobEvent[]>([]);
    let debounceTimer: NodeJS.Timeout | null = null; // Not reactive state

    let newJobs = $ndk.storeSubscribe(
        {
            kinds: [ExtendedNDKKind.FreelanceJob],
        },
        {
            autoStart: false,
            closeOnEose: false,
            groupable: false,
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        },
        JobEvent
    );

    // Debounce the new jobs updates
    $effect(() => {
        // Only react to $newJobs changes
        const currentJobs = $newJobs;

        if (debounceTimer) clearTimeout(debounceTimer);

        debounceTimer = setTimeout(() => {
            debouncedNewJobs = [...currentJobs];
        }, 300); // 300ms debounce delay

        return () => {
            if (debounceTimer) clearTimeout(debounceTimer);
        };
    });

    let applyWoTFiltering = $state(true)

    let jobList = $derived.by(() => {
        let copiedJobs = [...debouncedNewJobs];
        copiedJobs = copiedJobs.filter((t: JobEvent) => {
            const newJob = t.status === JobStatus.New;

            const partOfWot = applyWoTFiltering 
                ? $wot.has(t.pubkey)
                : true

            const muted = $mutedPubkeys.has(t.pubkey)

            return newJob && partOfWot && !muted;
        });

        orderEventsChronologically(copiedJobs);

        if (searchQuery && searchQuery.length > 0) {
            copiedJobs = filterJobs(copiedJobs, searchQuery);
        }

        return new Set(copiedJobs);
    });

    // tracks if user-defined filtering returned anything
    let noResults = $derived.by(() => {
        if (searchQuery && searchQuery.length > 0 && jobList.size === 0) return true;

        return false;
    });
    // We can avoid $effect by reacting to filterList length but can set this regardless
    let currentPage = $derived(searchQuery && searchQuery.length > 0 ? 1 : 1);

    function filterJobs(jobListToFilter: JobEvent[], searchTerm: string): JobEvent[] {
        const fuse = new Fuse(jobListToFilter, {
            isCaseSensitive: false,
            shouldSort: true, // Whether to sort the result list, by score
            ignoreLocation: true, // When true, search will ignore location and distance, so it won't matter where in the string the pattern appears
            threshold: 0.6,
            minMatchCharLength: 2, // Only the matches whose length exceeds this value will be returned
            keys: [
                {
                    name: 'title',
                    weight: 0.4,
                },
                {
                    name: 'description',
                    weight: 0.2,
                },
                {
                    name: 'tags',
                    weight: 0.4,
                },
            ],
        });

        const searchResult = fuse.search(searchTerm);

        const filteredJobList = searchResult.map(({ item }) => item);

        return filteredJobList;
    }

    function handlePrev() {
        currentPage -= 1;
    }

    function handleNext() {
        currentPage += 1;
    }

    $effect(() => {
        if ($sessionInitialized) {
            checkRelayConnections();
            newJobs.startSubscription();
        }
    });

    onDestroy(() => {
        if (newJobs) newJobs.empty();
        if (debounceTimer) clearTimeout(debounceTimer);
    });

    const paginationBtnClasses =
        'font-[18px] py-[10px] px-[20px] ' + 'max-[576px]:grow-1 shadow-subtle';

    const wotTooltip =
        '<div class="font-bold">' +
        '<p>Only show Jobs from people in your Web of Trust.</p>' +
        '<p>Switch off to see<span class="text-yellow-500"> all Jobs from everyone</span></p>' +
        '</div>'
</script>

<div class="w-full flex flex-col gap-0 grow">
    <div class="w-full flex flex-col justify-center items-center py-[50px]">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[35px] max-[576px]:gap-[25px]">
                <div class="w-full flex flex-col gap-[15px] justify-start">
                    <div
                        class="flex flex-row items-center gap-4 max-[768px]:flex-col max-[768px]:items-start"
                    >
                        <h2 class="max-sm:text-2xl sm:text-[40px] font-[500]">
                            Latest Job Listings
                        </h2>
                        <Button
                            variant="outlined"
                            onClick={() => ($showDecentralizedDiscoveryModal = true)}
                            classes="whitespace-nowrap"
                        >
                            <i class="bx bx-broadcast"></i>
                            Decentralized Discovery
                        </Button>
                        <div class="flex gap-x-2 items-center">
                            <Checkbox
                                id={'totalAmount'}
                                label={'WoT Filtering'}
                                bind:checked={applyWoTFiltering}
                            />
                            <QuestionIcon
                                extraClasses="text-[14px] p-[3px]"
                                placement="bottom-start"
                                popUpText={wotTooltip}
                            />
                        </div>
                    </div>
                </div>
                <div class="w-full flex flex-row gap-[25px] max-[768px]:flex-col">
                    <div class="w-full flex flex-col gap-[25px]">
                        <div
                            class="w-full grid grid-cols-3 gap-[25px] max-[1200px]:grid-cols-2 max-[992px]:grid-cols-1 max-[768px]:grid-cols-1"
                        >
                            {#if jobList && jobList.size > 0}
                                {#each Array.from(jobList).slice((currentPage - 1) * JobsPerPage, currentPage * JobsPerPage) as job (job.id)}
                                    <JobCard {job} />
                                {/each}
                            {:else if noResults}
                                <h2 class="h2 font-bold text-center">No search results!</h2>
                            {:else}
                                <div class="w-[90vw] flex flex-wrap items-center gap-x-4 gap-y-8">
                                    {#each { length: 8 } as _}
                                        <div
                                            class="card w-[80vw] sm:w-[40vw] flex flex-col items-center grow flex-wrap h-48 p-4 space-y-4"
                                        >
                                            <div class="w-full placeholder animate-pulse"></div>
                                            <div class="w-[60%] grid grid-rows-3 gap-8">
                                                <div class="placeholder animate-pulse"></div>
                                                <div class="placeholder animate-pulse"></div>
                                                <div class="placeholder animate-pulse"></div>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                        <div class="w-full flex flex-row justify-center items-center">
                            <div
                                class="w-full max-w-[300px] flex flex-row gap-[15px] justify-center items-center max-[576px]:flex-wrap"
                            >
                                <Button
                                    classes="{paginationBtnClasses} max-[576px]:order-2"
                                    onClick={handlePrev}
                                    disabled={currentPage === 1}
                                >
                                    <i class="bx bxs-chevron-left"></i>
                                </Button>
                                <div
                                    class="flex flex-row justify-center items-center max-[576px]:w-[100%]"
                                >
                                    <p>Current page: {currentPage}</p>
                                </div>
                                <Button
                                    classes="{paginationBtnClasses} max-[576px]:order-3"
                                    onClick={handleNext}
                                    disabled={jobList.size <= currentPage * JobsPerPage}
                                >
                                    <i class="bx bxs-chevron-right"></i>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
