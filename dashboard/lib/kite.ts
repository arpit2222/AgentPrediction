import { ethers } from 'ethers';
import type { Market } from './types';

const RPC_URL = process.env.NEXT_PUBLIC_KITE_RPC_URL || 'https://rpc-testnet.gokite.ai/';
const MARKET_ADDRESS = process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS || '';

const MARKET_ABI = [
  'function marketCount() view returns (uint256)',
  'function getMarketStatus(uint256 marketId) view returns (string question, uint256 deadline, bool resolved, bool outcome, uint256 totalYesStake, uint256 totalNoStake, uint256 predictionCount)',
  'function getPredictions(uint256 marketId) view returns (tuple(address predictor, uint256 marketId, bool position, uint256 amount, bool settled)[])',
];

function getProvider() {
  return new ethers.JsonRpcProvider(RPC_URL, 2368);
}

function fmtUsdc(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(4);
}

export async function fetchMarketCount(): Promise<number> {
  if (!MARKET_ADDRESS) return 0;
  const contract = new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, getProvider());
  const count = await contract.marketCount() as bigint;
  return Number(count);
}

export async function fetchMarket(id: number): Promise<Market | null> {
  if (!MARKET_ADDRESS) return null;
  const contract = new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, getProvider());

  try {
    const [question, deadline, resolved, outcome, yesStake, noStake, predCount] =
      await contract.getMarketStatus(id) as [string, bigint, boolean, boolean, bigint, bigint, bigint];

    return {
      id,
      question,
      deadline: Number(deadline),
      resolved,
      outcome,
      totalYesStake: fmtUsdc(yesStake),
      totalNoStake: fmtUsdc(noStake),
      predictionCount: Number(predCount),
      agentPredictions: [],
    };
  } catch {
    return null;
  }
}

export async function fetchAllMarkets(): Promise<Market[]> {
  const count = await fetchMarketCount();
  if (count === 0) return [];

  const ids = Array.from({ length: count }, (_, i) => i + 1);
  const results = await Promise.allSettled(ids.map(fetchMarket));

  return results
    .filter((r): r is PromiseFulfilledResult<Market> => r.status === 'fulfilled' && r.value !== null)
    .map((r) => r.value);
}

export function formatTimeRemaining(deadlineSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = deadlineSeconds - now;

  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function getMarketStatus(market: Market): 'active' | 'resolved' | 'expired' {
  if (market.resolved) return 'resolved';
  const now = Math.floor(Date.now() / 1000);
  if (market.deadline < now) return 'expired';
  return 'active';
}

export function yesPercent(market: Market): number {
  const yes = parseFloat(market.totalYesStake);
  const no = parseFloat(market.totalNoStake);
  const total = yes + no;
  return total === 0 ? 50 : Math.round((yes / total) * 100);
}

export function shortenAddress(addr: string): string {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';
}

export function explorerTx(hash: string): string {
  return `https://testnet.kitescan.ai/tx/${hash}`;
}

export function explorerAddress(addr: string): string {
  return `https://testnet.kitescan.ai/address/${addr}`;
}
