import { deployContracts, deploymentManager } from "./deploy-multichain";
import { networks } from "../config/networks";
import { formatEther } from "ethers";

async function deployToAllChains() {
  console.log("🚀 Starting multi-chain deployment...\n");
  
  // Define deployment order
  const deploymentOrder = [
    "mainnet",
    "arbitrum",
    "optimism",
    "polygon",
    "base",
    "avalanche",
    "bsc"
  ];
  
  const deploymentResults: Record<string, any> = {};
  
  // Check if we're in interactive mode
  const isInteractive = process.argv.includes("--interactive");
  const deployStaking = process.argv.includes("--deploy-staking");
  
  // First deploy to mainnet
  console.log("1️⃣ Deploying to Ethereum Mainnet...");
  try {
    const mainnetDeployment = await deployContracts({ 
      verify: true,
      deployStaking: deployStaking 
    });
    deploymentResults.mainnet = mainnetDeployment;
    console.log("✅ Mainnet deployment complete!\n");
  } catch (error) {
    console.error("❌ Mainnet deployment failed:", error);
    process.exit(1);
  }
  
  // Get mainnet deployment for bridging reference
  const mainnetDeployment = await deploymentManager.getLatestDeployment(1);
  if (!mainnetDeployment) {
    console.error("❌ No mainnet deployment found!");
    process.exit(1);
  }
  
  console.log("📋 Mainnet AMICA Token: " + mainnetDeployment.addresses.amicaToken);
  console.log("\n⏸️  Please bridge AMICA tokens to other chains before continuing...");
  console.log("   You'll need the bridged AMICA addresses for each chain.\n");
  
  // For demo purposes, we'll use placeholder addresses
  // In production, these would be the actual bridged token addresses
  const bridgedAmicaAddresses: Record<string, string> = {
    arbitrum: process.env.ARBITRUM_BRIDGED_AMICA || "0x...",
    optimism: process.env.OPTIMISM_BRIDGED_AMICA || "0x...",
    polygon: process.env.POLYGON_BRIDGED_AMICA || "0x...",
    base: process.env.BASE_BRIDGED_AMICA || "0x...",
    avalanche: process.env.AVALANCHE_BRIDGED_AMICA || "0x...",
    bsc: process.env.BSC_BRIDGED_AMICA || "0x...",
  };
  
  if (isInteractive) {
    console.log("🔄 Interactive mode enabled. Enter bridged AMICA addresses:");
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    for (const network of deploymentOrder.slice(1)) {
      const answer = await new Promise<string>((resolve) => {
        readline.question(`${networks[network].name} bridged AMICA address (or press Enter to skip): `, resolve);
      });
      if (answer && answer !== "") {
        bridgedAmicaAddresses[network] = answer;
      }
    }
    readline.close();
  }
  
  // Deploy to other chains
  for (const networkName of deploymentOrder.slice(1)) {
    const bridgedAddress = bridgedAmicaAddresses[networkName];
    
    if (!bridgedAddress || bridgedAddress === "0x...") {
      console.log(`\n⏭️  Skipping ${networks[networkName].name} - no bridged AMICA address provided`);
      continue;
    }
    
    console.log(`\n🚀 Deploying to ${networks[networkName].name}...`);
    console.log(`   Bridged AMICA: ${bridgedAddress}`);
    
    try {
      const deployment = await deployContracts({
        bridgedAmicaAddress: bridgedAddress,
        verify: true,
        deployStaking: deployStaking,
      });
      deploymentResults[networkName] = deployment;
      console.log(`✅ ${networks[networkName].name} deployment complete!`);
    } catch (error) {
      console.error(`❌ ${networks[networkName].name} deployment failed:`, error);
    }
  }
  
  // Summary
  console.log("\n📊 Deployment Summary");
  console.log("=".repeat(80));
  
  for (const [network, result] of Object.entries(deploymentResults)) {
    if (result) {
      console.log(`\n${networks[network].name}:`);
      console.log(`  AmicaToken: ${result.amicaToken}`);
      console.log(`  PersonaFactory: ${result.personaFactory}`);
      console.log(`  ERC20Implementation: ${result.erc20Implementation}`);
      if (result.bridgeWrapper) {
        console.log(`  BridgeWrapper: ${result.bridgeWrapper}`);
      }
      if (result.stakingRewards) {
        console.log(`  StakingRewards: ${result.stakingRewards}`);
      }
    }
  }
  
  // Save summary to file
  const fs = require("fs");
  const path = require("path");
  const summaryPath = path.join(__dirname, "../deployments/deployment-summary.json");
  
  const summary = {
    timestamp: new Date().toISOString(),
    mainnetAmicaToken: mainnetDeployment.addresses.amicaToken,
    deployments: Object.entries(deploymentResults).reduce((acc, [network, result]) => {
      if (result) {
        acc[network] = {
          chainId: networks[network].chainId,
          ...result
        };
      }
      return acc;
    }, {} as any),
    bridgedTokens: bridgedAmicaAddresses,
  };
  
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`\n💾 Deployment summary saved to: ${summaryPath}`);
  
  // Next steps
  console.log("\n📝 Next Steps:");
  console.log("1. Verify all contracts using: npx hardhat run scripts/verify.ts --network <network> -- --latest");
  console.log("2. Configure pairing tokens on each chain if needed");
  console.log("3. Approve agent tokens if using agent functionality");
  console.log("4. Set up staking pools if staking was deployed");
  console.log("5. Transfer AMICA tokens to users/treasury as needed");
}

// Parse command line arguments
const showHelp = () => {
  console.log(`
AMICA Protocol Multi-Chain Deployment Script

Usage: npx hardhat run scripts/deploy-all-chains.ts [options]

Options:
  --interactive        Interactive mode to enter bridged addresses
  --deploy-staking     Deploy staking rewards contracts
  --help              Show this help message

Environment Variables:
  ARBITRUM_BRIDGED_AMICA   Bridged AMICA address on Arbitrum
  OPTIMISM_BRIDGED_AMICA   Bridged AMICA address on Optimism
  POLYGON_BRIDGED_AMICA    Bridged AMICA address on Polygon
  BASE_BRIDGED_AMICA       Bridged AMICA address on Base
  AVALANCHE_BRIDGED_AMICA  Bridged AMICA address on Avalanche
  BSC_BRIDGED_AMICA        Bridged AMICA address on BSC
`);
};

if (process.argv.includes("--help")) {
  showHelp();
  process.exit(0);
}

deployToAllChains()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
