import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import { uniswapAddresses } from "../config/uniswap";
import { networks } from "../config/networks";
import { DeploymentManager } from "./utils/deployment-manager";
import { verifyContract } from "./utils/verify-helper";
import { ExtendedDeploymentAddresses } from "../types/deployment";

const deploymentManager = new DeploymentManager();

const STAKING_REWARDS_PER_BLOCK = ethers.parseEther("1");
const GAS_PRICE_DEFAULT = ethers.parseUnits("0.01", "gwei");
const GAS_LIMIT_DEFAULT = 10_000_000;
const BRIDGED_AMICA_ADDRESS = "0x33c38a54E3A02b1cb7133A157D72DAc4BFadd88f";


async function deployContracts() {
  console.log("🚀 Starting deployment...");
  console.log(`Using ${BRIDGED_AMICA_ADDRESS} as bridged AMICA address`);

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);


  const blockNumber = await ethers.provider.getBlockNumber();

  console.log(`📍 Network: ${networks[getNetworkName(chainId)]?.name || "Unknown"} (Chain ID: ${chainId})`);
  console.log(`👤 Deployer: ${deployer.address}`);
  console.log(`💰 Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  console.log(`📅 Block Number: ${blockNumber}`);

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
  const upgradeOptions = {
    txOverrides: {
      gasPrice: GAS_PRICE_DEFAULT,
      gasLimit: GAS_LIMIT_DEFAULT,
    }
  };

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
  let bridgeWrapperImplAddress: string | undefined;
  let bridgeProxyAdminAddress: string | undefined;

  if (chainId !== 1) {
    console.log("\n4️⃣ Deploying AmicaBridgeWrapper...");
    const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");

    // Deploy as upgradeable proxy
    const bridgeWrapper = await upgrades.deployProxy(
      AmicaBridgeWrapper,
      [
        BRIDGED_AMICA_ADDRESS,
        amicaAddress,
        deployer.address
      ],
      {
        initializer: "initialize",
        ...upgradeOptions
      }
    );
    await bridgeWrapper.waitForDeployment();
    bridgeWrapperAddress = await bridgeWrapper.getAddress();

    // Get implementation and admin addresses for verification
    bridgeWrapperImplAddress = await upgrades.erc1967.getImplementationAddress(bridgeWrapperAddress);
    bridgeProxyAdminAddress = await upgrades.erc1967.getAdminAddress(bridgeWrapperAddress);

    txHashes.bridgeWrapper = bridgeWrapper.deploymentTransaction()?.hash;
    console.log(`✅ AmicaBridgeWrapper proxy deployed to: ${bridgeWrapperAddress}`);
    console.log(`   Implementation: ${bridgeWrapperImplAddress}`);
    console.log(`   ProxyAdmin: ${bridgeProxyAdminAddress}`);

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

  console.log("\n5️⃣ Deploying PersonaStakingRewards...");
  const PersonaStakingRewards = await ethers.getContractFactory("PersonaStakingRewards");
  rewardsPerBlock = STAKING_REWARDS_PER_BLOCK;

  const currentBlock = await ethers.provider.getBlockNumber();
  startBlock = currentBlock + 100; // Start rewards 100 blocks from now

  const stakingRewards = await PersonaStakingRewards.deploy(
    amicaAddress,
    personaFactoryAddress,
    rewardsPerBlock,
    startBlock,
    {
      gasPrice: GAS_PRICE_DEFAULT,
      gasLimit: GAS_LIMIT_DEFAULT,
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
    proxyAdmin: amicaProxyAdminAddress, // All proxies should use the same admin
    bridgeWrapper: bridgeWrapperAddress,
    bridgeWrapperImpl: bridgeWrapperImplAddress,
    erc20Implementation: erc20ImplAddress,
    bridgedAmicaAddress: BRIDGED_AMICA_ADDRESS,
    stakingRewards: stakingRewardsAddress,
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
