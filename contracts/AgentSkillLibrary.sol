// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AgentSkillLibrary
 * @notice On-chain registry and execution dispatcher for AI agent skills.
 *         Each "skill" is an external contract that agents can invoke.
 *         All executions are logged on-chain for full auditability.
 */
contract AgentSkillLibrary is Ownable, ReentrancyGuard {

    // ─── Types ───────────────────────────────────────────────────────────────

    struct Skill {
        string name;
        address implementation;
        bool active;
        uint256 executionCount;
        uint256 registeredAt;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    mapping(bytes32 => Skill) public skills;
    bytes32[] public skillKeys;

    mapping(address => bool) public authorizedCallers;

    // ─── Events ──────────────────────────────────────────────────────────────

    event SkillRegistered(
        bytes32 indexed skillId,
        string name,
        address indexed implementation,
        address indexed registeredBy
    );
    event SkillUpdated(
        bytes32 indexed skillId,
        address oldImplementation,
        address newImplementation
    );
    event SkillDeactivated(bytes32 indexed skillId, string name);
    event SkillExecuted(
        bytes32 indexed skillId,
        address indexed caller,
        bytes params,
        bytes result,
        uint256 timestamp
    );
    event CallerAuthorized(address indexed caller, bool authorized);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error SkillNotFound();
    error SkillInactive();
    error SkillAlreadyExists();
    error InvalidImplementation();
    error UnauthorizedCaller();
    error ExecutionFailed();
    error EmptySkillName();

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setCallerAuthorization(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
        emit CallerAuthorized(caller, authorized);
    }

    // ─── Skill Management ────────────────────────────────────────────────────

    function registerSkill(string calldata name, address implementation) external onlyOwner {
        if (bytes(name).length == 0) revert EmptySkillName();
        if (implementation == address(0)) revert InvalidImplementation();

        bytes32 skillId = _skillId(name);
        if (skills[skillId].implementation != address(0)) revert SkillAlreadyExists();

        skills[skillId] = Skill({
            name: name,
            implementation: implementation,
            active: true,
            executionCount: 0,
            registeredAt: block.timestamp
        });
        skillKeys.push(skillId);

        emit SkillRegistered(skillId, name, implementation, msg.sender);
    }

    function updateSkill(string calldata name, address newImplementation) external onlyOwner {
        if (newImplementation == address(0)) revert InvalidImplementation();
        bytes32 skillId = _skillId(name);
        Skill storage skill = _getSkill(skillId);

        address old = skill.implementation;
        skill.implementation = newImplementation;

        emit SkillUpdated(skillId, old, newImplementation);
    }

    function deactivateSkill(string calldata name) external onlyOwner {
        bytes32 skillId = _skillId(name);
        Skill storage skill = _getSkill(skillId);
        skill.active = false;
        emit SkillDeactivated(skillId, name);
    }

    // ─── Execution ───────────────────────────────────────────────────────────

    /**
     * @notice Execute a registered skill with arbitrary params.
     *         Only authorized agents/callers can invoke this.
     * @param name Skill name (e.g. "price_analysis", "sentiment_check")
     * @param params ABI-encoded parameters passed to the skill implementation
     * @return result ABI-encoded return value from the skill
     */
    function executeSkill(
        string calldata name,
        bytes calldata params
    ) external nonReentrant returns (bytes memory result) {
        if (!authorizedCallers[msg.sender] && msg.sender != owner()) revert UnauthorizedCaller();

        bytes32 skillId = _skillId(name);
        Skill storage skill = _getSkill(skillId);
        if (!skill.active) revert SkillInactive();

        skill.executionCount++;

        // Low-level call to skill implementation
        bool success;
        (success, result) = skill.implementation.call(params);
        if (!success) revert ExecutionFailed();

        emit SkillExecuted(skillId, msg.sender, params, result, block.timestamp);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function getSkill(string calldata name) external view returns (Skill memory) {
        return _getSkill(_skillId(name));
    }

    function getSkillById(bytes32 skillId) external view returns (Skill memory) {
        return _getSkill(skillId);
    }

    function getAllSkills() external view returns (Skill[] memory result) {
        uint256 len = skillKeys.length;
        result = new Skill[](len);
        for (uint256 i = 0; i < len; ) {
            result[i] = skills[skillKeys[i]];
            unchecked { ++i; }
        }
    }

    function skillExists(string calldata name) external view returns (bool) {
        return skills[_skillId(name)].implementation != address(0);
    }

    function totalSkills() external view returns (uint256) {
        return skillKeys.length;
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _skillId(string memory name) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(name));
    }

    function _getSkill(bytes32 skillId) internal view returns (Skill storage) {
        Skill storage skill = skills[skillId];
        if (skill.implementation == address(0)) revert SkillNotFound();
        return skill;
    }
}
