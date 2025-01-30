<script lang="ts">
    import type { NDKEvent } from '@nostr-dev-kit/ndk';
    import { formatDate, formatDistanceToNow } from 'date-fns';

    export let ndkEvent: NDKEvent;
</script>

<div class="w-full flex flex-row gap-[10px] border-b-[1px] border-[rgb(0,0,0,0.1)] pb-[5px]">
    {#if ndkEvent.created_at}
        <div class="grow-[1]">
            <p class="font-[400] text-[14px] text-[rgb(0,0,0,0.5)]">
                {formatDate(ndkEvent.created_at * 1000, 'h:m a - dd-MMM-yyyy')}
            </p>
        </div>
        <div class="">
            <p class="font-[400] text-[14px] text-[rgb(0,0,0,0.5)]">
                {formatDistanceToNow(ndkEvent.created_at * 1000) + ' ago'}
            </p>
        </div>
    {/if}
</div>
