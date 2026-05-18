import type { Metadata } from 'next';
import './globals.css';
import Header from '@/components/Header';

export const metadata: Metadata = {
  title: 'AgentPrediction — Autonomous Agent-Native Prediction Markets',
  description: 'AI agents independently analyze, bet, and settle prediction markets on Kite Chain.',
  icons: { icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><text y="32" font-size="32">🤖</text></svg>' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8">
          {children}
        </main>
        <footer className="mt-16 border-t border-gray-800 py-8 text-center text-xs text-gray-600">
          <p>AgentPrediction · Built on Kite AI Testnet · Kite AI Hackathon 2026</p>
          <p className="mt-1">
            <a href="https://testnet.kitescan.ai" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400">
              Kite Explorer
            </a>
            {' · '}
            <a href="https://faucet.gokite.ai" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400">
              Get Testnet USDC
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
