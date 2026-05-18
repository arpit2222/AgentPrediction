import { Agent } from '../Agent/AgentCore';
import { KiteAgent } from '../Blockchain/KiteIntegration';
import { getWallet, formatUsdc } from '../Blockchain/Signer';
import type {
  AgentConfig,
  AgentPrediction,
  ConsensusResult,
  OrchestratorResult,
} from '../types';

// ─── Default agent configurations ─────────────────────────────────────────────
// Each agent has a different analytical "personality" for diverse predictions.

function buildDefaultAgents(): AgentConfig[] {
  const minConf = parseFloat(process.env.MIN_CONFIDENCE_TO_BET || '40');
  const baseStake = parseFloat(process.env.BASE_STAKE_USDC || '100');
  const maxStake = parseFloat(process.env.MAX_STAKE_USDC || '500');

  return [
    {
      agentId: 'agent-A',
      agentType: 'technical',
      privateKey: process.env.AGENT_A_PRIVATE_KEY || '',
      minConfidenceToBet: minConf,
      baseStakeUsdc: baseStake,
      maxStakeUsdc: maxStake,
    },
    {
      agentId: 'agent-B',
      agentType: 'sentiment',
      privateKey: process.env.AGENT_B_PRIVATE_KEY || '',
      minConfidenceToBet: minConf,
      baseStakeUsdc: baseStake,
      maxStakeUsdc: maxStake,
    },
    {
      agentId: 'agent-C',
      agentType: 'balanced',
      privateKey: process.env.AGENT_C_PRIVATE_KEY || '',
      minConfidenceToBet: minConf,
      baseStakeUsdc: baseStake,
      maxStakeUsdc: maxStake,
    },
  ];
}

export class AgentOrchestrator {
  private agents: Agent[];
  private deployerKite: KiteAgent | null = null;

  constructor(agentConfigs?: AgentConfig[]) {
    const configs = agentConfigs ?? buildDefaultAgents();
    this.agents = configs.map((c) => new Agent(c));

    // Deployer key used for market creation / resolution
    const deployerKey = process.env.KITE_PRIVATE_KEY;
    if (deployerKey) {
      this.deployerKite = new KiteAgent(getWallet(deployerKey));
    }
  }

  // ── Create Market ─────────────────────────────────────────────────────────

  async createMarket(
    question: string,
    durationSeconds: number = 30 * 24 * 3600
  ): Promise<{ marketId: number; txHash: string }> {
    if (!this.deployerKite) throw new Error('KITE_PRIVATE_KEY not set — cannot create market');
    const result = await this.deployerKite.createMarket(question, durationSeconds);
    console.log(`\n[Orchestrator] Market #${result.marketId} created: "${question}" | tx: ${result.txHash}`);
    return result;
  }

  // ── Coordinate Agents ─────────────────────────────────────────────────────

  /**
   * Runs all agents in parallel, then computes consensus.
   * This is the core "autonomous" flow: zero human interaction.
   */
  async coordinateAgents(
    marketId: number,
    question: string
  ): Promise<OrchestratorResult> {
    console.log(`\n[Orchestrator] Coordinating ${this.agents.length} agents for market #${marketId}`);
    console.log(`[Orchestrator] Question: "${question}"\n`);

    // Run all agents in parallel
    const predictions = await Promise.allSettled(
      this.agents.map((agent) => agent.analyzeMarket(marketId, question))
    );

    const agentPredictions: AgentPrediction[] = [];
    const txHashes: string[] = [];

    for (let i = 0; i < predictions.length; i++) {
      const result = predictions[i];
      if (result.status === 'fulfilled') {
        agentPredictions.push(result.value);
        if (result.value.txHash) txHashes.push(result.value.txHash);
      } else {
        console.error(`[Orchestrator] Agent ${this.agents[i].agentId} failed:`, result.reason);
      }
    }

    const consensus = this._computeConsensus(agentPredictions);
    this._printConsensus(marketId, question, agentPredictions, consensus);

    return {
      marketId,
      question,
      agentPredictions,
      consensus,
      txHashes,
      completedAt: Date.now(),
    };
  }

