<script lang="ts">
    import { TicketEvent, TicketStatus } from '$lib/events/TicketEvent';

    import ndk, { connected } from '$lib/stores/ndk';
    import { online } from '$lib/stores/network';
    import { wot } from '$lib/stores/wot';
    import { checkRelayConnections, orderEventsChronologically } from '$lib/utils/helpers';

    import { NDKKind, NDKSubscriptionCacheUsage, type NDKTag } from '@nostr-dev-kit/ndk';

    import { page } from '$app/state';
    import TowerBroadcastIcon from '$lib/components/Icons/TowerBroadcastIcon.svelte';
    import JobCard from '$lib/components/Jobs/JobCard.svelte';
    import Announcement from '$lib/components/Modals/Announcement.svelte';
    import { JobsPerPage } from '$lib/utils/misc';
    import type { ExtendedBaseType, NDKEventStore } from '@nostr-dev-kit/ndk-svelte';
    import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import { onDestroy, onMount } from 'svelte';
    import Button from '$lib/components/UI/Buttons/Button.svelte';

    const modalStore = getModalStore();

    let searchQuery = $derived(page.url.searchParams.get('searchTerms'));
    let filterList = $derived(searchQuery ? searchQuery.split(',') : []);

    let newJobs = $state<NDKEventStore<ExtendedBaseType<TicketEvent>>>();
    let jobList = $state<Set<TicketEvent>>(new Set());
    // tracks if user-defined filtering returned anything
    let noResults = $state(false);
    let currentPage = $state(1);

    $effect(() => {
        if ($newJobs && filterList) {
            // We just received a job
            orderEventsChronologically($newJobs);
            jobList = new Set(
                $newJobs.filter((t: TicketEvent) => {
                    // New job check: if a job status is changed this removes not new jobs
                    const newJob = t.status === TicketStatus.New;
                    // wot is always at least 3 if there is a user logged in
                    // only update filter if other users are also present
                    const partOfWot = $wot?.size > 2 && $wot.has(t.pubkey);

                    return newJob && partOfWot;
                })
            );

            if (filterList.length > 0) {
                filterJobs();
            }
        }
    });

    function filterJobs() {
        // We need to check all jobs against all filters
        if (filterList.length > 0) {
            const filteredJobList: Set<TicketEvent> = new Set();
            jobList.forEach((job: TicketEvent) => {
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

            if (filteredJobList.size === 0) noResults = true;

            jobList = filteredJobList;
            currentPage = 1;
        }
    }

    function readyToWork() {
        const modalComponent: ModalComponent = {
            ref: Announcement,
        };

        const modal: ModalSettings = {
            type: 'component',
            component: modalComponent,
        };
        modalStore.trigger(modal);
    }

    function handlePrev() {
        currentPage -= 1;
    }

    function handleNext() {
        currentPage += 1;
    }

    onMount(() => {
        checkRelayConnections();

        newJobs = $ndk.storeSubscribe(
            {
                kinds: [NDKKind.FreelanceTicket],
            },
            {
                autoStart: true,
                closeOnEose: false,
                groupable: false,
                cacheUsage: NDKSubscriptionCacheUsage.CACHE_FIRST,
            },
            TicketEvent
        );
        $newJobs = $newJobs;
    });

    onDestroy(() => {
        if (newJobs) newJobs.unsubscribe();
    });

    const paginationBtnClasses =
        'font-[18px] py-[10px] px-[20px] ' + 'max-[576px]:grow-[1] shadow-subtle';
</script>

<div class="w-full flex flex-col gap-0 flex-grow">
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
                                            class="card w-[80vw] sm:w-[40vw] flex flex-col items-center flex-grow flex-wrap h-48 p-4 space-y-4"
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
                                    classes="{paginationBtnClasses} max-[576px]:order-[2]"
                                    on:click={handlePrev}
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
                                    classes="{paginationBtnClasses} max-[576px]:order-[3]"
                                    on:click={handleNext}
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
{#if $connected && $online}
    <div class="fixed bottom-20 sm:bottom-5 right-4 sm:right-8">
        <button
            class="btn btn-icon-lg sm:btn-icon-xl bg-blue-500"
            onclick={() => {
                readyToWork();
            }}
        >
            <TowerBroadcastIcon extraClasses={'text-3xl text-white'} />
        </button>
    </div>
{/if}
