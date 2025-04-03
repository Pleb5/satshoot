<script lang="ts">
    import { clipboard, getToastStore } from '@skeletonlabs/skeleton';
    import Button from './Button.svelte';

    const toastStore = getToastStore();

    interface Props {
        text: string;
        feedbackMessage?: string; // Customizable feedback message
        classes?: string;
    }

    let { text, feedbackMessage = 'Copied!', classes = '' }: Props = $props();

    function handleCopy() {
        toastStore.trigger({
            message: feedbackMessage,
            background: `bg-success-300-600`,
            autohide: true,
            timeout: 3000,
        });
    }
</script>

<Button variant="outlined" classes="relative {classes}">
    <i class="bx bxs-copy" use:clipboard={text} onclick={handleCopy}></i>
</Button>
