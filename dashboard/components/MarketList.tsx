'use client';

import { useEffect, useState } from 'react';
import MarketCard from './MarketCard';
import { MOCK_MARKETS } from '@/lib/mockData';
import { fetchAllMarkets } from '@/lib/kite';
import type { Market } from '@/lib/types';

interface Props {
  initialMarkets?: Market[];
}

export default function MarketList({ initialMarkets }: Props) {
  const [markets, setMarkets] = useState<Market[]>(initialMarkets ?? MOCK_MARKETS);
  const [loading, setLoading] = useState(!initialMarkets);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('all');

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS) return;

    const load = async () => {
      const data = await fetchAllMarkets();
      if (data.length > 0) {
        setMarkets(data);
        setLastUpdated(Date.now());
      }
      setLoading(false);
    };

    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, []);

  const filtered = markets.filter((m) => {
    if (filter === 'active') return !m.resolved;
    if (filter === 'resolved') return m.resolved;
    return true;
  });

  const now = Math.floor(Date.now() / 1000);
  const activeCount = markets.filter((m) => !m.resolved && m.deadline > now).length;
  const resolvedCount = markets.filter((m) => m.resolved).length;
  const totalVolume = markets
    .reduce((s, m) => s + parseFloat(m.totalYesStake) + parseFloat(m.totalNoStake), 0)
    .toLocaleString('en-US', { maximumFractionDigits: 0 });

  return (
    <div>
      {/* Stats row */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: 'Active Markets', value: activeCount, color: 'text-yes' },
          { label: 'Resolved', value: resolvedCount, color: 'text-gray-300' },
          { label: 'Total Volume', value: `${totalVolume} USDC`, color: 'text-accent' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-gray-800 bg-surface-2 p-3 text-center">
            <div className={`text-lg font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
          {(['all', 'active', 'resolved'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-3 py-1 text-sm capitalize transition-colors ${
                filter === f ? 'bg-accent/20 text-accent' : 'text-gray-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-600">
          {loading ? '⟳ Loading...' : `Updated ${Math.round((Date.now() - lastUpdated) / 1000)}s ago`}
        </span>
      </div>

      {/* Market cards */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-800 p-12 text-center text-gray-500">
          <p className="text-2xl">📭</p>
          <p className="mt-2">No {filter === 'all' ? '' : filter} markets yet.</p>
          <p className="mt-1 text-sm">Create one via Telegram: /create Will BTC reach $100K?</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </div>
      )}
    </div>
  );
}
