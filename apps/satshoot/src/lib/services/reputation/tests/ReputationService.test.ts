import { ReputationService } from '../ReputationService.svelte';
import type { Hexpubkey } from '@nostr-dev-kit/ndk';
import type { ReputationData } from '../types';
import { generateSecretKey, getPublicKey } from 'nostr-tools';

vi.mock('../EarningsService.svelte', () => ({
    EarningsService: vi.fn().mockImplementation(() => ({
        initialize: vi.fn(),
        getEarnings: vi.fn().mockReturnValue(100),
        destroy: vi.fn(),
    })),
}));

vi.mock('../PaymentsService.svelte', () => ({
    PaymentsService: vi.fn().mockImplementation(() => ({
        initialize: vi.fn(),
        getPayments: vi.fn().mockReturnValue(200),
        destroy: vi.fn(),
    })),
}));

vi.mock('../PledgesService.svelte', () => ({
    PledgesService: vi.fn().mockImplementation(() => ({
        initialize: vi.fn(),
        getPledges: vi.fn().mockReturnValue(300),
        destroy: vi.fn(),
    })),
}));

vi.mock('../JobBidService.svelte', () => ({
    JobBidService: vi.fn().mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue({
            involvedJobs: ['job1'],
            involvedJobEvents: [],
            involvedBids: [],
            winningBidsOfUser: [],
            winningBidsForUser: [],
        }),
    })),
}));

vi.mock('../ServiceOrderService.svelte', () => ({
    ServiceOrderService: vi.fn().mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue({
            involvedOrders: ['order1'],
            involvedServiceEvents: [],
            involvedOrderEvents: [],
            confirmOrders: [],
            ordersOfUser: [],
        }),
    })),
}));

vi.mock('$lib/stores/reviews', () => ({
    aggregateClientRatings: vi.fn().mockReturnValue({ average: 4.5 }),
    aggregateFreelancerRatings: vi.fn().mockReturnValue({ average: 3.5 }),
}));

describe('ReputationService', () => {
    let service: ReputationService;
    const user: Hexpubkey = getPublicKey(generateSecretKey());

    beforeEach(() => {
        service = new ReputationService(user);
    });

    it('should initialize correctly and calculate averages', async () => {
        await service.initialize();

        expect(service.isInitialized).toBe(true);
        expect(service.clientAverage).toBe(4.5);
        expect(service.freelancerAverage).toBe(3.5);
        expect(service.overallAverage).toBe(4.0);
    });

    it('should handle missing averages correctly', () => {
        service.clientAverage = NaN;
        service.freelancerAverage = 4;
        expect(service['getOverallAverage']()).toBe(4);

        service.freelancerAverage = NaN;
        service.clientAverage = 5;
        expect(service['getOverallAverage']()).toBe(5);

        service.clientAverage = NaN;
        service.freelancerAverage = NaN;
        expect(isNaN(service['getOverallAverage']())).toBe(true);
    });

    it('should return correct reactive getters', async () => {
        await service.initialize();

        expect(service.earnings).toBe(100);
        expect(service.payments).toBe(200);
        expect(service.pledges).toBe(300);

        const reputation: ReputationData = service.reputationData;
        expect(reputation.financial.earnings).toBe(100);
        expect(reputation.financial.payments).toBe(200);
        expect(reputation.financial.pledges).toBe(300);
        expect(reputation.clientAverage).toBe(4.5);
        expect(reputation.freelancerAverage).toBe(3.5);
        expect(reputation.overallAverage).toBe(4);
        expect(reputation.isInitialized).toBe(true);
    });

    it('should return correct financial items for UI', async () => {
        await service.initialize();
        const items = service.financialItems;

        expect(items).toHaveLength(3);
        expect(items[0].label).toBe('Earnings');
        expect(items[0].amount).toBe(100);
        expect(items[1].label).toBe('Payments');
        expect(items[2].label).toBe('Pledges');
    });

    it('should call destroy on all subservices', () => {
        const destroySpy1 = vi.spyOn(service['earningsService'], 'destroy');
        const destroySpy2 = vi.spyOn(service['paymentsService'], 'destroy');
        const destroySpy3 = vi.spyOn(service['pledgesService'], 'destroy');

        service.destroy();

        expect(destroySpy1).toHaveBeenCalled();
        expect(destroySpy2).toHaveBeenCalled();
        expect(destroySpy3).toHaveBeenCalled();
    });
});
