<script lang="ts">
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';

    import ndk, { sessionInitialized } from '$lib/stores/session';
    import { wot } from '$lib/stores/wot';
    import { checkRelayConnections, orderEventsChronologically } from '$lib/utils/helpers';

    import { NDKKind, NDKSubscriptionCacheUsage, type NDKTag } from '@nostr-dev-kit/ndk';

    import { page } from '$app/state';
    import JobCard from '$lib/components/Jobs/JobCard.svelte';
    import Announcement from '$lib/components/Modals/Announcement.svelte';
    import { JobsPerPage } from '$lib/utils/misc';
    import { onDestroy } from 'svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';

    let searchQuery = $derived(page.url.searchParams.get('searchTerms'));
    let filterList = $derived(searchQuery ? searchQuery.split(',') : []);

    let newJobs = $ndk.storeSubscribe(
        {
            kinds: [NDKKind.FreelanceTicket],
        },
        {
            autoStart: false,
            closeOnEose: false,
            groupable: false,
            cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
        },
        TicketEvent
    );

    let jobList = $derived.by(() => {
        let copiedJobs = [...$newJobs]
        orderEventsChronologically(copiedJobs);
        copiedJobs = copiedJobs.filter((t: TicketEvent) => {
            const newJob = t.status === TicketStatus.New;
            const partOfWot = $wot.has(t.pubkey);

            return newJob && partOfWot;
        })

        if (filterList.length > 0) {
            copiedJobs = filterJobs(copiedJobs);
        }

        return new Set(copiedJobs);
    });
    // tracks if user-defined filtering returned anything
    let noResults = $derived.by(() => {
        if (filterList.length > 0 && jobList.size === 0) return true;

        return false;
    });
    // We can avoid $effect by reacting to filterlist length but can set this regardless
    let currentPage = $derived(filterList.length > 0 ? 1 : 1);

    let showAnnouncementModal = $state(false);

    function filterJobs(jobListToFilter: TicketEvent[]): TicketEvent[] {
        // We need to check all jobs against all filters
        const filteredJobList: Set<TicketEvent> = new Set();
        jobListToFilter.forEach((job: TicketEvent) => {
            filterList.forEach((filter: string) => {
                const lowerCaseFilter = filter.toLowerCase();

                const lowerCaseTitle = job.title.toLowerCase();
                const lowerCaseDescription = job.description.toLowerCase();

                let tagsContain: boolean = false;
                job.tags.forEach((tag: NDKTag) => {
                    if ((tag[1] as string).toLowerCase().includes(lowerCaseFilter)) {
                        tagsContain = true;
                    }
                });

                const titleContains: boolean = lowerCaseTitle.includes(lowerCaseFilter);
                const descContains: boolean = lowerCaseDescription.includes(lowerCaseFilter);

                if (titleContains || descContains || tagsContain) {
                    filteredJobList.add(job);
                }
            });
        });

        return Array.from(filteredJobList);
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
    });

    const paginationBtnClasses =
        'font-[18px] py-[10px] px-[20px] ' + 'max-[576px]:grow-1 shadow-subtle';
</script>

<div class="w-full flex flex-col gap-0 grow">
    <div class="w-full flex flex-col justify-center items-center py-[50px]">
        <div class="max-w-[1400px] w-full flex flex-col justify-start items-end px-[10px] relative">
            <div class="w-full flex flex-col gap-[35px] max-[576px]:gap-[25px]">
                <div class="w-full flex flex-col gap-[15px] justify-start">
                    <h2 class="text-[40px] font-[500]">Latest Job Listings</h2>
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
<Announcement bind:isOpen={showAnnouncementModal} />
