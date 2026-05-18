const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Kite testnet USDC — replace with faucet address if different
const TESTNET_USDC = process.env.USDC_ADDRESS || "0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "KITE");

  // ── 1. MockUSDC (local / testnet without real USDC) ───────────────────────
  let usdcAddress = TESTNET_USDC;
  const network = await ethers.provider.getNetwork();
  const isLocal = network.chainId === 31337n;

  if (isLocal) {
    console.log("\n[1/4] Deploying MockUSDC (local)...");
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const mockUsdc = await MockUSDC.deploy();
    await mockUsdc.waitForDeployment();
    usdcAddress = await mockUsdc.getAddress();
    console.log("MockUSDC:", usdcAddress);

    // Mint 1M USDC to deployer for testing
    await mockUsdc.mint(deployer.address, ethers.parseUnits("1000000", 6));
    console.log("Minted 1,000,000 USDC to deployer");
  } else {
    console.log("\n[1/4] Using real USDC on Kite testnet:", usdcAddress);
  }

  // ── 2. AgentVault ─────────────────────────────────────────────────────────
  console.log("\n[2/4] Deploying AgentVault...");
  const AgentVault = await ethers.getContractFactory("AgentVault");
  const agentVault = await AgentVault.deploy(usdcAddress);
  await agentVault.waitForDeployment();
  const agentVaultAddress = await agentVault.getAddress();
  console.log("AgentVault:", agentVaultAddress);

  // ── 3. AgentSkillLibrary ──────────────────────────────────────────────────
  console.log("\n[3/4] Deploying AgentSkillLibrary...");
  const AgentSkillLibrary = await ethers.getContractFactory("AgentSkillLibrary");
  const skillLibrary = await AgentSkillLibrary.deploy();
  await skillLibrary.waitForDeployment();
  const skillLibraryAddress = await skillLibrary.getAddress();
  console.log("AgentSkillLibrary:", skillLibraryAddress);

  // ── 4. PredictionMarket ───────────────────────────────────────────────────
  console.log("\n[4/4] Deploying PredictionMarket...");
  const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
  const market = await PredictionMarket.deploy(usdcAddress, deployer.address);
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();
  console.log("PredictionMarket:", marketAddress);

  // ── Post-deploy setup ─────────────────────────────────────────────────────
  console.log("\n[Setup] Authorizing AgentVault in PredictionMarket...");
  await market.setAgentAuthorization(agentVaultAddress, true);
  console.log("AgentVault authorized as resolver");

  // ── Save addresses ────────────────────────────────────────────────────────
  const addresses = {
    network: network.chainId.toString(),
    usdc: usdcAddress,
    agentVault: agentVaultAddress,
    skillLibrary: skillLibraryAddress,
    predictionMarket: marketAddress,
    deployedAt: new Date().toISOString(),
    deployedBy: deployer.address,
  };

  const outputPath = path.join(__dirname, "..", "deployments.json");
  fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));
  console.log("\n✅ Deployment complete. Addresses saved to deployments.json");
  console.log(JSON.stringify(addresses, null, 2));

  // Update .env if it exists
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    let env = fs.readFileSync(envPath, "utf8");
    const updates = {
      PREDICTION_MARKET_ADDRESS: marketAddress,
      AGENT_VAULT_ADDRESS: agentVaultAddress,
      SKILL_LIBRARY_ADDRESS: skillLibraryAddress,
      USDC_ADDRESS: usdcAddress,
    };
    for (const [key, val] of Object.entries(updates)) {
      const regex = new RegExp(`^${key}=.*$`, "m");
      if (regex.test(env)) {
        env = env.replace(regex, `${key}=${val}`);
      } else {
        env += `\n${key}=${val}`;
      }
    }
    fs.writeFileSync(envPath, env);
    console.log("✅ .env updated with contract addresses");
  }

  return addresses;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
