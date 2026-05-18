// Minimal ABI fragments — only what the agent framework needs to call.
// Full ABIs are in /artifacts after Hardhat compile.

export const PREDICTION_MARKET_ABI = [
  // Read
  'function marketCount() view returns (uint256)',
  'function getMarketStatus(uint256 marketId) view returns (string question, uint256 deadline, bool resolved, bool outcome, uint256 totalYesStake, uint256 totalNoStake, uint256 predictionCount)',
  'function getUserStakes(uint256 marketId, address user) view returns (uint256 yesStake, uint256 noStake)',
  'function authorizedAgents(address) view returns (bool)',
  // Write
  'function createMarket(string question, uint256 deadline) returns (uint256 marketId)',
  'function predictYes(uint256 marketId, uint256 amount)',
  'function predictNo(uint256 marketId, uint256 amount)',
  'function resolveMarket(uint256 marketId, bool outcome)',
  'function settleMarket(uint256 marketId)',
  // Events
  'event MarketCreated(uint256 indexed marketId, string question, uint256 deadline, address indexed creator)',
  'event PredictionMade(uint256 indexed marketId, address indexed predictor, bool position, uint256 amount)',
  'event MarketResolved(uint256 indexed marketId, bool outcome, address indexed resolver)',
  'event MarketSettled(uint256 indexed marketId, uint256 totalPayout, uint256 protocolFee)',
] as const;

export const AGENT_VAULT_ABI = [
  'function deposit(uint256 amount)',
  'function spendFunds(address recipient, uint256 amount, string reason) returns (uint256 recordIndex)',
  'function getVaultBalance() view returns (uint256)',
  'function getAgentRemainingDailyBudget(address agent) view returns (uint256)',
  'function getAgentConfig(address agent) view returns (tuple(bool registered, uint256 maxPerTx, uint256 dailyLimit, uint256 dailySpent, uint256 dailyWindowStart, uint256 totalSpent, uint256 txCount))',
  'event FundsSpent(address indexed agent, address indexed recipient, uint256 amount, string reason, uint256 indexed recordIndex)',
] as const;

export const SKILL_LIBRARY_ABI = [
  'function registerSkill(string name, address implementation)',
  'function executeSkill(string name, bytes params) returns (bytes result)',
  'function skillExists(string name) view returns (bool)',
  'function getSkill(string name) view returns (tuple(string name, address implementation, bool active, uint256 executionCount, uint256 registeredAt))',
  'event SkillExecuted(bytes32 indexed skillId, address indexed caller, bytes params, bytes result, uint256 timestamp)',
] as const;

export const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
] as const;
