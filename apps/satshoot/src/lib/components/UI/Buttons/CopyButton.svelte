<script lang="ts">
    import { clipboard, getToastStore } from '@skeletonlabs/skeleton';
    import Button from './Button.svelte';

    const toastStore = getToastStore();

    export let text: string;
    export let feedbackMessage = 'Copied!'; // Customizable feedback message
    export let classes = '';

    function handleCopy() {
        toastStore.trigger({
            message: feedbackMessage,
            background: `bg-success-300-600-token`,
            autohide: true,
            timeout: 3000,
        });
    }
</script>

<Button variant="outlined" classes="relative {classes}" on:click={handleCopy}>
    <i class="bx bxs-copy" use:clipboard={text} />
</Button>
