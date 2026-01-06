<script lang="ts">
    import { toaster } from '$lib/stores/toaster';
    import Button from './Button.svelte';

    interface Props {
        buttonText?: string;
        text: string;
        feedbackMessage?: string;
        classes?: string;
    }

    let {
        buttonText = '',
        text,
        feedbackMessage = 'Copied!',
        classes = '',
    }: Props = $props();

    const variant = $derived(buttonText ? 'contained' : 'outlined');

    function handleCopy() {
        navigator.clipboard.writeText(text).then(() =>
            toaster.success({
                title: feedbackMessage,
            })
        );
    }
</script>

<Button variant={variant} classes="relative {classes}" onClick={handleCopy}>
    {#if buttonText}
        {buttonText}
    {:else}
        <i class="bx bxs-copy"></i>
    {/if}
</Button>
