<script lang="ts">
    import { toaster } from '$lib/stores/toaster';
    import Button from './Button.svelte';

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

<Button variant="outlined" classes="relative {classes}" onClick={handleCopy}>
    <i class="bx bxs-copy"></i>
</Button>
