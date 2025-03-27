<script lang="ts">
import { notifications } from '$lib/stores/notifications';

    interface Props {
        sizeClass?: string;
    }

    let { sizeClass = 'text-lg' }: Props = $props();

</script>

<div class="relative inline-block">
    <span class="">
        <i class="fa-solid fa-bell {sizeClass}"></i>
    </span>

    {#if $notifications?.length > 0}
        <span 
            class="badge-icon custom-badge-size variant-filled-error 
            absolute -top-2 -right-4 z-10"
        >
            {$notifications.length}
        </span>
    {/if}
</div>

<style>
    .custom-badge-size {
        font-size:7pt;
        width: 21px; 
        height: 21px;
    }
    @screen sm {
        .custom-badge-size {
            font-size:9pt;
            width: 25px; 
            height: 25px;
        }
    }
</style>
