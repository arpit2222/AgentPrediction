import { ethers } from 'ethers';
import { getProvider, parseUsdc, formatUsdc } from './Signer';
import {
  PREDICTION_MARKET_ABI,
  AGENT_VAULT_ABI,
  ERC20_ABI,
} from './ContractABIs';

export interface PlacePredictionArgs {
  marketId: number;
  outcome: 'YES' | 'NO';
  amount: bigint;
  reason: string;
}

export interface PlacePredictionResult {
  txHash: string;
  blockNumber: number;
  gasUsed: bigint;
}

export class KiteAgent {
  private wallet: ethers.Wallet;
  private marketContract: ethers.Contract;
  private usdcContract: ethers.Contract;
  private vaultContract: ethers.Contract | null = null;
  private marketAddress: string;
  private usdcAddress: string;

  constructor(wallet: ethers.Wallet) {
    this.wallet = wallet;
    this.marketAddress = process.env.PREDICTION_MARKET_ADDRESS || '';
    this.usdcAddress = process.env.USDC_ADDRESS || '0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63';

    if (!this.marketAddress) {
      throw new Error('PREDICTION_MARKET_ADDRESS not set in environment');
    }

    this.marketContract = new ethers.Contract(
      this.marketAddress,
      PREDICTION_MARKET_ABI,
      this.wallet
    );
    this.usdcContract = new ethers.Contract(
      this.usdcAddress,
      ERC20_ABI,
      this.wallet
    );

    const vaultAddress = process.env.AGENT_VAULT_ADDRESS;
    if (vaultAddress) {
      this.vaultContract = new ethers.Contract(vaultAddress, AGENT_VAULT_ABI, this.wallet);
    }
  }

  // ── Identity ──────────────────────────────────────────────────────────────

  getAddress(): string {
    return this.wallet.address;
  }

  async getUsdcBalance(): Promise<bigint> {
    return this.usdcContract.balanceOf(this.wallet.address) as Promise<bigint>;
  }

  async getKiteBalance(): Promise<string> {
    const balance = await getProvider().getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  // ── Market Operations ─────────────────────────────────────────────────────

  async createMarket(question: string, deadlineSeconds: number): Promise<{ marketId: number; txHash: string }> {
    const deadline = Math.floor(Date.now() / 1000) + deadlineSeconds;
    const tx = await this.marketContract.createMarket(question, deadline);
    const receipt = await tx.wait();

    // Parse MarketCreated event for the returned marketId
    const iface = new ethers.Interface(PREDICTION_MARKET_ABI as unknown as string[]);
    let marketId = 0;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === 'MarketCreated') {
          marketId = Number(parsed.args.marketId);
        }
      } catch {}
    }

    return { marketId, txHash: receipt.hash };
  }

  async placePrediction(args: PlacePredictionArgs): Promise<PlacePredictionResult> {
    const { marketId, outcome, amount, reason: _reason } = args;

    // 1. Ensure USDC allowance
    await this._ensureAllowance(amount);

    // 2. Call predictYes / predictNo
    const fn = outcome === 'YES' ? 'predictYes' : 'predictNo';
    const tx = await this.marketContract[fn](marketId, amount);
    const receipt = await tx.wait();

    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
    };
  }

  async resolveMarket(marketId: number, outcome: boolean): Promise<string> {
    const tx = await this.marketContract.resolveMarket(marketId, outcome);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async settleMarket(marketId: number): Promise<string> {
    const tx = await this.marketContract.settleMarket(marketId);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async getMarketStatus(marketId: number) {
    const result = await this.marketContract.getMarketStatus(marketId);
    return {
      question: result[0] as string,
      deadline: Number(result[1]),
      resolved: result[2] as boolean,
      outcome: result[3] as boolean,
      totalYesStake: result[4] as bigint,
      totalNoStake: result[5] as bigint,
      predictionCount: Number(result[6]),
    };
  }

  // ── Vault Operations (optional) ───────────────────────────────────────────

  async spendVaultFunds(
    recipient: string,
    amount: bigint,
    reason: string
  ): Promise<string> {
    if (!this.vaultContract) throw new Error('AgentVault address not configured');
    const tx = await this.vaultContract.spendFunds(recipient, amount, reason);
    const receipt = await tx.wait();
    return receipt.hash;
  }

  async getVaultRemainingBudget(): Promise<bigint> {
    if (!this.vaultContract) return 0n;
    return this.vaultContract.getAgentRemainingDailyBudget(this.wallet.address) as Promise<bigint>;
  }

  // ── Allowance ─────────────────────────────────────────────────────────────

  private async _ensureAllowance(amount: bigint): Promise<void> {
    const current = await this.usdcContract.allowance(
      this.wallet.address,
      this.marketAddress
    ) as bigint;

    if (current >= amount) return;

    // Approve max to avoid repeated approvals
    const tx = await this.usdcContract.approve(this.marketAddress, ethers.MaxUint256);
    await tx.wait();
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  parseUsdc = parseUsdc;
  formatUsdc = formatUsdc;
}
