<script lang="ts">
    import { onDestroy } from 'svelte';
    import { modeCurrent } from '@skeletonlabs/skeleton';
    import { abbreviateNumber } from '$lib/utils/misc';
    import { Chart, ArcElement, Tooltip, Legend, PieController } from 'chart.js';
    import ChartDataLabels from 'chartjs-plugin-datalabels';

    Chart.register(ArcElement, Tooltip, Legend, ChartDataLabels, PieController);

    interface Props {
        dataset?: Record<string, number>;
    }

    let { dataset = {} }: Props = $props();
    let canvas = $state<HTMLCanvasElement>();
    let chartInstance = $state<Chart>();
    let isDark = $derived(!$modeCurrent);

    // Generate random HSL colors for each dataset entry
    function generateColors(count: number, darkMode: boolean) {
        return Array.from({ length: count }, (_, i) => {
            const hue = (i * 360) / count; // Distribute colors evenly around color wheel
            const lightness = darkMode ? 40 : 65; // Darker for dark mode
            return `hsl(${hue}, 70%, ${lightness}%)`;
        });
    }

    // Darken the color for hover effect
    function darkenColor(hslColor: string, factor = 0.2) {
        return hslColor.replace(/(\d+)%\)$/, (_, l) => `${Math.max(0, l - factor * 100)}%)`);
    }

    // Derived values
    const labels = $derived.by(() => Object.keys(dataset));
    const values = $derived.by(() => Object.values(dataset));
    const colors = $derived.by(() => generateColors(labels.length, isDark));
    const hoverColors = $derived.by(() => colors.map((color) => darkenColor(color)));

    const options = $derived({
        responsive: true,
        plugins: {
            legend: {
                position: 'bottom',
                align: 'start',
                labels: {
                    font: {
                        size: 14,
                        weight: 'bold',
                    },
                    color: isDark ? '#E5E7EB' : '#000000', // Light: gray-700, Dark: gray-200
                },
            },
            tooltip: {
                bodyFont: { size: 18 },
                displayColors: false,
            },
            datalabels: {
                color: isDark ? '#fff' : '#333', // Adjust text color based on theme
                font: { weight: 'bold', size: 14 },
                formatter: (value: any, context: any) => {
                    const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                    const percentage = ((value / total) * 100).toFixed(1);
                    const absoluteValue = `${abbreviateNumber(value)} sat${value > 1 ? 's' : ''}`;
                    return absoluteValue + '\n' + percentage + '%'; // Show absolute value + percentage
                },
                anchor: 'center',
                align: 'center',
                clip: false, // Ensure text is fully visible
            },
        },
    });

    const chartData = $derived.by(() => ({
        labels,
        datasets: [
            {
                data: values,
                backgroundColor: colors,
                hoverBackgroundColor: hoverColors,
            },
        ],
    }));

    $effect(() => {
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Initialize or update chart
        if (!chartInstance) {
            // Initial creation
            chartInstance = new Chart(ctx, {
                type: 'pie',
                data: chartData,
                options: options as any,
                plugins: [ChartDataLabels],
            });
        } else {
            // Only update if data actually changed
            if (JSON.stringify(chartInstance.data) !== JSON.stringify(chartData)) {
                chartInstance.data = chartData;
                chartInstance.update();
            }

            // Only update options if theme changed
            if (
                chartInstance.options.plugins?.legend?.labels?.color !==
                options.plugins.legend.labels.color
            ) {
                chartInstance.options = options as any;
                chartInstance.update();
            }
        }
    });

    onDestroy(() => {
        chartInstance?.destroy();
    });
</script>

{#if labels.length}
    <div
        class="w-full max-w-sm p-4 rounded-xl shadow-md transition-colors duration-300 bg-black-100"
    >
        <canvas bind:this={canvas} aria-label="Pie chart visualization"></canvas>
    </div>
{/if}
