// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Mock USDC with 6 decimals for local testing
contract MockUSDC is ERC20, Ownable {
    constructor() ERC20("Mock USD Coin", "USDC") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function faucet(uint256 amount) external {
        require(amount <= 10_000 * 1e6, "max 10k per call");
        _mint(msg.sender, amount);
    }
}
