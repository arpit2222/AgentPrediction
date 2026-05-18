import { ethers } from 'ethers';
import { getProvider, formatUsdc } from '../../../agent-framework/src/Blockchain/Signer';
import { ERC20_ABI } from '../../../agent-framework/src/Blockchain/ContractABIs';

export interface UserBet {
  marketId: number;
  outcome: 'YES' | 'NO';
  amountUsdc: number;
  txHash: string;
  timestamp: number;
}

export interface UserState {
  telegramId: string;
  privateKey?: string;
  walletAddress?: string;
  bets: UserBet[];
  dailyBetCount: number;
  dailyBetWindowStart: number;
}

const MAX_BETS_PER_DAY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const USDC_ADDRESS = process.env.USDC_ADDRESS || '0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63';

export class UserStateManager {
  private users = new Map<string, UserState>();

  // ── User Registration ──────────────────────────────────────────────────────

  registerWallet(telegramId: string, privateKey: string): string {
    if (!privateKey.startsWith('0x')) privateKey = '0x' + privateKey;

    let wallet: ethers.Wallet;
    try {
      wallet = new ethers.Wallet(privateKey);
    } catch {
      throw new Error('Invalid private key format');
    }

    const existing = this.users.get(telegramId) ?? this._newUser(telegramId);
    existing.privateKey = privateKey;
    existing.walletAddress = wallet.address;
    this.users.set(telegramId, existing);

    return wallet.address;
  }

  getUser(telegramId: string): UserState {
    if (!this.users.has(telegramId)) {
      this.users.set(telegramId, this._newUser(telegramId));
    }
    return this.users.get(telegramId)!;
  }

  hasWallet(telegramId: string): boolean {
    const user = this.users.get(telegramId);
    return !!(user?.privateKey && user?.walletAddress);
  }

  getWallet(telegramId: string): ethers.Wallet {
    const user = this.users.get(telegramId);
    if (!user?.privateKey) throw new Error('No wallet registered');
    return new ethers.Wallet(user.privateKey, getProvider());
  }

  // ── USDC Balance ───────────────────────────────────────────────────────────

  async getUsdcBalance(telegramId: string): Promise<bigint> {
    const user = this.users.get(telegramId);
    if (!user?.walletAddress) return 0n;

    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, getProvider());
    return usdc.balanceOf(user.walletAddress) as Promise<bigint>;
  }

  // ── Bet Tracking ───────────────────────────────────────────────────────────

  canBet(telegramId: string): boolean {
    const user = this.getUser(telegramId);
    this._resetDailyWindowIfNeeded(user);
    return user.dailyBetCount < MAX_BETS_PER_DAY;
  }

  recordBet(telegramId: string, bet: UserBet): void {
    const user = this.getUser(telegramId);
    this._resetDailyWindowIfNeeded(user);
    user.bets.push(bet);
    user.dailyBetCount++;
    this.users.set(telegramId, user);
  }

  getUserBets(telegramId: string): UserBet[] {
    return this.getUser(telegramId).bets;
  }

  getUserBetsForMarket(telegramId: string, marketId: number): UserBet[] {
    return this.getUser(telegramId).bets.filter((b) => b.marketId === marketId);
  }

  // ── Demo wallet fallback ───────────────────────────────────────────────────

  getDemoWallet(): ethers.Wallet | null {
    const demoKey = process.env.DEMO_USER_PRIVATE_KEY;
    if (!demoKey) return null;
    return new ethers.Wallet(demoKey, getProvider());
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private _newUser(telegramId: string): UserState {
    return {
      telegramId,
      bets: [],
      dailyBetCount: 0,
      dailyBetWindowStart: Date.now(),
    };
  }

  private _resetDailyWindowIfNeeded(user: UserState): void {
    if (Date.now() - user.dailyBetWindowStart >= DAY_MS) {
      user.dailyBetCount = 0;
      user.dailyBetWindowStart = Date.now();
    }
  }
}
