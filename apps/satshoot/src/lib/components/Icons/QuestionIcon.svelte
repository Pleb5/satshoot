<script lang="ts">
import { onMount } from "svelte";
import { popup } from "@skeletonlabs/skeleton";
import type { PopupSettings } from "@skeletonlabs/skeleton";
import type { Placement } from "@floating-ui/dom";

export let extraClasses = 'text-lg';
export let triggerEvent: "click" | "hover"
        | "focus-click" | "focus-blur" | null = null;

export let placement: Placement | null = null;
export let popUpText: string | null = null;

let popupSettings: PopupSettings | null = null;

onMount(() => {
    if (triggerEvent && placement && popUpText){
        popupSettings = {
            event: triggerEvent,
            target: 'popupTarget',
            placement: placement
        }
    }
});
</script>

<span class="">
    {#if popupSettings}

        <i 
            class="fa-solid fa-circle-question {extraClasses}" 
            use:popup={popupSettings}
        />
        <div data-popup='popupTarget'>
            <div class="card w-80 p-4 bg-primary-300-600-token max-h-60 overflow-y-auto">
                {@html popUpText}
            </div>
        </div>

    {:else}
        <i class="fa-solid fa-circle-question {extraClasses}"></i>
    {/if}
</span>
