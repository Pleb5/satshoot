<script lang="ts">
    import { ProgressRing } from '@skeletonlabs/skeleton-svelte';

    interface Props {
        color?: 'primary' | 'tertiary' | 'error' | 'white';
        size?: number;
        value?: number | null;
    }

    let { color = 'white', size = 8, value = null }: Props = $props();

    const meterStroke = $derived(color === 'white' ? 'stroke-white' : `stroke-${color}-500`);
    const trackStroke = $derived(color === 'white' ? 'stroke-white/50' : `stroke-${color}-400`);
</script>

<ProgressRing {value} size={`size-${size}`} {meterStroke} {trackStroke} />
