// scripts/verify.ts
import { run } from "hardhat";

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

// Usage: npx hardhat run scripts/verify.ts --network <network>
async function main() {
  // Add your deployed contract addresses here
  const contracts = [
    {
      address: "0x...", // AmicaToken address
      args: ["0x..."], // constructor args
    },
    {
      address: "0x...", // PersonaTokenFactory address
      args: ["0x...", "0x...", "0x...", "0x..."],
    },
  ];

  for (const contract of contracts) {
    await verify(contract.address, contract.args);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
