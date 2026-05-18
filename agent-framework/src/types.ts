// ─── Market Data ─────────────────────────────────────────────────────────────

export interface CryptoPrice {
  symbol: string;
  coingeckoId: string;
  currentPrice: number;
  priceChange24h: number;
  priceChange7d: number;
  volume24h: number;
  marketCap: number;
}

export interface HistoricalPricePoint {
  timestamp: number;
  price: number;
}

export interface TrendAnalysis {
  direction: 'bullish' | 'bearish' | 'neutral';
  ma7: number;
  ma30: number;
  priceVsMa7: number;    // % deviation from 7-day MA
  priceVsMa30: number;   // % deviation from 30-day MA
  momentum: number;      // -1 to 1 (rate of change)
  historicalPrices: number[];
}

export interface SentimentData {
  score: number;         // -1 (very bearish) to 1 (very bullish)
  articleCount: number;
  positiveCount: number;
  negativeCount: number;
  headlines: string[];
}

export interface MarketData {
  question: string;
  symbol: string;
  coingeckoId: string;
  currentPrice: number;
  targetValue?: number;         // extracted from question e.g. "$100K" → 100000
  timeframe?: string;           // e.g. "by June"
  price: CryptoPrice;
  trend: TrendAnalysis;
  sentiment: SentimentData;
  fetchedAt: number;
}

// ─── Prediction ───────────────────────────────────────────────────────────────

export interface PredictionResult {
  outcome: 'YES' | 'NO';
  confidence: number;           // 0–100
  reasoning: string;
  technicalScore: number;       // 0–100 contribution from technical analysis
  sentimentScore: number;       // 0–100 contribution from sentiment
  priceAnalysisScore: number;   // 0–100 contribution from price proximity
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export type AgentType = 'technical' | 'sentiment' | 'balanced';

export interface AgentConfig {
  agentId: string;
  agentType: AgentType;
  privateKey: string;
  minConfidenceToBet: number;   // 0–100
  baseStakeUsdc: number;        // in whole USDC
  maxStakeUsdc: number;
}

export interface AgentPrediction {
  agentId: string;
  agentType: AgentType;
  agentAddress: string;
  marketId: number;
  question: string;
  prediction: PredictionResult;
  stakeAmount: bigint;          // in USDC 6-decimal units
  txHash?: string;
  timestamp: number;
  skipped: boolean;             // true if confidence < minConfidenceToBet
}

// ─── Orchestration ────────────────────────────────────────────────────────────

export interface ConsensusResult {
  outcome: 'YES' | 'NO';
  confidence: number;           // weighted average
  agreeingAgents: number;
  totalAgents: number;
  totalStaked: bigint;
}

export interface OrchestratorResult {
  marketId: number;
  question: string;
  agentPredictions: AgentPrediction[];
  consensus: ConsensusResult;
  txHashes: string[];
  completedAt: number;
}

// ─── Logging / Attestation ───────────────────────────────────────────────────

export interface ActionLog {
  agentId: string;
  action: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  txHash?: string;
  timestamp: number;
}

// ─── Question Parsing ─────────────────────────────────────────────────────────

export interface ParsedQuestion {
  symbol: string;               // e.g. "BTC"
  coingeckoId: string;          // e.g. "bitcoin"
  targetValue?: number;         // e.g. 100000
  direction?: 'above' | 'below';
  timeframe?: string;
  raw: string;
}
