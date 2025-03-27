<!-- src/lib/QRCode.svelte -->
<script lang="ts">
    import QRCode from 'qrcode';
    import Popup from '../UI/Popup.svelte';
    import { getModalStore } from '@skeletonlabs/skeleton';

    const modalStore = getModalStore();

    interface Props {
        title: string;
        data: string; // The data to encode in the QR code
        size?: number; // Size of the QR code (width and height)
        margin?: number; // Margin around the QR code
        darkColor?: string; // Dark color of the QR code
        lightColor?: string; // Light color of the QR code
    }

    let {
        title,
        data,
        size = 200,
        margin = 1,
        darkColor = '#000000',
        lightColor = '#ffffff',
    }: Props = $props();

    let canvas = $state<HTMLCanvasElement>();

    $effect(() => {
        if (canvas) {
            QRCode.toCanvas(canvas, data, {
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
            <canvas bind:this={canvas} width={size} height={size}></canvas>
        </div>
    </Popup>
{/if}
