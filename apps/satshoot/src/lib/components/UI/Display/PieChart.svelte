<script lang="ts">
    import { Pie } from 'svelte-chartjs';
    import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
    import ChartDataLabels from 'chartjs-plugin-datalabels';
    import { onMount, tick } from 'svelte';
    import { modeCurrent } from '@skeletonlabs/skeleton';

    export let dataset: Record<string, number> = {}; // Dynamic dataset

    onMount(async () => {
        Chart.register(ArcElement, Tooltip, Legend, ChartDataLabels);
        await tick(); // Ensure DOM updates before checking theme
    });

    $: isDark = !$modeCurrent;

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

    // Prepare the chart data dynamically
    $: labels = Object.keys(dataset);
    $: values = Object.values(dataset);
    $: colors = generateColors(labels.length, isDark);
    $: hoverColors = colors.map((color) => darkenColor(color));

    let options = {};

    $: options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'bottom',
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
                    let total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                    let percentage = ((value / total) * 100).toFixed(1);
                    return `${value} (${percentage}%)`; // Show absolute value + percentage
                },
                anchor: 'center',
                align: 'center',
                clip: false, // Ensure text is fully visible
            },
        },
    };

    $: chartData = {
        labels,
        datasets: [
            {
                data: values,
                backgroundColor: colors,
                hoverBackgroundColor: hoverColors,
            },
        ],
    };
</script>

{#if labels.length}
    <div
        class="w-full max-w-sm p-4 rounded-xl shadow-md transition-colors duration-300 bg-black-100"
    >
        <Pie
            data={chartData}
            options={{
                ...options,
            }}
        />
    </div>
{/if}
