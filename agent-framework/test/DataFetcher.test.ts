import { DataFetcher } from '../src/Agent/DataFetcher';

describe('DataFetcher — parseQuestion', () => {
  const fetcher = new DataFetcher();

  it('parses BTC + target + direction', () => {
    const result = fetcher.parseQuestion('Will Bitcoin > $100K by June?');
    expect(result.symbol).toBe('BTC');
    expect(result.coingeckoId).toBe('bitcoin');
    expect(result.targetValue).toBeCloseTo(100_000, -1);
    expect(result.direction).toBe('above');
    expect(result.timeframe).toContain('June');
  });

  it('parses ETH', () => {
    const result = fetcher.parseQuestion('Will ETH flip BTC?');
    expect(result.symbol).toBe('ETH');
    expect(result.coingeckoId).toBe('ethereum');
  });

  it('parses SOL with $500', () => {
    const result = fetcher.parseQuestion('Will SOL reach $500?');
    expect(result.symbol).toBe('SOL');
    expect(result.targetValue).toBeCloseTo(500, 0);
  });

  it('parses million-dollar targets', () => {
    const result = fetcher.parseQuestion('Will BTC exceed $1M?');
    expect(result.targetValue).toBeCloseTo(1_000_000, -2);
  });

  it('handles no target gracefully', () => {
    const result = fetcher.parseQuestion('Will DOGE make it?');
    expect(result.targetValue).toBeUndefined();
  });

  it('detects below direction', () => {
    const result = fetcher.parseQuestion('Will BTC drop below $50K?');
    expect(result.direction).toBe('below');
  });
});

describe('DataFetcher — sentiment fallback', () => {
  it('returns neutral sentiment when no NewsAPI key', async () => {
    const saved = process.env.NEWSAPI_KEY;
    delete process.env.NEWSAPI_KEY;
    const fetcher = new DataFetcher('');
    const result = await fetcher.getMarketSentiment('bitcoin');
    process.env.NEWSAPI_KEY = saved;
    expect(result.score).toBe(0);
    expect(result.articleCount).toBe(0);
  });
});
