<script lang="ts">
    import { Popover } from '@skeletonlabs/skeleton-svelte';
    import type { Placement } from '@floating-ui/dom';
    import Card from '../UI/Card.svelte';

    interface Props {
        popUpText: string;
        iconClasses?: string;
        placement?: Placement;
        tooltipClasses?:string;
    }

    let { popUpText, iconClasses = 'bx bx-question-mark text-white', placement, tooltipClasses = 'w-80 p-4 max-h-60 overflow-y-auto shadow-deep'}: Props = $props();

    let openState = $state(false);
</script>

<Popover
    open={openState}
    onOpenChange={(e) => (openState = e.open)}
    positioning={{ placement }}
    zIndex="1000"
>
    {#snippet trigger()}
        <i class={iconClasses}></i>
    {/snippet}
    {#snippet content()}
        <Card classes={tooltipClasses}>
            {@html popUpText}
        </Card>
    {/snippet}
</Popover>
