import { run } from "hardhat";
import { DeploymentManager } from "./utils/deployment-manager";

async function verify(contractAddress: string, constructorArguments: any[]) {
  console.log(`Verifying contract at ${contractAddress}...`);

  try {
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: constructorArguments,
    });
    console.log("Contract verified successfully!");
  } catch (error: any) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("Contract is already verified!");
    } else {
      console.error("Verification failed:", error);
    }
  }
}

// Verify all contracts from latest deployment
async function verifyLatestDeployment() {
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const deploymentManager = new DeploymentManager();
  const latest = await deploymentManager.getLatestDeployment(chainId);
  
  if (!latest) {
    console.error("No deployment found for current network");
    return;
  }
  
  console.log(`\n🔍 Verifying contracts from deployment: ${latest.timestamp}`);
  console.log(`Chain: ${latest.chainName} (${chainId})`);
  
  const contracts = [];
  
  // AmicaToken
  if (latest.addresses.amicaToken) {
    contracts.push({
      name: "AmicaToken",
      address: latest.addresses.amicaToken,
      args: [latest.deployer],
    });
  }
  
  // ERC20Implementation
  if (latest.addresses.erc20Implementation) {
    contracts.push({
      name: "ERC20Implementation",
      address: latest.addresses.erc20Implementation,
      args: [],
    });
  }
  
  // AmicaBridgeWrapper
  if (latest.addresses.bridgeWrapper && latest.addresses.bridgedAmicaAddress) {
    contracts.push({
      name: "AmicaBridgeWrapper",
      address: latest.addresses.bridgeWrapper,
      args: [
        latest.addresses.bridgedAmicaAddress,
        latest.addresses.amicaToken,
        latest.deployer
      ],
    });
  }
  
  // PersonaStakingRewards (need to get constructor args from events or config)
  if (latest.addresses.stakingRewards) {
    console.log("\n⚠️  Note: PersonaStakingRewards verification requires manual constructor args");
    console.log("   Use: npx hardhat verify --network <network> <address> <amicaToken> <personaFactory> <amicaPerBlock> <startBlock>");
  }
  
  // Verify each contract
  for (const contract of contracts) {
    console.log(`\n${contract.name}:`);
    await verify(contract.address, contract.args);
  }
}

// Manual verification with specific addresses
async function main() {
  const args = process.argv.slice(2);
  
  // Check if we should verify latest deployment
  if (args.includes("--latest")) {
    await verifyLatestDeployment();
    return;
  }
  
  // Otherwise, use manual contract list
  // Add your deployed contract addresses here
  const contracts = [
    {
      name: "AmicaToken",
      address: "0x...", // AmicaToken address
      args: ["0x..."], // constructor args: [initialOwner]
    },
    {
      name: "PersonaTokenFactory",
      address: "0x...", // PersonaTokenFactory proxy address
      args: [], // Proxy has no constructor args
    },
    {
      name: "PersonaTokenFactory Implementation",
      address: "0x...", // PersonaTokenFactory implementation address
      args: [], // Implementation has no constructor args
    },
    {
      name: "ERC20Implementation",
      address: "0x...", // ERC20Implementation address
      args: [], // No constructor args
    },
    {
      name: "AmicaBridgeWrapper",
      address: "0x...", // Bridge wrapper address (if deployed)
      args: ["0x...", "0x...", "0x..."], // [bridgedAmicaToken, nativeAmicaToken, owner]
    },
    {
      name: "PersonaStakingRewards",
      address: "0x...", // Staking rewards address (if deployed)
      args: ["0x...", "0x...", "10000000000000000000", "12345678"], // [amicaToken, personaFactory, amicaPerBlock, startBlock]
    },
  ];

  // Filter out placeholder addresses
  const validContracts = contracts.filter(c => !c.address.includes("..."));
  
  if (validContracts.length === 0) {
    console.log("No valid contract addresses found.");
    console.log("Please update the contract addresses in the script or use --latest flag.");
    return;
  }

  for (const contract of validContracts) {
    console.log(`\nVerifying ${contract.name}...`);
    await verify(contract.address, contract.args);
  }
}

// Usage: 
// - Verify latest deployment: npx hardhat run scripts/verify.ts --network <network> -- --latest
// - Manual verification: Update addresses in script, then run: npx hardhat run scripts/verify.ts --network <network>
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
