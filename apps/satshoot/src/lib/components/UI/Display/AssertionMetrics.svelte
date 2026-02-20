<script lang="ts">
    import { abbreviateNumber } from '$lib/utils/misc';
    import QuestionIcon from '$lib/components/Icons/QuestionIcon.svelte';

    type AssertionData = {
        rank?: number;
        followers?: number;
        zapAmtRecd?: number;
        zapAmtSent?: number;
        postCnt?: number;
        replyCnt?: number;
        reactionsCnt?: number;
        zapCntRecd?: number;
        zapCntSent?: number;
        zapAvgAmtDayRecd?: number;
        zapAvgAmtDaySent?: number;
        reportsCntRecd?: number;
        reportsCntSent?: number;
        firstCreatedAt?: number;
        activeHoursStart?: number;
        activeHoursEnd?: number;
        commonTopics?: string[];
        providerCount: number;
    };

    interface Props {
        assertions?: AssertionData;
        selectedTags?: string[];
    }

    let { assertions, selectedTags }: Props = $props();

    type MetricFormat = 'rank' | 'number' | 'sats' | 'satsPerDay' | 'date' | 'hour' | 'topics' | 'text';

    type MetricDefinition = {
        tag: string;
        label: string;
        icon?: string;
        format: MetricFormat;
        getValue: (assertions: AssertionData) => number | string | string[] | undefined;
    };

    const metricDefinitions: MetricDefinition[] = [
        {
            tag: 'rank',
            label: 'WoT Rank',
            icon: 'bx bx-trending-up text-blue-500',
            format: 'rank',
            getValue: (data) => data.rank,
        },
        {
            tag: 'followers',
            label: 'Followers',
            icon: 'bx bx-group text-green-500',
            format: 'number',
            getValue: (data) => data.followers,
        },
        {
            tag: 'post_cnt',
            label: 'Posts',
            icon: 'bx bx-message-square-dots text-purple-500',
            format: 'number',
            getValue: (data) => data.postCnt,
        },
        {
            tag: 'reply_cnt',
            label: 'Replies',
            icon: 'bx bx-reply text-indigo-500',
            format: 'number',
            getValue: (data) => data.replyCnt,
        },
        {
            tag: 'reactions_cnt',
            label: 'Reactions',
            icon: 'bx bx-like text-pink-500',
            format: 'number',
            getValue: (data) => data.reactionsCnt,
        },
        {
            tag: 'zap_amt_recd',
            label: 'Zaps Received',
            icon: 'bx bxs-bolt text-yellow-500',
            format: 'sats',
            getValue: (data) => data.zapAmtRecd,
        },
        {
            tag: 'zap_amt_sent',
            label: 'Zaps Sent',
            icon: 'bx bx-send text-orange-500',
            format: 'sats',
            getValue: (data) => data.zapAmtSent,
        },
        {
            tag: 'zap_cnt_recd',
            label: 'Zaps Received (count)',
            icon: 'bx bx-bolt-circle text-yellow-500',
            format: 'number',
            getValue: (data) => data.zapCntRecd,
        },
        {
            tag: 'zap_cnt_sent',
            label: 'Zaps Sent (count)',
            icon: 'bx bx-bolt text-orange-500',
            format: 'number',
            getValue: (data) => data.zapCntSent,
        },
        {
            tag: 'zap_avg_amt_day_recd',
            label: 'Avg Zaps/day Received',
            icon: 'bx bx-line-chart text-yellow-600',
            format: 'satsPerDay',
            getValue: (data) => data.zapAvgAmtDayRecd,
        },
        {
            tag: 'zap_avg_amt_day_sent',
            label: 'Avg Zaps/day Sent',
            icon: 'bx bx-line-chart text-orange-600',
            format: 'satsPerDay',
            getValue: (data) => data.zapAvgAmtDaySent,
        },
        {
            tag: 'reports_cnt_recd',
            label: 'Reports Received',
            icon: 'bx bx-flag text-red-500',
            format: 'number',
            getValue: (data) => data.reportsCntRecd,
        },
        {
            tag: 'reports_cnt_sent',
            label: 'Reports Sent',
            icon: 'bx bx-flag text-red-400',
            format: 'number',
            getValue: (data) => data.reportsCntSent,
        },
        {
            tag: 'first_created_at',
            label: 'First Activity',
            icon: 'bx bx-time text-blue-500',
            format: 'date',
            getValue: (data) => data.firstCreatedAt,
        },
        {
            tag: 'active_hours_start',
            label: 'Active Hours Start',
            icon: 'bx bx-time-five text-indigo-500',
            format: 'hour',
            getValue: (data) => data.activeHoursStart,
        },
        {
            tag: 'active_hours_end',
            label: 'Active Hours End',
            icon: 'bx bx-time-five text-indigo-500',
            format: 'hour',
            getValue: (data) => data.activeHoursEnd,
        },
        {
            tag: 't',
            label: 'Common Topics',
            icon: 'bx bx-hash text-teal-500',
            format: 'topics',
            getValue: (data) => data.commonTopics,
        },
    ];

    const metricDefinitionMap = new Map(metricDefinitions.map((metric) => [metric.tag, metric]));
    const hasSelectedTags = $derived(Array.isArray(selectedTags));
    const selectedTagSet = $derived.by(() => {
        if (!hasSelectedTags || !selectedTags) return null;
        return new Set(selectedTags);
    });

    const metrics = $derived.by(() => {
        if (!assertions) return [] as Array<MetricDefinition & { value: unknown }>;

        const tags = selectedTagSet
            ? Array.from(selectedTagSet)
            : metricDefinitions.map((metric) => metric.tag);

        return tags.map((tag) => {
            const metric = metricDefinitionMap.get(tag) ?? {
                tag,
                label: tag,
                format: 'text',
                getValue: () => undefined,
            };

            return {
                ...metric,
                value: metric.getValue(assertions),
            };
        });
    });

    const hasProviders = $derived(Boolean(assertions && assertions.providerCount > 0));

    function isValuePresent(value: unknown): boolean {
        if (Array.isArray(value)) return value.length > 0;
        return value !== undefined && value !== null && value !== '';
    }

    const hasAnyValue = $derived(metrics.some((metric) => isValuePresent(metric.value)));

    const hasData = $derived(
        hasProviders && metrics.length > 0 && (selectedTagSet ? true : hasAnyValue)
    );

    const assertionTooltip =
        '<div>' +
        'These metrics come from trusted assertion providers (NIP-85) ' +
        'selected in your settings.' +
        '</div>';

    const metricWrapperClasses =
        'flex flex-row gap-[5px] items-center justify-between p-[8px] rounded-[4px] hover:bg-black-50 dark:hover:bg-white-50 transition-colors';

    function formatFloatValue(value: number): string {
        const absValue = Math.abs(value);
        if (absValue < 1) return value.toPrecision(3);
        return value.toFixed(3);
    }

    function formatHour(value: number): string {
        const hour = Math.max(0, Math.min(23, Math.round(value)));
        return `${hour.toString().padStart(2, '0')}:00`;
    }

    function formatDate(value: number): string {
        return new Date(value * 1000).toLocaleDateString();
    }

    function formatValue(format: MetricFormat, value: number | string | string[]): string {
        if (Array.isArray(value)) {
            return value.join(', ');
        }

        if (format === 'date' && typeof value === 'number') {
            return formatDate(value);
        }

        if (format === 'hour' && typeof value === 'number') {
            return formatHour(value);
        }

        if (format === 'satsPerDay' && typeof value === 'number') {
            return `${Number.isInteger(value) ? abbreviateNumber(value) : formatFloatValue(value)} sats/day`;
        }

        if (format === 'sats' && typeof value === 'number') {
            return `${Number.isInteger(value) ? abbreviateNumber(value) : formatFloatValue(value)} sats`;
        }

        if (format === 'number' && typeof value === 'number') {
            return Number.isInteger(value) ? abbreviateNumber(value) : formatFloatValue(value);
        }

        return String(value);
    }
