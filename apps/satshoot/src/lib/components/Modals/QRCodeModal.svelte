<!-- src/lib/QRCode.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import QRCode from 'qrcode';
    import Popup from '../UI/Popup.svelte';
    import { getModalStore } from '@skeletonlabs/skeleton';

    const modalStore = getModalStore();

    export let title: string;
    export let data: string; // The data to encode in the QR code
    export let size = 200; // Size of the QR code (width and height)
    export let margin = 1; // Margin around the QR code
    export let darkColor = '#000000'; // Dark color of the QR code
    export let lightColor = '#ffffff'; // Light color of the QR code

    let canvas: HTMLCanvasElement;

    onMount(async () => {
        if (canvas) {
            await QRCode.toCanvas(canvas, data, {
                width: size,
                margin,
                color: {
                    dark: darkColor,
                    light: lightColor,
                },
            });
        }
    });
</script>

{#if $modalStore[0]}
    <Popup {title}>
        <div class="flex flex-col justify-center items-center">
            <canvas bind:this={canvas} width={size} height={size} />
        </div>
    </Popup>
{/if}
