<script lang="ts">
    import type { AssertionData } from '$lib/services/reputation/types';
    import { abbreviateNumber } from '$lib/utils/misc';
    import QuestionIcon from '$lib/components/Icons/QuestionIcon.svelte';

    interface Props {
        assertions?: AssertionData;
    }

    let { assertions }: Props = $props();

    const hasData = $derived(
        assertions &&
            assertions.providerCount > 0 &&
            (assertions.rank !== undefined ||
                assertions.followers !== undefined ||
                assertions.zapAmtRecd !== undefined)
    );

    const assertionTooltip =
        '<div>' +
        'These metrics come from trusted assertion providers (NIP-85) ' +
        'configured in your settings. Data is aggregated from multiple ' +
        'providers for reliability.' +
        '</div>';

    const metricWrapperClasses =
        'flex flex-row gap-[5px] items-center justify-between p-[8px] rounded-[4px] hover:bg-black-50 dark:hover:bg-white-50 transition-colors';
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
            {#if assertions?.rank !== undefined}
                <div class={metricWrapperClasses}>
                    <div class="flex items-center gap-2">
                        <i class="bx bx-trending-up text-blue-500"></i>
                        <span class="text-sm">WoT Rank</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <div
                            class="h-2 w-20 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
                        >
                            <div
                                class="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                                style="width: {assertions.rank}%"
                            ></div>
                        </div>
                        <span class="text-sm font-medium">{assertions.rank}/100</span>
                    </div>
                </div>
            {/if}

            {#if assertions?.followers !== undefined}
                <div class={metricWrapperClasses}>
                    <div class="flex items-center gap-2">
                        <i class="bx bx-group text-green-500"></i>
                        <span class="text-sm">Followers</span>
                    </div>
                    <span class="text-sm font-medium">
                        {abbreviateNumber(assertions.followers)}
                    </span>
                </div>
            {/if}

            {#if assertions?.zapAmtRecd !== undefined}
                <div class={metricWrapperClasses}>
                    <div class="flex items-center gap-2">
                        <i class="bx bxs-bolt text-yellow-500"></i>
                        <span class="text-sm">Zaps Received</span>
                    </div>
                    <span class="text-sm font-medium">
                        {abbreviateNumber(assertions.zapAmtRecd)} sats
                    </span>
                </div>
            {/if}

            {#if assertions?.zapAmtSent !== undefined}
                <div class={metricWrapperClasses}>
                    <div class="flex items-center gap-2">
                        <i class="bx bx-send text-orange-500"></i>
                        <span class="text-sm">Zaps Sent</span>
                    </div>
                    <span class="text-sm font-medium">
                        {abbreviateNumber(assertions.zapAmtSent)} sats
                    </span>
                </div>
            {/if}

            {#if assertions?.postCnt !== undefined}
                <div class={metricWrapperClasses}>
                    <div class="flex items-center gap-2">
                        <i class="bx bx-message-square-dots text-purple-500"></i>
                        <span class="text-sm">Posts</span>
                    </div>
                    <span class="text-sm font-medium">
                        {abbreviateNumber(assertions.postCnt)}
                    </span>
                </div>
            {/if}
        </div>
    </div>
{/if}
