<script lang="ts">
    import type { NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
    import { getModalStore, getToastStore, ProgressRadial } from '@skeletonlabs/skeleton';
    import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
    import { onMount } from 'svelte';
    import { Invoice } from '@getalby/lightning-tools';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    export let cashuWallet: NDKCashuWallet;
    let html5QrCode: Html5Qrcode;
    let fileInput: HTMLInputElement | null = null;

    onMount(() => {
        html5QrCode = new Html5Qrcode('qr-reader', {
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
            verbose: false,
        });

        return () => {
            if (html5QrCode.isScanning) html5QrCode.stop();
        };
    });

    let pr = '';
    let withdrawing = false;
    let isScanning = false;

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
                    background: `bg-success-300-600-token`,
                });
                modalStore.close();
            })
            .catch((err) => {
                console.error('An error occurred in withdraw', err);
                toastStore.trigger({
                    message: `Failed to withdraw!`,
                    autohide: false,
                    background: `bg-error-300-600-token`,
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
                background: `bg-error-300-600-token`,
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
                    background: `bg-error-300-600-token`,
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
                        background: `bg-error-300-600-token`,
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

{#if $modalStore[0]}
    <div class="card p-4 flex flex-col gap-y-4">
        <h4 class="h4 text-lg sm:text-2xl text-center mb-2">Withdraw Ecash</h4>

        <!-- Payment request input -->
        <input
            type="text"
            bind:value={pr}
            class="input"
            aria-label="payment request"
            placeholder="Enter lightning invoice"
        />

        <!-- Camera-based QR scanning area -->
        <div id="qr-reader"></div>

        <!-- Hidden file input element -->
        <input
            type="file"
            accept="image/*"
            bind:this={fileInput}
            on:change={handleFileInput}
            style="display: none;"
        />

        <!-- Button to open file dialog -->
        <button
            on:click={openFileDialog}
            class="input btn btn-sm sm:btn-md bg-tertiary-300-600-token"
        >
            Import QR
        </button>

        <!-- Scan QR Code with camera button -->
        <button
            type="button"
            on:click={isScanning ? stopScanningQR : scanQRCode}
            class="input btn btn-sm sm:btn-md bg-tertiary-300-600-token"
        >
            {#if isScanning}
                Stop Scanning QR
            {:else}
                Scan QR
            {/if}
        </button>

        <!-- Withdraw button -->
        <button
            type="button"
            on:click={withdraw}
            class="input btn btn-sm sm:btn-md bg-tertiary-300-600-token"
            disabled={withdrawing || !pr}
        >
            Withdraw
            {#if withdrawing}
                <span>
                    <ProgressRadial
                        value={undefined}
                        stroke={60}
                        meter="stroke-error-500"
                        track="stroke-error-500/30"
                        strokeLinecap="round"
                        width="w-8"
                    />
                </span>
            {/if}
        </button>
    </div>
{/if}
