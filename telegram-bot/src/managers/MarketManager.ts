import { ethers } from 'ethers';
import { AgentOrchestrator } from '../../../agent-framework/src/Orchestration/AgentOrchestrator';
import { KiteAgent } from '../../../agent-framework/src/Blockchain/KiteIntegration';
import { getWallet, formatUsdc } from '../../../agent-framework/src/Blockchain/Signer';
import type { OrchestratorResult, AgentPrediction } from '../../../agent-framework/src/types';
import type { MarketSummary, MarketResultData, AgentStatEntry } from '../messages/BotMessages';

export interface StoredMarket {
  id: number;
  question: string;
  deadlineMs: number;
  resolved: boolean;
  outcome?: boolean;
  agentPredictions: AgentPrediction[];
  yesStake: bigint;
  noStake: bigint;
  txHashes: string[];
  createdAt: number;
}

const MARKET_DURATION_SECONDS = 30 * 24 * 3600; // 30 days default
const AGENT_TIMEOUT_MS = 90_000; // 90s timeout for agent analysis

export class MarketManager {
  private orchestrator: AgentOrchestrator;
  private deployerKite: KiteAgent;
  private markets = new Map<number, StoredMarket>();
  private agentStats = new Map<string, AgentStatEntry>();

  constructor() {
    this.orchestrator = new AgentOrchestrator();

    const deployerKey = process.env.KITE_PRIVATE_KEY;
    if (!deployerKey) throw new Error('KITE_PRIVATE_KEY not set');
    this.deployerKite = new KiteAgent(getWallet(deployerKey));
  }

  // ── Full Market Creation Flow ──────────────────────────────────────────────

  /**
   * Creates market on-chain, then runs all 3 agents autonomously.
   * This is the core "agentic" demo flow.
   */
  async createMarketFlow(question: string): Promise<OrchestratorResult> {
    // Wrap in timeout so a slow network doesn't hang forever
    const result = await Promise.race([
      this.orchestrator.executeMarketFlow(question),
      this._timeout(AGENT_TIMEOUT_MS),
    ]) as OrchestratorResult;

    // Persist locally
    const market: StoredMarket = {
      id: result.marketId,
      question: result.question,
      deadlineMs: Date.now() + MARKET_DURATION_SECONDS * 1000,
      resolved: false,
      agentPredictions: result.agentPredictions,
      yesStake: result.agentPredictions
        .filter((p) => !p.skipped && p.prediction.outcome === 'YES')
        .reduce((sum, p) => sum + p.stakeAmount, 0n),
      noStake: result.agentPredictions
        .filter((p) => !p.skipped && p.prediction.outcome === 'NO')
        .reduce((sum, p) => sum + p.stakeAmount, 0n),
      txHashes: result.txHashes,
      createdAt: Date.now(),
    };
    this.markets.set(result.marketId, market);
    this._updateAgentStats(result.agentPredictions);

    return result;
  }

  // ── Market Queries ─────────────────────────────────────────────────────────

  getMarket(marketId: number): StoredMarket | undefined {
    return this.markets.get(marketId);
  }

  getActiveMarkets(): MarketSummary[] {
    return Array.from(this.markets.values())
      .filter((m) => !m.resolved)
      .map((m) => {
        const consensus = m.agentPredictions.length > 0
          ? this._getConsensusOutcome(m.agentPredictions)
          : undefined;
        return {
          id: m.id,
          question: m.question,
          deadlineMs: m.deadlineMs,
          yesStake: m.yesStake,
          noStake: m.noStake,
          consensus,
          resolved: m.resolved,
        };
      });
  }

