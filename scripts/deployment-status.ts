import { ethers } from "hardhat";
import { DeploymentManager } from "./utils/deployment-manager";
import { networks } from "../config/networks";

async function checkDeploymentStatus() {
  const deploymentManager = new DeploymentManager();
  const allDeployments = await deploymentManager.getAllDeployments();
  
  console.log("🌐 AMICA Protocol Deployment Status\n");
  console.log("=" * 80);
  
  for (const [chainId, deployments] of Object.entries(allDeployments)) {
    const networkName = getNetworkName(Number(chainId));
    const latest = deployments[deployments.length - 1];
    
    console.log(`\n📍 ${networks[networkName]?.name || "Unknown"} (Chain ID: ${chainId})`);
    console.log(`   Deployments: ${deployments.length}`);
    
    if (latest) {
      console.log(`   Latest deployment: ${latest.timestamp}`);
      console.log(`   Deployer: ${latest.deployer}`);
      console.log(`   Contracts:`);
      console.log(`     - AmicaToken: ${latest.addresses.amicaToken}`);
      console.log(`     - PersonaFactory: ${latest.addresses.personaFactory}`);
      if (latest.addresses.bridgeWrapper) {
        console.log(`     - BridgeWrapper: ${latest.addresses.bridgeWrapper}`);
        console.log(`     - Bridged AMICA: ${latest.addresses.bridgedAmicaAddress}`);
      }
    }
  }
  
  // Check which chains still need deployment
  const deployedChainIds = Object.keys(allDeployments).map(Number);
  const missingChains = Object.entries(networks)
    .filter(([_, config]) => !deployedChainIds.includes(config.chainId))
    .map(([name, config]) => `${config.name} (${config.chainId})`);
  
  if (missingChains.length > 0) {
    console.log("\n⚠️  Not yet deployed on:");
    missingChains.forEach(chain => console.log(`   - ${chain}`));
  }
  
  console.log("\n" + "=" * 80);
}

function getNetworkName(chainId: number): string {
  const entry = Object.entries(networks).find(([_, config]) => config.chainId === chainId);
  return entry ? entry[0] : "unknown";
}

checkDeploymentStatus()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

