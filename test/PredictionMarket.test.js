const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("PredictionMarket", () => {
  let market, usdc;
  let owner, agent, user1, user2, feeRecipient;
  const ONE_USDC = ethers.parseUnits("1", 6);
  const TEN_USDC = ethers.parseUnits("10", 6);
  const HUNDRED_USDC = ethers.parseUnits("100", 6);

  beforeEach(async () => {
    [owner, agent, user1, user2, feeRecipient] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();

    const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
    market = await PredictionMarket.deploy(await usdc.getAddress(), feeRecipient.address);

    // Mint & approve
    for (const account of [agent, user1, user2]) {
      await usdc.mint(account.address, HUNDRED_USDC * 100n);
      await usdc.connect(account).approve(await market.getAddress(), ethers.MaxUint256);
    }

    // Authorize agent
    await market.setAgentAuthorization(agent.address, true);
  });

  // ── createMarket ──────────────────────────────────────────────────────────

  describe("createMarket", () => {
    it("creates market with correct data", async () => {
      const deadline = (await time.latest()) + 3600;
      const tx = await market.createMarket("Will BTC > $100K?", deadline);
      const receipt = await tx.wait();

      const event = receipt.logs
        .map((l) => { try { return market.interface.parseLog(l); } catch { return null; } })
        .find((e) => e?.name === "MarketCreated");

      expect(event.args.marketId).to.equal(1n);
      expect(event.args.question).to.equal("Will BTC > $100K?");
      expect(event.args.deadline).to.equal(deadline);
    });

    it("reverts on past deadline", async () => {
      const pastDeadline = (await time.latest()) - 1;
      await expect(market.createMarket("Bad?", pastDeadline)).to.be.revertedWithCustomError(
        market,
        "InvalidDeadline"
      );
    });

    it("increments market count", async () => {
      const deadline = (await time.latest()) + 3600;
      await market.createMarket("Q1?", deadline);
      await market.createMarket("Q2?", deadline);
      expect(await market.marketCount()).to.equal(2n);
    });
  });

  // ── predictYes / predictNo ────────────────────────────────────────────────

  describe("predictions", () => {
    let marketId;

    beforeEach(async () => {
      const deadline = (await time.latest()) + 3600;
      const tx = await market.createMarket("Will ETH flip BTC?", deadline);
      const receipt = await tx.wait();
      marketId = 1n;
    });

    it("records YES prediction and transfers USDC", async () => {
      const balBefore = await usdc.balanceOf(user1.address);
      await market.connect(user1).predictYes(marketId, TEN_USDC);
      const balAfter = await usdc.balanceOf(user1.address);

      expect(balBefore - balAfter).to.equal(TEN_USDC);

      const [, , , , yesStake] = await market.getMarketStatus(marketId);
      expect(yesStake).to.equal(TEN_USDC);
    });

    it("records NO prediction correctly", async () => {
      await market.connect(user2).predictNo(marketId, TEN_USDC);
      const [, , , , , noStake] = await market.getMarketStatus(marketId);
      expect(noStake).to.equal(TEN_USDC);
    });

    it("reverts on amount below MIN_STAKE", async () => {
      await expect(
        market.connect(user1).predictYes(marketId, ONE_USDC - 1n)
      ).to.be.revertedWithCustomError(market, "InsufficientStake");
    });

    it("reverts on expired market", async () => {
      await time.increase(7200);
      await expect(
        market.connect(user1).predictYes(marketId, TEN_USDC)
      ).to.be.revertedWithCustomError(market, "MarketExpired");
    });

    it("accumulates multiple predictions", async () => {
      await market.connect(user1).predictYes(marketId, TEN_USDC);
      await market.connect(user2).predictYes(marketId, TEN_USDC);
      const [, , , , yesStake] = await market.getMarketStatus(marketId);
      expect(yesStake).to.equal(TEN_USDC * 2n);
    });
  });

  // ── resolveMarket ─────────────────────────────────────────────────────────

  describe("resolveMarket", () => {
    let marketId;

    beforeEach(async () => {
      const deadline = (await time.latest()) + 3600;
      await market.createMarket("Will SOL reach $500?", deadline);
      marketId = 1n;
      await market.connect(user1).predictYes(marketId, TEN_USDC);
      await time.increase(3601);
    });

    it("authorized agent can resolve", async () => {
      await expect(market.connect(agent).resolveMarket(marketId, true))
        .to.emit(market, "MarketResolved")
        .withArgs(marketId, true, agent.address);
    });

    it("reverts if non-agent tries to resolve", async () => {
      await expect(
        market.connect(user1).resolveMarket(marketId, true)
      ).to.be.revertedWithCustomError(market, "UnauthorizedAgent");
    });

    it("reverts if market not yet expired", async () => {
      const deadline2 = (await time.latest()) + 7200;
      await market.createMarket("Q2?", deadline2);
      await expect(
        market.connect(agent).resolveMarket(2n, true)
      ).to.be.revertedWithCustomError(market, "MarketNotExpired");
    });

    it("reverts double resolution", async () => {
      await market.connect(agent).resolveMarket(marketId, true);
      await expect(
        market.connect(agent).resolveMarket(marketId, false)
      ).to.be.revertedWithCustomError(market, "MarketAlreadyResolved");
    });
  });

  // ── settleMarket ──────────────────────────────────────────────────────────

  describe("settleMarket", () => {
    let marketId;

    beforeEach(async () => {
      const deadline = (await time.latest()) + 3600;
      await market.createMarket("Will DOGE moon?", deadline);
      marketId = 1n;

      await market.connect(user1).predictYes(marketId, HUNDRED_USDC);
      await market.connect(user2).predictNo(marketId, HUNDRED_USDC);

      await time.increase(3601);
      await market.connect(agent).resolveMarket(marketId, true); // YES wins
    });

    it("pays winners proportionally after fee", async () => {
      const balBefore = await usdc.balanceOf(user1.address);
      await market.settleMarket(marketId);
      const balAfter = await usdc.balanceOf(user1.address);

      const totalStake = HUNDRED_USDC * 2n;
      const fee = (totalStake * 200n) / 10_000n; // 2%
      const distributable = totalStake - fee;

      expect(balAfter - balBefore).to.equal(distributable);
    });

    it("collects protocol fee", async () => {
      const feeBefore = await usdc.balanceOf(feeRecipient.address);
      await market.settleMarket(marketId);
      const feeAfter = await usdc.balanceOf(feeRecipient.address);

      const totalStake = HUNDRED_USDC * 2n;
      const expectedFee = (totalStake * 200n) / 10_000n;
      expect(feeAfter - feeBefore).to.equal(expectedFee);
    });

    it("reverts if market not resolved", async () => {
      const deadline2 = (await time.latest()) + 3600;
      await market.createMarket("Unresolved?", deadline2);
      await market.connect(user1).predictYes(2n, TEN_USDC);
      await time.increase(3601);

      await expect(market.settleMarket(2n)).to.be.revertedWithCustomError(
        market,
        "MarketNotResolved"
      );
    });
  });

  // ── getMarketStatus ───────────────────────────────────────────────────────

  describe("getMarketStatus", () => {
    it("returns correct market data", async () => {
      const deadline = (await time.latest()) + 3600;
      await market.createMarket("Test?", deadline);
      await market.connect(user1).predictYes(1n, TEN_USDC);
      await market.connect(user2).predictNo(1n, HUNDRED_USDC);

      const [question, dl, resolved, outcome, yesStake, noStake, count] =
        await market.getMarketStatus(1n);

      expect(question).to.equal("Test?");
      expect(dl).to.equal(deadline);
      expect(resolved).to.be.false;
      expect(yesStake).to.equal(TEN_USDC);
      expect(noStake).to.equal(HUNDRED_USDC);
      expect(count).to.equal(2n);
    });

    it("reverts for nonexistent market", async () => {
      await expect(market.getMarketStatus(999n)).to.be.revertedWithCustomError(
        market,
        "MarketNotFound"
      );
    });
  });
});
