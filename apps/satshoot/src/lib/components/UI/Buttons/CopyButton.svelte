<script lang="ts">
    import { createToaster } from '@skeletonlabs/skeleton-svelte';
    import Button from './Button.svelte';

    const toaster = createToaster();

    interface Props {
        text: string;
        feedbackMessage?: string; // Customizable feedback message
        classes?: string;
    }

    let { text, feedbackMessage = 'Copied!', classes = '' }: Props = $props();

    function handleCopy() {
        navigator.clipboard.writeText(text).then(() =>
            toaster.error({
                title: feedbackMessage,
            })
        );
    }
</script>

<Button variant="outlined" classes="relative {classes}" on:click={handleCopy}>
    <i class="bx bxs-copy"></i>
</Button>
