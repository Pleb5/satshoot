<script lang="ts">
    import type { NDKEvent } from '@nostr-dev-kit/ndk';
    import { formatDate, formatDistanceToNow } from 'date-fns';

    interface Props {
        ndkEvent: NDKEvent;
    }

    let { ndkEvent }: Props = $props();
</script>

<div
    class="w-full flex flex-row gap-[10px] border-b-[1px] border-black-100 dark:border-white-100 pb-[5px]"
>
    {#if ndkEvent.created_at}
        <div class="grow-1">
            <p class="font-[400] text-[14px] text-black-500 dark:text-white-500">
                {formatDate(ndkEvent.created_at * 1000, 'h:m a - dd-MMM-yyyy')}
            </p>
        </div>
        <div class="">
            <p class="font-[400] text-[14px] text-black-500 dark:text-white-500">
                {formatDistanceToNow(ndkEvent.created_at * 1000) + ' ago'}
            </p>
        </div>
    {/if}
</div>
