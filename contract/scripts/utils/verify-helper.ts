import { run } from "hardhat";

export async function verifyContract(
  address: string,
  constructorArgs: any[],
  contractPath?: string
): Promise<boolean> {
  try {
    console.log(`Verifying contract at ${address}...`);
    
    const verifyArgs: any = {
      address,
      constructorArguments: constructorArgs,
    };
    
    if (contractPath) {
      verifyArgs.contract = contractPath;
    }
    
    await run("verify:verify", verifyArgs);
    console.log("✅ Contract verified successfully!");
    return true;
  } catch (error: any) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log("✅ Contract is already verified!");
      return true;
    }
    console.error("❌ Verification failed:", error.message);
    return false;
  }
}
