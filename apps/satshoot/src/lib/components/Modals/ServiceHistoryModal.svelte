<script lang="ts">
    import { ServiceStatus, type ServiceEvent } from '$lib/events/ServiceEvent';
    import { Pricing } from '$lib/events/types';
    import ModalWrapper from '../UI/ModalWrapper.svelte';

    interface Props {
        isOpen: boolean;
        service: ServiceEvent;
    }

    let { isOpen = $bindable(), service }: Props = $props();

    // Parse different types of history from service tags
    const historyData = $derived.by(() => {
        const stateHistory: Array<{
            type: 'status';
            fromStatus: ServiceStatus;
            toStatus: ServiceStatus;
            timestamp: number;
        }> = [];

        const pricingHistory: Array<{
            type: 'pricing';
            oldData: { pricing: Pricing; amount: number };
            newData: { pricing: Pricing; amount: number };
            timestamp: number;
        }> = [];

        const zapSplitsHistory: Array<{
            type: 'zap_splits';
            oldData: { pledgeSplit: number; sponsoringSplit: number; sponsoredNpub: string };
            newData: { pledgeSplit: number; sponsoringSplit: number; sponsoredNpub: string };
            timestamp: number;
        }> = [];

        const orderHistory: Array<{
            type: 'order';
            orderAddress: string;
            timestamp: number;
        }> = [];

        // Parse history from tags
        service.tags.forEach((tag) => {
            if (tag[0] === 'state_history' && tag.length >= 4) {
                stateHistory.push({
                    type: 'status',
                    fromStatus: parseInt(tag[1]),
                    toStatus: parseInt(tag[2]),
                    timestamp: parseInt(tag[3]),
                });
            } else if (tag[0] === 'pricing_history' && tag.length >= 4) {
                try {
                    pricingHistory.push({
                        type: 'pricing',
                        oldData: JSON.parse(tag[1]),
                        newData: JSON.parse(tag[2]),
                        timestamp: parseInt(tag[3]),
                    });
                } catch (e) {
                    console.warn('Failed to parse pricing history:', e);
                }
            } else if (tag[0] === 'zap_splits_history' && tag.length >= 4) {
                try {
                    zapSplitsHistory.push({
                        type: 'zap_splits',
                        oldData: JSON.parse(tag[1]),
                        newData: JSON.parse(tag[2]),
                        timestamp: parseInt(tag[3]),
                    });
                } catch (e) {
                    console.warn('Failed to parse zap splits history:', e);
                }
            } else if (tag[0] === 'a' && tag.length >= 3) {
                // Order additions
                orderHistory.push({
                    type: 'order',
                    orderAddress: tag[1],
                    timestamp: parseInt(tag[2] || '0'),
                });
            }
        });

        // Combine all history and sort by timestamp
        const allHistory = [
            ...stateHistory,
            ...pricingHistory,
            ...zapSplitsHistory,
            ...orderHistory,
        ].sort((a, b) => b.timestamp - a.timestamp);

        return allHistory;
    });

    function getStatusString(status: ServiceStatus): string {
        return status === ServiceStatus.Active ? 'Active' : 'Inactive';
    }

    function getStatusColor(status: ServiceStatus): string {
        return status === ServiceStatus.Active ? 'text-green-600' : 'text-red-600';
    }

    function getPricingString(pricing: Pricing): string {
        return pricing === Pricing.Absolute ? 'Fixed Price' : 'Hourly Rate';
    }

    function formatTimestamp(timestamp: number): string {
        if (timestamp === 0) return 'Unknown time';
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
    }

    function formatAmount(amount: number): string {
        return amount.toLocaleString() + ' sats';
    }

    function truncateAddress(address: string): string {
        return address.length > 20 ? address.substring(0, 20) + '...' : address;
    }
</script>

