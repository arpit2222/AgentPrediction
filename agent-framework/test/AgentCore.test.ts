import { Agent } from '../src/Agent/AgentCore';
import type { AgentConfig } from '../src/types';

// ─── Mock KiteIntegration so tests don't need a live RPC ─────────────────────
jest.mock('../src/Blockchain/KiteIntegration', () => {
  return {
    KiteAgent: jest.fn().mockImplementation(() => ({
      getAddress: () => '0xAgentAddress',
      getUsdcBalance: async () => BigInt(1_000 * 1e6), // 1000 USDC
      getKiteBalance: async () => '10.0',
      placePrediction: async () => ({
        txHash: '0xdeadbeef',
        blockNumber: 100,
        gasUsed: BigInt(100_000),
      }),
    })),
  };
});

// ─── Mock DataFetcher ─────────────────────────────────────────────────────────
jest.mock('../src/Agent/DataFetcher', () => {
  return {
    DataFetcher: jest.fn().mockImplementation(() => ({
      parseQuestion: (q: string) => ({
        symbol: 'BTC',
        coingeckoId: 'bitcoin',
        targetValue: 100_000,
        direction: 'above',
        raw: q,
      }),
      fetchAllData: async () => ({
        price: {
          symbol: 'BTC',
          coingeckoId: 'bitcoin',
          currentPrice: 95_000,
          priceChange24h: 3.5,
          priceChange7d: 12,
          volume24h: 5e10,
          marketCap: 1.9e12,
        },
        trend: {
          direction: 'bullish',
          ma7: 90_000,
          ma30: 80_000,
          priceVsMa7: 5.6,
          priceVsMa30: 18.75,
          momentum: 0.12,
          historicalPrices: Array.from({ length: 30 }, (_, i) => 70_000 + i * 1_000),
        },
        sentiment: { score: 0.4, articleCount: 10, positiveCount: 6, negativeCount: 2, headlines: [] },
      }),
    })),
  };
});

function makeConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    agentId: 'test-agent',
    agentType: 'balanced',
    privateKey: '0x' + 'a'.repeat(64),
    minConfidenceToBet: 40,
    baseStakeUsdc: 100,
    maxStakeUsdc: 500,
    ...overrides,
  };
}

describe('Agent', () => {
  it('constructs without throwing', () => {
    expect(() => new Agent(makeConfig())).not.toThrow();
  });

  it('returns correct agentId and address', () => {
    const agent = new Agent(makeConfig({ agentId: 'alpha' }));
    expect(agent.agentId).toBe('alpha');
    expect(agent.getAddress()).toBe('0xAgentAddress');
  });

  describe('decideStakeAmount', () => {
    it('returns 0 below threshold', () => {
      const agent = new Agent(makeConfig({ minConfidenceToBet: 50 }));
      expect(agent.decideStakeAmount(49)).toBe(0n);
    });

    it('returns base stake at exact threshold', () => {
      const agent = new Agent(makeConfig({ minConfidenceToBet: 40, baseStakeUsdc: 100, maxStakeUsdc: 500 }));
      const stake = agent.decideStakeAmount(40);
      expect(stake).toBe(BigInt(100 * 1e6));
    });

    it('returns max stake at 100% confidence', () => {
      const agent = new Agent(makeConfig({ minConfidenceToBet: 0, baseStakeUsdc: 100, maxStakeUsdc: 500 }));
      const stake = agent.decideStakeAmount(100);
      expect(stake).toBe(BigInt(500 * 1e6));
    });

    it('scales linearly between base and max', () => {
      const agent = new Agent(makeConfig({ minConfidenceToBet: 0, baseStakeUsdc: 0, maxStakeUsdc: 200 }));
      const half = agent.decideStakeAmount(50);
      expect(half).toBe(BigInt(100 * 1e6)); // 50% of 200
    });
  });

  describe('analyzeMarket', () => {
    it('returns a prediction with txHash when confidence >= threshold', async () => {
      const agent = new Agent(makeConfig({ minConfidenceToBet: 1 }));
      const result = await agent.analyzeMarket(1, 'Will BTC > $100K?');

      expect(result.agentId).toBe('test-agent');
      expect(result.marketId).toBe(1);
      expect(['YES', 'NO']).toContain(result.prediction.outcome);
      expect(result.txHash).toBe('0xdeadbeef');
      expect(result.skipped).toBe(false);
    });

    it('skips bet when confidence below threshold', async () => {
      // Set threshold very high so it's always skipped
      const agent = new Agent(makeConfig({ minConfidenceToBet: 100 }));
      const result = await agent.analyzeMarket(1, 'Will BTC > $100K?');
      expect(result.skipped).toBe(true);
      expect(result.txHash).toBeUndefined();
    });

    it('logs actions', async () => {
      const agent = new Agent(makeConfig({ minConfidenceToBet: 1 }));
      await agent.analyzeMarket(1, 'Will BTC > $100K?');
      const logs = agent.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(3);
      expect(logs[0].action).toBe('parse_question');
    });
  });
});
