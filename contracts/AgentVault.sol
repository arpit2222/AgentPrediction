// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title AgentVault
 * @notice Fund management vault for autonomous agents.
 *         Each agent has an assigned wallet with configurable per-transaction
 *         and daily spending limits. All actions are emitted for on-chain
 *         attestation and indexed by Goldsky.
 *
 *         Designed to mirror the Kite AA ClientAgentVault pattern:
 *         agents call spendFunds() which enforces limits, then transfers USDC.
 */
contract AgentVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Types ───────────────────────────────────────────────────────────────

    struct AgentConfig {
        bool registered;
        uint256 maxPerTx;           // max USDC per single transaction
        uint256 dailyLimit;         // max USDC per 24-hour rolling window
        uint256 dailySpent;
        uint256 dailyWindowStart;   // timestamp when current window began
        uint256 totalSpent;
        uint256 txCount;
    }

    struct SpendRecord {
        address agent;
        address recipient;
        uint256 amount;
        string reason;              // e.g. "market_prediction:42:YES"
        uint256 timestamp;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    IERC20 public immutable usdc;

    mapping(address => AgentConfig) public agentConfigs;
    address[] public registeredAgents;

    SpendRecord[] public spendHistory;
    mapping(address => uint256[]) public agentSpendIndices;

    uint256 public constant DAILY_WINDOW = 1 days;

    // ─── Events ──────────────────────────────────────────────────────────────

    event AgentRegistered(
        address indexed agent,
        uint256 maxPerTx,
        uint256 dailyLimit
    );
    event AgentLimitsUpdated(
        address indexed agent,
        uint256 maxPerTx,
        uint256 dailyLimit
    );
    event AgentRemoved(address indexed agent);
    event FundsSpent(
        address indexed agent,
        address indexed recipient,
        uint256 amount,
        string reason,
        uint256 indexed recordIndex
    );
    event FundsDeposited(address indexed depositor, uint256 amount);
    event FundsWithdrawn(address indexed recipient, uint256 amount);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error AgentNotRegistered();
    error AgentAlreadyRegistered();
    error ExceedsPerTxLimit();
    error ExceedsDailyLimit();
    error InsufficientVaultBalance();
    error ZeroAmount();
    error InvalidLimit();
    error UnauthorizedAgent();

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _usdc) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
    }

    // ─── Agent Management ────────────────────────────────────────────────────

    function registerAgent(
        address agent,
        uint256 maxPerTx,
        uint256 dailyLimit
    ) external onlyOwner {
        if (agentConfigs[agent].registered) revert AgentAlreadyRegistered();
        if (maxPerTx == 0 || dailyLimit == 0) revert InvalidLimit();
        if (maxPerTx > dailyLimit) revert InvalidLimit();

        agentConfigs[agent] = AgentConfig({
            registered: true,
            maxPerTx: maxPerTx,
            dailyLimit: dailyLimit,
            dailySpent: 0,
            dailyWindowStart: block.timestamp,
            totalSpent: 0,
            txCount: 0
        });
        registeredAgents.push(agent);

        emit AgentRegistered(agent, maxPerTx, dailyLimit);
    }

    function updateAgentLimits(
        address agent,
        uint256 maxPerTx,
        uint256 dailyLimit
    ) external onlyOwner {
        AgentConfig storage cfg = _getAgentConfig(agent);
        if (maxPerTx == 0 || dailyLimit == 0) revert InvalidLimit();
        if (maxPerTx > dailyLimit) revert InvalidLimit();

        cfg.maxPerTx = maxPerTx;
        cfg.dailyLimit = dailyLimit;

        emit AgentLimitsUpdated(agent, maxPerTx, dailyLimit);
    }

    function removeAgent(address agent) external onlyOwner {
        AgentConfig storage cfg = _getAgentConfig(agent);
        cfg.registered = false;
        emit AgentRemoved(agent);
    }

    // ─── Fund Operations ─────────────────────────────────────────────────────

    function deposit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit FundsDeposited(msg.sender, amount);
    }

    function withdraw(uint256 amount, address recipient) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        if (usdc.balanceOf(address(this)) < amount) revert InsufficientVaultBalance();
        usdc.safeTransfer(recipient, amount);
        emit FundsWithdrawn(recipient, amount);
    }

    /**
     * @notice Agent calls this to spend USDC from the vault.
     *         Enforces per-tx and daily limits; records attestation.
     * @param recipient  Where USDC goes (e.g. PredictionMarket contract)
     * @param amount     USDC amount (6 decimals)
     * @param reason     Human-readable tag for attestation indexing
     */
    function spendFunds(
        address recipient,
        uint256 amount,
        string calldata reason
    ) external nonReentrant returns (uint256 recordIndex) {
        if (amount == 0) revert ZeroAmount();

        AgentConfig storage cfg = agentConfigs[msg.sender];
        if (!cfg.registered) revert AgentNotRegistered();

        // Enforce per-tx limit
        if (amount > cfg.maxPerTx) revert ExceedsPerTxLimit();

        // Rolling daily window reset
        if (block.timestamp >= cfg.dailyWindowStart + DAILY_WINDOW) {
            cfg.dailySpent = 0;
            cfg.dailyWindowStart = block.timestamp;
        }

        // Enforce daily limit
        if (cfg.dailySpent + amount > cfg.dailyLimit) revert ExceedsDailyLimit();

        // Vault has enough
        if (usdc.balanceOf(address(this)) < amount) revert InsufficientVaultBalance();

        // Effects
        cfg.dailySpent += amount;
        cfg.totalSpent += amount;
        cfg.txCount++;

        recordIndex = spendHistory.length;
        spendHistory.push(SpendRecord({
            agent: msg.sender,
            recipient: recipient,
            amount: amount,
            reason: reason,
            timestamp: block.timestamp
        }));
        agentSpendIndices[msg.sender].push(recordIndex);

        // Interaction
        usdc.safeTransfer(recipient, amount);

        emit FundsSpent(msg.sender, recipient, amount, reason, recordIndex);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function getVaultBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function getAgentConfig(address agent) external view returns (AgentConfig memory) {
        return _getAgentConfig(agent);
    }

    function getAgentRemainingDailyBudget(address agent) external view returns (uint256) {
        AgentConfig storage cfg = _getAgentConfig(agent);
        if (block.timestamp >= cfg.dailyWindowStart + DAILY_WINDOW) return cfg.dailyLimit;
        if (cfg.dailyLimit <= cfg.dailySpent) return 0;
        return cfg.dailyLimit - cfg.dailySpent;
    }

    function getSpendRecord(uint256 index) external view returns (SpendRecord memory) {
        return spendHistory[index];
    }

    function getAgentSpendHistory(address agent) external view returns (SpendRecord[] memory) {
        uint256[] storage indices = agentSpendIndices[agent];
        uint256 len = indices.length;
        SpendRecord[] memory records = new SpendRecord[](len);
        for (uint256 i = 0; i < len; ) {
            records[i] = spendHistory[indices[i]];
            unchecked { ++i; }
        }
        return records;
    }

    function totalSpendRecords() external view returns (uint256) {
        return spendHistory.length;
    }

    function getAllAgents() external view returns (address[] memory) {
        return registeredAgents;
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _getAgentConfig(address agent) internal view returns (AgentConfig storage) {
        AgentConfig storage cfg = agentConfigs[agent];
        if (!cfg.registered) revert AgentNotRegistered();
        return cfg;
    }
}
