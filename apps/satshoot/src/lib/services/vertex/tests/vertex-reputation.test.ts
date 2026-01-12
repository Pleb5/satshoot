import { NDKEvent } from '@nostr-dev-kit/ndk';
import {
    getVertexErrorMessage,
    parseVertexReputationResponse,
    VERTEX_REPUTATION_SORT,
} from '../vertex-reputation';

vi.mock('dexie', () => ({
    default: class Dexie {
        version() {
            return {
                stores: () => this,
            };
        }
    },
}));

const buildEvent = (content: unknown, tags: string[][]) =>
    new NDKEvent(undefined, {
        content: JSON.stringify(content),
        tags,
        kind: 6312,
        pubkey: 'vertex',
        id: 'event-id',
        created_at: 123,
        sig: 'sig',
    });

describe('vertex reputation parsing', () => {
    it('parses response payload and limits followers', () => {
        const target = { pubkey: 'target', rank: 0.1, follows: 10, followers: 20 };
        const followers = Array.from({ length: 6 }, (_, index) => ({
            pubkey: `follower-${index}`,
            rank: 0.01 * index,
        }));

        const event = buildEvent([target, ...followers], [
            ['sort', VERTEX_REPUTATION_SORT],
            ['nodes', '123'],
        ]);

        const result = parseVertexReputationResponse(event);

        expect(result.target.pubkey).toBe('target');
        expect(result.followers).toHaveLength(5);
        expect(result.followers[0].pubkey).toBe('follower-0');
        expect(result.sort).toBe(VERTEX_REPUTATION_SORT);
        expect(result.nodes).toBe('123');
    });

    it('throws when response is empty', () => {
        const event = buildEvent([], [['sort', VERTEX_REPUTATION_SORT]]);

        expect(() => parseVertexReputationResponse(event)).toThrow('Vertex response was empty.');
    });

    it('extracts error messages from status tags', () => {
        const errorEvent = new NDKEvent(undefined, {
            content: '',
            tags: [['status', 'error', 'invalid target']],
            kind: 7000,
            pubkey: 'vertex',
            id: 'error-id',
            created_at: 123,
            sig: 'sig',
        });

        expect(getVertexErrorMessage(errorEvent)).toBe('invalid target');
    });
});
