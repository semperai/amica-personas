import { ethers } from "hardhat";

async function main() {
  console.log("Deploying Amica Protocol...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy AmicaToken
  console.log("Deploying AmicaToken...");
  const AmicaToken = await ethers.getContractFactory("AmicaToken");
  const amicaToken = await AmicaToken.deploy(deployer.address);
  await amicaToken.waitForDeployment();
  console.log("AmicaToken deployed to:", await amicaToken.getAddress());

  // Deploy ERC20Implementation
  console.log("Deploying ERC20Implementation...");
  const ERC20Implementation = await ethers.getContractFactory("ERC20Implementation");
  const erc20Implementation = await ERC20Implementation.deploy();
  await erc20Implementation.waitForDeployment();
  console.log("ERC20Implementation deployed to:", await erc20Implementation.getAddress());

  // For mainnet deployment, you would use actual Uniswap addresses
  // For local testing, deploy mocks
  console.log("Deploying Mock Uniswap contracts...");
  const MockUniswapV2Factory = await ethers.getContractFactory("MockUniswapV2Factory");
  const mockUniswapFactory = await MockUniswapV2Factory.deploy();
  await mockUniswapFactory.waitForDeployment();
  console.log("MockUniswapV2Factory deployed to:", await mockUniswapFactory.getAddress());

  const MockUniswapV2Router = await ethers.getContractFactory("MockUniswapV2Router");
  const mockUniswapRouter = await MockUniswapV2Router.deploy();
  await mockUniswapRouter.waitForDeployment();
  console.log("MockUniswapV2Router deployed to:", await mockUniswapRouter.getAddress());

  // Deploy PersonaTokenFactory
  console.log("Deploying PersonaTokenFactory...");
  const PersonaTokenFactory = await ethers.getContractFactory("PersonaTokenFactory");
  const personaFactory = await PersonaTokenFactory.deploy(
    await amicaToken.getAddress(),
    await mockUniswapFactory.getAddress(),
    await mockUniswapRouter.getAddress(),
    await erc20Implementation.getAddress()
  );
  await personaFactory.waitForDeployment();
  console.log("PersonaTokenFactory deployed to:", await personaFactory.getAddress());

  console.log("\nDeployment complete!");
  console.log("====================================");
  console.log("AmicaToken:", await amicaToken.getAddress());
  console.log("ERC20Implementation:", await erc20Implementation.getAddress());
  console.log("PersonaTokenFactory:", await personaFactory.getAddress());
  console.log("MockUniswapV2Factory:", await mockUniswapFactory.getAddress());
  console.log("MockUniswapV2Router:", await mockUniswapRouter.getAddress());
  console.log("====================================");

  // Verify contracts if on a real network
  if (process.env.ETHERSCAN_API_KEY && network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\nVerifying contracts...");
    await run("verify:verify", {
      address: await amicaToken.getAddress(),
      constructorArguments: [deployer.address],
    });

    await run("verify:verify", {
      address: await erc20Implementation.getAddress(),
      constructorArguments: [],
    });

    await run("verify:verify", {
      address: await personaFactory.getAddress(),
      constructorArguments: [
        await amicaToken.getAddress(),
        await mockUniswapFactory.getAddress(),
        await mockUniswapRouter.getAddress(),
        await erc20Implementation.getAddress()
      ],
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });