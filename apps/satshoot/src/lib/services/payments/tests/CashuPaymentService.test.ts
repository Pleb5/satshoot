import { describe, it, expect, vi } from 'vitest';
import { CashuPaymentService } from '../CashuPaymentService.svelte';
import { UserEnum } from '../UserEnum';
import { BidEvent } from '$lib/events/BidEvent';
import { JobEvent } from '$lib/events/JobEvent';

vi.mock('$lib/utils/helpers', () => ({
    getCashuPaymentInfo: vi.fn().mockResolvedValue(null),
    broadcastEvent: vi.fn(),
}));

vi.mock('$lib/stores/session', () => ({
    default: {
        subscribe: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
    },
}));

vi.mock('$lib/wallet/wallet', () => ({
    wallet: {
        subscribe: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
    },
}));

type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((promiseResolve, promiseReject) => {
        resolve = promiseResolve;
        reject = promiseReject;
    });

    return { promise, resolve, reject };
}

function createService() {
    const primary = { pubkey: 'job-owner-pubkey' } as JobEvent;
    Object.setPrototypeOf(primary, JobEvent.prototype);

    const secondary = { pubkey: 'freelancer-pubkey', sponsoredNpub: '' } as BidEvent;
    Object.setPrototypeOf(secondary, BidEvent.prototype);

    return new CashuPaymentService(primary, secondary);
}

describe('CashuPaymentService', () => {
    it('processes cashu payments sequentially', async () => {
        const service = createService();
        const first = createDeferred<void>();
        const second = createDeferred<void>();

        const processSpy = vi
            .spyOn(service as any, 'processCashuPayment')
            .mockImplementationOnce(() => first.promise)
            .mockImplementationOnce(() => second.promise);

        const paymentPromise = service.processPayment(1000, 2000, 0);

        await Promise.resolve();
        expect(processSpy).toHaveBeenCalledTimes(1);
        expect(processSpy).toHaveBeenCalledWith(UserEnum.Freelancer, 'freelancer-pubkey', 1000);

        first.resolve();
        await Promise.resolve();

        expect(processSpy).toHaveBeenCalledTimes(2);
        expect(processSpy.mock.calls[1][0]).toBe(UserEnum.Satshoot);
        expect(processSpy.mock.calls[1][2]).toBe(2000);

        second.resolve();
        const result = await paymentPromise;

        expect(result.get(UserEnum.Freelancer)).toBe(true);
        expect(result.get(UserEnum.Satshoot)).toBe(true);
    });
});
