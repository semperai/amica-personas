import { ethers, upgrades } from "hardhat";
import { DeploymentManager } from "./utils/deployment-manager";
import { formatEther } from "ethers";

const deploymentManager = new DeploymentManager();
const GAS_PRICE_DEFAULT = ethers.parseUnits("0.01", "gwei");
const GAS_LIMIT_DEFAULT = 10_000_000;

/**
 * Deploy PersonaFactoryViewer for an existing PersonaTokenFactory
 */
async function deployViewer() {
  console.log("🚀 Deploying PersonaFactoryViewer...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log(`📍 Network: Chain ID ${chainId}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  // Get latest deployment
  const latest = await deploymentManager.getLatestDeployment(chainId);
  if (!latest) {
    throw new Error("No deployment found for this chain. Please deploy the main contracts first.");
  }

  const personaFactoryAddress = latest.addresses.personaFactory;
  console.log(`📋 Found PersonaTokenFactory at: ${personaFactoryAddress}`);

  // Check if viewer already exists
  if (latest.addresses.personaFactoryViewer) {
    console.log(`⚠️  PersonaFactoryViewer already deployed at: ${latest.addresses.personaFactoryViewer}`);
    console.log("   Use --force flag to deploy a new one anyway");
    
    if (!process.argv.includes("--force")) {
      return latest.addresses.personaFactoryViewer;
    }
  }

  // Deploy PersonaFactoryViewer
  console.log("\n📊 Deploying PersonaFactoryViewer...");
  const PersonaFactoryViewer = await ethers.getContractFactory("PersonaFactoryViewer");
  const viewer = await PersonaFactoryViewer.deploy(
    personaFactoryAddress,
    {
      gasPrice: GAS_PRICE_DEFAULT,
      gasLimit: GAS_LIMIT_DEFAULT,
    }
  );
  await viewer.waitForDeployment();
  const viewerAddress = await viewer.getAddress();

  console.log(`✅ PersonaFactoryViewer deployed to: ${viewerAddress}`);
  console.log(`   Transaction: ${viewer.deploymentTransaction()?.hash}`);

  // Update deployment info
  latest.addresses.personaFactoryViewer = viewerAddress;
  latest.transactionHashes = latest.transactionHashes || {};
  latest.transactionHashes.personaFactoryViewer = viewer.deploymentTransaction()?.hash;
  
  await deploymentManager.saveDeployment(latest);
  console.log("\n💾 Deployment info updated");

  return viewerAddress;
}

/**
 * Upgrade PersonaTokenFactory to latest implementation
 */
async function upgradePersonaFactory() {
  console.log("🔄 Upgrading PersonaTokenFactory...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log(`📍 Network: Chain ID ${chainId}`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  // Get latest deployment
  const latest = await deploymentManager.getLatestDeployment(chainId);
  if (!latest) {
    throw new Error("No deployment found for this chain.");
  }

  const proxyAddress = latest.addresses.personaFactory;
  console.log(`📋 Found PersonaTokenFactory proxy at: ${proxyAddress}`);

  // Get current implementation
  const currentImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log(`   Current implementation: ${currentImpl}`);

  // Detect proxy type
  let proxyType: "transparent" | "uups" = "transparent";
  try {
    // Check if it's a UUPS proxy by looking for the proxiableUUID function
    const impl = await ethers.getContractAt("PersonaTokenFactory", currentImpl);
    await impl.proxiableUUID();
    proxyType = "uups";
  } catch {
    // If the function doesn't exist, it's a transparent proxy
    proxyType = "transparent";
  }
  console.log(`   Proxy type: ${proxyType}`);

  // Prepare upgrade
  console.log("\n⚙️  Preparing upgrade...");
  const PersonaTokenFactory = await ethers.getContractFactory("PersonaTokenFactory");

  // Validate upgrade - using detected proxy type
  console.log("🔍 Validating upgrade compatibility...");
  await upgrades.validateUpgrade(proxyAddress, PersonaTokenFactory, {
    kind: proxyType,
  });
  console.log("✅ Upgrade validation passed");

  // Perform upgrade
  console.log("\n📤 Upgrading proxy...");
  const upgraded = await upgrades.upgradeProxy(
    proxyAddress,
    PersonaTokenFactory,
    {
      kind: proxyType,
      txOverrides: {
        gasPrice: GAS_PRICE_DEFAULT,
        gasLimit: GAS_LIMIT_DEFAULT,
      }
    }
  );
  await upgraded.waitForDeployment();

  // Get new implementation address
  const newImpl = await upgrades.erc1967.getImplementationAddress(proxyAddress);
  console.log(`✅ Upgrade complete!`);
  console.log(`   New implementation: ${newImpl}`);

  // Update deployment info
  latest.addresses.personaFactoryImpl = newImpl;
  latest.transactionHashes = latest.transactionHashes || {};
  latest.transactionHashes.personaFactoryUpgrade = upgraded.deploymentTransaction()?.hash;
  latest.upgradeHistory = latest.upgradeHistory || [];
  latest.upgradeHistory.push({
    timestamp: new Date().toISOString(),
    fromImpl: currentImpl,
    toImpl: newImpl,
    upgrader: deployer.address,
  });

  await deploymentManager.saveDeployment(latest);
  console.log("\n💾 Deployment info updated");

  return newImpl;
}

/**
 * Full deployment and upgrade process
 */
async function deployViewerAndUpgrade() {
  console.log("🚀 Starting PersonaFactoryViewer deployment and factory upgrade...\n");

  try {
    // Step 1: Upgrade PersonaTokenFactory
    console.log("Step 1/2: Upgrading PersonaTokenFactory");
    console.log("=".repeat(50));
    const newImpl = await upgradePersonaFactory();
    
    console.log("\n" + "=".repeat(50));
    console.log("Step 2/2: Deploying PersonaFactoryViewer");
    console.log("=".repeat(50));
    
    // Step 2: Deploy viewer
    const viewerAddress = await deployViewer();

    console.log("\n✨ Process complete!");
    console.log("=".repeat(50));
    console.log("PersonaTokenFactory upgraded to:", newImpl);
    console.log("PersonaFactoryViewer deployed to:", viewerAddress);

    return { newImpl, viewerAddress };
  } catch (error) {
    console.error("\n❌ Error during deployment/upgrade:", error);
    throw error;
  }
}

/**
 * Check current deployment status
 */
async function checkDeploymentStatus() {
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log("📊 Checking deployment status...\n");

  const latest = await deploymentManager.getLatestDeployment(chainId);
  if (!latest) {
    console.log("❌ No deployment found for this chain");
    return;
  }

  console.log(`📍 Chain ID: ${chainId}`);
  console.log(`📅 Deployed: ${latest.timestamp}`);
  console.log(`👤 Deployer: ${latest.deployer}`);
  console.log("\n📋 Contracts:");
  console.log(`  PersonaTokenFactory Proxy: ${latest.addresses.personaFactory}`);
  console.log(`  PersonaTokenFactory Impl: ${latest.addresses.personaFactoryImpl}`);
  console.log(`  PersonaFactoryViewer: ${latest.addresses.personaFactoryViewer || "Not deployed"}`);
  console.log(`  AmicaToken: ${latest.addresses.amicaToken}`);
  
  if (latest.addresses.stakingRewards) {
    console.log(`  StakingRewards: ${latest.addresses.stakingRewards}`);
  }
  
  if (latest.addresses.bridgeWrapper) {
    console.log(`  BridgeWrapper: ${latest.addresses.bridgeWrapper}`);
  }

  // Check if viewer is deployed
  if (!latest.addresses.personaFactoryViewer) {
    console.log("\n⚠️  PersonaFactoryViewer not deployed yet");
    console.log("   Run: npx hardhat run scripts/deploy-viewer-and-upgrade.ts --network <network>");
  }

  // Check upgrade history
  if (latest.upgradeHistory && latest.upgradeHistory.length > 0) {
    console.log("\n📜 Upgrade History:");
    latest.upgradeHistory.forEach((upgrade: any, index: number) => {
      console.log(`  Upgrade #${index + 1}:`);
      console.log(`    Date: ${upgrade.timestamp}`);
      console.log(`    From: ${upgrade.fromImpl}`);
      console.log(`    To: ${upgrade.toImpl}`);
      console.log(`    By: ${upgrade.upgrader}`);
    });
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--status")) {
    await checkDeploymentStatus();
  } else if (args.includes("--viewer-only")) {
    await deployViewer();
  } else if (args.includes("--upgrade-only")) {
    await upgradePersonaFactory();
  } else {
    await deployViewerAndUpgrade();
  }
}

// Execute if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { deployViewer, upgradePersonaFactory, deployViewerAndUpgrade, checkDeploymentStatus };
