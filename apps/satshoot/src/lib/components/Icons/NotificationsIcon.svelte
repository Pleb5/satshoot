<script lang="ts">
import { notifications } from '$lib/stores/notifications';

    export let sizeClass = 'text-lg';

</script>

<div class="relative inline-block">
    <span class="">
        <i class="fa-solid fa-bell {sizeClass}"></i>
    </span>

    {#if $notifications?.length > 0}
        <span 
            class="badge-icon variant-filled-error absolute -top-1 -right-2 z-10"
            style="font-size:8pt; width: 15px; height: 15px;"
        >
            {$notifications.length}
        </span>
    {/if}
</div>

