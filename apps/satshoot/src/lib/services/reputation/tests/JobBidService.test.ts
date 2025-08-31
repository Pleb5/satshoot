import { JobBidService } from '../JobBidService.svelte';
import { getPublicKey, generateSecretKey } from 'nostr-tools';
import { NDKKind } from '@nostr-dev-kit/ndk';
import { JobEvent } from '$lib/events/JobEvent';
import { BidEvent } from '$lib/events/BidEvent';
import { ExtendedNDKKind } from '$lib/types/ndkKind';

vi.mock('$lib/events/JobEvent', () => ({
    JobEvent: {
        from: vi.fn(),
    },
}));

vi.mock('$lib/events/BidEvent', () => ({
    BidEvent: {
        from: vi.fn(),
    },
}));

// Mock stores with proper setup
vi.mock('$lib/stores/session', () => ({
    default: {
        subscribe: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
        fetchEvents: vi.fn(),
    },
}));

vi.mock('$lib/stores/wot', () => ({
    wot: {
        subscribe: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
        has: vi.fn(),
    },
}));

// Mock NDK instance
const mockNDKInstance = {
    fetchEvents: vi.fn().mockResolvedValue([]),
};

// Mock WoT store
const mockWotStore = {
    has: vi.fn(),
};

// Mock svelte/store get function
vi.mock('svelte/store', () => ({
    get: vi.fn((store) => {
        if (store === mockNDKInstance || store.fetchEvents) {
            return mockNDKInstance;
        }
        return mockWotStore;
    }),
}));

vi.mock('@nostr-dev-kit/ndk', async () => {
    const actual = await vi.importActual('@nostr-dev-kit/ndk');
    return {
        ...actual,
        default: vi.fn(() => mockNDKInstance),
    };
});

// Helper function to create mock NDK events
const createMockNDKEvent = ({
    id = 'mock-event-id',
    kind,
    pubkey = 'mock-pubkey',
    tagAddress = () => 'mock-tag-address',
    acceptedBidAddress,
    referencedJobAddress,
}: {
    id?: string;
    kind: NDKKind;
    pubkey?: string;
    tagAddress?: () => string;
    acceptedBidAddress?: string;
    referencedJobAddress?: string;
}) => ({
    id,
    kind,
    pubkey,
    tagAddress,
    acceptedBidAddress,
    referencedJobAddress,
});

// Helper function to create mock Job/Bid event instances
const createMockJobEvent = ({
    jobAddress = 'job-address-123',
    acceptedBidAddress,
    pubkey = 'job-creator-pubkey',
}: {
    jobAddress?: string;
    acceptedBidAddress?: string;
    pubkey?: string;
}) => ({
    jobAddress,
    acceptedBidAddress,
    pubkey,
});

const createMockBidEvent = ({
    id = 'bid-id-123',
    referencedJobAddress = 'job-address-123',
    pubkey = 'bidder-pubkey',
}: {
    id?: string;
    referencedJobAddress?: string;
    pubkey?: string;
}) => ({
    id,
    tagAddress: () => `bid-address-${id}`,
    referencedJobAddress,
    pubkey,
});