<ModalWrapper bind:isOpen title="Service History">
    <div class="w-full max-h-[70vh] overflow-y-auto">
        {#if historyData.length > 0}
            <div class="space-y-4 p-4">
                {#each historyData as entry, index (`${entry.type}-${entry.timestamp}-${index}`)}
                    <div
                        class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
                    >
                        <div class="flex justify-between items-start mb-2">
                            <div
                                class="font-semibold text-sm uppercase tracking-wider text-gray-600 dark:text-gray-400"
                            >
                                {#if entry.type === 'status'}
                                    Status Change
                                {:else if entry.type === 'pricing'}
                                    Pricing Update
                                {:else if entry.type === 'zap_splits'}
                                    Zap Splits Change
                                {:else if entry.type === 'order'}
                                    New Order
                                {/if}
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">
                                {formatTimestamp(entry.timestamp)}
                            </div>
                        </div>

                        <div class="text-sm">
                            {#if entry.type === 'status'}
                                <div class="flex items-center gap-2">
                                    <span class={getStatusColor(entry.fromStatus)}>
                                        {getStatusString(entry.fromStatus)}
                                    </span>
                                    <span class="text-gray-400">→</span>
                                    <span class={getStatusColor(entry.toStatus)}>
                                        {getStatusString(entry.toStatus)}
                                    </span>
                                </div>
                            {:else if entry.type === 'pricing'}
                                <div class="space-y-1">
                                    <div class="flex items-center gap-2">
                                        <span class="font-medium">Type:</span>
                                        <span class="text-gray-600 dark:text-gray-400">
                                            {getPricingString(entry.oldData.pricing)}
                                        </span>
                                        <span class="text-gray-400">→</span>
                                        <span class="text-primary-600 dark:text-primary-400">
                                            {getPricingString(entry.newData.pricing)}
                                        </span>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <span class="font-medium">Amount:</span>
                                        <span class="text-gray-600 dark:text-gray-400">
                                            {formatAmount(entry.oldData.amount)}
                                        </span>
                                        <span class="text-gray-400">→</span>
                                        <span class="text-primary-600 dark:text-primary-400">
                                            {formatAmount(entry.newData.amount)}
                                        </span>
                                    </div>
                                </div>
                            {:else if entry.type === 'zap_splits'}
                                <div class="space-y-1">
                                    <div class="flex items-center gap-2">
                                        <span class="font-medium">Pledge Split:</span>
                                        <span class="text-gray-600 dark:text-gray-400">
                                            {entry.oldData.pledgeSplit}%
                                        </span>
                                        <span class="text-gray-400">→</span>
                                        <span class="text-primary-600 dark:text-primary-400">
                                            {entry.newData.pledgeSplit}%
                                        </span>
                                    </div>
                                    {#if entry.oldData.sponsoredNpub || entry.newData.sponsoredNpub}
                                        <div class="flex items-center gap-2">
                                            <span class="font-medium">Sponsoring Split:</span>
                                            <span class="text-gray-600 dark:text-gray-400">
                                                {entry.oldData.sponsoringSplit}%
                                            </span>
                                            <span class="text-gray-400">→</span>
                                            <span class="text-primary-600 dark:text-primary-400">
                                                {entry.newData.sponsoringSplit}%
                                            </span>
                                        </div>
                                        <div class="text-xs text-gray-500 dark:text-gray-400">
                                            Sponsored: {entry.newData.sponsoredNpub || 'None'}
                                        </div>
                                    {/if}
                                </div>
                            {:else if entry.type === 'order'}
                                <div class="flex items-center gap-2">
                                    <span class="font-medium">Order Address:</span>
                                    <span
                                        class="text-primary-600 dark:text-primary-400 font-mono text-xs"
                                    >
                                        {truncateAddress(entry.orderAddress)}
                                    </span>
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
                    <p class="text-sm">This service hasn't been modified since creation.</p>
                </div>
            </div>
        {/if}
    </div>
</ModalWrapper>
