# AgentPrediction

**Autonomous Agent-Native Prediction Markets on Kite AI**

> Built for the Kite AI Global Hackathon 2026 — Encode Club

AgentPrediction is a fully autonomous prediction market platform where AI agents don't just provide signals — they hold wallets, stake real funds, and compete on-chain. Every market is analyzed and bet on by three specialized AI agents with distinct personalities: a Technical Analyst, a Sentiment Reader, and a Balanced Strategist.

---

## What It Does

1. **User creates a market** via Telegram: `/create Will BTC > $100K by December 2026?`
2. **Three AI agents** independently analyze the question using live CoinGecko price data and NewsAPI sentiment
3. **Agents stake USDC on-chain** via the PredictionMarket smart contract on Kite AI Testnet
4. **Consensus is reached** via majority vote; the result is broadcast back to Telegram
5. **Market resolves** when the deadline passes; winners are paid out proportionally (minus 2% protocol fee)
6. **Dashboard** tracks all markets, agent performance stats, and historical accuracy in real time

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Kite AI Testnet                           │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ PredictionMarket│  │  AgentSkillLibrary│  │   AgentVault  │  │
│  │   (core logic)  │  │  (skill registry) │  │ (fund custody)│  │
│  └────────┬────────┘  └──────────────────┘  └───────────────┘  │
└───────────┼─────────────────────────────────────────────────────┘
            │ ethers.js v6
┌───────────┼─────────────────────────────────────────────────────┐
│           │         Agent Framework (TypeScript)                  │
│  ┌────────┴──────────────────────────────────────────────────┐  │
│  │               AgentOrchestrator                            │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐  │  │
│  │  │ Agent A      │ │ Agent B      │ │ Agent C          │  │  │
│  │  │ (Technical)  │ │ (Sentiment)  │ │ (Balanced)       │  │  │
│  │  └──────┬───────┘ └──────┬───────┘ └────────┬─────────┘  │  │
│  │         │                │                   │             │  │
│  │  ┌──────┴───────┐ ┌──────┴───────┐ ┌────────┴─────────┐  │  │
│  │  │ DataFetcher  │ │PredictionModel│ │  ActionLogger    │  │  │
│  │  │(CoinGecko +  │ │(weights-based │ │  (JSONL audit)   │  │  │
│  │  │  NewsAPI)    │ │  scoring)    │ │                  │  │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
            │
┌───────────┴───────────────────────────────────────────────────┐
│  Telegram Bot (Telegraf)    │    Dashboard (Next.js 14)        │
│  - /create, /status, /bet  │    - Live markets feed            │
│  - /wallet, /agents        │    - Agent performance charts     │
│  - Webhook (Vercel)        │    - Goldsky GraphQL integration  │
└───────────────────────────────────────────────────────────────┘
```

---

## Agent Personalities

| Agent | Type | Technical Weight | Sentiment Weight | Strategy |
|-------|------|-----------------|-----------------|----------|
| Agent A | Technical | 65% | 10% | MA crossovers, momentum, price proximity |
| Agent B | Sentiment | 25% | 55% | News score, article ratio, narrative trend |
| Agent C | Balanced | 40% | 30% | Equal mix of technical + sentiment + proximity |

Confidence formula: `|composite_score - 50| × 2` → range 1–99%

Stake sizing: linear scale from `baseStake` at `minConfidence` to `maxStake` at 99% confidence.

---

## Smart Contracts

| Contract | Purpose |
|----------|---------|
| `PredictionMarket.sol` | Create markets, place YES/NO bets, resolve, settle with 2% fee |
| `AgentSkillLibrary.sol` | On-chain registry of agent skill modules (low-level call dispatch) |
| `AgentVault.sol` | Custodial vault with per-tx and rolling 24h daily spend limits |
| `MockUSDC.sol` | 6-decimal test token with `faucet()` (10k USDC max per call) |

**Network:** Kite AI Testnet (Chain ID: 2368)
**RPC:** `https://rpc-testnet.gokite.ai/`

---

## Project Structure

```
AgentPrediction/
├── contracts/              # Solidity smart contracts
│   ├── PredictionMarket.sol
│   ├── AgentSkillLibrary.sol
│   ├── AgentVault.sol
│   └── mocks/MockUSDC.sol
├── scripts/
│   ├── deploy.js           # Hardhat deploy script
│   └── test.sh             # Full test suite runner
├── test/                   # Hardhat contract tests (44 tests)
├── agent-framework/        # TypeScript agent system
│   ├── src/
│   │   ├── Agent/          # DataFetcher, PredictionModel, AgentCore, ActionLogger
│   │   ├── Blockchain/     # KiteIntegration, Signer, ContractABIs
│   │   ├── Orchestration/  # AgentOrchestrator
│   │   └── types.ts
│   └── test/               # Jest tests (42 tests: unit + integration + E2E)
├── telegram-bot/           # Telegraf bot (webhook + polling)
│   ├── src/
│   │   ├── bot/            # TelegramBot.ts (8 commands)
│   │   ├── managers/       # UserStateManager, MarketManager
│   │   ├── messages/       # BotMessages.ts
│   │   └── api/            # webhookHandler.ts
│   └── api/telegram.ts     # Vercel serverless entry
├── dashboard/              # Next.js 14 App Router dashboard
│   ├── app/                # pages: /, /markets, /market/[id], /agents, /dashboard
│   ├── components/         # MarketCard, MarketDetail, AgentStats, RealTimeUpdates
│   └── lib/                # kite.ts (RPC), goldsky.ts (GraphQL), mockData.ts
├── hardhat.config.js
├── DEPLOYMENT_CHECKLIST.md
└── README.md
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- A Kite AI testnet wallet with KITE (gas) and USDC

### 1. Install & Compile Contracts

```bash
npm install
npm run compile
npm test              # runs 44 contract tests
```

### 2. Deploy to Kite Testnet

```bash
cp .env.example .env
# Add your PRIVATE_KEY and KITE_RPC_URL
npm run deploy:testnet
```

### 3. Run the Agent Framework

```bash
cd agent-framework
npm install
npm test              # runs 42 Jest tests

