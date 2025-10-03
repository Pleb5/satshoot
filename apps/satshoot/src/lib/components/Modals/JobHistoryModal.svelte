<script lang="ts">
    import { JobStatus, type JobEvent } from '$lib/events/JobEvent';
    import { getJobStatusString, getJobStatusColor } from '$lib/utils/job';
    import UserProfile from '../UI/Display/UserProfile.svelte';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    interface Props {
        isOpen: boolean;
        job: JobEvent;
    }

    let { isOpen = $bindable(), job }: Props = $props();

    // Parse different types of history from job tags and events
    const historyData = $derived.by(() => {
        const history: Array<{
            type: 'creation' | 'status' | 'bid_accepted';
            fromStatus?: JobStatus;
            toStatus?: JobStatus;
            bidAddress?: string;
            timestamp: number;
        }> = [];

        // Add job creation event
        history.push({
            type: 'creation',
            timestamp: job.publishedAt,
        });

        // Add state history from tags
        job.stateHistory.forEach((entry) => {
            history.push({
                type: 'status',
                fromStatus: entry.fromStatus,
                toStatus: entry.toStatus,
                timestamp: entry.timestamp,
            });
        });

        // Add bid acceptance if available
        if (job.acceptedBidAddress) {
            // Try to get timestamp from the 'a' tag
            const bidTag = job.tags.find(
                (tag) => tag[0] === 'a' && tag[1] === job.acceptedBidAddress
            );
            const bidTimestamp = bidTag && bidTag[2] ? parseInt(bidTag[2]) : job.created_at || 0;

            history.push({
                type: 'bid_accepted',
                bidAddress: job.acceptedBidAddress,
                timestamp: bidTimestamp,
            });
        }

        // Sort by timestamp (newest first)
        return history.sort((a, b) => b.timestamp - a.timestamp);
    });

    function formatTimestamp(timestamp: number): string {
        if (timestamp === 0) return 'Unknown time';
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
    }

    function truncateAddress(address: string): string {
        return address.length > 30 ? address.substring(0, 30) + '...' : address;
    }

    function getEventTypeIcon(type: string): string {
        switch (type) {
            case 'creation':
                return 'bx bx-plus-circle';
            case 'status':
                return 'bx bx-transfer-alt';
            case 'bid_accepted':
                return 'bx bx-check-circle';
            default:
                return 'bx bx-info-circle';
        }
    }

    function getEventTypeColor(type: string): string {
        switch (type) {
            case 'creation':
                return 'text-blue-600 dark:text-blue-400';
            case 'status':
                return 'text-purple-600 dark:text-purple-400';
            case 'bid_accepted':
                return 'text-green-600 dark:text-green-400';
            default:
                return 'text-gray-600 dark:text-gray-400';
        }
    }
</script>

<ModalWrapper bind:isOpen title="Job History">
    <div class="w-full max-h-[70vh] overflow-y-auto">
        {#if historyData.length > 0}
            <div class="space-y-4 p-4">
                {#each historyData as entry, index (`${entry.type}-${entry.timestamp}-${index}`)}
                    <div
                        class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
                    >
                        <div class="flex justify-between items-start mb-2">
                            <div
                                class="font-semibold text-sm uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-2"
                            >
                                <i
                                    class="{getEventTypeIcon(entry.type)} {getEventTypeColor(
                                        entry.type
                                    )} text-lg"
                                ></i>
                                {#if entry.type === 'creation'}
                                    Job Created
                                {:else if entry.type === 'status'}
                                    Status Change
                                {:else if entry.type === 'bid_accepted'}
                                    Bid Accepted
                                {/if}
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">
                                {formatTimestamp(entry.timestamp)}
                            </div>
                        </div>

                        <div class="text-sm">
                            {#if entry.type === 'creation'}
                                <div class="flex items-center gap-2">
                                    <span class="font-medium">Title:</span>
                                    <span class="text-primary-600 dark:text-primary-400">
                                        {job.title}
                                    </span>
                                </div>
                                <div class="flex items-center gap-2 mt-1">
                                    <span class="font-medium">Initial Status:</span>
                                    <span class={getJobStatusColor(JobStatus.New)}>
                                        {getJobStatusString(JobStatus.New)}
                                    </span>
                                </div>
                            {:else if entry.type === 'status' && entry.fromStatus !== undefined && entry.toStatus !== undefined}
                                <div class="flex items-center gap-2">
                                    <span class={getJobStatusColor(entry.fromStatus)}>
                                        {getJobStatusString(entry.fromStatus)}
                                    </span>
                                    <span class="text-gray-400">→</span>
                                    <span class={getJobStatusColor(entry.toStatus)}>
                                        {getJobStatusString(entry.toStatus)}
                                    </span>
                                </div>
                            {:else if entry.type === 'bid_accepted' && entry.bidAddress}
                                <div class="space-y-1">
                                    <div class="flex items-center gap-2">
                                        <span class="font-medium">Bid Address:</span>
                                        <span
                                            class="text-primary-600 dark:text-primary-400 font-mono text-xs"
                                        >
                                            {truncateAddress(entry.bidAddress)}
                                        </span>
                                    </div>
                                    {#if job.winnerFreelancer}
                                        <div class="flex items-center gap-2">
                                            <span class="font-medium">Winner Freelancer:</span>
                                            <span
                                                class="text-green-600 dark:text-green-400 font-mono text-xs"
                                            >
                                                <UserProfile pubkey={job.winnerFreelancer} />
                                                <!-- {job.winnerFreelancer.substring(0, 16)}... -->
                                            </span>
                                        </div>
                                    {/if}
                                    <div class="text-xs text-gray-500 dark:text-gray-400">
                                        Job status automatically changed to "In Progress"
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <div class="p-8 text-center">
                <div class="text-gray-500 dark:text-gray-400">
                    <i class="bx bx-history text-4xl mb-2 block"></i>
                    <p class="text-lg font-medium">No History Available</p>
                    <p class="text-sm">This job hasn't been modified since creation.</p>
                </div>
            </div>
        {/if}
    </div>
</ModalWrapper>
