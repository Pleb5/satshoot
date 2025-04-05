<script lang="ts">
    import { onMount } from 'svelte';
    import { popup } from '@skeletonlabs/skeleton';
    import type { PopupSettings } from '@skeletonlabs/skeleton';
    import type { Placement } from '@floating-ui/dom';
    import Card from '../UI/Card.svelte';

    interface Props {
        extraClasses?: string;
        triggerEvent?: 'click' | 'hover' | 'focus-click' | 'focus-blur' | null;
        placement?: Placement | null;
        popUpText?: string | null;
    }

    let {
        extraClasses = 'text-lg',
        triggerEvent = null,
        placement = null,
        popUpText = null,
    }: Props = $props();

    let popupSettings: PopupSettings | null = $state(null);

    onMount(() => {
        if (triggerEvent && placement && popUpText) {
            popupSettings = {
                event: triggerEvent,
                target: 'popupTarget',
                placement: placement,
            };
        }
    });
</script>

{#if popupSettings}
    <i
        class="bx bx-question-mark bg-blue-500 text-white rounded-[50%] {extraClasses}"
        use:popup={popupSettings}
    ></i>
    <div data-popup="popupTarget">
        <Card classes="w-80 p-4 max-h-60 overflow-y-auto shadow-deep">
            {@html popUpText}
        </Card>
    </div>
{:else}
    <i class="bx bx-question-mark bg-blue-500 text-white rounded-[50%] {extraClasses}"></i>
{/if}
