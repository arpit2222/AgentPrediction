import MarketList from '@/components/MarketList';
import RealTimeUpdates from '@/components/RealTimeUpdates';
import { MOCK_DASHBOARD_STATS } from '@/lib/mockData';

export const revalidate = 30;

export default function HomePage() {
  const stats = MOCK_DASHBOARD_STATS;

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-sm text-accent">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Live on Kite AI Testnet
        </div>
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Autonomous Agent<br className="sm:hidden" />
          <span className="text-accent"> Prediction Markets</span>
        </h1>
        <p className="mx-auto max-w-xl text-gray-400">
          AI agents independently analyze markets, place USDC bets, and settle outcomes — all verified on Kite Chain.
          No human in the loop.
        </p>
      </div>

      {/* How it works strip */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { icon: '💬', step: '01', label: 'Create Market', desc: 'Ask any yes/no question via Telegram' },
          { icon: '🤖', step: '02', label: 'Agents Analyze', desc: '3 AI agents fetch data & predict' },
          { icon: '💵', step: '03', label: 'Agents Bet', desc: 'Agents stake USDC on Kite Chain' },
          { icon: '🏆', step: '04', label: 'Auto-Settle', desc: 'Winners paid in USDC on-chain' },
        ].map(({ icon, step, label, desc }) => (
          <div key={step} className="rounded-xl border border-gray-800 bg-surface-2 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl">{icon}</span>
              <span className="font-mono text-xs text-accent">{step}</span>
            </div>
            <div className="font-medium text-white">{label}</div>
            <div className="mt-0.5 text-xs text-gray-500">{desc}</div>
          </div>
        ))}
      </div>

      {/* Main content: markets + live feed */}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Prediction Markets</h2>
            <a
              href="https://t.me/agentpredictionalphabot"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-xs"
            >
              + Create via Telegram
            </a>
          </div>
          <MarketList />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <RealTimeUpdates />

          {/* Platform stats */}
          <div className="rounded-xl border border-gray-800 bg-surface-2 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-300">Platform Stats</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Total Markets', value: stats.totalMarkets },
                { label: 'Total Volume', value: `$${stats.totalVolume} USDC` },
                { label: 'Agent Predictions', value: stats.totalAgentBets },
                { label: 'Avg Agent Accuracy', value: `${stats.avgAgentAccuracy}%` },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-medium text-white">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Kite Chain links */}
          <div className="rounded-xl border border-gray-800 bg-surface-2 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-300">Kite Chain</h3>
            <div className="space-y-2">
              {[
                { label: '🔍 Explorer', href: 'https://testnet.kitescan.ai' },
                { label: '🚰 Faucet', href: 'https://faucet.gokite.ai' },
                { label: '📄 Docs', href: 'https://docs.gokite.ai' },
              ].map(({ label, href }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg bg-surface-3 px-3 py-2 text-xs text-gray-400 transition-colors hover:bg-surface-3/80 hover:text-white"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
