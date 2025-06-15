import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import { uniswapAddresses } from "../config/uniswap";
import { networks } from "../config/networks";
import { DeploymentManager } from "./utils/deployment-manager";
import { verifyContract } from "./utils/verify-helper";
import { ExtendedDeploymentAddresses } from "../types/deployment";

const deploymentManager = new DeploymentManager();

interface DeploymentOptions {
  bridgedAmicaAddress?: string;
  verify?: boolean;
  gasPrice?: bigint;
  gasLimit?: bigint;
  deployStaking?: boolean;
  stakingRewardsPerBlock?: string;
}

async function deployContracts(options: DeploymentOptions = {}): Promise<ExtendedDeploymentAddresses> {
  console.log("🚀 Starting deployment...");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log(`📍 Network: ${networks[getNetworkName(chainId)]?.name || "Unknown"} (Chain ID: ${chainId})`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  // Get Uniswap addresses for this chain
  const uniswap = uniswapAddresses[chainId];
  if (!uniswap) {
    throw new Error(`Uniswap addresses not configured for chain ${chainId}`);
  }

  console.log("\n📋 Uniswap Configuration:");
  console.log(`  Factory: ${uniswap.factory}`);
  console.log(`  Router: ${uniswap.router}`);

  const startTime = Date.now();
  const txHashes: any = {};

  // Deploy AmicaToken with upgradeable proxy
  console.log("\n1️⃣ Deploying AmicaToken...");
  const AmicaToken = await ethers.getContractFactory("AmicaToken");

  // Set gas options for upgrades plugin
  const upgradeOptions = options.gasPrice || options.gasLimit ? {
    txOverrides: {
      gasPrice: options.gasPrice,
      gasLimit: options.gasLimit,
    }
  } : {};

  const amicaToken = await upgrades.deployProxy(
    AmicaToken,
    [deployer.address],
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
    gasPrice: options.gasPrice,
    gasLimit: options.gasLimit,
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
      uniswap.factory,
      uniswap.router,
      erc20ImplAddress,
    ],
    {
      initializer: "initialize",
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

  // Deploy bridge wrapper if not mainnet
  let bridgeWrapperAddress: string | undefined;
  if (chainId !== 1 && options.bridgedAmicaAddress) {
    console.log("\n4️⃣ Deploying AmicaBridgeWrapper...");
    const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");
    const bridgeWrapper = await AmicaBridgeWrapper.deploy(
      options.bridgedAmicaAddress,
      amicaAddress,
      deployer.address,
      {
        gasPrice: options.gasPrice,
        gasLimit: options.gasLimit,
      }
    );
    await bridgeWrapper.waitForDeployment();
    bridgeWrapperAddress = await bridgeWrapper.getAddress();
    txHashes.bridgeWrapper = bridgeWrapper.deploymentTransaction()?.hash;
    console.log(`✅ AmicaBridgeWrapper deployed to: ${bridgeWrapperAddress}`);

    // Set bridge wrapper in AmicaToken
    console.log("\n🔗 Setting bridge wrapper in AmicaToken...");
    const tx = await amicaToken.setBridgeWrapper(bridgeWrapperAddress);
    await tx.wait();
    console.log("✅ Bridge wrapper set");
  }

  // Deploy PersonaStakingRewards if requested
  let stakingRewardsAddress: string | undefined;
  let rewardsPerBlock: bigint | undefined;
  let startBlock: number | undefined;

  if (options.deployStaking) {
    console.log("\n5️⃣ Deploying PersonaStakingRewards...");
    const PersonaStakingRewards = await ethers.getContractFactory("PersonaStakingRewards");
    rewardsPerBlock = options.stakingRewardsPerBlock ?
      ethers.parseEther(options.stakingRewardsPerBlock) :
      ethers.parseEther("10"); // Default 10 AMICA per block

    const currentBlock = await ethers.provider.getBlockNumber();
    startBlock = currentBlock + 100; // Start rewards 100 blocks from now

    const stakingRewards = await PersonaStakingRewards.deploy(
      amicaAddress,
      personaFactoryAddress,
      rewardsPerBlock,
      startBlock,
      {
        gasPrice: options.gasPrice,
        gasLimit: options.gasLimit,
      }
    );
    await stakingRewards.waitForDeployment();
    stakingRewardsAddress = await stakingRewards.getAddress();
    txHashes.stakingRewards = stakingRewards.deploymentTransaction()?.hash;
    console.log(`✅ PersonaStakingRewards deployed to: ${stakingRewardsAddress}`);

    // Set staking rewards in PersonaTokenFactory
    console.log("\n🔗 Setting staking rewards in PersonaTokenFactory...");
    const tx = await personaFactory.setStakingRewards(stakingRewardsAddress);
    await tx.wait();
    console.log("✅ Staking rewards set");
  }

  // If mainnet (or mainnet mock), withdraw initial supply
  const isMainnet = chainId === 1;
  if (isMainnet) {
    console.log("\n💰 Withdrawing initial AMICA supply to deployer...");
    const totalSupply = await amicaToken.TOTAL_SUPPLY();
    const tx = await amicaToken.withdraw(deployer.address, totalSupply);
    await tx.wait();
    console.log(`✅ ${ethers.formatEther(totalSupply)} AMICA withdrawn to deployer`);
  }

  const deploymentTime = (Date.now() - startTime) / 1000;
  console.log(`\n⏱️  Deployment completed in ${deploymentTime.toFixed(2)} seconds`);

  // Create addresses object with proper typing
  const addresses = {
    amicaToken: amicaAddress,
    amicaTokenImpl: amicaTokenImplAddress,
    personaFactory: personaFactoryAddress,
    personaFactoryImpl: personaFactoryImplAddress,
    proxyAdmin: amicaProxyAdminAddress, // Both proxies should use the same admin
    bridgeWrapper: bridgeWrapperAddress,
    erc20Implementation: erc20ImplAddress,
    bridgedAmicaAddress: options.bridgedAmicaAddress,
    stakingRewards: stakingRewardsAddress,
  } as ExtendedDeploymentAddresses;

  // Save deployment
  const deployment = {
    chainId,
    chainName: getNetworkName(chainId),
    addresses,
    blockNumber: await ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    transactionHashes: txHashes,
  };

  await deploymentManager.saveDeployment(deployment);

  // Verify contracts if requested
  if (options.verify) {
    console.log("\n🔍 Starting contract verification...");
    await verifyContracts(addresses, deployer.address, rewardsPerBlock, startBlock);
  }

  return addresses;
}

async function verifyContracts(
  addresses: ExtendedDeploymentAddresses,
  deployerAddress: string,
  rewardsPerBlock?: bigint,
  startBlock?: number
) {
  interface VerificationItem {
    name: string;
    address: string;
    args: any[];
    contract?: string;
  }

  const verifications: VerificationItem[] = [
    {
      name: "AmicaToken Implementation",
      address: addresses.amicaTokenImpl!,
      args: [],
      contract: "contracts/AmicaToken.sol:AmicaToken"
    },
    {
      name: "PersonaTokenFactory Implementation",
      address: addresses.personaFactoryImpl!,
      args: [],
      contract: "contracts/PersonaTokenFactory.sol:PersonaTokenFactory"
    },
    {
      name: "ERC20Implementation",
      address: addresses.erc20Implementation!,
      args: [],
    },
  ];

  // Verify proxy admin if needed
  if (addresses.proxyAdmin) {
    verifications.push({
      name: "ProxyAdmin",
      address: addresses.proxyAdmin,
      args: [deployerAddress],
      contract: "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol:ProxyAdmin"
    });
  }

  if (addresses.bridgeWrapper && addresses.bridgedAmicaAddress) {
    verifications.push({
      name: "AmicaBridgeWrapper",
      address: addresses.bridgeWrapper,
      args: [addresses.bridgedAmicaAddress, addresses.amicaToken!, deployerAddress],
    });
  }

  if (addresses.stakingRewards && rewardsPerBlock && startBlock) {
    verifications.push({
      name: "PersonaStakingRewards",
      address: addresses.stakingRewards,
      args: [addresses.amicaToken!, addresses.personaFactory!, rewardsPerBlock, startBlock],
    });
  }

  for (const verification of verifications) {
    console.log(`\nVerifying ${verification.name}...`);
    try {
      await verifyContract(verification.address, verification.args, verification.contract);
    } catch (error) {
      console.error(`Failed to verify ${verification.name}:`, error);
    }
  }

  // Verify proxies separately
  console.log("\nVerifying proxy contracts...");
  try {
    await verifyContract(addresses.amicaToken!, [], "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy");
  } catch (error) {
    console.error("Failed to verify AmicaToken proxy:", error);
  }

  try {
    await verifyContract(addresses.personaFactory!, [], "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy");
  } catch (error) {
    console.error("Failed to verify PersonaTokenFactory proxy:", error);
  }
}

function getNetworkName(chainId: number): string {
  const entry = Object.entries(networks).find(([_, config]) => config.chainId === chainId);
  return entry ? entry[0] : "unknown";
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const options: DeploymentOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--bridged-amica":
        options.bridgedAmicaAddress = args[++i];
        break;
      case "--verify":
        options.verify = true;
        break;
      case "--gas-price":
        options.gasPrice = ethers.parseUnits(args[++i], "gwei");
        break;
      case "--gas-limit":
        options.gasLimit = BigInt(args[++i]);
        break;
      case "--deploy-staking":
        options.deployStaking = true;
        break;
      case "--staking-rewards-per-block":
        options.stakingRewardsPerBlock = args[++i];
        break;
    }
  }

  // Validate bridged AMICA requirement for non-mainnet
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== 1 && !options.bridgedAmicaAddress && !process.env.BRIDGED_AMICA_ADDRESS) {
    console.error("❌ Error: Bridged AMICA address required for non-mainnet deployment");
    console.error("   Use --bridged-amica <address> or set BRIDGED_AMICA_ADDRESS env var");
    process.exit(1);
  }

  // Use env var if not provided via CLI
  if (!options.bridgedAmicaAddress && process.env.BRIDGED_AMICA_ADDRESS) {
    options.bridgedAmicaAddress = process.env.BRIDGED_AMICA_ADDRESS;
  }

  await deployContracts(options);
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