  async getMarketResultData(marketId: number): Promise<MarketResultData | null> {
    const local = this.markets.get(marketId);

    // Also refresh on-chain data
    try {
      const onChain = await this.deployerKite.getMarketStatus(marketId);
      if (local) {
        local.yesStake = onChain.totalYesStake;
        local.noStake = onChain.totalNoStake;
        local.resolved = onChain.resolved;
        local.outcome = onChain.outcome;
      }

      return {
        question: local?.question ?? onChain.question,
        deadlineMs: local?.deadlineMs ?? onChain.deadline * 1000,
        resolved: onChain.resolved,
        outcome: onChain.outcome,
        totalYesStake: onChain.totalYesStake,
        totalNoStake: onChain.totalNoStake,
        predictionCount: onChain.predictionCount,
        agentPredictions: local?.agentPredictions ?? [],
      };
    } catch {
      if (!local) return null;
      return {
        question: local.question,
        deadlineMs: local.deadlineMs,
        resolved: local.resolved,
        outcome: local.outcome,
        totalYesStake: local.yesStake,
        totalNoStake: local.noStake,
        predictionCount: local.agentPredictions.filter((p) => !p.skipped).length,
        agentPredictions: local.agentPredictions,
      };
    }
  }

  // ── User Bet ───────────────────────────────────────────────────────────────

  async placeUserBet(
    wallet: ethers.Wallet,
    marketId: number,
    outcome: 'YES' | 'NO',
    amountUsdc: number
  ): Promise<string> {
    const kite = new KiteAgent(wallet);
    const amount = BigInt(Math.floor(amountUsdc * 1e6));

    const balance = await kite.getUsdcBalance();
    if (balance < amount) {
      throw new Error(
        `Insufficient USDC: have ${formatUsdc(balance)} USDC, need ${amountUsdc} USDC`
      );
    }

    const result = await kite.placePrediction({
      marketId,
      outcome,
      amount,
      reason: `user_bet:${marketId}:${outcome}`,
    });

    // Update local stake tracking
    const market = this.markets.get(marketId);
    if (market) {
      if (outcome === 'YES') market.yesStake += amount;
      else market.noStake += amount;
    }

    return result.txHash;
  }

  // ── Settlement ─────────────────────────────────────────────────────────────

  async resolveAndSettle(marketId: number, outcome: boolean): Promise<{ resolveTx: string; settleTx: string }> {
    const result = await this.orchestrator.resolveAndSettle(marketId, outcome);

    const market = this.markets.get(marketId);
    if (market) {
      market.resolved = true;
      market.outcome = outcome;
    }

    // Update agent stats for accuracy
    this._finalizeAgentStats(marketId, outcome);

    return result;
  }

  // ── Agent Stats ────────────────────────────────────────────────────────────

  getAgentStats(): AgentStatEntry[] {
    return Array.from(this.agentStats.values());
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _getConsensusOutcome(predictions: AgentPrediction[]): 'YES' | 'NO' {
    const active = predictions.filter((p) => !p.skipped);
    if (active.length === 0) return 'NO';
    const yesCount = active.filter((p) => p.prediction.outcome === 'YES').length;
    return yesCount >= active.length / 2 ? 'YES' : 'NO';
  }

  private _updateAgentStats(predictions: AgentPrediction[]): void {
    for (const p of predictions) {
      if (p.skipped) continue;
      const existing = this.agentStats.get(p.agentId) ?? {
        agentId: p.agentId,
        agentType: p.agentType,
        marketsAnalyzed: 0,
        accuracy: 0,
        totalStaked: 0n,
        totalWon: 0n,
      };
      existing.marketsAnalyzed++;
      existing.totalStaked += p.stakeAmount;
      this.agentStats.set(p.agentId, existing);
    }
  }

  private _finalizeAgentStats(marketId: number, outcome: boolean): void {
    const market = this.markets.get(marketId);
    if (!market) return;

    for (const p of market.agentPredictions) {
      if (p.skipped) continue;
      const stats = this.agentStats.get(p.agentId);
      if (!stats) continue;

      const won = (p.prediction.outcome === 'YES') === outcome;
      if (won) {
        stats.totalWon += p.stakeAmount;
      }

      // Recalculate accuracy (simple running average)
      const correct = won ? 1 : 0;
      stats.accuracy =
        (stats.accuracy * (stats.marketsAnalyzed - 1) + correct * 100) /
        stats.marketsAnalyzed;

      this.agentStats.set(p.agentId, stats);
    }
  }

  private _timeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), ms)
    );
  }
}
