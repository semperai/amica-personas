import { ethers } from "hardhat";

/**
 * Script to handle the conversion of bridged AMICA to native AMICA on a new chain
 *
 * Usage:
 * 1. Set environment variables:
 *    - BRIDGE_WRAPPER_ADDRESS: Address of the deployed bridge wrapper
 *    - BRIDGED_AMICA_ADDRESS: Address of the bridged AMICA token
 *    - AMOUNT_TO_CONVERT: Amount of bridged AMICA to convert (in ether units)
 *
 * 2. Run: npx hardhat run scripts/bridge-conversion.ts --network <network-name>
 */

async function main() {
    const [signer] = await ethers.getSigners();
    console.log("Converting bridged AMICA with account:", signer.address);

    // Get addresses from environment
    const bridgeWrapperAddress = process.env.BRIDGE_WRAPPER_ADDRESS;
    const bridgedAmicaAddress = process.env.BRIDGED_AMICA_ADDRESS;
    const amountToConvert = process.env.AMOUNT_TO_CONVERT || "1000";

    if (!bridgeWrapperAddress || !bridgedAmicaAddress) {
        throw new Error("Please set BRIDGE_WRAPPER_ADDRESS and BRIDGED_AMICA_ADDRESS environment variables");
    }

    // Get contract instances
    const bridgeWrapper = await ethers.getContractAt("AmicaBridgeWrapper", bridgeWrapperAddress);
    const bridgedAmica = await ethers.getContractAt("IERC20", bridgedAmicaAddress);

    // Get native AMICA address from bridge wrapper
    const nativeAmicaAddress = await bridgeWrapper.nativeAmicaToken();
    const nativeAmica = await ethers.getContractAt("IERC20", nativeAmicaAddress);

    // Convert amount to wei
    const amount = ethers.parseEther(amountToConvert);

    console.log("\n=== Pre-conversion balances ===");
    console.log("Bridged AMICA balance:", ethers.formatEther(await bridgedAmica.balanceOf(signer.address)));
    console.log("Native AMICA balance:", ethers.formatEther(await nativeAmica.balanceOf(signer.address)));
    console.log("Amount to convert:", amountToConvert, "AMICA");

    // Check if user has enough bridged tokens
    const bridgedBalance = await bridgedAmica.balanceOf(signer.address);
    if (bridgedBalance < amount) {
        throw new Error(`Insufficient bridged AMICA balance. Have: ${ethers.formatEther(bridgedBalance)}, Need: ${amountToConvert}`);
    }

    // Approve bridge wrapper to spend bridged tokens
    console.log("\nApproving bridge wrapper...");
    const approveTx = await bridgedAmica.approve(bridgeWrapperAddress, amount);
    await approveTx.wait();
    console.log("Approval complete!");

    // Wrap bridged tokens to get native tokens
    console.log("\nWrapping bridged AMICA to native AMICA...");
    const wrapTx = await bridgeWrapper.wrap(amount);
    const receipt = await wrapTx.wait();
    console.log("Wrap transaction complete!");
    console.log("Transaction hash:", receipt?.hash);

    // Show post-conversion balances
    console.log("\n=== Post-conversion balances ===");
    console.log("Bridged AMICA balance:", ethers.formatEther(await bridgedAmica.balanceOf(signer.address)));
    console.log("Native AMICA balance:", ethers.formatEther(await nativeAmica.balanceOf(signer.address)));

    // Show bridge wrapper stats
    console.log("\n=== Bridge wrapper stats ===");
    console.log("Total bridged in:", ethers.formatEther(await bridgeWrapper.totalBridgedIn()));
    console.log("Total bridged out:", ethers.formatEther(await bridgeWrapper.totalBridgedOut()));
    console.log("Bridged balance held:", ethers.formatEther(await bridgeWrapper.bridgedBalance()));
}

// Unwrap function (convert native back to bridged for bridging back to Ethereum)
async function unwrap() {
    const [signer] = await ethers.getSigners();
    console.log("Converting native AMICA back to bridged with account:", signer.address);

    const bridgeWrapperAddress = process.env.BRIDGE_WRAPPER_ADDRESS;
    const amountToConvert = process.env.AMOUNT_TO_CONVERT || "1000";

    if (!bridgeWrapperAddress) {
        throw new Error("Please set BRIDGE_WRAPPER_ADDRESS environment variable");
    }

    const bridgeWrapper = await ethers.getContractAt("AmicaBridgeWrapper", bridgeWrapperAddress);
    const nativeAmicaAddress = await bridgeWrapper.nativeAmicaToken();
    const bridgedAmicaAddress = await bridgeWrapper.bridgedAmicaToken();

    const nativeAmica = await ethers.getContractAt("IERC20", nativeAmicaAddress);
    const bridgedAmica = await ethers.getContractAt("IERC20", bridgedAmicaAddress);

    const amount = ethers.parseEther(amountToConvert);

    console.log("\n=== Pre-unwrap balances ===");
    console.log("Native AMICA balance:", ethers.formatEther(await nativeAmica.balanceOf(signer.address)));
    console.log("Bridged AMICA balance:", ethers.formatEther(await bridgedAmica.balanceOf(signer.address)));

    // Approve bridge wrapper to burn native tokens
    console.log("\nApproving bridge wrapper to burn native tokens...");
    const approveTx = await nativeAmica.approve(bridgeWrapperAddress, amount);
    await approveTx.wait();

    // Unwrap native tokens to get bridged tokens
    console.log("\nUnwrapping native AMICA to bridged AMICA...");
    const unwrapTx = await bridgeWrapper.unwrap(amount);
    const receipt = await unwrapTx.wait();
    console.log("Unwrap transaction complete!");
    console.log("Transaction hash:", receipt?.hash);

    console.log("\n=== Post-unwrap balances ===");
    console.log("Native AMICA balance:", ethers.formatEther(await nativeAmica.balanceOf(signer.address)));
    console.log("Bridged AMICA balance:", ethers.formatEther(await bridgedAmica.balanceOf(signer.address)));
}

// Check which function to run based on command line argument
if (process.argv.includes("--unwrap")) {
    unwrap()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
} else {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
