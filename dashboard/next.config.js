/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_KITE_RPC_URL: process.env.NEXT_PUBLIC_KITE_RPC_URL,
    NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS: process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS,
    NEXT_PUBLIC_GOLDSKY_URL: process.env.NEXT_PUBLIC_GOLDSKY_URL,
    NEXT_PUBLIC_KITE_EXPLORER: 'https://testnet.kitescan.ai',
  },
};

module.exports = nextConfig;