describe('JobBidService', () => {
    const testUser = getPublicKey(generateSecretKey());
    const otherUser = getPublicKey(generateSecretKey());

    let service: JobBidService;

    beforeEach(() => {
        // Reset all mocks before each test
        vi.clearAllMocks();

        mockWotStore.has.mockReturnValue(true);
        mockNDKInstance.fetchEvents.mockResolvedValue([]);

        (JobEvent.from as any).mockImplementation((event: any) =>
            createMockJobEvent({
                jobAddress: event.tagAddress(),
                acceptedBidAddress: event.acceptedBidAddress,
                pubkey: event.pubkey,
            })
        );
        (BidEvent.from as any).mockImplementation((event: any) =>
            createMockBidEvent({
                id: event.id,
                referencedJobAddress: event.referencedJobAddress,
                pubkey: event.pubkey,
            })
        );

        service = new JobBidService(testUser);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('constructor', () => {
        it('should create service instance with user pubkey', () => {
            const newService = new JobBidService(testUser);
            expect(newService).toBeInstanceOf(JobBidService);
        });

        it('should handle different user pubkeys', () => {
            const anotherUser = getPublicKey(generateSecretKey());
            const newService = new JobBidService(anotherUser);
            expect(newService).toBeInstanceOf(JobBidService);
        });
    });

    describe('initialize', () => {
        it('should return correct JobBidContext with user winning bids', async () => {
            const bidId = 'winning-bid-123';
            const jobAddress = 'job-address-123';

            // Mock user bid that won
            const userBid = createMockNDKEvent({
                id: bidId,
                kind: ExtendedNDKKind.FreelanceBid,
                pubkey: testUser,
                tagAddress: () => `bid-address-${bidId}`,
                referencedJobAddress: jobAddress,
            });

            // Mock job that accepted the user's bid
            const wonJob = createMockNDKEvent({
                id: 'job-123',
                kind: ExtendedNDKKind.FreelanceJob,
                pubkey: otherUser,
                tagAddress: () => jobAddress,
                acceptedBidAddress: `bid-address-${bidId}`,
            });

            mockNDKInstance.fetchEvents
                .mockResolvedValueOnce([userBid]) // processUserBids: userBids
                .mockResolvedValueOnce([wonJob]) // processUserBids: allJobsUserWon
                .mockResolvedValueOnce([]) // processUserJobs: userJobs
                .mockResolvedValueOnce([]); // processUserJobs: allWinningBidsOnUserJobs

            const result = await service.initialize();

            expect(result.involvedJobEvents).toHaveLength(1);
            expect(result.involvedBids).toHaveLength(1);
            expect(result.winningBidsOfUser).toEqual([bidId]);
            expect(result.winningBidsForUser).toHaveLength(0);
            expect(result.involvedJobs).toEqual([jobAddress]);

            // Verify correct event types were fetched
            expect(mockNDKInstance.fetchEvents).toHaveBeenCalledTimes(4);
            expect(mockNDKInstance.fetchEvents).toHaveBeenNthCalledWith(
                1,
                { kinds: [ExtendedNDKKind.FreelanceBid], authors: [testUser] },
                expect.any(Object)
            );
        });

        it('should return correct JobBidContext with winning bids on user jobs', async () => {
            const bidId = 'winning-bid-456';
            const jobAddress = 'user-job-456';

            // Mock user's job
            const userJob = createMockNDKEvent({
                id: 'user-job-456',
                kind: ExtendedNDKKind.FreelanceJob,
                pubkey: testUser,
                tagAddress: () => jobAddress,
            });

            // Mock winning bid on user's job
            const winningBid = createMockNDKEvent({
                id: bidId,
                kind: ExtendedNDKKind.FreelanceBid,
                pubkey: otherUser,
                referencedJobAddress: jobAddress,
            });

            mockNDKInstance.fetchEvents
                .mockResolvedValueOnce([]) // processUserBids: userBids
                .mockResolvedValueOnce([]) // processUserBids: allJobsUserWon
                .mockResolvedValueOnce([userJob]) // processUserJobs: userJobs
                .mockResolvedValueOnce([winningBid]); // processUserJobs: allWinningBidsOnUserJobs

            const result = await service.initialize();

            expect(result.involvedJobEvents).toHaveLength(1);
            expect(result.involvedBids).toHaveLength(1);
            expect(result.winningBidsOfUser).toHaveLength(0);
            expect(result.winningBidsForUser).toEqual([bidId]);
            expect(result.involvedJobs).toEqual([jobAddress]);
        });

        it('should handle empty results correctly', async () => {
            mockNDKInstance.fetchEvents
                .mockResolvedValueOnce([]) // userBids
                .mockResolvedValueOnce([]) // allJobsUserWon
                .mockResolvedValueOnce([]) // userJobs
                .mockResolvedValueOnce([]); // allWinningBidsOnUserJobs

            const result = await service.initialize();

            expect(result.involvedJobEvents).toHaveLength(0);
            expect(result.involvedBids).toHaveLength(0);
            expect(result.winningBidsOfUser).toHaveLength(0);
            expect(result.winningBidsForUser).toHaveLength(0);
            expect(result.involvedJobs).toHaveLength(0);
        });

        it('should filter out events from users not in WoT', async () => {
            const bidId = 'filtered-bid-123';
            const jobAddress = 'filtered-job-123';

            // Mock user bid
            const userBid = createMockNDKEvent({
                id: bidId,
                kind: ExtendedNDKKind.FreelanceBid,
                pubkey: testUser,
                tagAddress: () => `bid-address-${bidId}`,
                referencedJobAddress: jobAddress,
            });

            // Mock job from user NOT in WoT
            const jobNotInWot = createMockNDKEvent({
                id: 'job-not-in-wot',
                kind: ExtendedNDKKind.FreelanceJob,
                pubkey: 'untrusted-user',
                tagAddress: () => jobAddress,
                acceptedBidAddress: `bid-address-${bidId}`,
            });

            // Configure WoT to reject the job creator
            mockWotStore.has.mockImplementation((pubkey: string) => pubkey !== 'untrusted-user');

            mockNDKInstance.fetchEvents
                .mockResolvedValueOnce([userBid]) // userBids
                .mockResolvedValueOnce([jobNotInWot]) // allJobsUserWon
                .mockResolvedValueOnce([]) // userJobs
                .mockResolvedValueOnce([]); // allWinningBidsOnUserJobs

            const result = await service.initialize();

            // Should be filtered out due to WoT
            expect(result.involvedJobEvents).toHaveLength(0);
            expect(result.involvedBids).toHaveLength(0);
            expect(result.winningBidsOfUser).toHaveLength(0);
            expect(result.winningBidsForUser).toHaveLength(0);
            expect(result.involvedJobs).toHaveLength(0);

            // Verify WoT was checked
            expect(mockWotStore.has).toHaveBeenCalledWith('untrusted-user');
        });

        it('should handle mismatched bids correctly', async () => {
            const userBid = createMockNDKEvent({
                id: 'orphaned-bid',
                kind: ExtendedNDKKind.FreelanceBid,
                pubkey: testUser,
                tagAddress: () => 'bid-address-orphaned',
            });

            // Job that doesn't match the bid
            const unmatchedJob = createMockNDKEvent({
                id: 'unmatched-job',
                kind: ExtendedNDKKind.FreelanceJob,
                pubkey: otherUser,
                tagAddress: () => 'different-job-address',
                acceptedBidAddress: 'different-bid-address',
            });

            mockNDKInstance.fetchEvents
                .mockResolvedValueOnce([userBid]) // userBids
                .mockResolvedValueOnce([unmatchedJob]) // allJobsUserWon
                .mockResolvedValueOnce([]) // userJobs
                .mockResolvedValueOnce([]); // allWinningBidsOnUserJobs

            const result = await service.initialize();

            // Should not include mismatched events
            expect(result.involvedJobEvents).toHaveLength(0);
            expect(result.involvedBids).toHaveLength(0);
            expect(result.winningBidsOfUser).toHaveLength(0);
        });

        it('should handle fetch errors gracefully', async () => {
            mockNDKInstance.fetchEvents.mockRejectedValueOnce(new Error('Network error'));

            await expect(service.initialize()).rejects.toThrow('Network error');
        });

        it('should handle complex scenario with multiple jobs and bids', async () => {
            const userBid1 = createMockNDKEvent({
                id: 'user-bid-1',
                kind: ExtendedNDKKind.FreelanceBid,
                pubkey: testUser,
                tagAddress: () => 'bid-address-1',
            });

            const jobWon1 = createMockNDKEvent({
                kind: ExtendedNDKKind.FreelanceJob,
                pubkey: otherUser,
                tagAddress: () => 'job-1',
                acceptedBidAddress: 'bid-address-1',
            });

            const userJob1 = createMockNDKEvent({
                kind: ExtendedNDKKind.FreelanceJob,
                pubkey: testUser,
                tagAddress: () => 'user-job-1',
            });

            const bidOnUserJob = createMockNDKEvent({
                id: 'bid-on-user-job',
                kind: ExtendedNDKKind.FreelanceBid,
                pubkey: otherUser,
                referencedJobAddress: 'user-job-1',
            });

            mockNDKInstance.fetchEvents
                .mockResolvedValueOnce([userBid1]) // userBids
                .mockResolvedValueOnce([jobWon1]) // allJobsUserWon
                .mockResolvedValueOnce([userJob1]) // userJobs
                .mockResolvedValueOnce([bidOnUserJob]); // allWinningBidsOnUserJobs

            const result = await service.initialize();

            expect(result.involvedJobEvents).toHaveLength(2);
            expect(result.involvedBids).toHaveLength(2);
            expect(result.winningBidsOfUser).toEqual(['user-bid-1']);
            expect(result.winningBidsForUser).toEqual(['bid-on-user-job']);
            expect(result.involvedJobs).toHaveLength(2);
            expect(result.involvedJobs).toContain('job-1');
            expect(result.involvedJobs).toContain('user-job-1');
        });

        it('should return result with correct interface structure', async () => {
            const result = await service.initialize();

            // Verify result has all required properties
            expect(result).toHaveProperty('involvedJobEvents');
            expect(result).toHaveProperty('involvedBids');
            expect(result).toHaveProperty('winningBidsOfUser');
            expect(result).toHaveProperty('winningBidsForUser');
            expect(result).toHaveProperty('involvedJobs');

            // Verify types
            expect(Array.isArray(result.involvedJobEvents)).toBe(true);
            expect(Array.isArray(result.involvedBids)).toBe(true);
            expect(Array.isArray(result.winningBidsOfUser)).toBe(true);
            expect(Array.isArray(result.winningBidsForUser)).toBe(true);
            expect(Array.isArray(result.involvedJobs)).toBe(true);
        });

        it('should handle duplicate job addresses correctly', async () => {
            const userBid = createMockNDKEvent({
                id: 'bid-1',
                kind: ExtendedNDKKind.FreelanceBid,
                pubkey: testUser,
                tagAddress: () => 'bid-address-1',
            });

            const wonJob = createMockNDKEvent({
                kind: ExtendedNDKKind.FreelanceJob,
                pubkey: otherUser,
                tagAddress: () => 'same-job-address',
                acceptedBidAddress: 'bid-address-1',
            });

            const userJob = createMockNDKEvent({
                kind: ExtendedNDKKind.FreelanceJob,
                pubkey: testUser,
                tagAddress: () => 'same-job-address', // Same address as won job
            });

            const bidOnUserJob = createMockNDKEvent({
                id: 'bid-2',
                kind: ExtendedNDKKind.FreelanceBid,
                pubkey: otherUser,
                referencedJobAddress: 'same-job-address',
            });

            mockNDKInstance.fetchEvents
                .mockResolvedValueOnce([userBid]) // userBids
                .mockResolvedValueOnce([wonJob]) // allJobsUserWon
                .mockResolvedValueOnce([userJob]) // userJobs
                .mockResolvedValueOnce([bidOnUserJob]); // allWinningBidsOnUserJobs

            const result = await service.initialize();

            // Should have duplicate job addresses in the array
            expect(result.involvedJobs).toHaveLength(2);
            expect(result.involvedJobs.filter((addr) => addr === 'same-job-address')).toHaveLength(
                2
            );
        });

        it('should verify event processing calls JobEvent.from and BidEvent.from', async () => {
            const userBid = createMockNDKEvent({
                id: 'test-bid',
                kind: ExtendedNDKKind.FreelanceBid,
                pubkey: testUser,
                tagAddress: () => 'test-bid-address',
            });

            const wonJob = createMockNDKEvent({
                kind: ExtendedNDKKind.FreelanceJob,
                pubkey: otherUser,
                tagAddress: () => 'test-job-address',
                acceptedBidAddress: 'test-bid-address',
            });

            mockNDKInstance.fetchEvents
                .mockResolvedValueOnce([userBid]) // userBids
                .mockResolvedValueOnce([wonJob]) // allJobsUserWon
                .mockResolvedValueOnce([]) // userJobs
                .mockResolvedValueOnce([]); // allWinningBidsOnUserJobs

            await service.initialize();

            expect(JobEvent.from).toHaveBeenCalledWith(wonJob);
            expect(BidEvent.from).toHaveBeenCalledWith(userBid);
        });
    });

    describe('performance considerations', () => {
        it('should handle large numbers of events efficiently', async () => {
            const manyBids = Array.from({ length: 100 }, (_, i) =>
                createMockNDKEvent({
                    id: `bid-${i}`,
                    kind: ExtendedNDKKind.FreelanceBid,
                    pubkey: testUser,
                    tagAddress: () => `bid-address-${i}`,
                })
            );

            const manyJobs = Array.from({ length: 50 }, (_, i) =>
                createMockNDKEvent({
                    id: `job-${i}`,
                    kind: ExtendedNDKKind.FreelanceJob,
                    pubkey: otherUser,
                    tagAddress: () => `job-address-${i}`,
                    acceptedBidAddress: `bid-address-${i}`,
                })
            );

            mockNDKInstance.fetchEvents
                .mockResolvedValueOnce(manyBids) // userBids
                .mockResolvedValueOnce(manyJobs) // allJobsUserWon
                .mockResolvedValueOnce([]) // userJobs
                .mockResolvedValueOnce([]); // allWinningBidsOnUserJobs

            const startTime = Date.now();
            const result = await service.initialize();
            const duration = Date.now() - startTime;

            // Should complete in reasonable time (less than 1 second for 150 events)
            expect(duration).toBeLessThan(1000);
            expect(result.involvedJobs).toHaveLength(50);
            expect(result.winningBidsOfUser).toHaveLength(50);
        });
    });
});
