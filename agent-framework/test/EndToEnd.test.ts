/**
 * End-to-End tests for the full AgentPrediction platform flow.
 *
 * Simulates the complete journey:
 *   User creates market → Agents analyze → Agents bet → Market resolves → Winners paid
 *
 * All on-chain calls are mocked. These tests verify the orchestration logic,
 * consensus algorithm, and stake accounting without needing a live RPC.
 */

import { AgentOrchestrator } from '../src/Orchestration/AgentOrchestrator';
import type { OrchestratorResult, AgentConfig } from '../src/types';

// ─── Mock the entire blockchain layer ────────────────────────────────────────

const mockPredictYes = jest.fn().mockResolvedValue({ txHash: '0xyes_hash', blockNumber: 100, gasUsed: BigInt(120_000) });
const mockPredictNo  = jest.fn().mockResolvedValue({ txHash: '0xno_hash',  blockNumber: 101, gasUsed: BigInt(120_000) });
const mockCreateMkt  = jest.fn().mockResolvedValue({ marketId: 99, txHash: '0xcreate_hash' });
const mockResolve    = jest.fn().mockResolvedValue('0xresolve_hash');
const mockSettle     = jest.fn().mockResolvedValue('0xsettle_hash');

jest.mock('../src/Blockchain/KiteIntegration', () => ({
  KiteAgent: jest.fn().mockImplementation(() => ({
    getAddress: () => '0xMockAddress',
    getUsdcBalance: async () => BigInt(5_000 * 1e6),
    getKiteBalance: async () => '10.0',
    createMarket: mockCreateMkt,
    placePrediction: async ({ outcome }: { outcome: string }) =>
      outcome === 'YES' ? mockPredictYes() : mockPredictNo(),
    resolveMarket: mockResolve,
    settleMarket: mockSettle,
    getMarketStatus: async () => ({
      question: 'Will BTC > $100K?',
      deadline: Math.floor(Date.now() / 1000) + 3600,
      resolved: false,
      outcome: false,
      totalYesStake: BigInt(1170 * 1e6),
      totalNoStake: BigInt(0),
      predictionCount: 3,
    }),
  })),
}));

// ─── Mock DataFetcher to avoid live API calls ─────────────────────────────────

