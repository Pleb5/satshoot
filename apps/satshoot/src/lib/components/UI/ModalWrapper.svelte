<script lang="ts">
    import type { Snippet } from 'svelte';
    import { Modal } from '@skeletonlabs/skeleton-svelte';
    import Popup from './Popup.svelte';

    interface Props {
        isOpen: boolean;
        title?: string; // Title for the modal header
        popUpText?: string | undefined;
        headerAction?: Snippet;
        children?: Snippet;
    }

    let {
        isOpen = $bindable(),
        title = '',
        popUpText = undefined,
        headerAction,
        children,
    }: Props = $props();
</script>

<Modal open={isOpen} closeOnInteractOutside={false} closeOnEscape={false}>
    {#snippet content()}
        <Popup bind:isOpen {title} {popUpText} {headerAction} {children} />
    {/snippet}
</Modal>
