'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: 'Markets' },
  { href: '/agents', label: 'Agents' },
  { href: '/dashboard', label: 'Dashboard' },
];

export default function Header() {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-800 bg-surface-1/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <span className="font-bold text-white">
            Agent<span className="text-accent">Prediction</span>
          </span>
          <span className="rounded bg-accent/20 px-1.5 py-0.5 text-xs text-accent">
            Kite Testnet
          </span>
        </Link>

        {/* Nav */}
        <nav className="hidden items-center gap-1 sm:flex">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                path === href
                  ? 'bg-accent/20 text-accent'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Telegram CTA */}
        <a
          href="https://t.me/agentpredictionalphabot"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-lg bg-blue-500/20 px-3 py-1.5 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/30"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/>
          </svg>
          Telegram Bot
        </a>
      </div>

      {/* Mobile nav */}
      <div className="flex gap-1 overflow-x-auto border-t border-gray-800 px-4 py-2 sm:hidden">
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`whitespace-nowrap rounded px-3 py-1 text-sm ${
              path === href ? 'bg-accent/20 text-accent' : 'text-gray-400'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
    </header>
  );
}
