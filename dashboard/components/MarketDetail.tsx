'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import CountdownTimer from './CountdownTimer';
import StakeBar from './StakeBar';
import { fetchMarket, explorerTx } from '@/lib/kite';
import { MOCK_MARKETS } from '@/lib/mockData';
import type { Market, AgentPrediction } from '@/lib/types';

const AGENT_COLORS: Record<string, string> = {
  'agent-A': 'border-blue-500/40 bg-blue-500/5',
  'agent-B': 'border-purple-500/40 bg-purple-500/5',
  'agent-C': 'border-accent/40 bg-accent/5',
};
const AGENT_ICONS: Record<string, string> = {
  technical: '📈',
  sentiment: '📰',
  balanced: '⚖️',
};

function ConfidenceRing({ confidence, outcome }: { confidence: number; outcome: 'YES' | 'NO' }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const stroke = circ * (confidence / 100);
  const color = outcome === 'YES' ? '#22c55e' : '#ef4444';

  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      <svg width="64" height="64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#1f2937" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={`${stroke} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-xs font-bold" style={{ color }}>{confidence}%</div>
        <div className="text-[10px] text-gray-400">{outcome}</div>
      </div>
    </div>
  );
}

function AgentCard({ prediction }: { prediction: AgentPrediction }) {
  const borderClass = AGENT_COLORS[prediction.agentId] ?? 'border-gray-700 bg-gray-800/20';
  const icon = AGENT_ICONS[prediction.agentType] ?? '🤖';

  return (
    <div className={`rounded-xl border p-4 ${borderClass}`}>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span>{icon}</span>
            <span className="font-semibold capitalize text-white">{prediction.agentId}</span>
          </div>
          <span className="text-xs capitalize text-gray-500">{prediction.agentType} analysis</span>
        </div>
        <ConfidenceRing confidence={prediction.confidence} outcome={prediction.outcome} />
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">Stake</span>
          <span className="font-mono text-white">{parseFloat(prediction.stakeAmount).toLocaleString()} USDC</span>
        </div>
        {prediction.txHash && (
          <div className="flex justify-between">
            <span className="text-gray-400">Tx</span>
            <a
              href={explorerTx(prediction.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-accent hover:underline"
            >
              {prediction.txHash.slice(0, 8)}…
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MarketDetail({ id }: { id: number }) {
  const fallback = MOCK_MARKETS.find((m) => m.id === id);
  const [market, setMarket] = useState<Market | null>(fallback ?? null);
  const [loading, setLoading] = useState(!fallback);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS) return;

    const load = async () => {
      const data = await fetchMarket(id);
      if (data) setMarket(data);
      setLoading(false);
    };
    load();
    const timer = setInterval(load, 10_000);
    return () => clearInterval(timer);
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-500">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!market) {
    return (
      <div className="rounded-xl border border-red-800/40 bg-red-900/10 p-8 text-center text-red-400">
        Market #{id} not found.{' '}
        <Link href="/" className="underline">Back to markets</Link>
      </div>
    );
  }

  const yes = parseFloat(market.totalYesStake) || 0;
  const no = parseFloat(market.totalNoStake) || 0;
  const total = yes + no;

  const activeAgents = market.agentPredictions;
  const yesAgents = activeAgents.filter((p) => p.outcome === 'YES').length;
  const consensus = activeAgents.length > 0
    ? { outcome: yesAgents >= activeAgents.length / 2 ? 'YES' : 'NO' as 'YES' | 'NO',
        confidence: Math.round(activeAgents.reduce((s, p) => s + p.confidence, 0) / activeAgents.length) }
    : null;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Back */}
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white">
        ← All Markets
      </Link>

      {/* Market header */}
      <div className="rounded-xl border border-gray-800 bg-surface-2 p-6">
        <div className="mb-4 flex flex-wrap items-start gap-3">
          <span className="font-mono text-xs text-accent">#{market.id}</span>
          {market.resolved ? (
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${market.outcome ? 'bg-yes/20 text-yes' : 'bg-no/20 text-no'}`}>
              {market.outcome ? '✅ YES Won' : '❌ NO Won'}
            </span>
          ) : (
            <span className="rounded bg-green-400/10 px-2 py-0.5 text-xs font-medium text-green-400">Active</span>
          )}
        </div>

        <h1 className="mb-4 text-xl font-bold leading-snug text-white">{market.question}</h1>

        <div className="flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-gray-500">Deadline</span>
            <div className="font-medium text-white">
              <CountdownTimer deadlineSeconds={market.deadline} />
            </div>
          </div>
          <div>
            <span className="text-gray-500">Total Pool</span>
            <div className="font-medium text-white">{total.toLocaleString()} USDC</div>
          </div>
          <div>
            <span className="text-gray-500">Predictions</span>
            <div className="font-medium text-white">{market.predictionCount}</div>
          </div>
        </div>
      </div>

      {/* Two-column: Stakes + Consensus */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Stakes */}
        <div className="rounded-xl border border-gray-800 bg-surface-2 p-5">
          <h2 className="mb-4 font-semibold text-gray-300">💰 Market Stakes</h2>
          <StakeBar yesAmount={market.totalYesStake} noAmount={market.totalNoStake} className="mb-4" />
          <div className="space-y-2">
            {[
              { label: 'YES pool', amount: yes, color: 'text-yes' },
              { label: 'NO pool', amount: no, color: 'text-no' },
            ].map(({ label, amount, color }) => (
              <div key={label} className="flex justify-between rounded-lg bg-surface-3 px-3 py-2 text-sm">
                <span className={color}>{label}</span>
                <span className="font-mono text-white">{amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} USDC</span>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Consensus */}
        <div className="rounded-xl border border-gray-800 bg-surface-2 p-5">
          <h2 className="mb-4 font-semibold text-gray-300">🤖 Agent Consensus</h2>
          {consensus ? (
            <>
              <div className={`mb-4 rounded-xl p-4 text-center ${consensus.outcome === 'YES' ? 'bg-yes/10' : 'bg-no/10'}`}>
                <div className={`text-3xl font-bold ${consensus.outcome === 'YES' ? 'text-yes' : 'text-no'}`}>
                  {consensus.confidence}% {consensus.outcome}
                </div>
                <div className="mt-1 text-sm text-gray-400">
                  {yesAgents}/{activeAgents.length} agents agree
                </div>
              </div>
              <div className="text-xs text-gray-500">
                {activeAgents.length} agents analyzed · {activeAgents.reduce((s, p) => s + parseFloat(p.stakeAmount), 0).toLocaleString()} USDC staked
              </div>
            </>
          ) : (
            <div className="py-6 text-center text-gray-500 text-sm">No agent predictions yet</div>
          )}
        </div>
      </div>

      {/* Agent prediction cards */}
      {activeAgents.length > 0 && (
        <div>
          <h2 className="mb-3 font-semibold text-gray-300">Individual Agent Predictions</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {activeAgents.map((p) => (
              <AgentCard key={p.agentId} prediction={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
