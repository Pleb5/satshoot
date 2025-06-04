import { toaster } from '$lib/stores/toaster';

export enum UserEnum {
    Satshoot = 'satshoot',
    Freelancer = 'freelancer',
}

export type NutZapErrorData = {
    mint: string;
    proofs: any[];
};

export class NutZapError extends Error {
    constructor(
        message: string,
        public readonly data: NutZapErrorData
    ) {
        super(message);
        this.name = this.constructor.name;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export enum ToastType {
    Success = 'success',
    Warn = 'warning',
    Error = 'error',
}

/**
 * Service for handling toast notifications related to payments
 */
export class ToastService {
    /**
     * Create a toast notification
     */
    create(message: string, type: ToastType, autohide: boolean = true) {
        toaster.create({
            title: message,
            type,
            duration: autohide ? undefined : 60000, // if autohide is false set duration to 1 min
        });
    }

    /**
     * Handle payment status notifications
     */
    handlePaymentStatus(
        paid: Map<UserEnum, boolean>,
        userEnum: UserEnum,
        shareMillisats: number,
        successMessage: string,
        failureMessage: string
    ) {
        if (paid.get(userEnum)) {
            this.create(successMessage, ToastType.Success, false);
        } else if (shareMillisats > 0) {
            this.create(failureMessage, ToastType.Warn, false);
        }
    }

    /**
     * Handle payment errors with special handling for NutZap errors
     */
    handlePaymentError(err: Error, payee: string) {
        // Save already minted p2pk NutZap proofs, when Nostr event creation fails
        if (err instanceof NutZapError) {
            toaster.error({
                title: err.message,
                action: {
                    label: 'Copy Proofs',
                    onClick: () => {
                        navigator.clipboard.writeText(JSON.stringify(err.data));
                        this.create(
                            'Copied Proofs with Mint info to clipboard!',
                            ToastType.Warn,
                            false
                        );
                    },
                },
            });
        } else {
            this.create(
                `An error occurred in processing payment for ${payee}: ${err.message || err}`,
                ToastType.Error
            );
        }
    }

    /**
     * Handle general payment errors
     */
    handleGeneralError(message: string) {
        this.create(`Error: ${message}`, ToastType.Error);
    }

    /**
     * Handle success messages
     */
    handleSuccess(message: string) {
        this.create(message, ToastType.Success);
    }

    /**
     * Handle warning messages
     */
    handleWarning(message: string) {
        this.create(message, ToastType.Warn);
    }
}
