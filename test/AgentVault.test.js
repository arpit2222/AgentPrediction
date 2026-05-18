const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AgentVault", () => {
  let vault, usdc;
  let owner, agentA, agentB, recipient, other;

  const ONE_K = ethers.parseUnits("1000", 6);
  const TEN_K = ethers.parseUnits("10000", 6);
  const MAX_PER_TX = ethers.parseUnits("500", 6);
  const DAILY_LIMIT = ethers.parseUnits("2000", 6);

  beforeEach(async () => {
    [owner, agentA, agentB, recipient, other] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    const AgentVault = await ethers.getContractFactory("AgentVault");
    vault = await AgentVault.deploy(await usdc.getAddress());

    // Fund vault
    await usdc.mint(owner.address, TEN_K * 10n);
    await usdc.approve(await vault.getAddress(), ethers.MaxUint256);
    await vault.deposit(TEN_K);

    // Register agents
    await vault.registerAgent(agentA.address, MAX_PER_TX, DAILY_LIMIT);
    await vault.registerAgent(agentB.address, MAX_PER_TX, DAILY_LIMIT);
  });

  describe("registerAgent", () => {
    it("stores agent config correctly", async () => {
      const cfg = await vault.getAgentConfig(agentA.address);
      expect(cfg.registered).to.be.true;
      expect(cfg.maxPerTx).to.equal(MAX_PER_TX);
      expect(cfg.dailyLimit).to.equal(DAILY_LIMIT);
    });

    it("reverts duplicate registration", async () => {
      await expect(
        vault.registerAgent(agentA.address, MAX_PER_TX, DAILY_LIMIT)
      ).to.be.revertedWithCustomError(vault, "AgentAlreadyRegistered");
    });

    it("reverts if maxPerTx > dailyLimit", async () => {
      const signers = await ethers.getSigners();
      const newAgent = signers[5]; // not yet registered
      await expect(
        vault.registerAgent(newAgent.address, DAILY_LIMIT, MAX_PER_TX)
      ).to.be.revertedWithCustomError(vault, "InvalidLimit");
    });
  });

  describe("spendFunds", () => {
    it("transfers USDC and records attestation", async () => {
      const balBefore = await usdc.balanceOf(recipient.address);
      await vault.connect(agentA).spendFunds(recipient.address, MAX_PER_TX, "market_prediction:1:YES");
      const balAfter = await usdc.balanceOf(recipient.address);
      expect(balAfter - balBefore).to.equal(MAX_PER_TX);
    });

    it("emits FundsSpent with correct data", async () => {
      await expect(
        vault.connect(agentA).spendFunds(recipient.address, MAX_PER_TX, "test:reason")
      )
        .to.emit(vault, "FundsSpent")
        .withArgs(agentA.address, recipient.address, MAX_PER_TX, "test:reason", 0n);
    });

    it("reverts when exceeding per-tx limit", async () => {
      await expect(
        vault.connect(agentA).spendFunds(recipient.address, MAX_PER_TX + 1n, "over_limit")
      ).to.be.revertedWithCustomError(vault, "ExceedsPerTxLimit");
    });

    it("reverts when exceeding daily limit", async () => {
      // Spend up to daily limit (4 × 500 = 2000)
      for (let i = 0; i < 4; i++) {
        await vault.connect(agentA).spendFunds(recipient.address, MAX_PER_TX, `spend:${i}`);
      }
      // Use an amount <= maxPerTx but would exceed daily limit
      await expect(
        vault.connect(agentA).spendFunds(recipient.address, MAX_PER_TX, "over_daily")
      ).to.be.revertedWithCustomError(vault, "ExceedsDailyLimit");
    });

    it("resets daily limit after 24h", async () => {
      // Exhaust daily limit
      for (let i = 0; i < 4; i++) {
        await vault.connect(agentA).spendFunds(recipient.address, MAX_PER_TX, `s${i}`);
      }
      // Advance 1 day
      await time.increase(86401);
      // Should work again
      await expect(
        vault.connect(agentA).spendFunds(recipient.address, MAX_PER_TX, "after_reset")
      ).to.not.be.reverted;
    });

    it("reverts for unregistered agent", async () => {
      await expect(
        vault.connect(other).spendFunds(recipient.address, ONE_K, "bad")
      ).to.be.revertedWithCustomError(vault, "AgentNotRegistered");
    });
  });

  describe("getAgentRemainingDailyBudget", () => {
    it("returns full daily limit initially", async () => {
      expect(await vault.getAgentRemainingDailyBudget(agentA.address)).to.equal(DAILY_LIMIT);
    });

    it("decreases after spending", async () => {
      await vault.connect(agentA).spendFunds(recipient.address, MAX_PER_TX, "s1");
      const remaining = await vault.getAgentRemainingDailyBudget(agentA.address);
      expect(remaining).to.equal(DAILY_LIMIT - MAX_PER_TX);
    });
  });

  describe("deposit / withdraw", () => {
    it("owner can withdraw", async () => {
      const before = await usdc.balanceOf(owner.address);
      await vault.withdraw(ONE_K, owner.address);
      const after = await usdc.balanceOf(owner.address);
      expect(after - before).to.equal(ONE_K);
    });

    it("non-owner cannot withdraw", async () => {
      await expect(vault.connect(agentA).withdraw(ONE_K, agentA.address)).to.be.reverted;
    });
  });

  describe("spend history", () => {
    it("records all agent spend records", async () => {
      await vault.connect(agentA).spendFunds(recipient.address, MAX_PER_TX, "r1");
      await vault.connect(agentA).spendFunds(recipient.address, MAX_PER_TX, "r2");

      const history = await vault.getAgentSpendHistory(agentA.address);
      expect(history.length).to.equal(2);
      expect(history[0].reason).to.equal("r1");
      expect(history[1].reason).to.equal("r2");
    });
  });
});
