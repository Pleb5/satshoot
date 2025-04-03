<script lang="ts">
    import { ProgressRing } from '@skeletonlabs/skeleton-svelte';

    interface Props {
        color?: 'primary' | 'tertiary' | 'error' | 'white';
        size?: number;
        value?: number | null;
    }

    let { color = 'tertiary', size = 8, value = null }: Props = $props();

    const meterStroke = $derived(`stroke-${color}-500`);
    const trackStroke = $derived(`stroke-${color}-500/30`);
</script>

<ProgressRing {value} {meterStroke} {trackStroke} size={`size-${size}`} strokeLinecap="round" />
