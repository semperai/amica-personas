import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import { networks } from "../config/networks";
import { DeploymentManager } from "./utils/deployment-manager";
import { verifyContract } from "./utils/verify-helper";
import { ExtendedDeploymentAddresses } from "../types/deployment";

const deploymentManager = new DeploymentManager();

const STAKING_REWARDS_PER_BLOCK = ethers.parseEther("1");
const GAS_PRICE_DEFAULT = ethers.parseUnits("0.01", "gwei");
const GAS_LIMIT_DEFAULT = 10_000_000;

// from uniswap v4
const POOL_MANAGER_ADDRESS = "0x498581fF718922c3f8e6A244956aF099B2652b2b";
const POSITION_MANAGER_ADDRESS = "0x7c5f5a4bbd8fd63184577525326123b519429bdc";
// from running:
// forge script script/DeployAmicaHookMinedAddressScript.sol:DeployAmicaHookMinedAddressScript --rpc-url https://mainnet.base.org --chain 8453 --broadcast
const AMICA_FEE_REDUCTION_HOOK_ADDRESS = "0xd458b59895590ac14aff613057261c60c3f74080";

async function deployContracts() {
  console.log("🚀 Starting deployment...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  const blockNumber = await ethers.provider.getBlockNumber();

  console.log(`📍 Network: ${networks[getNetworkName(chainId)]?.name || "Unknown"} (Chain ID: ${chainId})`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log(`📅 Block Number: ${blockNumber}`);




  const startTime = Date.now();
  const txHashes: any = {};


  // Deploy UniswapV4Manager
  console.log("\n0️⃣ Deploying UniswapV4Manager...");
  const UniswapV4Manager = await ethers.getContractFactory("UniswapV4Manager");
  const uniswapV4Manager = await UniswapV4Manager.deploy(
    POOL_MANAGER_ADDRESS,
    POSITION_MANAGER_ADDRESS,
    AMICA_FEE_REDUCTION_HOOK_ADDRESS,
    {
      gasPrice: GAS_PRICE_DEFAULT,
      gasLimit: GAS_LIMIT_DEFAULT,
    }
  );
  await uniswapV4Manager.waitForDeployment();

  const uniswapV4ManagerAddress = await uniswapV4Manager.getAddress();

  console.log(`✅ UniswapV4Manager deployed to: ${uniswapV4ManagerAddress}`);


  // Deploy AmicaToken with upgradeable proxy
  console.log("\n1️⃣ Deploying AmicaToken...");
  const AmicaToken = await ethers.getContractFactory("AmicaToken");

  // Set gas options for upgrades plugin
  const upgradeOptions = {
    txOverrides: {
      gasPrice: GAS_PRICE_DEFAULT,
      gasLimit: GAS_LIMIT_DEFAULT,
    }
  };

  const amicaToken = await upgrades.deployProxy(
    AmicaToken,
    [deployer.address, ethers.parseEther("1000000000")],
    {
      initializer: "initialize",
      ...upgradeOptions
    }
  );
  await amicaToken.waitForDeployment();
  const amicaAddress = await amicaToken.getAddress();

  // Get implementation and admin addresses for verification
  const amicaTokenImplAddress = await upgrades.erc1967.getImplementationAddress(amicaAddress);
  const amicaProxyAdminAddress = await upgrades.erc1967.getAdminAddress(amicaAddress);

  txHashes.amicaToken = amicaToken.deploymentTransaction()?.hash;
  console.log(`✅ AmicaToken proxy deployed to: ${amicaAddress}`);
  console.log(`   Implementation: ${amicaTokenImplAddress}`);
  console.log(`   ProxyAdmin: ${amicaProxyAdminAddress}`);

  // Deploy ERC20Implementation
  console.log("\n2️⃣ Deploying ERC20Implementation...");
  const ERC20Implementation = await ethers.getContractFactory("ERC20Implementation");
  const erc20Implementation = await ERC20Implementation.deploy({
    gasPrice: GAS_PRICE_DEFAULT,
    gasLimit: GAS_LIMIT_DEFAULT,
  });
  await erc20Implementation.waitForDeployment();
  const erc20ImplAddress = await erc20Implementation.getAddress();
  txHashes.erc20Implementation = erc20Implementation.deploymentTransaction()?.hash;
  console.log(`✅ ERC20Implementation deployed to: ${erc20ImplAddress}`);

  // Deploy PersonaTokenFactory with upgradeable proxy
  console.log("\n3️⃣ Deploying PersonaTokenFactory...");
  const PersonaTokenFactory = await ethers.getContractFactory("PersonaTokenFactory");

  const personaFactory = await upgrades.deployProxy(
    PersonaTokenFactory,
    [
      amicaAddress,
      POOL_MANAGER_ADDRESS,
      uniswapV4ManagerAddress,
      erc20ImplAddress,
    ],
    {
      initializer: "initialize",
      kind: "transparent", // Explicitly use transparent proxy
      ...upgradeOptions
    }
  );
  await personaFactory.waitForDeployment();
  const personaFactoryAddress = await personaFactory.getAddress();

  // Get implementation address for verification
  const personaFactoryImplAddress = await upgrades.erc1967.getImplementationAddress(personaFactoryAddress);
  const personaProxyAdminAddress = await upgrades.erc1967.getAdminAddress(personaFactoryAddress);

  txHashes.personaFactory = personaFactory.deploymentTransaction()?.hash;
  console.log(`✅ PersonaTokenFactory proxy deployed to: ${personaFactoryAddress}`);
  console.log(`   Implementation: ${personaFactoryImplAddress}`);
  console.log(`   ProxyAdmin: ${personaProxyAdminAddress}`);

  // Run setFactory on UniswapV4Manager
  console.log("\nSetting factory on UniswapV4Manager...");
  const setFactoryTx = await uniswapV4Manager.setFactory(personaFactoryAddress, {
    gasPrice: GAS_PRICE_DEFAULT,
    gasLimit: GAS_LIMIT_DEFAULT,
  });
  const setFactoryReceipt = await setFactoryTx.wait();
  console.log(`✅ Factory set on UniswapV4Manager in block ${setFactoryReceipt?.blockNumber}`);

  // Deploy PersonaFactoryViewer
  console.log("\n4️⃣ Deploying PersonaFactoryViewer...");
  const PersonaFactoryViewer = await ethers.getContractFactory("PersonaFactoryViewer");
  const personaFactoryViewer = await PersonaFactoryViewer.deploy(
    personaFactoryAddress,
    {
      gasPrice: GAS_PRICE_DEFAULT,
      gasLimit: GAS_LIMIT_DEFAULT,
    }
  );
  await personaFactoryViewer.waitForDeployment();
  const personaFactoryViewerAddress = await personaFactoryViewer.getAddress();
  txHashes.personaFactoryViewer = personaFactoryViewer.deploymentTransaction()?.hash;
  console.log(`✅ PersonaFactoryViewer deployed to: ${personaFactoryViewerAddress}`);

  const deploymentTime = (Date.now() - startTime) / 1000;
  console.log(`\n⏱️  Deployment completed in ${deploymentTime.toFixed(2)} seconds`);

  // Create addresses object with proper typing
  const addresses = {
    amicaToken: amicaAddress,
    amicaTokenImpl: amicaTokenImplAddress,
    uniswapV4Manager: uniswapV4ManagerAddress,
    personaFactory: personaFactoryAddress,
    personaFactoryImpl: personaFactoryImplAddress,
    personaFactoryViewer: personaFactoryViewerAddress,
    proxyAdmin: amicaProxyAdminAddress, // All proxies should use the same admin
    erc20Implementation: erc20ImplAddress,
  } as ExtendedDeploymentAddresses;

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
