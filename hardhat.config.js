require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const KITE_RPC_URL = process.env.KITE_RPC_URL || "https://rpc-testnet.gokite.ai/";
const PRIVATE_KEY = process.env.KITE_PRIVATE_KEY || "0x" + "a".repeat(64); // dummy for compilation

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },

  networks: {
    hardhat: {
      chainId: 31337,
    },
    "kite-testnet": {
      url: KITE_RPC_URL,
      chainId: 2368,
      accounts: [PRIVATE_KEY],
      gasPrice: "auto",
    },
  },

  etherscan: {
    apiKey: {
      "kite-testnet": process.env.KITE_EXPLORER_API_KEY || "NO_KEY",
    },
    customChains: [
      {
        network: "kite-testnet",
        chainId: 2368,
        urls: {
          apiURL: "https://testnet.kitescan.ai/api",
          browserURL: "https://testnet.kitescan.ai",
        },
      },
    ],
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
