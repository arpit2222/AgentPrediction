import type { AgentPrediction, OrchestratorResult } from '../../../agent-framework/src/types';

// Formatting helpers
const bold = (s: string) => `*${s}*`;
const code = (s: string) => `\`${s}\``;
const line = () => '─'.repeat(32);

function formatUsdc(units: bigint): string {
  return (Number(units) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function shortenHash(hash: string): string {
  return hash ? `${hash.slice(0, 6)}...${hash.slice(-4)}` : '';
}

function outcomeEmoji(outcome: 'YES' | 'NO'): string {
  return outcome === 'YES' ? '🟢' : '🔴';
}

function confidenceBar(confidence: number): string {
  const filled = Math.round(confidence / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${confidence}%`;
}

// ─── Message Templates ────────────────────────────────────────────────────────

export class BotMessages {

  static welcome(username?: string): string {
    return `
🤖 ${bold('Welcome to AgentPrediction')}${username ? `, ${username}` : ''}!

The first autonomous prediction market where ${bold('AI agents')} independently analyze, bet, and settle — all on ${bold('Kite Chain')}.

${bold('Commands:')}
/create — Create a new prediction market
/markets — View all active markets
/bet — Place your prediction against the agents
/results — Check market results
/agentstats — See how agents are performing
/help — Show this message

${bold('How it works:')}
1️⃣ You create a market question
2️⃣ 3 AI agents autonomously analyze & place USDC bets
3️⃣ You can bet against or with the agents
4️⃣ Market resolves on deadline — winners get paid in USDC

Start with: /create Will Bitcoin reach \\$100K by December 2026?
`.trim();
  }

  static help(): string {
    return `
📖 ${bold('AgentPrediction Commands')}

${bold('/create')} ${code('<question>')}
Create a new prediction market. The question should be a yes/no question.
_Example:_ /create Will ETH flip BTC by 2027?

${bold('/markets')}
List all active prediction markets with agent consensus.

${bold('/bet')} ${code('<marketId> <yes|no> <amount>')}
Place a USDC bet on a market.
_Example:_ /bet 1 yes 50

${bold('/results')} ${code('<marketId>')}
See full details, all predictions, and settlement status.

${bold('/agentstats')}
View agent performance leaderboard and historical accuracy.

${bold('/wallet')} ${code('<privateKey>')}
Register your wallet to place bets (private key stored in memory only).
`.trim();
  }

  static marketCreating(question: string): string {
    return `
⏳ ${bold('Creating Market...')}

${bold('Question:')} ${question}

🔗 Creating market on Kite Chain...
🤖 Agents are analyzing — this takes ~30 seconds.

I'll send you the results when ready!
`.trim();
  }

  static marketCreated(result: OrchestratorResult): string {
    const { marketId, question, consensus, agentPredictions } = result;
    const active = agentPredictions.filter((p) => !p.skipped);
    const skipped = agentPredictions.filter((p) => p.skipped);

    let msg = `
✅ ${bold(`Market #${marketId} Created`)}

📋 ${bold('Question:')} ${question}
${line()}
🤖 ${bold('Agent Consensus:')} ${outcomeEmoji(consensus.outcome)} ${bold(consensus.outcome)}
📊 Confidence: ${confidenceBar(consensus.confidence)}
👥 Agreement: ${consensus.agreeingAgents}/${consensus.totalAgents} agents
💵 Total staked by agents: ${bold(formatUsdc(consensus.totalStaked) + ' USDC')}
${line()}
${bold('Individual Agent Predictions:')}
`.trim();

    for (const p of active) {
      const txTag = p.txHash ? ` | ${code(shortenHash(p.txHash))}` : '';
      msg += `\n${outcomeEmoji(p.prediction.outcome)} ${bold(p.agentId)} [${p.agentType}]: ${p.prediction.outcome} @ ${p.prediction.confidence}%${txTag}`;
      msg += `\n   Stake: ${formatUsdc(p.stakeAmount)} USDC`;
    }

    if (skipped.length > 0) {
      msg += `\n⏭ ${skipped.map((p) => p.agentId).join(', ')} skipped (low confidence)`;
    }

    msg += `\n${line()}`;
    msg += `\n💡 Use /bet ${marketId} yes 50 to bet with the agents`;
    msg += `\n📊 Use /results ${marketId} to see live status`;

    return msg;
  }

  static agentError(agentId: string, error: string): string {
    return `⚠️ Agent ${agentId} failed: ${error}`;
  }

  static marketList(markets: MarketSummary[]): string {
    if (markets.length === 0) {
      return `📭 ${bold('No active markets yet.')}\n\nCreate one with /create`;
    }

    let msg = `📈 ${bold('Active Prediction Markets')}\n${line()}\n`;

    for (const m of markets) {
      const outcome = m.consensus ? outcomeEmoji(m.consensus) + ' ' + m.consensus : '⏳ analyzing';
      const deadline = new Date(m.deadlineMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      msg += `\n${bold(`#${m.id}`)} ${m.question.slice(0, 60)}${m.question.length > 60 ? '...' : ''}`;
      msg += `\n   Agents: ${outcome} | Deadline: ${deadline}`;
      msg += `\n   YES: ${formatUsdc(m.yesStake)} | NO: ${formatUsdc(m.noStake)} USDC`;
      msg += `\n`;
    }

    msg += `\n${line()}\nUse /results <id> for details | /bet <id> yes/no <amount> to bet`;
    return msg;
  }

  static betPrompt(marketId: number, question: string): string {
    return `
💰 ${bold(`Bet on Market #${marketId}`)}

${bold('Question:')} ${question}

Reply with your position:
/bet ${marketId} yes <amount>   🟢 Bet YES
/bet ${marketId} no <amount>    🔴 Bet NO

_Example: /bet ${marketId} yes 25 — bets 25 USDC on YES_
`.trim();
  }

  static betConfirmation(
    marketId: number,
    outcome: 'YES' | 'NO',
    amountUsdc: number,
    txHash: string
  ): string {
    return `
${outcomeEmoji(outcome)} ${bold('Bet Placed!')}

Market: ${bold(`#${marketId}`)}
Position: ${bold(outcome)}
Amount: ${bold(amountUsdc + ' USDC')}
Tx: ${code(shortenHash(txHash))}
🔗 ${`https://testnet.kitescan.ai/tx/${txHash}`}

Use /results ${marketId} to track your position.
`.trim();
  }

  static betError(reason: string): string {
    return `❌ ${bold('Bet failed:')} ${reason}`;
  }

  static insufficientBalance(have: string, need: string): string {
    return `
❌ ${bold('Insufficient USDC')}

You have: ${have} USDC
You need: ${need} USDC

Get testnet USDC at: https://faucet.gokite.ai/
`.trim();
  }

  static results(marketId: number, data: MarketResultData): string {
    const statusIcon = data.resolved ? (data.outcome ? '✅ YES won' : '❌ NO won') : '⏳ Active';
    const yesTotal = formatUsdc(data.totalYesStake);
    const noTotal = formatUsdc(data.totalNoStake);
    const grand = Number(data.totalYesStake + data.totalNoStake) / 1e6;
    const yesPct = grand > 0 ? ((Number(data.totalYesStake) / 1e6 / grand) * 100).toFixed(1) : '50.0';
    const noPct = grand > 0 ? ((Number(data.totalNoStake) / 1e6 / grand) * 100).toFixed(1) : '50.0';

    let msg = `
📊 ${bold(`Market #${marketId} Results`)}

📋 ${bold('Question:')} ${data.question}
🏁 ${bold('Status:')} ${statusIcon}
📅 Deadline: ${new Date(data.deadlineMs).toLocaleString()}
${line()}
🟢 YES: ${bold(yesTotal + ' USDC')} (${yesPct}%) | ${data.predictionCount} bets
🔴 NO:  ${bold(noTotal + ' USDC')} (${noPct}%)
💰 Total pool: ${bold(grand.toLocaleString() + ' USDC')}
${line()}`.trim();

    if (data.agentPredictions.length > 0) {
      msg += `\n\n🤖 ${bold('Agent Predictions:')}`;
      for (const p of data.agentPredictions) {
        if (!p.skipped) {
          msg += `\n${outcomeEmoji(p.prediction.outcome)} ${p.agentId}: ${p.prediction.outcome} @ ${p.prediction.confidence}% | ${formatUsdc(p.stakeAmount)} USDC`;
        }
      }
    }

    if (!data.resolved) {
      msg += `\n\n💡 /bet ${marketId} yes 50 — place your prediction`;
    }

    return msg;
  }

  static marketResolved(marketId: number, outcome: 'YES' | 'NO', settleTxHash: string): string {
    return `
🏁 ${bold(`Market #${marketId} Settled!`)}

Result: ${outcomeEmoji(outcome)} ${bold(outcome + ' wins')}
Settlement tx: ${code(shortenHash(settleTxHash))}

Winners have been paid in USDC on Kite Chain.
Use /results ${marketId} to see final breakdown.
`.trim();
  }

  static agentStats(stats: AgentStatEntry[]): string {
    if (stats.length === 0) {
      return `📭 No agent activity yet. Create a market with /create`;
    }

    let msg = `🏆 ${bold('Agent Performance Leaderboard')}\n${line()}\n`;

    stats.sort((a, b) => b.accuracy - a.accuracy);

    for (let i = 0; i < stats.length; i++) {
      const medal = ['🥇', '🥈', '🥉'][i] ?? '  ';
      const s = stats[i];
      msg += `\n${medal} ${bold(s.agentId)} [${s.agentType}]`;
      msg += `\n   Accuracy: ${s.accuracy.toFixed(1)}% | Markets: ${s.marketsAnalyzed}`;
      msg += `\n   Total staked: ${formatUsdc(s.totalStaked)} USDC | Won: ${formatUsdc(s.totalWon)} USDC`;
      msg += `\n`;
    }

    return msg.trim();
  }

  static error(message: string): string {
    return `❌ ${bold('Error:')} ${message}\n\nUse /help for available commands.`;
  }

  static noWallet(): string {
    return `
⚠️ ${bold('No wallet registered')}

To place bets you need to register a wallet:
/wallet <your_private_key>

⚠️ Only use a testnet key funded from https://faucet.gokite.ai/
`.trim();
  }

  static walletRegistered(address: string, usdcBalance: string): string {
    return `
✅ ${bold('Wallet Registered')}

Address: ${code(address)}
USDC Balance: ${bold(usdcBalance + ' USDC')}

You can now use /bet to place predictions!
`.trim();
  }

  static rateLimited(): string {
    return `⏱ You've reached the max 10 bets per day. Try again tomorrow.`;
  }

  static timeout(): string {
    return `⏱ Agent analysis timed out. Please try again — the network may be congested.`;
  }
}

// ─── Supporting Types ─────────────────────────────────────────────────────────

export interface MarketSummary {
  id: number;
  question: string;
  deadlineMs: number;
  yesStake: bigint;
  noStake: bigint;
  consensus?: 'YES' | 'NO';
  resolved: boolean;
}

export interface MarketResultData {
  question: string;
  deadlineMs: number;
  resolved: boolean;
  outcome?: boolean;
  totalYesStake: bigint;
  totalNoStake: bigint;
  predictionCount: number;
  agentPredictions: AgentPrediction[];
}

export interface AgentStatEntry {
  agentId: string;
  agentType: string;
  marketsAnalyzed: number;
  accuracy: number;
  totalStaked: bigint;
  totalWon: bigint;
}
