import { deployContracts, deploymentManager } from "./deploy-multichain";
import { networks } from "../config/networks";

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
  
  // First deploy to mainnet
  console.log("1️⃣ Deploying to Ethereum Mainnet...");
  try {
    const mainnetDeployment = await deployContracts({ verify: true });
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
  
  console.log("⏸️  Please bridge AMICA tokens to other chains before continuing...");
  console.log(`   Mainnet AMICA: ${mainnetDeployment.addresses.amicaToken}`);
  console.log("\n   Once bridged, you'll need the bridged AMICA addresses for each chain.");
  console.log("   Press Ctrl+C to exit and resume later with bridge addresses.\n");
  
  // For demo purposes, we'll use placeholder addresses
  // In production, these would be the actual bridged token addresses
  const bridgedAmicaAddresses: Record<string, string> = {
    arbitrum: "0x...", // Replace with actual bridged address
    optimism: "0x...",
    polygon: "0x...",
    base: "0x...",
    avalanche: "0x...",
    bsc: "0x...",
  };
  
  // Deploy to other chains
  for (const networkName of deploymentOrder.slice(1)) {
    const bridgedAddress = bridgedAmicaAddresses[networkName];
    
    if (!bridgedAddress || bridgedAddress === "0x...") {
      console.log(`⏭️  Skipping ${networkName} - no bridged AMICA address provided`);
      continue;
    }
    
    console.log(`\n🚀 Deploying to ${networks[networkName].name}...`);
    
    try {
      const deployment = await deployContracts({
        bridgedAmicaAddress: bridgedAddress,
        verify: true,
      });
      deploymentResults[networkName] = deployment;
      console.log(`✅ ${networks[networkName].name} deployment complete!`);
    } catch (error) {
      console.error(`❌ ${networks[networkName].name} deployment failed:`, error);
    }
  }
  
  // Summary
  console.log("\n📊 Deployment Summary");
  console.log("=" * 60);
  
  for (const [network, result] of Object.entries(deploymentResults)) {
    if (result) {
      console.log(`\n${networks[network].name}:`);
      console.log(`  AmicaToken: ${result.amicaToken}`);
      console.log(`  PersonaFactory: ${result.personaFactory}`);
      if (result.bridgeWrapper) {
        console.log(`  BridgeWrapper: ${result.bridgeWrapper}`);
      }
    }
  }
}

deployToAllChains()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
