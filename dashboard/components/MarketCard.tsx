import Link from 'next/link';
import CountdownTimer from './CountdownTimer';
import StakeBar from './StakeBar';
import type { Market } from '@/lib/types';

interface Props {
  market: Market;
}

function statusBadge(market: Market) {
  if (market.resolved) {
    const winner = market.outcome ? 'YES' : 'NO';
    return (
      <span className={`rounded px-2 py-0.5 text-xs font-medium ${market.outcome ? 'bg-yes/20 text-yes' : 'bg-no/20 text-no'}`}>
        {winner} Won
      </span>
    );
  }
  const now = Math.floor(Date.now() / 1000);
  if (market.deadline < now) {
    return <span className="rounded bg-gray-700/60 px-2 py-0.5 text-xs text-gray-400">Expired</span>;
  }
  return <span className="rounded bg-green-400/10 px-2 py-0.5 text-xs text-green-400">Active</span>;
}

function agentConsensus(market: Market): { outcome: 'YES' | 'NO'; confidence: number } | null {
  const active = market.agentPredictions.filter((p) => p);
  if (active.length === 0) return null;
  const yes = active.filter((p) => p.outcome === 'YES').length;
  const outcome = yes >= active.length / 2 ? 'YES' : 'NO';
  const avgConf = Math.round(active.reduce((s, p) => s + p.confidence, 0) / active.length);
  return { outcome, confidence: avgConf };
}

export default function MarketCard({ market }: Props) {
  const consensus = agentConsensus(market);
  const yes = parseFloat(market.totalYesStake) || 0;
  const no = parseFloat(market.totalNoStake) || 0;
  const total = yes + no;

  return (
    <Link href={`/market/${market.id}`} className="block">
      <div className="group rounded-xl border border-gray-800 bg-surface-2 p-4 transition-all duration-200 hover:border-accent/40 hover:bg-surface-3 animate-fade-in">
        {/* Header row */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex-1">
            <span className="mb-1 inline-block font-mono text-xs text-accent">#{market.id}</span>
            <p className="text-sm font-medium leading-snug text-white group-hover:text-accent transition-colors">
              {market.question}
            </p>
          </div>
          {statusBadge(market)}
        </div>

        {/* Agent consensus */}
        {consensus && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">🤖 Agents:</span>
            <span className={`text-xs font-semibold ${consensus.outcome === 'YES' ? 'text-yes' : 'text-no'}`}>
              {consensus.confidence}% {consensus.outcome}
            </span>
          </div>
        )}

        {/* Stake bar */}
        <StakeBar
          yesAmount={market.totalYesStake}
          noAmount={market.totalNoStake}
          className="mb-3"
        />

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>💰 {total.toLocaleString()} USDC · {market.predictionCount} bets</span>
          {!market.resolved && <CountdownTimer deadlineSeconds={market.deadline} />}
        </div>
      </div>
    </Link>
  );
}
