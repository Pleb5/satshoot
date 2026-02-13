import { calculateTotalAmount, calculateOverallAverage } from '../utils';

import { NDKKind, zapInvoiceFromEvent, NDKNutzap, type NDKEvent } from '@nostr-dev-kit/ndk';

vi.mock('@nostr-dev-kit/ndk', async () => {
    const actual = await vi.importActual('@nostr-dev-kit/ndk');
    return {
        ...actual,
        zapInvoiceFromEvent: vi.fn(),
        NDKNutzap: {
            from: vi.fn(),
        },
    };
});

const createMockNDKEvent = (kind: NDKKind, amount: number, signatureVerified = true): NDKEvent =>
    ({
        kind,
        signatureVerified,
        verifySignature: () => signatureVerified,
    }) as unknown as NDKEvent;

describe('calculateTotalAmount', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calculates total amount from zap events in sats', () => {
        (zapInvoiceFromEvent as any).mockImplementation(() => ({
            amount: 3000, // msats
        }));

        const events = [
            createMockNDKEvent(NDKKind.Zap, 3000),
            createMockNDKEvent(NDKKind.Zap, 3000),
        ];

        const total = calculateTotalAmount(events);
        expect(total).toBe(6); // 3 + 3 sats
        expect(zapInvoiceFromEvent).toHaveBeenCalledTimes(2);
    });

    it('calculates total amount from nutzap events in sats', () => {
        (NDKNutzap.from as any).mockImplementation(() => ({
            amount: 2000, // sats
        }));

        const events = [
            createMockNDKEvent(NDKKind.Nutzap, 2000),
            createMockNDKEvent(NDKKind.Nutzap, 2000),
        ];

        const total = calculateTotalAmount(events);
        expect(total).toBe(4000); // 2000 + 2000 sats
        expect(NDKNutzap.from).toHaveBeenCalledTimes(2);
    });

    it('skips unverified events', () => {
        const events = [
            createMockNDKEvent(NDKKind.Zap, 1000, false), // unverified
            createMockNDKEvent(NDKKind.Nutzap, 2000, false),
        ];

        const total = calculateTotalAmount(events);
        expect(total).toBe(0);
    });

    it('handles mixed zap and nutzap events', () => {
        (zapInvoiceFromEvent as any).mockReturnValue({ amount: 1000 });
        (NDKNutzap.from as any).mockReturnValue({ amount: 2000 });

        const events = [
            createMockNDKEvent(NDKKind.Zap, 1000),
            createMockNDKEvent(NDKKind.Nutzap, 2000),
        ];

        const total = calculateTotalAmount(events);
        expect(total).toBe(2001); // 1 + 2000 sats
    });
});

describe('calculateOverallAverage', () => {
    it('calculates average when both values are valid', () => {
        const result = calculateOverallAverage(4.5, 3.5);
        expect(result).toBe(4);
    });

    it('returns client average if freelancer average is NaN', () => {
        const result = calculateOverallAverage(4.5, NaN);
        expect(result).toBe(4.5);
    });

    it('returns freelancer average if client average is NaN', () => {
        const result = calculateOverallAverage(NaN, 3);
        expect(result).toBe(3);
    });

    it('returns NaN if both values are NaN', () => {
        const result = calculateOverallAverage(NaN, NaN);
        expect(isNaN(result)).toBe(true);
    });
});
