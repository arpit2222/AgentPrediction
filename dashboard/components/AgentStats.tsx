'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { MOCK_AGENT_STATS, MOCK_ACCURACY_TREND } from '@/lib/mockData';
import type { AgentStats } from '@/lib/types';

const AGENT_COLORS: Record<string, string> = {
  'agent-A': '#818cf8',
  'agent-B': '#22c55e',
  'agent-C': '#f59e0b',
};

function AccuracyBadge({ accuracy }: { accuracy: number }) {
  const color = accuracy >= 80 ? 'text-yes' : accuracy >= 65 ? 'text-yellow-400' : 'text-no';
  return <span className={`font-bold ${color}`}>{accuracy.toFixed(1)}%</span>;
}

function AgentRow({ stat, rank }: { stat: AgentStats; rank: number }) {
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <tr className="border-b border-gray-800 transition-colors hover:bg-surface-3">
      <td className="px-4 py-3 text-lg">{medals[rank] ?? String(rank + 1)}</td>
      <td className="px-4 py-3">
        <div className="font-medium text-white capitalize">{stat.agentId}</div>
        <div className="text-xs capitalize text-gray-500">{stat.agentType}</div>
      </td>
      <td className="px-4 py-3 text-center">
        <AccuracyBadge accuracy={stat.accuracy} />
      </td>
      <td className="px-4 py-3 text-center text-gray-300">{stat.marketsAnalyzed}</td>
      <td className="px-4 py-3 text-center text-gray-300">{stat.winRate}%</td>
      <td className="px-4 py-3 text-right">
        <div className="font-mono text-yes">+{parseFloat(stat.totalWon).toLocaleString()}</div>
        <div className="font-mono text-xs text-gray-500">{parseFloat(stat.totalStaked).toLocaleString()} staked</div>
      </td>
    </tr>
  );
}

export default function AgentStats({ stats = MOCK_AGENT_STATS }: { stats?: AgentStats[] }) {
  const sorted = [...stats].sort((a, b) => b.accuracy - a.accuracy);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        {sorted.map((s, i) => (
          <div
            key={s.agentId}
            className="rounded-xl border border-gray-800 bg-surface-2 p-4"
            style={{ borderTopColor: AGENT_COLORS[s.agentId] ?? '#818cf8', borderTopWidth: 2 }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium capitalize text-white">{s.agentId}</span>
              <span className="text-lg">{['🥇', '🥈', '🥉'][i] ?? ''}</span>
            </div>
            <div className="text-2xl font-bold" style={{ color: AGENT_COLORS[s.agentId] }}>
              {s.accuracy.toFixed(1)}%
            </div>
            <div className="mt-1 text-xs text-gray-500">Accuracy across {s.marketsAnalyzed} markets</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-surface-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs text-gray-500">
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3 text-center">Accuracy</th>
              <th className="px-4 py-3 text-center">Markets</th>
              <th className="px-4 py-3 text-center">Win Rate</th>
              <th className="px-4 py-3 text-right">Winnings (USDC)</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => <AgentRow key={s.agentId} stat={s} rank={i} />)}
          </tbody>
        </table>
      </div>

      {/* Accuracy trend chart */}
      <div className="rounded-xl border border-gray-800 bg-surface-2 p-5">
        <h2 className="mb-4 font-semibold text-gray-300">Accuracy Trend (Last 10 Markets)</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={MOCK_ACCURACY_TREND} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="market" tick={{ fill: '#6b7280', fontSize: 11 }} label={{ value: 'Market #', position: 'insideBottom', fill: '#4b5563', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} domain={[60, 100]} unit="%" />
              <Tooltip
                contentStyle={{ background: '#0e1117', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              {Object.entries(AGENT_COLORS).map(([key, color]) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Predictions per agent bar chart */}
      <div className="rounded-xl border border-gray-800 bg-surface-2 p-5">
        <h2 className="mb-4 font-semibold text-gray-300">Total USDC Staked per Agent</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sorted.map((s) => ({ name: s.agentId, Staked: parseFloat(s.totalStaked), Won: parseFloat(s.totalWon) }))}
              margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#0e1117', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Staked" fill="#374151" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Won" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
