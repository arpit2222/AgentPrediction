// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PredictionMarket
 * @notice Autonomous agent-native prediction market settling in USDC on Kite Chain
 */
contract PredictionMarket is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─── Types ───────────────────────────────────────────────────────────────

    struct Market {
        uint256 id;
        string question;
        uint256 deadline;
        bool resolved;
        bool outcome;           // true = YES won, false = NO won
        uint256 totalYesStake;
        uint256 totalNoStake;
        address resolver;       // agent or oracle that resolved this market
        uint256 createdAt;
    }

    struct Prediction {
        address predictor;
        uint256 marketId;
        bool position;          // true = YES, false = NO
        uint256 amount;
        bool settled;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    IERC20 public immutable usdc;

    uint256 public marketCount;
    uint256 public constant PROTOCOL_FEE_BPS = 200; // 2%
    uint256 public constant MIN_STAKE = 1e6;         // 1 USDC (6 decimals)

    mapping(uint256 => Market) public markets;
    mapping(uint256 => Prediction[]) public marketPredictions;
    mapping(uint256 => mapping(address => uint256)) public userYesStake;
    mapping(uint256 => mapping(address => uint256)) public userNoStake;
    mapping(address => bool) public authorizedAgents;

    address public feeRecipient;

    // ─── Events ──────────────────────────────────────────────────────────────

    event MarketCreated(
        uint256 indexed marketId,
        string question,
        uint256 deadline,
        address indexed creator
    );
    event PredictionMade(
        uint256 indexed marketId,
        address indexed predictor,
        bool position,
        uint256 amount
    );
    event MarketResolved(
        uint256 indexed marketId,
        bool outcome,
        address indexed resolver
    );
    event MarketSettled(
        uint256 indexed marketId,
        uint256 totalPayout,
        uint256 protocolFee
    );
    event Claimed(
        uint256 indexed marketId,
        address indexed winner,
        uint256 payout
    );
    event AgentAuthorized(address indexed agent, bool authorized);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error MarketNotFound();
    error MarketExpired();
    error MarketNotExpired();
    error MarketAlreadyResolved();
    error MarketNotResolved();
    error InsufficientStake();
    error UnauthorizedAgent();
    error ZeroAmount();
    error InvalidDeadline();
    error AlreadyClaimed();
    error NothingToClaim();

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _usdc, address _feeRecipient) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        feeRecipient = _feeRecipient;
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setAgentAuthorization(address agent, bool authorized) external onlyOwner {
        authorizedAgents[agent] = authorized;
        emit AgentAuthorized(agent, authorized);
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }

    // ─── Market Creation ─────────────────────────────────────────────────────

    function createMarket(
        string calldata question,
        uint256 deadline
    ) external returns (uint256 marketId) {
        if (deadline <= block.timestamp) revert InvalidDeadline();
        if (bytes(question).length == 0) revert MarketNotFound();

        marketId = ++marketCount;

        markets[marketId] = Market({
            id: marketId,
            question: question,
            deadline: deadline,
            resolved: false,
            outcome: false,
            totalYesStake: 0,
            totalNoStake: 0,
            resolver: address(0),
            createdAt: block.timestamp
        });

        emit MarketCreated(marketId, question, deadline, msg.sender);
    }

    // ─── Prediction Functions ─────────────────────────────────────────────────

    function predictYes(uint256 marketId, uint256 amount) external nonReentrant {
        _predict(marketId, true, amount);
    }

    function predictNo(uint256 marketId, uint256 amount) external nonReentrant {
        _predict(marketId, false, amount);
    }

    function _predict(uint256 marketId, bool position, uint256 amount) internal {
        if (amount < MIN_STAKE) revert InsufficientStake();
        Market storage market = _getActiveMarket(marketId);

        // Checks — done above
        // Effects
        if (position) {
            market.totalYesStake += amount;
            userYesStake[marketId][msg.sender] += amount;
        } else {
            market.totalNoStake += amount;
            userNoStake[marketId][msg.sender] += amount;
        }

        marketPredictions[marketId].push(Prediction({
            predictor: msg.sender,
            marketId: marketId,
            position: position,
            amount: amount,
            settled: false
        }));

        // Interactions
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit PredictionMade(marketId, msg.sender, position, amount);
    }

    // ─── Resolution ──────────────────────────────────────────────────────────

    function resolveMarket(uint256 marketId, bool outcome) external {
        if (!authorizedAgents[msg.sender] && msg.sender != owner()) revert UnauthorizedAgent();

        Market storage market = markets[marketId];
        if (market.id == 0) revert MarketNotFound();
        if (market.resolved) revert MarketAlreadyResolved();
        if (block.timestamp < market.deadline) revert MarketNotExpired();

        // Effects
        market.resolved = true;
        market.outcome = outcome;
        market.resolver = msg.sender;

        emit MarketResolved(marketId, outcome, msg.sender);
    }

    // ─── Settlement / Claim ──────────────────────────────────────────────────

    /**
     * @notice Settle all winners of a resolved market in a single call.
     *         Callable by anyone; intended to be called by an agent.
     */
    function settleMarket(uint256 marketId) external nonReentrant {
        Market storage market = markets[marketId];
        if (market.id == 0) revert MarketNotFound();
        if (!market.resolved) revert MarketNotResolved();

        uint256 totalStake = market.totalYesStake + market.totalNoStake;
        uint256 fee = (totalStake * PROTOCOL_FEE_BPS) / 10_000;
        uint256 distributable = totalStake - fee;

        uint256 winningSide = market.outcome ? market.totalYesStake : market.totalNoStake;

        Prediction[] storage predictions = marketPredictions[marketId];
        uint256 len = predictions.length;

        for (uint256 i = 0; i < len; ) {
            Prediction storage p = predictions[i];
            if (!p.settled && p.position == market.outcome && p.amount > 0) {
                p.settled = true;
                uint256 payout = (p.amount * distributable) / winningSide;
                if (payout > 0) {
                    usdc.safeTransfer(p.predictor, payout);
                    emit Claimed(marketId, p.predictor, payout);
                }
            }
            unchecked { ++i; }
        }

        if (fee > 0 && feeRecipient != address(0)) {
            usdc.safeTransfer(feeRecipient, fee);
        }

        emit MarketSettled(marketId, distributable, fee);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function getMarketStatus(uint256 marketId) external view returns (
        string memory question,
        uint256 deadline,
        bool resolved,
        bool outcome,
        uint256 totalYesStake,
        uint256 totalNoStake,
        uint256 predictionCount
    ) {
        Market storage m = markets[marketId];
        if (m.id == 0) revert MarketNotFound();
        return (
            m.question,
            m.deadline,
            m.resolved,
            m.outcome,
            m.totalYesStake,
            m.totalNoStake,
            marketPredictions[marketId].length
        );
    }

    function getPredictions(uint256 marketId) external view returns (Prediction[] memory) {
        return marketPredictions[marketId];
    }

    function getUserStakes(
        uint256 marketId,
        address user
    ) external view returns (uint256 yesStake, uint256 noStake) {
        return (userYesStake[marketId][user], userNoStake[marketId][user]);
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _getActiveMarket(uint256 marketId) internal view returns (Market storage) {
        Market storage m = markets[marketId];
        if (m.id == 0) revert MarketNotFound();
        if (m.resolved) revert MarketAlreadyResolved();
        if (block.timestamp >= m.deadline) revert MarketExpired();
        return m;
    }
}
