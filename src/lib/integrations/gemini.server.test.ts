import {afterEach, describe, expect, it, vi} from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../env.server', () => ({getServerEnv: () => ({GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-test'})}));

import {explainCandidates, type ExplanationCandidate} from './gemini.server';

const candidate: ExplanationCandidate = {
  productId: '11111111-1111-4111-8111-111111111111', name: 'Amber Veil', shortDescription: 'Warm and quiet.',
  notes: ['Amber', 'Jasmine'], score: 89, dimensions: {warm: 85, floral: 65},
};

function geminiReply(items: unknown) {
  return new Response(JSON.stringify({candidates: [{content: {parts: [{text: JSON.stringify({items})}]}}]}), {status: 200});
}

afterEach(() => vi.unstubAllGlobals());

describe('Gemini explanation boundary', () => {
  it('uses a valid explanation only for an allowed product', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiReply([{productId: candidate.productId, explanation: 'A softly luminous composition follows your preference for gentle warmth and floral detail.'}]));
    vi.stubGlobal('fetch', fetchMock);
    const result = await explainCandidates('en', {warm: 85}, [candidate]);
    expect(result.source).toBe('gemini');
    expect(result.byProductId.get(candidate.productId)).toContain('gentle warmth');
    expect(fetchMock.mock.calls[0]?.[0]).toContain('gemini-test');
  });

  it('falls back when Gemini supplies a product outside the inventory allowlist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiReply([{productId: '22222222-2222-4222-8222-222222222222', explanation: 'A softly luminous composition follows your preference for gentle warmth and floral detail.'}])));
    const result = await explainCandidates('en', {}, [candidate]);
    expect(result.source).toBe('fallback');
    expect(result.byProductId.has(candidate.productId)).toBe(true);
  });

  it('falls back when the text includes a price or URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiReply([{productId: candidate.productId, explanation: 'Your ideal fragrance costs 100 IQD and can be found at https://example.com right now.'}])));
    expect((await explainCandidates('en', {}, [candidate])).source).toBe('fallback');
  });
});
