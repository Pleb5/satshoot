<script lang="ts">
    import type { NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
    import { Invoice } from '@getalby/lightning-tools';
    import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
    import { onMount } from 'svelte';
    import { getToastStore } from '@skeletonlabs/skeleton';

    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';
    import ProgressRing from '../UI/Display/ProgressRing.svelte';

    const toastStore = getToastStore();

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
                toastStore.trigger({
                    message: message,
                    timeout: 5000,
                    autohide: true,
                    background: `bg-success-300-600`,
                });
                pr = '';
            })
            .catch((err) => {
                console.error('An error occurred in withdraw', err);
                toastStore.trigger({
                    message: `Failed to withdraw: ${err?.message || err} `,
                    autohide: false,
                    background: `bg-error-300-600`,
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
            toastStore.trigger({
                message: `Failed to get camera details!`,
                autohide: false,
                background: `bg-error-300-600`,
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
                toastStore.trigger({
                    message: `Failed to start scanning!`,
                    autohide: false,
                    background: `bg-error-300-600`,
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
                    toastStore.trigger({
                        message: `Failed to get payment invoice!`,
                        autohide: false,
                        background: `bg-error-300-600`,
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
        <Button variant="text" classes="rounded-[0]" on:click={openFileDialog}>
            <i class="bx bx-upload"></i>
        </Button>

        <!-- scan qr -->
        <Button
            variant="text"
            classes="border-l-[1px] border-black-100 dark:border-white-100 rounded-[0]"
            on:click={isScanning ? stopScanningQR : scanQRCode}
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
        classes="bg-black-100 text-black-50 dark:text-white border-t-[1px] border-black-100 dark:border-white-100 rounded-[0]"
        on:click={withdraw}
        disabled={withdrawing || !pr}
    >
        Withdraw
        {#if withdrawing}
            <span>
                <ProgressRing color="error" />
            </span>
        {/if}
    </Button>
</div>
