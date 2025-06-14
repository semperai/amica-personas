import { ethers } from "hardhat";
import { parseEther } from "ethers";

/**
 * Script to deploy example agent tokens for testing
 * These can be used as agent tokens when creating personas
 */

interface AgentTokenConfig {
  name: string;
  symbol: string;
  totalSupply: string;
  decimals?: number;
}

const AGENT_TOKENS: AgentTokenConfig[] = [
  {
    name: "AI Agent Alpha",
    symbol: "ALPHA",
    totalSupply: "100000000", // 100M tokens
  },
  {
    name: "Bot Network Token",
    symbol: "BOT",
    totalSupply: "50000000", // 50M tokens
  },
  {
    name: "Neural Protocol",
    symbol: "NEURAL",
    totalSupply: "1000000000", // 1B tokens
  },
];

async function deployAgentTokens() {
  console.log("🤖 Deploying Agent Tokens...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);
  
  const deployedTokens: { [key: string]: string } = {};
  
  // Deploy a simple ERC20 token contract
  const ERC20Token = await ethers.getContractFactory("ERC20Token");
  
  for (const config of AGENT_TOKENS) {
    console.log(`\n📦 Deploying ${config.name} (${config.symbol})...`);
    
    const token = await ERC20Token.deploy(
      config.name,
      config.symbol,
      parseEther(config.totalSupply)
    );
    await token.waitForDeployment();
    
    const address = await token.getAddress();
    deployedTokens[config.symbol] = address;
    
    console.log(`✅ ${config.symbol} deployed to: ${address}`);
    console.log(`   Total Supply: ${config.totalSupply} ${config.symbol}`);
  }
  
  // Save deployment info
  console.log("\n📝 Agent Token Addresses:");
  console.log("=".repeat(40));
  console.log(JSON.stringify(deployedTokens, null, 2));
  
  // Write to file for easy reference
  const fs = require("fs");
  const path = require("path");
  const deploymentPath = path.join(__dirname, "../deployments/agent-tokens.json");
  
  // Ensure directory exists
  const dir = path.dirname(deploymentPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(
      {
        chainId: Number((await ethers.provider.getNetwork()).chainId),
        timestamp: new Date().toISOString(),
        deployer: deployer.address,
        tokens: deployedTokens,
      },
      null,
      2
    )
  );
  
  console.log(`\n💾 Deployment info saved to: ${deploymentPath}`);
  
  return deployedTokens;
}

// Simple ERC20 token for agent tokens
const ERC20_TOKEN_SOURCE = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20Token is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }
}
`;

// Main execution
deployAgentTokens()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

export { deployAgentTokens };
