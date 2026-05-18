import 'dotenv/config';
import { AgentOrchestrator } from './Orchestration/AgentOrchestrator';

// ─── Exports (used by telegram-bot and dashboard) ──────────────────────────

export { Agent } from './Agent/AgentCore';
export { DataFetcher } from './Agent/DataFetcher';
export { PredictionModel } from './Agent/PredictionModel';
export { ActionLogger } from './Agent/ActionLogger';
export { KiteAgent } from './Blockchain/KiteIntegration';
export { AgentOrchestrator } from './Orchestration/AgentOrchestrator';
export * from './types';

// ─── CLI Demo ──────────────────────────────────────────────────────────────
// Run: ts-node src/index.ts "Will Bitcoin > $100K by December 2026?"

async function demo() {
  const question = process.argv[2] || 'Will Bitcoin > $100K by December 2026?';
  const marketIdOverride = process.argv[3] ? parseInt(process.argv[3]) : undefined;

  console.log('AgentPrediction — Autonomous Agent Framework');
  console.log('='.repeat(50));
  console.log(`Question: ${question}`);
  console.log('='.repeat(50));

  const orchestrator = new AgentOrchestrator();

  if (marketIdOverride !== undefined) {
    // Coordinate existing market (skip creation)
    const result = await orchestrator.coordinateAgents(marketIdOverride, question);
    printSummary(result);
  } else {
    // Full flow: create market + agents analyze
    const result = await orchestrator.executeMarketFlow(question);
    printSummary(result);
  }
}

function printSummary(result: Awaited<ReturnType<AgentOrchestrator['executeMarketFlow']>>) {
  console.log('\n📊 FINAL SUMMARY');
  console.log(`Market ID:     #${result.marketId}`);
  console.log(`Consensus:     ${result.consensus.outcome} @ ${result.consensus.confidence}% confidence`);
  console.log(`Agents agreed: ${result.consensus.agreeingAgents}/${result.consensus.totalAgents}`);
  console.log(`Tx hashes:     ${result.txHashes.join(', ') || 'none'}`);
}

// Only run if this is the entry module (not imported)
if (require.main === module) {
  demo().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}
