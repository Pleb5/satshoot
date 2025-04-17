<script lang="ts">
    import { Popover } from '@skeletonlabs/skeleton-svelte';
    import type { Placement } from '@floating-ui/dom';
    import Card from '../UI/Card.svelte';

    interface Props {
        popUpText: string;
        extraClasses?: string;
        placement?: Placement;
    }

    let { popUpText, extraClasses = 'text-lg', placement }: Props = $props();

    let openState = $state(false);
</script>

<Popover
    open={openState}
    onOpenChange={(e) => (openState = e.open)}
    positioning={{ placement }}
    zIndex="1000"
>
    {#snippet trigger()}
        <i class="bx bx-question-mark bg-blue-500 text-white rounded-[50%] {extraClasses}"></i>
    {/snippet}
    {#snippet content()}
        <Card classes="w-80 p-4 max-h-60 overflow-y-auto shadow-deep">
            {@html popUpText}
        </Card>
    {/snippet}
</Popover>
