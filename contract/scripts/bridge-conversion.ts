import { ethers } from "hardhat";
import { formatEther, parseEther } from "ethers";

/**
 * Script to handle the conversion of bridged AMICA to native AMICA on a new chain
 * Now supports the updated AmicaBridgeWrapper contract
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

    // Check if bridge wrapper is paused
    const isPaused = await bridgeWrapper.paused();
    if (isPaused) {
        console.log("⚠️  Warning: Bridge wrapper is currently paused!");
    }

    // Convert amount to wei
    const amount = parseEther(amountToConvert);

    console.log("\n=== Pre-conversion balances ===");
    console.log("Bridged AMICA balance:", formatEther(await bridgedAmica.balanceOf(signer.address)));
    console.log("Native AMICA balance:", formatEther(await nativeAmica.balanceOf(signer.address)));
    console.log("Amount to convert:", amountToConvert, "AMICA");

    // Check if user has enough bridged tokens
    const bridgedBalance = await bridgedAmica.balanceOf(signer.address);
    if (bridgedBalance < amount) {
        throw new Error(`Insufficient bridged AMICA balance. Have: ${formatEther(bridgedBalance)}, Need: ${amountToConvert}`);
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
    console.log("Bridged AMICA balance:", formatEther(await bridgedAmica.balanceOf(signer.address)));
    console.log("Native AMICA balance:", formatEther(await nativeAmica.balanceOf(signer.address)));

    // Show bridge wrapper stats
    console.log("\n=== Bridge wrapper stats ===");
    console.log("Total bridged in:", formatEther(await bridgeWrapper.totalBridgedIn()));
    console.log("Total bridged out:", formatEther(await bridgeWrapper.totalBridgedOut()));
    console.log("Bridged balance held:", formatEther(await bridgeWrapper.bridgedBalance()));
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

    // Check if bridge wrapper is paused
    const isPaused = await bridgeWrapper.paused();
    if (isPaused) {
        console.log("⚠️  Warning: Bridge wrapper is currently paused!");
    }

    const amount = parseEther(amountToConvert);

    console.log("\n=== Pre-unwrap balances ===");
    console.log("Native AMICA balance:", formatEther(await nativeAmica.balanceOf(signer.address)));
    console.log("Bridged AMICA balance:", formatEther(await bridgedAmica.balanceOf(signer.address)));
    console.log("Amount to convert:", amountToConvert, "AMICA");

    // Check if contract has enough bridged tokens
    const contractBridgedBalance = await bridgeWrapper.bridgedBalance();
    if (contractBridgedBalance < amount) {
        throw new Error(`Insufficient bridged tokens in wrapper. Available: ${formatEther(contractBridgedBalance)}, Need: ${amountToConvert}`);
    }

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
    console.log("Native AMICA balance:", formatEther(await nativeAmica.balanceOf(signer.address)));
    console.log("Bridged AMICA balance:", formatEther(await bridgedAmica.balanceOf(signer.address)));

    // Show bridge wrapper stats
    console.log("\n=== Bridge wrapper stats ===");
    console.log("Total bridged in:", formatEther(await bridgeWrapper.totalBridgedIn()));
    console.log("Total bridged out:", formatEther(await bridgeWrapper.totalBridgedOut()));
    console.log("Bridged balance held:", formatEther(await bridgeWrapper.bridgedBalance()));
}

// Emergency withdraw function (owner only)
async function emergencyWithdraw() {
    const [signer] = await ethers.getSigners();
    console.log("Performing emergency withdraw with account:", signer.address);

    const bridgeWrapperAddress = process.env.BRIDGE_WRAPPER_ADDRESS;
    const tokenAddress = process.env.EMERGENCY_TOKEN_ADDRESS;
    const recipientAddress = process.env.EMERGENCY_RECIPIENT || signer.address;
    const amount = process.env.EMERGENCY_AMOUNT || "0";

    if (!bridgeWrapperAddress || !tokenAddress) {
        throw new Error("Please set BRIDGE_WRAPPER_ADDRESS and EMERGENCY_TOKEN_ADDRESS environment variables");
    }

    const bridgeWrapper = await ethers.getContractAt("AmicaBridgeWrapper", bridgeWrapperAddress);
    const token = await ethers.getContractAt("IERC20", tokenAddress);
    const tokenSymbol = await token.symbol();

    console.log("\n⚠️  EMERGENCY WITHDRAW");
    console.log(`Token: ${tokenSymbol} (${tokenAddress})`);
    console.log(`Recipient: ${recipientAddress}`);
    console.log(`Amount: ${amount === "0" ? "maximum allowed" : formatEther(parseEther(amount))}`);

    // If it's bridged AMICA, calculate maximum allowed
    const bridgedAmicaAddress = await bridgeWrapper.bridgedAmicaToken();
    if (tokenAddress.toLowerCase() === bridgedAmicaAddress.toLowerCase()) {
        const totalIn = await bridgeWrapper.totalBridgedIn();
        const totalOut = await bridgeWrapper.totalBridgedOut();
        const requiredBalance = totalIn - totalOut;
        const currentBalance = await token.balanceOf(bridgeWrapperAddress);
        const excess = currentBalance > requiredBalance ? currentBalance - requiredBalance : 0n;
        
        console.log("\nBridged AMICA Analysis:");
        console.log(`Current balance: ${formatEther(currentBalance)}`);
        console.log(`Required balance: ${formatEther(requiredBalance)}`);
        console.log(`Excess (withdrawable): ${formatEther(excess)}`);
        
        if (amount === "0") {
            amount = excess.toString();
        }
    }

    const withdrawAmount = parseEther(amount);
    
    console.log("\nExecuting emergency withdraw...");
    const tx = await bridgeWrapper.emergencyWithdraw(tokenAddress, recipientAddress, withdrawAmount);
    const receipt = await tx.wait();
    
    console.log("✅ Emergency withdraw complete!");
    console.log("Transaction hash:", receipt?.hash);
}

// Check which function to run based on command line argument
if (process.argv.includes("--unwrap")) {
    unwrap()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
} else if (process.argv.includes("--emergency")) {
    emergencyWithdraw()
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