</script>

{#if hasData}
    <div
        class="w-full flex flex-col gap-[5px] rounded-[5px] p-[10px] border-[1px] border-black-200 dark:border-white-200"
    >
        <div class="flex items-center gap-2 pb-2 border-b border-black-100 dark:border-white-100">
            <h4 class="font-medium text-sm">Trusted Provider Metrics</h4>
            <QuestionIcon
                extraClasses="w-5 h-5 text-sm *:pointer-events-none"
                placement="top"
                popUpText={assertionTooltip}
            />
            <span class="ml-auto text-xs text-gray-500">
                {assertions?.providerCount} {assertions?.providerCount === 1
                    ? 'provider'
                    : 'providers'}
            </span>
        </div>

        <div class="flex flex-col gap-[2px]">
            {#each metrics as metric}
                <div class={metricWrapperClasses}>
                    <div class="flex items-center gap-2 min-w-0">
                        {#if metric.icon}
                            <i class={metric.icon}></i>
                        {/if}
                        <span class="text-sm underline underline-offset-2">{metric.label}</span>
                    </div>

                    {#if metric.format === 'rank'}
                        {#if typeof metric.value === 'number'}
                            {@const rankValue = Math.max(0, Math.min(100, metric.value))}
                            {@const rankDisplay = Number.isInteger(rankValue)
                                ? rankValue
                                : formatFloatValue(rankValue)}
                            <div class="flex items-center gap-2">
                                <div
                                    class="h-2 w-20 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
                                >
                                    <div
                                        class="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                                        style="width: {rankValue}%"
                                    ></div>
                                </div>
                                <span class="text-sm font-medium">{rankDisplay}/100</span>
                            </div>
                        {:else}
                            <span class="text-xs text-gray-400">No data</span>
                        {/if}
                    {:else}
                        {#if isValuePresent(metric.value)}
                            <span
                                class="text-sm font-medium max-w-[200px] overflow-x-auto whitespace-nowrap scrollbar-hide"
                            >
                                {formatValue(metric.format, metric.value as number | string | string[])}
                            </span>
                        {:else}
                            <span class="text-xs text-gray-400">No data</span>
                        {/if}
                    {/if}
                </div>
            {/each}
        </div>
    </div>
{/if}

<style>
    .scrollbar-hide::-webkit-scrollbar {
        display: none;
    }

    .scrollbar-hide {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
</style>
