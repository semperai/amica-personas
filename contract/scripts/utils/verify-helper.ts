import { run } from "hardhat";

export async function verifyContract(
  contractAddress: string,
  constructorArguments: any[],
  contract?: string
): Promise<void> {
  console.log(`Verifying contract at ${contractAddress}...`);

  try {
    const verifyArgs: any = {
      address: contractAddress,
      constructorArguments: constructorArguments,
    };

    if (contract) {
      verifyArgs.contract = contract;
    }

    await run("verify:verify", verifyArgs);
    console.log("✅ Contract verified successfully!");
  } catch (error: any) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("✅ Contract is already verified!");
    } else {
      console.error("❌ Verification failed:", error.message);
      throw error;
    }
  }
}
