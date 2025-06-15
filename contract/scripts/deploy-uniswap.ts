// scripts/deploy-uniswap-v2.ts
import { ethers } from "hardhat";
import { ContractFactory } from "ethers";
import fs from "fs";
import path from "path";

// Import Uniswap artifacts
import WETH9 from "@uniswap/v2-periphery/build/WETH9.json";
import UniswapV2Factory from "@uniswap/v2-core/build/UniswapV2Factory.json";
import UniswapV2Router02 from "@uniswap/v2-periphery/build/UniswapV2Router02.json";

interface DeploymentAddresses {
  weth: string;
  factory: string;
  router: string;
  deployer: string;
  chainId: number;
  chainName: string;
  blockNumber: number;
  timestamp: string;
}

async function main(): Promise<void> {
  console.log("🦄 Deploying Uniswap V2 contracts...\n");

  // Get signer and network info
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  
  console.log(`📍 Network: ${network.name} (chainId: ${chainId})`);
  console.log(`👤 Deployer: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);

  // Deploy WETH
  console.log("1️⃣ Deploying WETH9...");
  const WETHFactory = new ContractFactory(
    WETH9.abi,
    WETH9.bytecode,
    deployer
  );
  const weth = await WETHFactory.deploy();
  await weth.waitForDeployment();
  const wethAddress = await weth.getAddress();
  console.log(`✅ WETH deployed at: ${wethAddress}`);

  // Deploy Factory
  console.log("\n2️⃣ Deploying UniswapV2Factory...");
  const FactoryContract = new ContractFactory(
    UniswapV2Factory.abi,
    UniswapV2Factory.bytecode,
    deployer
  );
  const factory = await FactoryContract.deploy(deployer.address);
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`✅ Factory deployed at: ${factoryAddress}`);

  // Deploy Router
  console.log("\n3️⃣ Deploying UniswapV2Router02...");
  const RouterContract = new ContractFactory(
    UniswapV2Router02.abi,
    UniswapV2Router02.bytecode,
    deployer
  );
  const router = await RouterContract.deploy(factoryAddress, wethAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log(`✅ Router deployed at: ${routerAddress}`);

  // Wait for confirmations on live networks
  if (chainId !== 31337 && chainId !== 1337) {
    console.log("\n⏳ Waiting for confirmations...");
    await weth.deploymentTransaction()?.wait(5);
    await factory.deploymentTransaction()?.wait(5);
    await router.deploymentTransaction()?.wait(5);
    console.log("✅ Confirmations received");
  }

  // Prepare deployment info
  const deployment: DeploymentAddresses = {
    weth: wethAddress,
    factory: factoryAddress,
    router: routerAddress,
    deployer: deployer.address,
    chainId: chainId,
    chainName: network.name,
    blockNumber: await ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
  };

  // Save deployment info
  const deploymentsDir = path.join(__dirname, "../deployments/uniswap");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `uniswap-v2-${network.name}-${chainId}.json`;
  const filepath = path.join(deploymentsDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(deployment, null, 2));
  console.log(`\n💾 Deployment info saved to: deployments/uniswap/${filename}`);

  // Display summary
  console.log("\n📋 Deployment Summary:");
  console.log("=".repeat(50));
  console.log(`WETH:    ${wethAddress}`);
  console.log(`Factory: ${factoryAddress}`);
  console.log(`Router:  ${routerAddress}`);
  console.log("=".repeat(50));

  // Display verification commands for live networks
  if (chainId !== 31337 && chainId !== 1337 && process.env.ETHERSCAN_API_KEY) {
    console.log("\n🔍 To verify contracts, run:");
    console.log(`npx hardhat verify --network ${network.name} ${wethAddress}`);
    console.log(`npx hardhat verify --network ${network.name} ${factoryAddress} "${deployer.address}"`);
    console.log(`npx hardhat verify --network ${network.name} ${routerAddress} "${factoryAddress}" "${wethAddress}"`);
  }

  console.log("\n✨ Uniswap V2 deployment complete!");
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
