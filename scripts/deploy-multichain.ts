import { ethers } from "hardhat";
import { Contract } from "ethers";

interface DeploymentResult {
    amicaToken: Contract;
    personaFactory: Contract;
    bridgeWrapper?: Contract;
    erc20Implementation: Contract;
}

async function deployToChain(bridgedAmicaAddress?: string): Promise<DeploymentResult> {
    console.log("Starting deployment...");
    
    const [deployer] = await ethers.getSigners();
    const chainId = await deployer.provider!.getNetwork().then(n => n.chainId);
    
    console.log(`Deploying to chain ${chainId} with account: ${deployer.address}`);
    
    // Deploy AmicaToken
    const AmicaToken = await ethers.getContractFactory("AmicaToken");
    const amicaToken = await AmicaToken.deploy(deployer.address);
    await amicaToken.waitForDeployment();
    console.log("AmicaToken deployed to:", await amicaToken.getAddress());
    
    // Deploy ERC20 implementation for persona tokens
    const ERC20Implementation = await ethers.getContractFactory("ERC20Implementation");
    const erc20Implementation = await ERC20Implementation.deploy();
    await erc20Implementation.waitForDeployment();
    console.log("ERC20Implementation deployed to:", await erc20Implementation.getAddress());
    
    // Deploy PersonaTokenFactory
    const PersonaTokenFactory = await ethers.getContractFactory("PersonaTokenFactory");
    
    // For testing, we'll use mock Uniswap addresses or deploy mocks
    // In production, these would be the actual Uniswap addresses for each chain
    const uniswapFactory = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"; // Example address
    const uniswapRouter = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; // Example address
    
    const personaFactory = await ethers.getContractProxy(
        await PersonaTokenFactory.deploy(),
        PersonaTokenFactory,
        [
            await amicaToken.getAddress(),
            uniswapFactory,
            uniswapRouter,
            await erc20Implementation.getAddress()
        ]
    );
    await personaFactory.waitForDeployment();
    console.log("PersonaTokenFactory deployed to:", await personaFactory.getAddress());
    
    let bridgeWrapper;
    
    // If this is not mainnet and we have a bridged AMICA address, deploy bridge wrapper
    if (chainId !== 1n && bridgedAmicaAddress) {
        console.log("Deploying bridge wrapper for non-mainnet chain...");
        
        const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");
        bridgeWrapper = await AmicaBridgeWrapper.deploy(
            bridgedAmicaAddress,
            await amicaToken.getAddress(),
            deployer.address
        );
        await bridgeWrapper.waitForDeployment();
        console.log("AmicaBridgeWrapper deployed to:", await bridgeWrapper.getAddress());
        
        // Set bridge wrapper in AmicaToken
        await amicaToken.setBridgeWrapper(await bridgeWrapper.getAddress());
        console.log("Bridge wrapper set in AmicaToken");
    }
    
    // If mainnet, withdraw initial AMICA supply to owner
    if (chainId === 1n) {
        const totalSupply = await amicaToken.TOTAL_SUPPLY();
        await amicaToken.withdraw(deployer.address, totalSupply);
        console.log("Initial AMICA supply withdrawn to deployer");
    }
    
    return {
        amicaToken,
        personaFactory,
        bridgeWrapper,
        erc20Implementation
    };
}

async function main() {
    // Example: Deploy to a new chain with bridged AMICA address
    // In practice, you would get the bridged AMICA address after bridging from Ethereum
    
    const BRIDGED_AMICA_ADDRESS = process.env.BRIDGED_AMICA_ADDRESS;
    
    const deployment = await deployToChain(BRIDGED_AMICA_ADDRESS);
    
    console.log("\n=== Deployment Summary ===");
    console.log("AmicaToken:", await deployment.amicaToken.getAddress());
    console.log("PersonaTokenFactory:", await deployment.personaFactory.getAddress());
    if (deployment.bridgeWrapper) {
        console.log("AmicaBridgeWrapper:", await deployment.bridgeWrapper.getAddress());
    }
    console.log("ERC20Implementation:", await deployment.erc20Implementation.getAddress());
    
    // Save deployment addresses to a file or output them for reference
    const addresses = {
        amicaToken: await deployment.amicaToken.getAddress(),
        personaFactory: await deployment.personaFactory.getAddress(),
        bridgeWrapper: deployment.bridgeWrapper ? await deployment.bridgeWrapper.getAddress() : null,
        erc20Implementation: await deployment.erc20Implementation.getAddress(),
        chainId: await ethers.provider.getNetwork().then(n => n.chainId),
        timestamp: new Date().toISOString()
    };
    
    console.log("\nDeployment addresses:", JSON.stringify(addresses, null, 2));
}

// Execute deploy
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
