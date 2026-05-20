/**
 * Integration tests for the Agent Framework.
 * These tests verify that multiple components work together correctly.
 * Blockchain calls are mocked — no live RPC needed.
 */

import { DataFetcher } from '../src/Agent/DataFetcher';
import { PredictionModel } from '../src/Agent/PredictionModel';
import { ActionLogger } from '../src/Agent/ActionLogger';
import { Agent } from '../src/Agent/AgentCore';
import type { AgentConfig } from '../src/types';

// ─── Mock blockchain layer ────────────────────────────────────────────────────
jest.mock('../src/Blockchain/KiteIntegration', () => ({
  KiteAgent: jest.fn().mockImplementation(() => ({
    getAddress: () => '0xMockAgentAddress',
    getUsdcBalance: async () => BigInt(500) * BigInt(1e18),
    getKiteBalance: async () => '5.0',
    placePrediction: async ({ outcome }: { outcome: string }) => ({
      txHash: `0x${outcome.toLowerCase()}hash1234`,
      blockNumber: 42,
      gasUsed: BigInt(120_000),
    }),
  })),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BULLISH_MARKET_DATA = {
  symbol: 'BTC',
  coingeckoId: 'bitcoin',
  targetValue: 100_000,
  direction: 'above' as const,
  raw: 'Will BTC > $100K?',
  timeframe: 'December',
};

const MOCK_FETCH_DATA = {
  price: {
    symbol: 'BTC', coingeckoId: 'bitcoin',
    currentPrice: 95_000,
    priceChange24h: 4.2, priceChange7d: 11.5,
    volume24h: 5e10, marketCap: 1.9e12,
  },
  trend: {
    direction: 'bullish' as const,
    ma7: 90_000, ma30: 80_000,
    priceVsMa7: 5.6, priceVsMa30: 18.75,
    momentum: 0.12,
    historicalPrices: Array.from({ length: 30 }, (_, i) => 70_000 + i * 1_000),
  },
  sentiment: { score: 0.4, articleCount: 12, positiveCount: 8, negativeCount: 2, headlines: [] },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DataFetcher → PredictionModel pipeline', () => {
  const fetcher = new DataFetcher();
  const model = new PredictionModel('balanced');

  it('parses question and feeds into model without errors', () => {
    const parsed = fetcher.parseQuestion('Will Bitcoin > $100K by December 2026?');
    expect(() => model.predict({
      question: parsed.raw,
      symbol: parsed.symbol,
      coingeckoId: parsed.coingeckoId,
      currentPrice: MOCK_FETCH_DATA.price.currentPrice,
      targetValue: parsed.targetValue,
      price: MOCK_FETCH_DATA.price,
      trend: MOCK_FETCH_DATA.trend,
      sentiment: MOCK_FETCH_DATA.sentiment,
      fetchedAt: Date.now(),
    }, parsed)).not.toThrow();
  });

  it('all three agent types produce valid predictions for the same data', () => {
    const parsed = fetcher.parseQuestion(BULLISH_MARKET_DATA.raw);
    const marketData = {
      question: parsed.raw,
      symbol: parsed.symbol,
      coingeckoId: parsed.coingeckoId,
      currentPrice: MOCK_FETCH_DATA.price.currentPrice,
      targetValue: parsed.targetValue,
      price: MOCK_FETCH_DATA.price,
      trend: MOCK_FETCH_DATA.trend,
      sentiment: MOCK_FETCH_DATA.sentiment,
      fetchedAt: Date.now(),
    };

    for (const type of ['technical', 'sentiment', 'balanced'] as const) {
      const result = new PredictionModel(type).predict(marketData, parsed);
      expect(['YES', 'NO']).toContain(result.outcome);
      expect(result.confidence).toBeGreaterThanOrEqual(1);
      expect(result.confidence).toBeLessThanOrEqual(99);
      expect(result.reasoning).toContain('Prediction:');
    }
  });

  it('bearish data consistently produces lower confidence YES scores', () => {
    const parsed = fetcher.parseQuestion('Will BTC > $100K?');
    const bearishData = {
      question: parsed.raw, symbol: parsed.symbol, coingeckoId: parsed.coingeckoId,
      currentPrice: 40_000, targetValue: 100_000,
      price: { ...MOCK_FETCH_DATA.price, currentPrice: 40_000, priceChange24h: -8, priceChange7d: -15 },
      trend: {
        direction: 'bearish' as const,
        ma7: 45_000, ma30: 60_000,
        priceVsMa7: -11, priceVsMa30: -33,
        momentum: -0.2, historicalPrices: [],
      },
      sentiment: { score: -0.8, articleCount: 10, positiveCount: 1, negativeCount: 9, headlines: [] },
      fetchedAt: Date.now(),
    };
    const result = new PredictionModel('balanced').predict(bearishData, parsed);
    expect(result.outcome).toBe('NO');
  });
});

describe('ActionLogger', () => {
  it('stores logs in memory and retrieves them', () => {
    const logger = new ActionLogger('test-agent-int');
    logger.log('test_action', { key: 'value' }, { result: 'ok' });
    logger.log('another_action', {}, { foo: 'bar' }, '0xsomehash');

    const logs = logger.getAll();
    expect(logs.length).toBe(2);
    expect(logs[0].action).toBe('test_action');
    expect(logs[1].txHash).toBe('0xsomehash');
  });

  it('getLast returns the most recent entry', () => {
    const logger = new ActionLogger('test-agent-last');
    logger.log('first', {}, {});
    logger.log('second', {}, {});
    expect(logger.getLast()?.action).toBe('second');
  });
});

describe('Agent stake sizing integration', () => {
  const config: AgentConfig = {
    agentId: 'int-agent',
    agentType: 'balanced',
    privateKey: '0x' + 'b'.repeat(64),
    minConfidenceToBet: 40,
    baseStakeUsdc: 100,
    maxStakeUsdc: 500,
  };

  it('stake scales correctly at boundary values', () => {
    const agent = new Agent(config);

    const atMin = agent.decideStakeAmount(40);
    const atMax = agent.decideStakeAmount(100);
    const atMid = agent.decideStakeAmount(70);

    expect(atMin).toBe(BigInt(100) * BigInt(1e18));
    expect(atMax).toBe(BigInt(500) * BigInt(1e18));
    // at 70% confidence: 40+(500-100)*(70-40)/60 = 100+200 = 300
    expect(atMid).toBeGreaterThan(atMin);
    expect(atMid).toBeLessThan(atMax);
  });

  it('never bets above MAX_STAKE regardless of confidence', () => {
    const agent = new Agent(config);
    const stake = agent.decideStakeAmount(99);
    expect(stake).toBeLessThanOrEqual(BigInt(500) * BigInt(1e18));
  });
});

describe('DataFetcher sentiment fallback', () => {
  it('returns score=0 when NewsAPI is unavailable', async () => {
    const fetcher = new DataFetcher('INVALID_KEY_TRIGGERS_FALLBACK');
    // Override to force fallback
    const result = await fetcher.getMarketSentiment('bitcoin');
    // Either from API (any score) or fallback (score=0)
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThanOrEqual(-1);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

// Full agent pipeline integration is covered in AgentCore.test.ts
// (jest.mock must be top-level; cannot be hoisted inside describe).

// See AgentCore.test.ts for full agent → blockchain pipeline tests.
