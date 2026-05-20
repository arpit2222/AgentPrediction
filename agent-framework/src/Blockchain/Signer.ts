import { ethers } from 'ethers';

let _provider: ethers.JsonRpcProvider | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) {
    const rpcUrl = process.env.KITE_RPC_URL || 'https://rpc-testnet.gokite.ai/';
    const chainId = parseInt(process.env.KITE_CHAIN_ID || '2368', 10);
    _provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
  }
  return _provider;
}

export function getWallet(privateKey: string): ethers.Wallet {
  if (!privateKey.startsWith('0x')) privateKey = '0x' + privateKey;
  return new ethers.Wallet(privateKey, getProvider());
}

export function getWalletFromEnv(envKey: string): ethers.Wallet {
  const key = process.env[envKey];
  if (!key) throw new Error(`Missing env var: ${envKey}`);
  return getWallet(key);
}

// Kite testnet token (0x0fF539...) is 18-decimal USDT, not 6-decimal USDC
const TOKEN_DECIMALS = 18;

export function parseUsdc(amount: number): bigint {
  return ethers.parseUnits(amount.toString(), TOKEN_DECIMALS);
}

export function formatUsdc(amount: bigint): string {
  return ethers.formatUnits(amount, TOKEN_DECIMALS);
}
