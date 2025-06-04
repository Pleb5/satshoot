import { NDKKind, zapInvoiceFromEvent, NDKNutzap, type NDKEvent } from '@nostr-dev-kit/ndk';

/**
 * Utility functions for reputation calculations
 */

/**
 * Calculate total amount from zap/nutzap events
 */
export function calculateTotalAmount(events: NDKEvent[]): number {
    return events.reduce((total, zap) => {
        if (zap.signatureVerified) {
            if (zap.kind === NDKKind.Zap) {
                const zapInvoice = zapInvoiceFromEvent(zap);
                if (zapInvoice?.amount) {
                    return total + Math.round(zapInvoice.amount / 1000);
                }
            } else if (zap.kind === NDKKind.Nutzap) {
                const nutzap = NDKNutzap.from(zap);
                if (nutzap?.amount) {
                    return total + Math.round(nutzap.amount / 1000);
                }
            }
        }

        return total;
    }, 0);
}

/**
 * Calculate overall average rating from client and freelancer averages
 */
export function calculateOverallAverage(clientAverage: number, freelancerAverage: number): number {
    if (!isNaN(clientAverage) && !isNaN(freelancerAverage)) {
        return (clientAverage + freelancerAverage) / 2;
    } else if (isNaN(clientAverage) && !isNaN(freelancerAverage)) {
        return freelancerAverage;
    } else if (isNaN(freelancerAverage) && !isNaN(clientAverage)) {
        return clientAverage;
    } else {
        return NaN;
    }
}
