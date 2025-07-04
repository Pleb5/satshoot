<script lang="ts">
    import type { NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
    import { Invoice } from '@getalby/lightning-tools';
    import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
    import { onMount } from 'svelte';

    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import { toaster } from '$lib/stores/toaster';

    interface Props {
        cashuWallet: NDKCashuWallet;
    }

    let { cashuWallet }: Props = $props();

    let html5QrCode: Html5Qrcode;
    let fileInput: HTMLInputElement | null = $state(null);

    let pr = $state('');
    let withdrawing = $state(false);
    let isScanning = $state(false);

    onMount(() => {
        html5QrCode = new Html5Qrcode('qr-reader', {
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
            verbose: false,
        });

        return () => {
            if (html5QrCode.isScanning) html5QrCode.stop();
        };
    });

    async function withdraw() {
        if (!pr) return;

        withdrawing = true;
        cashuWallet
            .lnPay({ pr })
            .then((res) => {
                console.log('res withdraw :>> ', res);
                let message = '<div><p>Successfully withdrawn amount!</p>';
                if (res?.fee) {
                    const invoice = new Invoice({ pr });
                    const { satoshi } = invoice;

                    const total = satoshi + res.fee;
                    message += `<br/>
                    <p>Withdrawn: ${satoshi} sats</p>
                    <br/>
                    <p>Fee: ${res.fee} sats</p>
                    <br/>
                    <p>Total: ${total} sats</p>`;
                }
                toaster.success({
                    title: message,
                });
                pr = '';
            })
            .catch((err) => {
                console.error('An error occurred in withdraw', err);
                toaster.error({
                    title: `Failed to withdraw: ${err?.message || err} `,
                    duration: 60000, // 1 min
                });
            })
            .finally(() => {
                withdrawing = false;
            });
    }

    async function scanQRCode() {
        // This method will trigger user permissions
        const cameraId = await Html5Qrcode.getCameras()
            .then((devices) => {
                if (devices && devices.length) {
                    return devices[0].id;
                }

                return null;
            })
            .catch((err) => {
                console.error('An error occurred in getting camera permission', err);
                return null;
            });

        if (!cameraId) {
            toaster.error({
                title: `Failed to get camera details!`,
            });
            return;
        }

        html5QrCode
            .start(
                cameraId,
                {
                    fps: 10, // Optional, frame per seconds for qr code scanning
                    qrbox: { width: 250, height: 250 },
                },
                (decodedText, decodedResult) => {
                    console.log('decodedText :>> ', decodedText);
                    pr = decodedText; // Set the payment request
                    html5QrCode.stop();
                    isScanning = false;
                },
                undefined
            )
            .then(() => {
                isScanning = true;
            })
            .catch((err) => {
                console.error('Failed to start scanning :>> ', err);
                toaster.error({
                    title: `Failed to start scanning!`,
                });
            });
    }

    async function stopScanningQR() {
        if (isScanning) {
            html5QrCode.stop();
            isScanning = false;
        }
    }

    function handleFileInput(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length) {
            const imageFile = input.files[0];

            // File-based QR code scanning
            html5QrCode
                .scanFile(imageFile, false)
                .then((decodedText) => {
                    console.log('decodedText :>> ', decodedText);
                    pr = decodedText; // Set the payment request
                })
                .catch((err) => {
                    console.error('Error scanning file. Reason: ', err);
                    toaster.error({
                        title: `Failed to get payment invoice!`,
                    });
                });
        }
    }

    // Function to open the file dialog
    function openFileDialog() {
        if (fileInput) {
            fileInput.click(); // Trigger the file input click
        }
    }
</script>

<div
    class="w-full flex flex-col rounded-[6px] overflow-hidden border-[1px] border-[rgb(0,0,0,0.15)] dark:border-[rgb(255,255,255,0.15)]"
>
    <div class="w-full flex flex-row">
        <Input
            type="text"
            placeholder="Lightning invoice"
            bind:value={pr}
            classes="w-full"
            notRounded
        />

        <!-- Hidden file input element -->
        <input
            type="file"
            accept="image/*"
            bind:this={fileInput}
            onchange={handleFileInput}
            class="hidden"
        />

        <!-- import qr -->
        <Button variant="text" classes="rounded-[0]" onClick={openFileDialog}>
            <i class="bx bx-upload"></i>
        </Button>

        <!-- scan qr -->
        <Button
            variant="text"
            classes="border-l-[1px] border-black-100 dark:border-white-100 rounded-[0]"
            onClick={isScanning ? stopScanningQR : scanQRCode}
        >
            {#if isScanning}
                <i class="bx bx-x"></i> <!-- Cancel icon when scanning -->
            {:else}
                <i class="bx bx-qr"></i> <!-- QR icon when idle -->
            {/if}
        </Button>
    </div>

    <!-- Camera-based QR scanning area -->
    <div id="qr-reader"></div>

    <Button
        variant="text"
        classes="bg-black-100 border-t-[1px] border-black-100 dark:border-white-100 rounded-[0]"
        onClick={withdraw}
        disabled={withdrawing || !pr}
    >
        Withdraw
        {#if withdrawing}
            <span>
                <ProgressRing color="primary" />
            </span>
        {/if}
    </Button>
</div>
