import { ethers } from 'ethers';
import { DataFetcher } from './DataFetcher';
import { PredictionModel } from './PredictionModel';
import { ActionLogger } from './ActionLogger';
import { KiteAgent } from '../Blockchain/KiteIntegration';
import { getWallet, parseUsdc, formatUsdc } from '../Blockchain/Signer';
import type {
  AgentConfig,
  AgentPrediction,
  MarketData,
  ParsedQuestion,
} from '../types';

export class Agent {
  private config: AgentConfig;
  private kite: KiteAgent;
  private fetcher: DataFetcher;
  private model: PredictionModel;
  private logger: ActionLogger;

  constructor(config: AgentConfig) {
    this.config = config;
    const wallet = getWallet(config.privateKey);
    this.kite = new KiteAgent(wallet);
    this.fetcher = new DataFetcher();
    this.model = new PredictionModel(config.agentType);
    this.logger = new ActionLogger(config.agentId);
  }

  get agentId(): string { return this.config.agentId; }
  get agentType() { return this.config.agentType; }
  getAddress(): string { return this.kite.getAddress(); }

  // ── Main Entry Point ───────────────────────────────────────────────────────

  /**
   * Full autonomous analysis → prediction → on-chain bet flow.
   * Zero human intervention after this is called.
   */
  async analyzeMarket(marketId: number, question: string): Promise<AgentPrediction> {
    console.log(`\n[${this.config.agentId}] Starting analysis for market #${marketId}: "${question}"`);

    // 1. Parse question
    const parsed = this.fetcher.parseQuestion(question);
    this.logger.log('parse_question', { question }, { parsed });

    // 2. Fetch market data
    const marketData = await this.fetchMarketData(parsed);
    this.logger.log('fetch_market_data', { symbol: parsed.symbol }, {
      currentPrice: marketData.currentPrice,
      trend: marketData.trend.direction,
      sentimentScore: marketData.sentiment.score,
    });

    // 3. Run prediction model
    const prediction = this.model.predict(marketData, parsed);
    this.logger.log('run_prediction_model', { agentType: this.config.agentType }, {
      outcome: prediction.outcome,
      confidence: prediction.confidence,
      technicalScore: prediction.technicalScore,
      sentimentScore: prediction.sentimentScore,
    });

    console.log(`[${this.config.agentId}] Prediction: ${prediction.outcome} | Confidence: ${prediction.confidence}%`);
    console.log(`[${this.config.agentId}] Reasoning:\n${prediction.reasoning}`);

    // 4. Decide stake
    const stakeAmount = this.decideStakeAmount(prediction.confidence);
    const skipped = prediction.confidence < this.config.minConfidenceToBet;

    const base: Omit<AgentPrediction, 'txHash'> = {
      agentId: this.config.agentId,
      agentType: this.config.agentType,
      agentAddress: this.kite.getAddress(),
      marketId,
      question,
      prediction,
      stakeAmount,
      timestamp: Date.now(),
      skipped,
    };

    if (skipped) {
      console.log(`[${this.config.agentId}] Confidence ${prediction.confidence}% below threshold ${this.config.minConfidenceToBet}% — skipping bet`);
      this.logger.log('skip_bet', { confidence: prediction.confidence, threshold: this.config.minConfidenceToBet }, {});
      return base;
    }

    // 5. Execute on-chain transaction
    const txHash = await this.placePrediction(marketId, prediction.outcome, stakeAmount);
    this.logger.log('place_prediction', {
      marketId,
      outcome: prediction.outcome,
      amount: formatUsdc(stakeAmount),
    }, { txHash }, txHash);

    console.log(`[${this.config.agentId}] ✅ Bet placed! tx: ${txHash}`);

    return { ...base, txHash };
  }

  // ── Data Fetching ──────────────────────────────────────────────────────────

  async fetchMarketData(parsed: ParsedQuestion): Promise<MarketData> {
    const { price, trend, sentiment } = await this.fetcher.fetchAllData(parsed);

    return {
      question: parsed.raw,
      symbol: parsed.symbol,
      coingeckoId: parsed.coingeckoId,
      currentPrice: price.currentPrice,
      targetValue: parsed.targetValue,
      timeframe: parsed.timeframe,
      price,
      trend,
      sentiment,
      fetchedAt: Date.now(),
    };
  }

  // ── Stake Sizing ───────────────────────────────────────────────────────────

  /**
   * Linear scaling: at minConfidence → base stake, at 100% → max stake.
   * Returns amount in USDC 6-decimal units.
   */
  decideStakeAmount(confidence: number): bigint {
    const { minConfidenceToBet, baseStakeUsdc, maxStakeUsdc } = this.config;
    if (confidence < minConfidenceToBet) return 0n;

    const range = 100 - minConfidenceToBet;
    const excess = confidence - minConfidenceToBet;
    const scale = range > 0 ? excess / range : 0;
    const stakeUsdc = baseStakeUsdc + (maxStakeUsdc - baseStakeUsdc) * scale;
    // Round to 2 decimal places to avoid floating-point issues in parseUnits
    const rounded = Math.round(stakeUsdc * 100) / 100;

    return parseUsdc(rounded);
  }

  // ── Blockchain ─────────────────────────────────────────────────────────────

  async placePrediction(marketId: number, outcome: 'YES' | 'NO', amount: bigint): Promise<string> {
    const usdcBalance = await this.kite.getUsdcBalance();
    if (usdcBalance < amount) {
      throw new Error(
        `Insufficient USDC: have ${formatUsdc(usdcBalance)}, need ${formatUsdc(amount)}`
      );
    }

    const result = await this.kite.placePrediction({
      marketId,
      outcome,
      amount,
      reason: `agent:${this.config.agentId}:${outcome}:${marketId}`,
    });

    return result.txHash;
  }

  async getUsdcBalance(): Promise<bigint> {
    return this.kite.getUsdcBalance();
  }

  async getKiteBalance(): Promise<string> {
    return this.kite.getKiteBalance();
  }

  getLogs() {
    return this.logger.getAll();
  }
}
