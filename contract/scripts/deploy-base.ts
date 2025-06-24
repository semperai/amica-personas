import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import { networks } from "../config/networks";
import { DeploymentManager } from "./utils/deployment-manager";
import { verifyContract } from "./utils/verify-helper";
import { DeploymentAddresses } from "../types/deployment";

const deploymentManager = new DeploymentManager();

const OPTIONS = {
  // gasPrice: ethers.parseUnits("0.01", "gwei"),
  // gasLimit: 10_000_000,
};

// from uniswap v4
const POOL_MANAGER_ADDRESS = "0x498581fF718922c3f8e6A244956aF099B2652b2b";
const POSITION_MANAGER_ADDRESS = "0x7c5f5a4bbd8fd63184577525326123b519429bdc";
// from running:
// forge script script/DeployDynamicFeeHookScript.sol:DeployDynamicFeeHookScript --rpc-url https://mainnet.base.org --chain 8453 --broadcast
const FEE_REDUCTION_HOOK_ADDRESS = "0xd458b59895590ac14aff613057261c60c3f74080";

async function deployContracts() {
  console.log("🚀 Starting deployment...");

  // Set gas options for upgrades plugin

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  const blockNumber = await ethers.provider.getBlockNumber();

  console.log(`Network: ${networks[getNetworkName(chainId)]?.name || "Unknown"} (Chain ID: ${chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log(`Block Number: ${blockNumber}`);


  const startTime = Date.now();
  const txHashes: any = {};


  // Deploy AmicaToken with upgradeable proxy
  console.log("\nDeploying AmicaToken...");
  const AmicaToken = await ethers.getContractFactory("AmicaToken");


  const amicaToken = await upgrades.deployProxy(
    AmicaToken,
    [deployer.address, ethers.parseEther("1000000000")],
    {
      initializer: "initialize",
      txOverrides: OPTIONS,
    }
  );
  await amicaToken.waitForDeployment();
  const amicaAddress = await amicaToken.getAddress();

  // Get implementation and admin addresses for verification
  const amicaTokenImplAddress = await upgrades.erc1967.getImplementationAddress(amicaAddress);
  const amicaProxyAdminAddress = await upgrades.erc1967.getAdminAddress(amicaAddress);

  txHashes.amicaToken = amicaToken.deploymentTransaction()?.hash;
  console.log(`   AmicaToken proxy deployed to: ${amicaAddress}`);
  console.log(`   Implementation: ${amicaTokenImplAddress}`);
  console.log(`   ProxyAdmin: ${amicaProxyAdminAddress}`);

  console.log("\nDeploying PersonaToken...");
  const PersonaToken = await ethers.getContractFactory("PersonaToken");
  const personaToken = await PersonaToken.deploy(OPTIONS);
  await personaToken.waitForDeployment();
  const personaTokenAddress = await personaToken.getAddress();
  txHashes.personaToken = personaToken.deploymentTransaction()?.hash;
  console.log(`PersonaToken deployed to: ${personaTokenAddress}`);

  // Deploy PersonaTokenFactory with upgradeable proxy
  console.log("\n Deploying PersonaTokenFactory...");
  const PersonaTokenFactory = await ethers.getContractFactory("PersonaTokenFactory");

  const personaFactory = await upgrades.deployProxy(
    PersonaTokenFactory,
    [
      amicaAddress,
      POOL_MANAGER_ADDRESS,
      POSITION_MANAGER_ADDRESS,
      FEE_REDUCTION_HOOK_ADDRESS,
      personaTokenAddress,
    ],
    {
      initializer: "initialize",
      kind: "transparent", // Explicitly use transparent proxy
      txOverrides: OPTIONS,
    }
  );
  await personaFactory.waitForDeployment();
  const personaFactoryAddress = await personaFactory.getAddress();

  // Get implementation address for verification
  const personaFactoryImplAddress = await upgrades.erc1967.getImplementationAddress(personaFactoryAddress);
  const personaProxyAdminAddress = await upgrades.erc1967.getAdminAddress(personaFactoryAddress);

  txHashes.personaFactory = personaFactory.deploymentTransaction()?.hash;
  console.log(`   PersonaTokenFactory proxy deployed to: ${personaFactoryAddress}`);
  console.log(`   Implementation: ${personaFactoryImplAddress}`);
  console.log(`   ProxyAdmin: ${personaProxyAdminAddress}`);

  // Deploy FeeReductionSystem and attach to DynamicFeeHook
  const FeeReductionSystem = await ethers.getContractFactory("FeeReductionSystem");
  const feeReductionSystem = await FeeReductionSystem.deploy(
    amicaAddress,
    personaFactoryAddress,
    OPTIONS
  );

  const feeReductionSystemAddress = await feeReductionSystem.getAddress();
  
  const DynamicFeeHook = await ethers.getContractFactory("DynamicFeeHook");
  const dynamicFeeHook = await DynamicFeeHook.attach(FEE_REDUCTION_HOOK_ADDRESS);

  // @ts-ignore TODO - fix this type error
  const setFeeReductionSystemTx = await dynamicFeeHook.setFeeReductionSystem(feeReductionSystemAddress, OPTIONS);
  const setFeeReductionSystemReceipt = await setFeeReductionSystemTx.wait();
  console.log(`\nFeeReductionSystem set on DynamicFeeHook in block ${setFeeReductionSystemReceipt?.blockNumber}`);

  // Deploy PersonaFactoryViewer
  console.log("\nDeploying PersonaFactoryViewer...");
  const PersonaFactoryViewer = await ethers.getContractFactory("PersonaFactoryViewer");
  const personaFactoryViewer = await PersonaFactoryViewer.deploy(
    personaFactoryAddress,
    OPTIONS
  );
  await personaFactoryViewer.waitForDeployment();
  const personaFactoryViewerAddress = await personaFactoryViewer.getAddress();
  txHashes.personaFactoryViewer = personaFactoryViewer.deploymentTransaction()?.hash;
  console.log(`PersonaFactoryViewer deployed to: ${personaFactoryViewerAddress}`);

  const deploymentTime = (Date.now() - startTime) / 1000;
  console.log(`\nDeployment completed in ${deploymentTime.toFixed(2)} seconds`);

  // Create addresses object with proper typing
  const addresses = {
    amicaToken: amicaAddress,
    amicaTokenImpl: amicaTokenImplAddress,
    personaFactory: personaFactoryAddress,
    personaFactoryImpl: personaFactoryImplAddress,
    personaFactoryViewer: personaFactoryViewerAddress,
    proxyAdmin: amicaProxyAdminAddress, // All proxies should use the same admin
    personaToken: personaTokenAddress,
    feeReductionSystem: feeReductionSystemAddress,
  } as DeploymentAddresses;

  // Save deployment
  const deployment = {
    chainId,
    chainName: getNetworkName(chainId),
    addresses,
    blockNumber,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    transactionHashes: txHashes,
  };

  await deploymentManager.saveDeployment(deployment);

  return addresses;
}

function getNetworkName(chainId: number): string {
  const entry = Object.entries(networks).find(([_, config]) => config.chainId === chainId);
  return entry ? entry[0] : "unknown";
}

// Main execution
async function main() {
  await deployContracts();
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

export { deployContracts, DeploymentManager, deploymentManager };
