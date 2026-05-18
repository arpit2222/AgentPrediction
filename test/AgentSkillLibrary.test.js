const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgentSkillLibrary", () => {
  let library;
  let owner, caller, other, implAddress;

  beforeEach(async () => {
    [owner, caller, other] = await ethers.getSigners();

    const AgentSkillLibrary = await ethers.getContractFactory("AgentSkillLibrary");
    library = await AgentSkillLibrary.deploy();

    // Authorize caller
    await library.setCallerAuthorization(caller.address, true);

    // Use a dummy address as "implementation" for non-execution tests
    implAddress = other.address;
  });

  describe("registerSkill", () => {
    it("registers a skill with correct data", async () => {
      await library.registerSkill("price_analysis", implAddress);
      const skill = await library.getSkill("price_analysis");

      expect(skill.name).to.equal("price_analysis");
      expect(skill.implementation).to.equal(implAddress);
      expect(skill.active).to.be.true;
      expect(skill.executionCount).to.equal(0n);
    });

    it("emits SkillRegistered event", async () => {
      await expect(library.registerSkill("test_skill", implAddress))
        .to.emit(library, "SkillRegistered");
    });

    it("reverts duplicate registration", async () => {
      await library.registerSkill("price_analysis", implAddress);
      await expect(
        library.registerSkill("price_analysis", implAddress)
      ).to.be.revertedWithCustomError(library, "SkillAlreadyExists");
    });

    it("reverts with zero address implementation", async () => {
      await expect(
        library.registerSkill("bad_skill", ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(library, "InvalidImplementation");
    });

    it("reverts with empty name", async () => {
      await expect(
        library.registerSkill("", implAddress)
      ).to.be.revertedWithCustomError(library, "EmptySkillName");
    });

    it("reverts if non-owner tries to register", async () => {
      await expect(
        library.connect(caller).registerSkill("x", implAddress)
      ).to.be.reverted;
    });
  });

  describe("deactivateSkill", () => {
    it("deactivates a registered skill", async () => {
      await library.registerSkill("sentiment_check", implAddress);
      await library.deactivateSkill("sentiment_check");
      const skill = await library.getSkill("sentiment_check");
      expect(skill.active).to.be.false;
    });

    it("emits SkillDeactivated event", async () => {
      await library.registerSkill("to_deactivate", implAddress);
      await expect(library.deactivateSkill("to_deactivate"))
        .to.emit(library, "SkillDeactivated");
    });
  });

  describe("skillExists", () => {
    it("returns true for registered skill", async () => {
      await library.registerSkill("exists_skill", implAddress);
      expect(await library.skillExists("exists_skill")).to.be.true;
    });

    it("returns false for unregistered skill", async () => {
      expect(await library.skillExists("nonexistent")).to.be.false;
    });
  });

  describe("getAllSkills", () => {
    it("returns all registered skills", async () => {
      await library.registerSkill("skill_a", implAddress);
      await library.registerSkill("skill_b", implAddress);
      const skills = await library.getAllSkills();
      expect(skills.length).to.equal(2);
    });
  });

  describe("access control", () => {
    it("reverts executeSkill for unauthorized caller", async () => {
      await library.registerSkill("secure_skill", implAddress);
      await expect(
        library.connect(other).executeSkill("secure_skill", "0x")
      ).to.be.revertedWithCustomError(library, "UnauthorizedCaller");
    });

    it("reverts executeSkill for inactive skill", async () => {
      await library.registerSkill("inactive_skill", implAddress);
      await library.deactivateSkill("inactive_skill");
      await expect(
        library.connect(caller).executeSkill("inactive_skill", "0x")
      ).to.be.revertedWithCustomError(library, "SkillInactive");
    });
  });
});
