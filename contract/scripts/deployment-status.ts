import { ethers } from "hardhat";
import { DeploymentManager } from "./utils/deployment-manager";
import { networks } from "../config/networks";
import { formatEther } from "ethers";

async function checkDeploymentStatus() {
  const deploymentManager = new DeploymentManager();
  const allDeployments = await deploymentManager.getAllDeployments();
  
  console.log("🌐 AMICA Protocol Deployment Status\n");
  console.log("=" * 80);
  
  // Check current network
  const provider = ethers.provider;
  const network = await provider.getNetwork();
  const currentChainId = Number(network.chainId);
  console.log(`\n🔌 Connected to: ${networks[getNetworkName(currentChainId)]?.name || "Unknown"} (Chain ID: ${currentChainId})`);
  
  for (const [chainId, deployments] of Object.entries(allDeployments)) {
    const networkName = getNetworkName(Number(chainId));
    const latest = deployments[deployments.length - 1];
    
    console.log(`\n📍 ${networks[networkName]?.name || "Unknown"} (Chain ID: ${chainId})`);
    console.log(`   Deployments: ${deployments.length}`);
    
    if (latest) {
      console.log(`   Latest deployment: ${latest.timestamp}`);
      console.log(`   Deployer: ${latest.deployer}`);
      console.log(`   Block: ${latest.blockNumber}`);
      console.log(`   Contracts:`);
      console.log(`     - AmicaToken: ${latest.addresses.amicaToken}`);
      console.log(`     - PersonaFactory: ${latest.addresses.personaFactory}`);
      console.log(`     - ERC20Implementation: ${latest.addresses.erc20Implementation}`);
      
      if (latest.addresses.bridgeWrapper) {
        console.log(`     - BridgeWrapper: ${latest.addresses.bridgeWrapper}`);
        console.log(`     - Bridged AMICA: ${latest.addresses.bridgedAmicaAddress}`);
      }
      
      if (latest.addresses.stakingRewards) {
        console.log(`     - StakingRewards: ${latest.addresses.stakingRewards}`);
      }
      
      // If this is the current network, show more details
      if (Number(chainId) === currentChainId) {
        console.log("\n   📊 Current Network Details:");
        await showNetworkDetails(latest);
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
  
  // Show agent tokens if deployed
  await showAgentTokens();
  
  console.log("\n" + "=" * 80);
}

async function showNetworkDetails(deployment: any) {
  try {
    // Get AMICA token details
    const amica = await ethers.getContractAt("AmicaToken", deployment.addresses.amicaToken);
    const totalSupply = await amica.totalSupply();
    const circulatingSupply = await amica.circulatingSupply();
    
    console.log(`     - AMICA Total Supply: ${formatEther(totalSupply)}`);
    console.log(`     - AMICA Circulating: ${formatEther(circulatingSupply)}`);
    
    // Get PersonaFactory details
    const factory = await ethers.getContractAt("PersonaTokenFactory", deployment.addresses.personaFactory);
    const tradingFeeConfig = await factory.tradingFeeConfig();
    const feeReductionConfig = await factory.feeReductionConfig();
    
    console.log(`     - Trading Fee: ${Number(tradingFeeConfig.feePercentage) / 100}%`);
    console.log(`     - Creator Share: ${Number(tradingFeeConfig.creatorShare) / 100}%`);
    console.log(`     - Min AMICA for Discount: ${formatEther(feeReductionConfig.minAmicaForReduction)}`);
    console.log(`     - Max AMICA for Full Discount: ${formatEther(feeReductionConfig.maxAmicaForReduction)}`);
    
    // Get pairing config for AMICA
    const pairingConfig = await factory.pairingConfigs(deployment.addresses.amicaToken);
    console.log(`     - AMICA Mint Cost: ${formatEther(pairingConfig.mintCost)}`);
    console.log(`     - AMICA Graduation Threshold: ${formatEther(pairingConfig.graduationThreshold)}`);
    
    // Check if staking is deployed
    if (deployment.addresses.stakingRewards) {
      const staking = await ethers.getContractAt("PersonaStakingRewards", deployment.addresses.stakingRewards);
      const amicaPerBlock = await staking.amicaPerBlock();
      const poolLength = await staking.poolLength();
      
      console.log(`     - Staking AMICA/Block: ${formatEther(amicaPerBlock)}`);
      console.log(`     - Staking Pools: ${poolLength}`);
    }
  } catch (error) {
    console.log("     ⚠️  Could not fetch on-chain data (different network?)");
  }
}

async function showAgentTokens() {
  const fs = require("fs");
  const path = require("path");
  const agentTokensPath = path.join(__dirname, "../deployments/agent-tokens.json");
  
  if (fs.existsSync(agentTokensPath)) {
    console.log("\n🤖 Deployed Agent Tokens:");
    const agentTokens = JSON.parse(fs.readFileSync(agentTokensPath, "utf8"));
    console.log(`   Chain ID: ${agentTokens.chainId}`);
    console.log(`   Deployed: ${agentTokens.timestamp}`);
    console.log(`   Tokens:`);
    for (const [symbol, address] of Object.entries(agentTokens.tokens)) {
      console.log(`     - ${symbol}: ${address}`);
    }
  }
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
