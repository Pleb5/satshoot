<script lang="ts">
    import type { Snippet } from 'svelte';

    interface Props {
        isOpen: boolean;
        title?: string;
        confirmText?: string;
        cancelText?: string;
        onConfirm: () => void;
        onCancel: () => void;
        children?: Snippet;
    }

    let {
        isOpen = $bindable(),
        title = 'Confirmation',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        onConfirm,
        onCancel,
        children,
    }: Props = $props();

    let dialogElement: HTMLDialogElement;

    $effect(() => {
        if (isOpen) {
            dialogElement?.showModal();
        } else {
            dialogElement?.close();
        }
    });

    function handleConfirm() {
        onConfirm();
        isOpen = false;
    }

    function handleCancel() {
        onCancel();
        isOpen = false;
    }
</script>

<dialog
    bind:this={dialogElement}
    class="rounded-container bg-surface-100-900 text-inherit max-w-[640px] top-1/2 left-1/2 -translate-1/2 p-4 space-y-4 z-10 backdrop:bg-surface-50/75 dark:backdrop:bg-surface-950/75"
>
    <h2 class="h3">{title}</h2>

    {@render children?.()}

    <form method="dialog" class="flex justify-end gap-2">
        <button type="button" class="btn preset-tonal" onclick={handleCancel}>
            {cancelText}
        </button>
        <button type="button" class="btn preset-filled" onclick={handleConfirm}>
            {confirmText}
        </button>
    </form>
</dialog>

<style>
    dialog,
    dialog::backdrop {
        --anim-duration: 250ms;
        transition:
            display var(--anim-duration) allow-discrete,
            overlay var(--anim-duration) allow-discrete,
            opacity var(--anim-duration);
        opacity: 0;
    }

    /* Animate In */
    dialog[open],
    dialog[open]::backdrop {
        opacity: 1;
    }

    /* Animate Out */
    @starting-style {
        dialog[open],
        dialog[open]::backdrop {
            opacity: 0;
        }
    }
</style>
