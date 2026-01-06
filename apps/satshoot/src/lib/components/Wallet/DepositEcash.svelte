<script lang="ts">
    import { type NDKCashuWallet } from '@nostr-dev-kit/ndk-wallet';
    import Button from '../UI/Buttons/Button.svelte';
    import Input from '../UI/Inputs/input.svelte';

    import ProgressRing from '../UI/Display/ProgressRing.svelte';
    import { toaster } from '$lib/stores/toaster';

    interface Props {
        cashuWallet: NDKCashuWallet;
    }

    let { cashuWallet }: Props = $props();

    let depositing = $state(false);
    let amountInput = $state('');
    let selectedMint = $state('');

    const amountSats = $derived.by(() => {
        const parsed = Number.parseInt(amountInput, 10);
        return Number.isFinite(parsed) ? parsed : 0;
    });

    function joinMintUrl(mint: string, path: string) {
        return `${mint.replace(/\/+$/, '')}${path}`;
    }

    function formatMintErrorResponseBody(body: unknown): string | undefined {
        if (body == null) return undefined;
        if (typeof body === 'string') return body.trim() || undefined;

        if (typeof body === 'object') {
            const anyBody = body as any;

            const error = typeof anyBody.error === 'string' ? anyBody.error : undefined;
            const message = typeof anyBody.message === 'string' ? anyBody.message : undefined;
            const detail = anyBody.detail;

            if (error) return error;
            if (message) return message;

            if (typeof detail === 'string') return detail;
            if (Array.isArray(detail)) {
                const lines = detail
                    .map((item) => {
                        if (!item || typeof item !== 'object') return String(item);
                        const anyItem = item as any;
                        const loc = Array.isArray(anyItem.loc) ? anyItem.loc : undefined;
                        const msg = typeof anyItem.msg === 'string' ? anyItem.msg : undefined;

                        const path = loc
                            ? loc
                                  .filter((segment: unknown) => segment !== 'body')
                                  .map(String)
                                  .join('.')
                            : undefined;

                        if (path && msg) return `${path}: ${msg}`;
                        if (msg) return msg;
                        if (path) return path;

                        try {
                            return JSON.stringify(anyItem);
                        } catch {
                            return String(anyItem);
                        }
                    })
                    .filter((line) => line && line !== '[object Object]');

                return lines.length > 0 ? lines.join('\n') : undefined;
            }

            try {
                const json = JSON.stringify(anyBody, Object.getOwnPropertyNames(anyBody), 2);
                if (json && json !== '{}') return json;
            } catch {}
        }

        return undefined;
    }

    async function createMintQuoteFallback(mint: string, amount: number, unit = 'sat') {
        const endpoint = joinMintUrl(mint, '/v1/mint/quote/bolt11');
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                accept: 'application/json, text/plain, */*',
                'content-type': 'application/json',
            },
            body: JSON.stringify({ amount, unit }),
        });

        const responseBody = await response.json().catch(() => undefined);
        if (!response.ok) {
            const status = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`.trim();
            const detail = formatMintErrorResponseBody(responseBody);
            const message = detail ? `${status}\n${detail}` : status;

            const error = new Error(message);
            (error as any).status = response.status;
            (error as any).body = responseBody;
            throw error;
        }

        const quoteId = typeof responseBody?.quote === 'string' ? responseBody.quote : undefined;
        const request = typeof responseBody?.request === 'string' ? responseBody.request : undefined;

        if (!quoteId || !request) {
            throw new Error('Mint returned an invalid quote response');
        }

        return { quoteId, request };
    }

    function normalizeAmountInput(value: string) {
        const trimmed = value.trim();
        if (!trimmed) return '';

        // Avoid leading zeros like "010" when the input was prefilled with 0.
        // Keep a single "0" if that's all the user typed.
        const withoutLeadingZeros = trimmed.replace(/^0+(?=\d)/, '');
        return withoutLeadingZeros;
    }

    function formatDepositError(error: unknown): string {
        if (error == null) return 'Unknown error';
        if (typeof error === 'string') return error;
        if (error instanceof Error) return error.message || error.name;
        if (typeof Response !== 'undefined' && error instanceof Response) {
            const status = `HTTP ${error.status}${error.statusText ? ` ${error.statusText}` : ''}`;
            return status.trim();
        }

        if (typeof error === 'object') {
            const anyError = error as any;

            const status = typeof anyError.status === 'number' ? anyError.status : undefined;
            const statusText = typeof anyError.statusText === 'string' ? anyError.statusText : undefined;
            const message = typeof anyError.message === 'string' ? anyError.message : undefined;
            const reason = typeof anyError.reason === 'string' ? anyError.reason : undefined;
            const detail = typeof anyError.detail === 'string' ? anyError.detail : undefined;

            const lines = [
                status !== undefined
                    ? `HTTP ${status}${statusText ? ` ${statusText}` : ''}`.trim()
                    : undefined,
                message,
                reason,
                detail,
            ].filter(Boolean);
            if (lines.length) return lines.join('\n');

            try {
                const json = JSON.stringify(anyError, Object.getOwnPropertyNames(anyError), 2);
                if (json && json !== '{}') return json;
            } catch {}

            return Object.prototype.toString.call(anyError);
        }

        return String(error);
    }

    // Initialize selected mint
    $effect(() => {
        if (cashuWallet.mints.length > 0 && !selectedMint) {
            selectedMint = cashuWallet.mints[0];
        }
    });

    async function deposit() {
        const sats = amountSats;
        if (depositing || sats <= 0 || !selectedMint) return;

        depositing = true;
        let closePaymentModal = () => {};
        let errorShown = false;

        const showErrorOnce = (error: unknown) => {
            if (errorShown) return;
            errorShown = true;
            toaster.error({
                title: `Failed to deposit:\n${formatDepositError(error)}`,
                duration: 60000, // 1 min
            });
        };

        try {
            const { init, launchPaymentModal, closeModal } = await import('@getalby/bitcoin-connect');
            init({ appName: 'SatShoot' });
            closePaymentModal = closeModal ?? closePaymentModal;

            const ndkCashuDeposit = cashuWallet.deposit(sats, selectedMint);

            // The deposit process updates wallet state that is captured in
            // 'balance_updated' event, on which a backup is triggered (see walletInit)
            ndkCashuDeposit.on('success', () => {
                closePaymentModal();
                toaster.success({
                    title: `Successfully deposited ${sats} sats!`,
                });
                depositing = false;
                amountInput = '';
            });

            ndkCashuDeposit.on('error', (error) => {
                console.log('ndkCashuDeposit failed', error);
                depositing = false;
                closePaymentModal();
                showErrorOnce(error);
            });

            const pollTimeMs = 2500;

            let pr: string;
            try {
                pr = await ndkCashuDeposit.start();
            } catch (error) {
                const status = (error as any)?.status;
                if (typeof status !== 'number' || status !== 422) throw error;

                console.warn('NDK deposit quote failed, attempting direct mint quote', error);
                const quote = await createMintQuoteFallback(selectedMint, sats);
                ndkCashuDeposit.quoteId = quote.quoteId;
                cashuWallet.depositMonitor.addDeposit(ndkCashuDeposit);
                setTimeout(() => ndkCashuDeposit.check(pollTimeMs), pollTimeMs);
                pr = quote.request;
            }

            launchPaymentModal({
                invoice: pr,
            });
        } catch (error) {
            depositing = false;
            try {
                closePaymentModal();
            } catch {}

            showErrorOnce(error);
        }
    }
</script>

<div
    class="w-full flex flex-col rounded-[6px] overflow-hidden border-[1px] border-black-200 dark:border-white-200"
>
    <div class="w-full flex flex-col">
        <Input
            type="number"
            placeholder="000,000 sats"
            min="1"
            step="1"
            bind:value={amountInput}
            onInput={(event) => {
                amountInput = normalizeAmountInput((event.target as HTMLInputElement).value);
            }}
            fullWidth
            notRounded
            noBorder
            classes="bg-transparent"
        />

        <select
            bind:value={selectedMint}
            class="input bg-transparent border-0 border-t-[1px] border-black-100 dark:border-white-100 rounded-[0]"
        >
            <option value="" disabled>Select a mint</option>
            {#each cashuWallet.mints as mint (mint)}
                <option value={mint}>{mint}</option>
            {/each}
        </select>
    </div>
    <Button
        variant="text"
        classes="bg-black-100 border-t-[1px] border-black-100 dark:border-white-100 rounded-[0]"
        onClick={deposit}
        disabled={depositing || amountSats <= 0 || !selectedMint}
        title="Generate an invoice and deposit sats to the selected mint"
    >
        Deposit
        {#if depositing}
            <ProgressRing color="primary" />
        {/if}
    </Button>
</div>
