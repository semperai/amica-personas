import { ethers } from "hardhat";
import { Contract } from "ethers";
import { uniswapAddresses } from "../config/uniswap";
import { networks } from "../config/networks";
import { DeploymentManager } from "./utils/deployment-manager";
import { verifyContract } from "./utils/verify-helper";
import { DeploymentAddresses } from "../types/deployment";

const deploymentManager = new DeploymentManager();

interface DeploymentOptions {
  bridgedAmicaAddress?: string;
  verify?: boolean;
  gasPrice?: bigint;
  gasLimit?: bigint;
}

async function deployContracts(options: DeploymentOptions = {}): Promise<DeploymentAddresses> {
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
  
  // Deploy AmicaToken
  console.log("\n1️⃣ Deploying AmicaToken...");
  const AmicaToken = await ethers.getContractFactory("AmicaToken");
  const amicaToken = await AmicaToken.deploy(deployer.address, {
    gasPrice: options.gasPrice,
    gasLimit: options.gasLimit,
  });
  await amicaToken.waitForDeployment();
  const amicaAddress = await amicaToken.getAddress();
  txHashes.amicaToken = amicaToken.deploymentTransaction()?.hash;
  console.log(`✅ AmicaToken deployed to: ${amicaAddress}`);
  
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
  
  // Deploy PersonaTokenFactory
  console.log("\n3️⃣ Deploying PersonaTokenFactory...");
  const PersonaTokenFactory = await ethers.getContractFactory("PersonaTokenFactory");
  const personaFactoryImpl = await PersonaTokenFactory.deploy({
    gasPrice: options.gasPrice,
    gasLimit: options.gasLimit,
  });
  await personaFactoryImpl.waitForDeployment();
  
  // Deploy proxy
  const ProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
  const TransparentUpgradeableProxy = await ethers.getContractFactory("TransparentUpgradeableProxy");
  
  const proxyAdmin = await ProxyAdmin.deploy(deployer.address);
  await proxyAdmin.waitForDeployment();
  
  const initData = PersonaTokenFactory.interface.encodeFunctionData("initialize", [
    amicaAddress,
    uniswap.factory,
    uniswap.router,
    erc20ImplAddress,
  ]);
  
  const proxy = await TransparentUpgradeableProxy.deploy(
    await personaFactoryImpl.getAddress(),
    await proxyAdmin.getAddress(),
    initData,
    {
      gasPrice: options.gasPrice,
      gasLimit: options.gasLimit,
    }
  );
  await proxy.waitForDeployment();
  const personaFactoryAddress = await proxy.getAddress();
  txHashes.personaFactory = proxy.deploymentTransaction()?.hash;
  console.log(`✅ PersonaTokenFactory deployed to: ${personaFactoryAddress}`);
  
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
  
  // If mainnet, withdraw initial supply
  if (chainId === 1) {
    console.log("\n💰 Withdrawing initial AMICA supply to deployer...");
    const totalSupply = await amicaToken.TOTAL_SUPPLY();
    const tx = await amicaToken.withdraw(deployer.address, totalSupply);
    await tx.wait();
    console.log(`✅ ${ethers.formatEther(totalSupply)} AMICA withdrawn to deployer`);
  }
  
  const deploymentTime = (Date.now() - startTime) / 1000;
  console.log(`\n⏱️  Deployment completed in ${deploymentTime.toFixed(2)} seconds`);
  
  // Save deployment
  const deployment = {
    chainId,
    chainName: getNetworkName(chainId),
    addresses: {
      amicaToken: amicaAddress,
      personaFactory: personaFactoryAddress,
      bridgeWrapper: bridgeWrapperAddress,
      erc20Implementation: erc20ImplAddress,
      bridgedAmicaAddress: options.bridgedAmicaAddress,
    },
    blockNumber: await ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    transactionHashes: txHashes,
  };
  
  await deploymentManager.saveDeployment(deployment);
  
  // Verify contracts if requested
  if (options.verify) {
    console.log("\n🔍 Starting contract verification...");
    await verifyContracts(deployment.addresses, deployer.address);
  }
  
  return deployment.addresses;
}

async function verifyContracts(addresses: DeploymentAddresses, deployerAddress: string) {
  const verifications = [
    {
      name: "AmicaToken",
      address: addresses.amicaToken,
      args: [deployerAddress],
    },
    {
      name: "ERC20Implementation",
      address: addresses.erc20Implementation,
      args: [],
    },
  ];
  
  if (addresses.bridgeWrapper && addresses.bridgedAmicaAddress) {
    verifications.push({
      name: "AmicaBridgeWrapper",
      address: addresses.bridgeWrapper,
      args: [addresses.bridgedAmicaAddress, addresses.amicaToken, deployerAddress],
    });
  }
  
  for (const { name, address, args } of verifications) {
    console.log(`\nVerifying ${name}...`);
    await verifyContract(address, args);
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
