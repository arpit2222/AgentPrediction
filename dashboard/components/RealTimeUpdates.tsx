'use client';

import { useEffect, useState } from 'react';
import { fetchAllMarkets } from '@/lib/kite';
import type { Market } from '@/lib/types';

interface UpdateEvent {
  marketId: number;
  type: 'new_bet' | 'market_created' | 'market_resolved';
  message: string;
  timestamp: number;
}

interface Props {
  onMarketsUpdate?: (markets: Market[]) => void;
  pollInterval?: number;
}

export default function RealTimeUpdates({ onMarketsUpdate, pollInterval = 10_000 }: Props) {
  const [events, setEvents] = useState<UpdateEvent[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [prevVolumes, setPrevVolumes] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS) return;

    const poll = async () => {
      setIsPolling(true);
      try {
        const markets = await fetchAllMarkets();
        onMarketsUpdate?.(markets);

        // Detect volume changes → generate feed events
        const newEvents: UpdateEvent[] = [];
        const newVolumes: Record<number, number> = {};

        for (const m of markets) {
          const total = parseFloat(m.totalYesStake) + parseFloat(m.totalNoStake);
          newVolumes[m.id] = total;

          if (prevVolumes[m.id] !== undefined && total > prevVolumes[m.id]) {
            const delta = (total - prevVolumes[m.id]).toFixed(2);
            newEvents.push({
              marketId: m.id,
              type: 'new_bet',
              message: `+${delta} USDC bet on #${m.id}: ${m.question.slice(0, 40)}…`,
              timestamp: Date.now(),
            });
          }
          if (!(m.id in prevVolumes)) {
            newEvents.push({
              marketId: m.id,
              type: 'market_created',
              message: `New market #${m.id}: ${m.question.slice(0, 40)}…`,
              timestamp: Date.now(),
            });
          }
          if (m.resolved && prevVolumes[m.id] !== undefined) {
            newEvents.push({
              marketId: m.id,
              type: 'market_resolved',
              message: `Market #${m.id} resolved → ${m.outcome ? 'YES' : 'NO'} wins!`,
              timestamp: Date.now(),
            });
          }
        }

        setPrevVolumes(newVolumes);
        if (newEvents.length > 0) {
          setEvents((prev) => [...newEvents, ...prev].slice(0, 20));
        }
        setLastSync(new Date());
      } finally {
        setIsPolling(false);
      }
    };

    poll();
    const id = setInterval(poll, pollInterval);
    return () => clearInterval(id);
  }, [pollInterval]); // eslint-disable-line react-hooks/exhaustive-deps

  const typeIcon = (type: UpdateEvent['type']) => {
    if (type === 'new_bet') return '💰';
    if (type === 'market_created') return '🆕';
    return '🏁';
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">
          Live Activity
          {isPolling && (
            <span className="ml-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-yes" />
          )}
        </h3>
        {lastSync && (
          <span className="text-xs text-gray-600">
            Synced {lastSync.toLocaleTimeString()}
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="py-4 text-center text-xs text-gray-600">
          {process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS
            ? 'Waiting for on-chain activity…'
            : '⚠️ Contract address not configured — connect to Kite testnet'}
        </div>
      ) : (
        <ul className="space-y-2">
          {events.map((e, i) => (
            <li
              key={i}
              className={`flex items-start gap-2 text-xs animate-fade-in ${
                e.type === 'market_resolved' ? 'text-accent' : 'text-gray-400'
              }`}
            >
              <span className="mt-0.5 shrink-0">{typeIcon(e.type)}</span>
              <span>{e.message}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 border-t border-gray-800 pt-3 text-xs text-gray-600">
        Polling every {pollInterval / 1000}s · Kite testnet
      </div>
    </div>
  );
}
