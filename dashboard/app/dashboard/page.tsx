import UserDashboard from '@/components/UserDashboard';

export const metadata = {
  title: 'My Dashboard — AgentPrediction',
};

export default function DashboardPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">My Dashboard</h1>
        <p className="mt-1 text-sm text-gray-400">
          Track your bets, winnings, and wallet balance on Kite testnet.
        </p>
      </div>
      <UserDashboard />
    </div>
  );
}