# Demo: analyze a question
npm start "Will ETH reach $5000 by end of 2026?"
```

### 4. Start the Telegram Bot (local)

```bash
cd telegram-bot
npm install
cp .env.example .env  # fill in TELEGRAM_BOT_TOKEN + contract addresses
npm run dev           # polling mode
```

### 5. Start the Dashboard

```bash
cd dashboard
npm install
npm run dev           # http://localhost:3000
```

---

## Environment Variables

### Root (`.env`)
```
PRIVATE_KEY=0x...           # deployer wallet
KITE_RPC_URL=https://rpc-testnet.gokite.ai/
```

### Agent Framework (`agent-framework/.env`)
```
KITE_RPC_URL=https://rpc-testnet.gokite.ai/
PREDICTION_MARKET_ADDRESS=0x...
AGENT_VAULT_ADDRESS=0x...
AGENT_A_PRIVATE_KEY=0x...
AGENT_B_PRIVATE_KEY=0x...
AGENT_C_PRIVATE_KEY=0x...
COINGECKO_API_KEY=           # optional, uses free tier if empty
NEWS_API_KEY=                # optional, disables sentiment if empty
```

### Telegram Bot (`telegram-bot/.env`)
```
TELEGRAM_BOT_TOKEN=...
BOT_WEBHOOK_URL=             # set for Vercel, empty for local polling
KITE_RPC_URL=https://rpc-testnet.gokite.ai/
PREDICTION_MARKET_ADDRESS=0x...
AGENT_VAULT_ADDRESS=0x...
AGENT_A_PRIVATE_KEY=0x...
AGENT_B_PRIVATE_KEY=0x...
AGENT_C_PRIVATE_KEY=0x...
```

### Dashboard (`dashboard/.env.local`)
```
NEXT_PUBLIC_RPC_URL=https://rpc-testnet.gokite.ai/
NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS=0x...
NEXT_PUBLIC_GOLDSKY_URL=     # optional Goldsky subgraph URL
```

---

## Running All Tests

```bash
./scripts/test.sh all
# or individual suites:
./scripts/test.sh contracts    # Hardhat tests
./scripts/test.sh unit         # Jest agent unit tests
./scripts/test.sh types        # TypeScript type checks
```

Expected output: **5/5 suites passed** (44 contract tests + 42 Jest tests)

---

## Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and quick guide |
| `/create <question>` | Create a prediction market, agents auto-bet |
| `/status <marketId>` | Check market status and agent positions |
| `/markets` | List last 5 active markets |
| `/bet <marketId> <YES\|NO> <amount>` | Place a manual user bet |
| `/wallet` | Show demo wallet address and balances |
| `/agents` | Show agent performance stats |
| `/help` | Full command reference |

---

## Dashboard Pages

| Route | Description |
|-------|-------------|
| `/` | Hero landing page with live stats ticker |
| `/markets` | All active prediction markets with filters |
| `/market/[id]` | Market detail with confidence ring, agent cards, live feed |
| `/agents` | Agent performance: accuracy trend + stake vs won charts |
| `/dashboard` | User portfolio: bets, winnings, wallet balance |

---

## Key Design Decisions

**Why three agents?** Diversity of opinion reduces systematic bias. A purely technical agent and a purely sentiment agent often disagree, which produces a more realistic market with competitive odds.

**Why USDC?** Stablecoin stakes remove volatility risk from the prediction itself. Agents bet $100–$500 USDC per market based on confidence.

**Why AgentVault?** On-chain daily spending limits prevent a buggy agent from draining its wallet. Every spend is recorded as an attestation for audit.

**Why JSONL logs?** `agent-actions.jsonl` gives a human-readable and machine-parseable audit trail of every agent decision without needing a database.

**Kite AI integration:** All transactions happen on Kite AI Testnet. Kite's EVM compatibility means standard ethers.js v6 works out of the box.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Kite AI Testnet (Chain ID 2368), Solidity 0.8.20, OpenZeppelin 5 |
| Dev tooling | Hardhat 2.22, ethers.js v6, viaIR optimizer |
| Agent framework | TypeScript 5, CoinGecko API, NewsAPI |
| Telegram bot | Telegraf v4, Express, Vercel serverless |
| Dashboard | Next.js 14 App Router, Tailwind CSS, Recharts, Apollo Client |
| Indexing | Goldsky subgraph (with mock fallback) |
| Testing | Hardhat/Chai (contracts), Jest + ts-jest (agents), 86 total tests |

---

## License

MIT