jest.mock('../src/Agent/DataFetcher', () => ({
  DataFetcher: jest.fn().mockImplementation(() => ({
    parseQuestion: (q: string) => ({
      symbol: 'BTC', coingeckoId: 'bitcoin',
      targetValue: 100_000, direction: 'above' as const, raw: q,
    }),
    fetchAllData: async () => ({
      price: {
        symbol: 'BTC', coingeckoId: 'bitcoin',
        currentPrice: 95_000, priceChange24h: 3.5, priceChange7d: 11,
        volume24h: 5e10, marketCap: 1.9e12,
      },
      trend: {
        direction: 'bullish' as const, ma7: 90_000, ma30: 80_000,
        priceVsMa7: 5.6, priceVsMa30: 18.75, momentum: 0.12,
        historicalPrices: Array.from({ length: 30 }, (_, i) => 70_000 + i * 1_000),
      },
      sentiment: { score: 0.5, articleCount: 10, positiveCount: 7, negativeCount: 2, headlines: [] },
    }),
  })),
}));

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeOrchestrator(): AgentOrchestrator {
  const configs: AgentConfig[] = [
    { agentId: 'agent-A', agentType: 'technical', privateKey: '0x' + 'a'.repeat(64), minConfidenceToBet: 1, baseStakeUsdc: 100, maxStakeUsdc: 500 },
    { agentId: 'agent-B', agentType: 'sentiment', privateKey: '0x' + 'b'.repeat(64), minConfidenceToBet: 1, baseStakeUsdc: 100, maxStakeUsdc: 500 },
    { agentId: 'agent-C', agentType: 'balanced',  privateKey: '0x' + 'c'.repeat(64), minConfidenceToBet: 1, baseStakeUsdc: 100, maxStakeUsdc: 500 },
  ];

  // Override deployer key env
  process.env.KITE_PRIVATE_KEY = '0x' + 'd'.repeat(64);
  process.env.PREDICTION_MARKET_ADDRESS = '0xMarketAddress';

  return new AgentOrchestrator(configs);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('E2E — Market Creation', () => {
  it('creates market on-chain and returns marketId', async () => {
    const orch = makeOrchestrator();
    const { marketId, txHash } = await orch.createMarket('Will BTC > $100K?');

    expect(marketId).toBe(99);
    expect(txHash).toBe('0xcreate_hash');
    expect(mockCreateMkt).toHaveBeenCalledWith('Will BTC > $100K?', expect.any(Number));
  });
});

describe('E2E — Agent Coordination', () => {
  let result: OrchestratorResult;

  beforeAll(async () => {
    const orch = makeOrchestrator();
    result = await orch.coordinateAgents(99, 'Will BTC > $100K?');
  });

  it('returns predictions from all 3 agents', () => {
    expect(result.agentPredictions).toHaveLength(3);
  });

  it('all agents produce valid outcomes', () => {
    for (const p of result.agentPredictions) {
      expect(['YES', 'NO']).toContain(p.prediction.outcome);
      expect(p.prediction.confidence).toBeGreaterThanOrEqual(1);
    }
  });

  it('consensus outcome is derived from majority vote', () => {
    const yesCount = result.agentPredictions.filter((p) => p.prediction.outcome === 'YES').length;
    const expected = yesCount >= 2 ? 'YES' : 'NO';
    expect(result.consensus.outcome).toBe(expected);
  });

  it('consensus confidence is a positive number', () => {
    expect(result.consensus.confidence).toBeGreaterThan(0);
    expect(result.consensus.confidence).toBeLessThanOrEqual(100);
  });

  it('totals staked is sum of all agent stakes', () => {
    const sum = result.agentPredictions.reduce((s, p) => s + p.stakeAmount, 0n);
    expect(result.consensus.totalStaked).toBe(sum);
  });

  it('tx hashes are collected from agent transactions', () => {
    expect(result.txHashes.length).toBeGreaterThan(0);
    for (const hash of result.txHashes) {
      expect(hash).toMatch(/^0x/);
    }
  });

  it('completedAt is a recent timestamp', () => {
    expect(result.completedAt).toBeGreaterThan(Date.now() - 10_000);
  });
});

describe('E2E — Full market flow (create + coordinate)', () => {
  it('executeMarketFlow completes end-to-end without throwing', async () => {
    const orch = makeOrchestrator();
    const result = await orch.executeMarketFlow('Will ETH flip BTC by 2027?');

    expect(result.marketId).toBeGreaterThan(0);
    expect(result.question).toBe('Will ETH flip BTC by 2027?');
    expect(result.agentPredictions.length).toBeGreaterThan(0);
    expect(['YES', 'NO']).toContain(result.consensus.outcome);
  });
});

describe('E2E — Resolution and Settlement', () => {
  it('resolves market and settles in one call', async () => {
    const orch = makeOrchestrator();
    const { resolveTx, settleTx } = await orch.resolveAndSettle(99, true);

    expect(resolveTx).toBe('0xresolve_hash');
    expect(settleTx).toBe('0xsettle_hash');
    expect(mockResolve).toHaveBeenCalledWith(99, true);
    expect(mockSettle).toHaveBeenCalledWith(99);
  });
});

describe('E2E — Agent wallet balances', () => {
  it('returns balance info for each agent', async () => {
    const orch = makeOrchestrator();
    const balances = await orch.getAgentBalances();

    expect(balances).toHaveLength(3);
    for (const b of balances) {
      expect(b.agentId).toBeTruthy();
      expect(b.address).toMatch(/^0x/);
      expect(typeof b.usdc).toBe('string');
      expect(typeof b.kite).toBe('string');
    }
  });
});

describe('E2E — Confidence threshold enforcement', () => {
  it('agents with threshold=100 skip all bets', async () => {
    const configs: AgentConfig[] = [
      { agentId: 'strict-A', agentType: 'technical', privateKey: '0x' + 'a'.repeat(64), minConfidenceToBet: 100, baseStakeUsdc: 100, maxStakeUsdc: 500 },
      { agentId: 'strict-B', agentType: 'sentiment', privateKey: '0x' + 'b'.repeat(64), minConfidenceToBet: 100, baseStakeUsdc: 100, maxStakeUsdc: 500 },
      { agentId: 'strict-C', agentType: 'balanced',  privateKey: '0x' + 'c'.repeat(64), minConfidenceToBet: 100, baseStakeUsdc: 100, maxStakeUsdc: 500 },
    ];
    process.env.KITE_PRIVATE_KEY = '0x' + 'd'.repeat(64);

    const orch = new AgentOrchestrator(configs);
    const result = await orch.coordinateAgents(1, 'Will SOL reach $500?');

    const skippedAll = result.agentPredictions.every((p) => p.skipped);
    expect(skippedAll).toBe(true);
    expect(result.consensus.totalStaked).toBe(0n);
  });
});
