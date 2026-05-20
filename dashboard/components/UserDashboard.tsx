'use client';

import { useState } from 'react';
import { shortenAddress, explorerAddress, explorerTx } from '@/lib/kite';
import type { UserBet } from '@/lib/types';

const DEMO_BETS: UserBet[] = [
  { marketId: 1, question: 'Will Bitcoin exceed $100,000 by December 31?', outcome: 'YES', amountUsdc: 100, txHash: '0xabc123', timestamp: Date.now() - 3600_000, settled: false },
  { marketId: 4, question: 'Will DOGE reach $1.00 in 2026?', outcome: 'NO', amountUsdc: 50, txHash: '0xdef456', timestamp: Date.now() - 172800_000, settled: true, won: true, payout: 68.5 },
  { marketId: 2, question: 'Will ETH flip BTC in market cap?', outcome: 'NO', amountUsdc: 75, txHash: '0x789abc', timestamp: Date.now() - 7200_000, settled: false },
];

async function connectMetaMask(): Promise<string> {
  const win = window as unknown as { ethereum?: { request: (a: { method: string }) => Promise<string[]> } };
  if (!win.ethereum) throw new Error('no_metamask');
  const accounts = await win.ethereum.request({ method: 'eth_requestAccounts' });
  return accounts[0];
}

export default function UserDashboard() {
  const [walletAddress, setWalletAddress] = useState('');
  const [inputAddress, setInputAddress] = useState('');
  const [mmError, setMmError] = useState('');
  const bets = DEMO_BETS;

  const totalBets = bets.length;
  const settledBets = bets.filter((b) => b.settled);
  const wins = settledBets.filter((b) => b.won).length;
  const winRate = settledBets.length > 0 ? Math.round((wins / settledBets.length) * 100) : 0;
  const totalWon = bets.reduce((s, b) => s + (b.payout ?? 0), 0);
  const totalStaked = bets.reduce((s, b) => s + b.amountUsdc, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Wallet connection */}
      <div className="rounded-xl border border-gray-800 bg-surface-2 p-5">
        <h2 className="mb-4 font-semibold text-gray-300">Your Wallet</h2>
        {walletAddress ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/20 text-lg">
              🦊
            </div>
            <div>
              <a
                href={explorerAddress(walletAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-accent hover:underline"
              >
                {shortenAddress(walletAddress)}
              </a>
              <div className="text-xs text-gray-500">Kite Testnet</div>
            </div>
            <button
              onClick={() => setWalletAddress('')}
              className="ml-auto text-xs text-gray-500 hover:text-white"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={async () => {
                setMmError('');
                try {
                  const addr = await connectMetaMask();
                  setWalletAddress(addr);
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : '';
                  if (msg === 'no_metamask') setMmError('MetaMask not found — paste your address below.');
                  else setMmError('Connection rejected.');
                }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500/20 px-4 py-2.5 text-sm font-medium text-orange-400 hover:bg-orange-500/30 transition-colors"
            >
              🦊 Connect MetaMask
            </button>
            {mmError && <p className="text-xs text-yellow-400">{mmError}</p>}
            <div className="flex gap-2">
              <input
                value={inputAddress}
                onChange={(e) => setInputAddress(e.target.value)}
                placeholder="Or paste wallet address (0x...)"
                className="flex-1 rounded-lg border border-gray-700 bg-surface-3 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-accent focus:outline-none"
              />
              <button
                onClick={() => {
                  if (inputAddress.startsWith('0x') && inputAddress.length >= 40) {
                    setWalletAddress(inputAddress.trim());
                  }
                }}
                className="rounded-lg bg-accent/20 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/30 transition-colors"
              >
                View
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total Bets', value: totalBets, color: 'text-white' },
          { label: 'Win Rate', value: `${winRate}%`, color: winRate >= 50 ? 'text-yes' : 'text-no' },
          { label: 'Total Staked', value: `${totalStaked} USDC`, color: 'text-gray-300' },
          { label: 'Winnings', value: `+${totalWon.toFixed(2)} USDC`, color: 'text-yes' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-gray-800 bg-surface-2 p-4 text-center">
            <div className={`text-lg font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {/* Bet history */}
      <div className="rounded-xl border border-gray-800 bg-surface-2 overflow-hidden">
        <div className="border-b border-gray-800 px-4 py-3">
          <h2 className="font-semibold text-gray-300">My Bets</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-xs text-gray-500">
                <th className="px-4 py-3">Market</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Stake</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Payout</th>
              </tr>
            </thead>
            <tbody>
              {bets.map((bet, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-surface-3 transition-colors">
                  <td className="px-4 py-3">
                    <div className="max-w-[200px] truncate text-gray-300">{bet.question}</div>
                    <a
                      href={explorerTx(bet.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-accent hover:underline"
                    >
                      {bet.txHash.slice(0, 10)}…
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${bet.outcome === 'YES' ? 'bg-yes/20 text-yes' : 'bg-no/20 text-no'}`}>
                      {bet.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-300">{bet.amountUsdc} USDC</td>
                  <td className="px-4 py-3">
                    {!bet.settled ? (
                      <span className="text-xs text-yellow-400">⏳ Active</span>
                    ) : bet.won ? (
                      <span className="text-xs text-yes">✅ Won</span>
                    ) : (
                      <span className="text-xs text-no">❌ Lost</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {bet.settled && bet.won
                      ? <span className="text-yes">+{bet.payout?.toFixed(2)} USDC</span>
                      : bet.settled
                      ? <span className="text-gray-500">—</span>
                      : <span className="text-gray-500">Pending</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-xs text-gray-600">
        To place bets, use the Telegram bot: /bet &lt;marketId&gt; yes/no &lt;amount&gt;
      </p>
    </div>
  );
}