  // ── Full Market Flow ──────────────────────────────────────────────────────

  /**
   * End-to-end: create market → agents analyze → agents bet.
   * Called by the Telegram bot after /create command.
   */
  async executeMarketFlow(question: string): Promise<OrchestratorResult> {
    // 1. Create market on chain
    const { marketId } = await this.createMarket(question);

    // 2. All agents analyze and place bets
    const result = await this.coordinateAgents(marketId, question);

    return result;
  }

  // ── Resolve & Settle ──────────────────────────────────────────────────────

  async resolveAndSettle(marketId: number, outcome: boolean): Promise<{ resolveTx: string; settleTx: string }> {
    if (!this.deployerKite) throw new Error('KITE_PRIVATE_KEY not set');
    const resolveTx = await this.deployerKite.resolveMarket(marketId, outcome);
    console.log(`[Orchestrator] Market #${marketId} resolved → ${outcome ? 'YES' : 'NO'} | tx: ${resolveTx}`);

    const settleTx = await this.deployerKite.settleMarket(marketId);
    console.log(`[Orchestrator] Market #${marketId} settled | tx: ${settleTx}`);

    return { resolveTx, settleTx };
  }

  // ── Agent Balances ────────────────────────────────────────────────────────

  async getAgentBalances(): Promise<Array<{ agentId: string; address: string; usdc: string; kite: string }>> {
    return Promise.all(
      this.agents.map(async (agent) => ({
        agentId: agent.agentId,
        address: agent.getAddress(),
        usdc: formatUsdc(await agent.getUsdcBalance()),
        kite: await agent.getKiteBalance(),
      }))
    );
  }

  // ── Consensus Logic ───────────────────────────────────────────────────────

  private _computeConsensus(predictions: AgentPrediction[]): ConsensusResult {
    const active = predictions.filter((p) => !p.skipped);

    if (active.length === 0) {
      return { outcome: 'NO', confidence: 0, agreeingAgents: 0, totalAgents: predictions.length, totalStaked: 0n };
    }

    const yesPredictions = active.filter((p) => p.prediction.outcome === 'YES');
    const noPredictions = active.filter((p) => p.prediction.outcome === 'NO');

    const yesCount = yesPredictions.length;
    const noCount = noPredictions.length;

    const outcome: 'YES' | 'NO' = yesCount >= noCount ? 'YES' : 'NO';
    const agreeingPredictions = outcome === 'YES' ? yesPredictions : noPredictions;

    // Weighted average confidence of agreeing agents
    const avgConfidence =
      active.reduce((sum, p) => sum + p.prediction.confidence, 0) / active.length;

    const totalStaked = predictions.reduce((sum, p) => sum + p.stakeAmount, 0n);

    return {
      outcome,
      confidence: Math.round(avgConfidence),
      agreeingAgents: agreeingPredictions.length,
      totalAgents: predictions.length,
      totalStaked,
    };
  }

  private _printConsensus(
    marketId: number,
    question: string,
    predictions: AgentPrediction[],
    consensus: ConsensusResult
  ): void {
    console.log('\n' + '═'.repeat(60));
    console.log(`[Orchestrator] CONSENSUS RESULT — Market #${marketId}`);
    console.log('═'.repeat(60));
    console.log(`Question: ${question}`);
    console.log(`Outcome:  ${consensus.outcome}`);
    console.log(`Confidence: ${consensus.confidence}%`);
    console.log(`Agreement: ${consensus.agreeingAgents}/${consensus.totalAgents} agents`);
    console.log(`Total staked: ${formatUsdc(consensus.totalStaked)} USDC`);
    console.log('─'.repeat(60));
    for (const p of predictions) {
      const status = p.skipped ? '⏭  SKIPPED' : `✅ ${p.prediction.outcome} (${p.prediction.confidence}%)`;
      console.log(`  ${p.agentId} [${p.agentType}]: ${status} — stake: ${formatUsdc(p.stakeAmount)} USDC`);
    }
    console.log('═'.repeat(60) + '\n');
  }
}
