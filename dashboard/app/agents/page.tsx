import AgentStats from '@/components/AgentStats';
import { MOCK_AGENT_STATS } from '@/lib/mockData';

export const metadata = {
  title: 'Agent Performance — AgentPrediction',
};

export default function AgentsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Agent Performance</h1>
        <p className="mt-1 text-gray-400 text-sm">
          Track how each AI agent performs across prediction markets. All bets are executed autonomously on Kite Chain.
        </p>
      </div>

      {/* Agent type explanations */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            id: 'agent-A',
            icon: '📈',
            name: 'Technical Agent',
            desc: 'Focuses on moving averages, momentum, and price trend analysis. Weight: 65% technical, 10% sentiment.',
          },
          {
            id: 'agent-B',
            icon: '📰',
            name: 'Sentiment Agent',
            desc: 'Prioritizes news sentiment, social signals, and market narrative. Weight: 55% sentiment, 25% technical.',
          },
          {
            id: 'agent-C',
            icon: '⚖️',
            name: 'Balanced Agent',
            desc: 'Evenly weighs technical analysis, sentiment, and price proximity to target. Most diversified.',
          },
        ].map(({ id, icon, name, desc }) => (
          <div key={id} className="rounded-xl border border-gray-800 bg-surface-2 p-4">
            <div className="mb-2 text-2xl">{icon}</div>
            <div className="font-medium text-white">{name}</div>
            <div className="mt-1 text-xs text-gray-500">{desc}</div>
          </div>
        ))}
      </div>

      <AgentStats stats={MOCK_AGENT_STATS} />
    </div>
  );
}
