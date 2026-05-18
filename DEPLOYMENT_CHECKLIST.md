# AgentPrediction — Deployment Checklist

## 1. Prerequisites

- [ ] Node.js 20+ installed
- [ ] Git configured
- [ ] Kite AI testnet wallet funded (need KITE for gas + USDC for agent bets)
  - Get KITE testnet tokens from: https://faucet.gokite.ai/
  - Get testnet USDC: call `MockUSDC.faucet()` after deploying, or use the deploy script output

## 2. Environment Setup

```bash
# Root (contracts)
cp .env.example .env
# Fill in: PRIVATE_KEY, KITE_RPC_URL

# Agent Framework
cp agent-framework/.env.example agent-framework/.env
# Fill in: KITE_RPC_URL, PREDICTION_MARKET_ADDRESS, AGENT_VAULT_ADDRESS,
#          AGENT_A_PRIVATE_KEY, AGENT_B_PRIVATE_KEY, AGENT_C_PRIVATE_KEY,
#          COINGECKO_API_KEY (optional), NEWS_API_KEY (optional)

# Telegram Bot
cp telegram-bot/.env.example telegram-bot/.env
# Fill in: TELEGRAM_BOT_TOKEN, BOT_WEBHOOK_URL (for prod), all agent keys + contract addresses

# Dashboard
cp dashboard/.env.example dashboard/.env.local
# Fill in: NEXT_PUBLIC_RPC_URL, NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS,
#          NEXT_PUBLIC_GOLDSKY_URL (optional)
```

## 3. Smart Contract Deployment

```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run contract tests (must pass before deploying)
npm test

# Deploy to Kite testnet
npm run deploy:testnet
```

After deployment, copy the addresses printed to console into all `.env` files.

## 4. Agent Framework Setup

```bash
cd agent-framework
npm install
npm test           # all 42 tests should pass
npm run build      # TypeScript compile check
```

Fund each agent wallet with USDC:
- Each agent needs at least `baseStakeUsdc * 10` USDC for meaningful demo
- Call `MockUSDC.faucet()` for each agent address (max 10,000 USDC per call)
- Approve USDC allowance: call `USDC.approve(PREDICTION_MARKET_ADDRESS, MaxUint256)` from each agent wallet

## 5. Telegram Bot Deployment

**Local polling mode (development):**
```bash
cd telegram-bot
npm install
npm run dev
```

**Vercel production (webhook mode):**
```bash
cd telegram-bot
npx vercel --prod
# Copy the deployment URL, set BOT_WEBHOOK_URL=https://<your-deployment>.vercel.app
# Then run: npx ts-node src/setWebhook.ts
```

Required Vercel environment variables (set in Vercel dashboard):
- `TELEGRAM_BOT_TOKEN`
- `KITE_RPC_URL`
- `PREDICTION_MARKET_ADDRESS`
- `AGENT_VAULT_ADDRESS`
- `AGENT_A_PRIVATE_KEY`, `AGENT_B_PRIVATE_KEY`, `AGENT_C_PRIVATE_KEY`
- `BOT_WEBHOOK_URL`

## 6. Dashboard Deployment

```bash
cd dashboard
npm install
npm run build      # must succeed with 0 errors
npm run start      # local preview
```

**Vercel production:**
```bash
npx vercel --prod
```

Required Vercel environment variables:
- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS`
- `NEXT_PUBLIC_GOLDSKY_URL` (optional, falls back to mock data)

## 7. Post-Deployment Verification

- [ ] `/start` command works in Telegram bot
- [ ] `/create Will BTC reach $100K by end of 2026?` creates a market and all 3 agents bet
- [ ] Dashboard shows the newly created market at `/markets`
- [ ] Dashboard `/agents` page shows agent stats
- [ ] `/status <marketId>` returns current market data
- [ ] Smart contract `getMarketStatus(marketId)` returns correct data on-chain

## 8. Goldsky Subgraph (Optional)

```bash
# Install Goldsky CLI
npm install -g @goldsky/cli
goldsky login

# Deploy subgraph (requires goldsky.yaml in project root)
goldsky subgraph deploy agentprediction/v1 --from-abi artifacts/
```

Update `NEXT_PUBLIC_GOLDSKY_URL` in dashboard with the subgraph endpoint.

## 9. Final Checks

- [ ] All `.env` files are NOT committed to git (verify `.gitignore`)
- [ ] Contract addresses match across all services
- [ ] Agent private keys are different from deployer key
- [ ] AgentVault has registered all 3 agent addresses (`registerAgent()`)
- [ ] Gas balance sufficient on deployer + all agent wallets
- [ ] Test run passes: `./scripts/test.sh all`
