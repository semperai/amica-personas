import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeploymentManager } from "./utils/deployment-manager";
import { formatEther, parseEther } from "ethers";

// ============================================================================
// UTILITY TASKS
// ============================================================================

task("accounts", "Prints the list of accounts", async (_, hre) => {
  const accounts = await hre.ethers.getSigners();
  console.log("\n📝 Available Accounts:");
  console.log("=" * 50);
  for (let i = 0; i < accounts.length; i++) {
    const balance = await hre.ethers.provider.getBalance(accounts[i].address);
    console.log(`Account #${i}: ${accounts[i].address}`);
    console.log(`  Balance: ${formatEther(balance)} ETH`);
  }
});

task("balance", "Prints an account's balance")
  .addParam("account", "The account's address")
  .addOptionalParam("token", "Token address (default: ETH)")
  .setAction(async (taskArgs, hre) => {
    if (taskArgs.token) {
      const token = await hre.ethers.getContractAt("IERC20", taskArgs.token);
      const balance = await token.balanceOf(taskArgs.account);
      const symbol = await token.symbol();
      const decimals = await token.decimals();
      console.log(`${hre.ethers.formatUnits(balance, decimals)} ${symbol}`);
    } else {
      const balance = await hre.ethers.provider.getBalance(taskArgs.account);
      console.log(`${formatEther(balance)} ETH`);
    }
  });

task("deployments", "Show all deployments for current network")
  .setAction(async (_, hre) => {
    const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
    const deploymentManager = new DeploymentManager();
    const deployments = await deploymentManager.loadDeployments(chainId);
    
    console.log(`\n📋 Deployments for Chain ${chainId}:`);
    console.log("=" * 60);
    
    if (deployments.length === 0) {
      console.log("No deployments found");
      return;
    }
    
    deployments.forEach((deployment, index) => {
      console.log(`\nDeployment #${index + 1} (${deployment.timestamp})`);
      console.log(`  Deployer: ${deployment.deployer}`);
      console.log(`  Block: ${deployment.blockNumber}`);
      console.log(`  Contracts:`);
      console.log(`    AmicaToken: ${deployment.addresses.amicaToken}`);
      console.log(`    PersonaFactory: ${deployment.addresses.personaFactory}`);
      if (deployment.addresses.bridgeWrapper) {
        console.log(`    BridgeWrapper: ${deployment.addresses.bridgeWrapper}`);
      }
    });
  });

// ============================================================================
// PERSONA TASKS
// ============================================================================

task("create-persona", "Creates a new persona")
  .addParam("name", "Persona name")
  .addParam("symbol", "Persona symbol")
  .addOptionalParam("factory", "PersonaTokenFactory address (uses latest if not provided)")
  .addOptionalParam("pairingToken", "Pairing token address (default: AMICA)")
  .addOptionalParam("initialBuy", "Initial buy amount in ether units (default: 0)")
  .addOptionalParam("metadata", "JSON string of metadata key-value pairs")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    
    // Get factory address
    let factoryAddress = taskArgs.factory;
    if (!factoryAddress) {
      const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
      const deploymentManager = new DeploymentManager();
      const latest = await deploymentManager.getLatestDeployment(chainId);
      if (!latest) {
        throw new Error("No deployment found. Please provide factory address.");
      }
      factoryAddress = latest.addresses.personaFactory;
    }
    
    const factory = await hre.ethers.getContractAt("PersonaTokenFactory", factoryAddress);
    
    // Get pairing token (default to AMICA)
    let pairingToken = taskArgs.pairingToken;
    if (!pairingToken) {
      pairingToken = await factory.amicaToken();
    }
    
    // Parse metadata if provided
    let metadataKeys: string[] = [];
    let metadataValues: string[] = [];
    if (taskArgs.metadata) {
      const metadata = JSON.parse(taskArgs.metadata);
      metadataKeys = Object.keys(metadata);
      metadataValues = Object.values(metadata);
    }
    
    // Parse initial buy amount
    const initialBuy = taskArgs.initialBuy ? parseEther(taskArgs.initialBuy) : 0;
    
    console.log("\n🎨 Creating Persona:");
    console.log(`  Name: ${taskArgs.name}`);
    console.log(`  Symbol: ${taskArgs.symbol}`);
    console.log(`  Pairing Token: ${pairingToken}`);
    console.log(`  Initial Buy: ${taskArgs.initialBuy || "0"} tokens`);
    
    const tx = await factory.createPersona(
      pairingToken,
      taskArgs.name,
      taskArgs.symbol,
      metadataKeys,
      metadataValues,
      initialBuy
    );
    
    const receipt = await tx.wait();
    console.log("\n✅ Persona created!");
    console.log(`  Transaction: ${receipt?.hash}`);
    
    // Get the token ID from events
    const event = receipt?.logs.find(log => {
      try {
        const parsed = factory.interface.parseLog(log);
        return parsed?.name === "PersonaCreated";
      } catch {
        return false;
      }
    });
    
    if (event) {
      const parsed = factory.interface.parseLog(event);
      console.log(`  Token ID: ${parsed?.args.tokenId}`);
      console.log(`  ERC20 Token: ${parsed?.args.erc20Token}`);
    }
  });

task("persona-info", "Get detailed information about a persona")
  .addParam("tokenId", "The persona token ID")
  .addOptionalParam("factory", "PersonaTokenFactory address")
  .setAction(async (taskArgs, hre) => {
    const factoryAddress = await getFactoryAddress(taskArgs.factory, hre);
    const factory = await hre.ethers.getContractAt("PersonaTokenFactory", factoryAddress);
    
    const persona = await factory.getPersona(taskArgs.tokenId);
    const purchase = await factory.purchases(taskArgs.tokenId);
    const available = await factory.getAvailableTokens(taskArgs.tokenId);
    
    console.log("\n🎭 Persona Information:");
    console.log("=" * 50);
    console.log(`  Token ID: ${taskArgs.tokenId}`);
    console.log(`  Name: ${persona.name}`);
    console.log(`  Symbol: ${persona.symbol}`);
    console.log(`  ERC20 Token: ${persona.erc20Token}`);
    console.log(`  Pairing Token: ${persona.pairToken}`);
    console.log(`  Created At: ${new Date(Number(persona.createdAt) * 1000).toLocaleString()}`);
    console.log(`\n💰 Trading Status:`);
    console.log(`  Graduated: ${persona.pairCreated ? "Yes ✅" : "No ❌"}`);
    console.log(`  Total Deposited: ${formatEther(purchase.totalDeposited)}`);
    console.log(`  Tokens Sold: ${formatEther(purchase.tokensSold)}`);
    console.log(`  Available: ${formatEther(available)}`);
  });

task("buy-persona", "Buy persona tokens on bonding curve")
  .addParam("tokenId", "The persona token ID")
  .addParam("amount", "Amount to spend in ether units")
  .addOptionalParam("factory", "PersonaTokenFactory address")
  .addOptionalParam("slippage", "Slippage tolerance in basis points (default: 100 = 1%)")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const factoryAddress = await getFactoryAddress(taskArgs.factory, hre);
    const factory = await hre.ethers.getContractAt("PersonaTokenFactory", factoryAddress);
    
    const amountIn = parseEther(taskArgs.amount);
    const slippage = Number(taskArgs.slippage || "100");
    
    // Get quote
    const expectedOut = await factory.getAmountOutForUser(taskArgs.tokenId, amountIn, signer.address);
    const minOut = expectedOut * BigInt(10000 - slippage) / 10000n;
    
    console.log("\n💸 Buying Persona Tokens:");
    console.log(`  Token ID: ${taskArgs.tokenId}`);
    console.log(`  Amount In: ${formatEther(amountIn)}`);
    console.log(`  Expected Out: ${formatEther(expectedOut)}`);
    console.log(`  Min Out (${slippage/100}% slippage): ${formatEther(minOut)}`);
    
    // Approve pairing token
    const persona = await factory.getPersona(taskArgs.tokenId);
    const pairingToken = await hre.ethers.getContractAt("IERC20", persona.pairToken);
    const approveTx = await pairingToken.approve(factoryAddress, amountIn);
    await approveTx.wait();
    
    // Execute swap
    const tx = await factory.swapExactTokensForTokens(
      taskArgs.tokenId,
      amountIn,
      minOut,
      signer.address,
      Math.floor(Date.now() / 1000) + 300 // 5 min deadline
    );
    
    const receipt = await tx.wait();
    console.log("\n✅ Purchase complete!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

// ============================================================================
// ADMIN TASKS
// ============================================================================

task("configure-pairing", "Configure a pairing token")
  .addParam("token", "Token address to configure")
  .addParam("mintCost", "Cost to mint persona in token units")
  .addParam("graduationThreshold", "Threshold for Uniswap graduation in token units")
  .addOptionalParam("factory", "PersonaTokenFactory address")
  .setAction(async (taskArgs, hre) => {
    const factoryAddress = await getFactoryAddress(taskArgs.factory, hre);
    const factory = await hre.ethers.getContractAt("PersonaTokenFactory", factoryAddress);
    
    const mintCost = parseEther(taskArgs.mintCost);
    const threshold = parseEther(taskArgs.graduationThreshold);
    
    console.log("\n⚙️  Configuring Pairing Token:");
    console.log(`  Token: ${taskArgs.token}`);
    console.log(`  Mint Cost: ${taskArgs.mintCost}`);
    console.log(`  Graduation Threshold: ${taskArgs.graduationThreshold}`);
    
    const tx = await factory.configurePairingToken(taskArgs.token, mintCost, threshold);
    const receipt = await tx.wait();
    
    console.log("\n✅ Configuration updated!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

task("configure-fees", "Configure trading fee parameters")
  .addParam("feePercentage", "Fee percentage in basis points (100 = 1%)")
  .addParam("creatorShare", "Creator's share of fees in basis points (5000 = 50%)")
  .addOptionalParam("factory", "PersonaTokenFactory address")
  .setAction(async (taskArgs, hre) => {
    const factoryAddress = await getFactoryAddress(taskArgs.factory, hre);
    const factory = await hre.ethers.getContractAt("PersonaTokenFactory", factoryAddress);
    
    console.log("\n💰 Configuring Trading Fees:");
    console.log(`  Fee Percentage: ${Number(taskArgs.feePercentage) / 100}%`);
    console.log(`  Creator Share: ${Number(taskArgs.creatorShare) / 100}%`);
    
    const tx = await factory.configureTradingFees(taskArgs.feePercentage, taskArgs.creatorShare);
    const receipt = await tx.wait();
    
    console.log("\n✅ Fees configured!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

task("configure-fee-reduction", "Configure AMICA-based fee reduction")
  .addParam("minAmica", "Minimum AMICA for reduction in ether units")
  .addParam("maxAmica", "Maximum AMICA for full reduction in ether units")
  .addParam("minReduction", "Minimum reduction multiplier (9000 = 90% of fee)")
  .addParam("maxReduction", "Maximum reduction multiplier (0 = 0% of fee)")
  .addOptionalParam("factory", "PersonaTokenFactory address")
  .setAction(async (taskArgs, hre) => {
    const factoryAddress = await getFactoryAddress(taskArgs.factory, hre);
    const factory = await hre.ethers.getContractAt("PersonaTokenFactory", factoryAddress);
    
    const minAmica = parseEther(taskArgs.minAmica);
    const maxAmica = parseEther(taskArgs.maxAmica);
    
    console.log("\n🎯 Configuring Fee Reduction:");
    console.log(`  Min AMICA: ${taskArgs.minAmica}`);
    console.log(`  Max AMICA: ${taskArgs.maxAmica}`);
    console.log(`  Min Reduction: ${100 - Number(taskArgs.minReduction) / 100}%`);
    console.log(`  Max Reduction: ${100 - Number(taskArgs.maxReduction) / 100}%`);
    
    const tx = await factory.configureFeeReduction(
      minAmica,
      maxAmica,
      taskArgs.minReduction,
      taskArgs.maxReduction
    );
    const receipt = await tx.wait();
    
    console.log("\n✅ Fee reduction configured!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

task("pause-factory", "Pause the PersonaTokenFactory")
  .addOptionalParam("factory", "PersonaTokenFactory address")
  .setAction(async (taskArgs, hre) => {
    const factoryAddress = await getFactoryAddress(taskArgs.factory, hre);
    const factory = await hre.ethers.getContractAt("PersonaTokenFactory", factoryAddress);
    
    console.log("\n⏸️  Pausing PersonaTokenFactory...");
    const tx = await factory.pause();
    const receipt = await tx.wait();
    
    console.log("✅ Factory paused!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

task("unpause-factory", "Unpause the PersonaTokenFactory")
  .addOptionalParam("factory", "PersonaTokenFactory address")
  .setAction(async (taskArgs, hre) => {
    const factoryAddress = await getFactoryAddress(taskArgs.factory, hre);
    const factory = await hre.ethers.getContractAt("PersonaTokenFactory", factoryAddress);
    
    console.log("\n▶️  Unpausing PersonaTokenFactory...");
    const tx = await factory.unpause();
    const receipt = await tx.wait();
    
    console.log("✅ Factory unpaused!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

// ============================================================================
// AMICA TOKEN TASKS
// ============================================================================

task("amica-info", "Get AMICA token information")
  .addOptionalParam("amica", "AmicaToken address")
  .setAction(async (taskArgs, hre) => {
    const amicaAddress = await getAmicaAddress(taskArgs.amica, hre);
    const amica = await hre.ethers.getContractAt("AmicaToken", amicaAddress);
    
    const totalSupply = await amica.totalSupply();
    const circulatingSupply = await amica.circulatingSupply();
    const contractBalance = await amica.balanceOf(amicaAddress);
    const depositedTokens = await amica.getDepositedTokens();
    
    console.log("\n🪙 AMICA Token Information:");
    console.log("=" * 50);
    console.log(`  Address: ${amicaAddress}`);
    console.log(`  Total Supply: ${formatEther(totalSupply)}`);
    console.log(`  Circulating Supply: ${formatEther(circulatingSupply)}`);
    console.log(`  Contract Balance: ${formatEther(contractBalance)}`);
    console.log(`  Deposited Tokens: ${depositedTokens.length - 1}`); // -1 for index 0
    
    if (depositedTokens.length > 1) {
      console.log("\n📦 Deposited Tokens:");
      for (let i = 1; i < depositedTokens.length; i++) {
        const balance = await amica.depositedBalances(depositedTokens[i]);
        const token = await hre.ethers.getContractAt("IERC20", depositedTokens[i]);
        const symbol = await token.symbol();
        console.log(`  ${symbol}: ${formatEther(balance)}`);
      }
    }
  });

task("withdraw-amica", "Withdraw AMICA from contract (owner only)")
  .addParam("amount", "Amount to withdraw in ether units")
  .addParam("to", "Recipient address")
  .addOptionalParam("amica", "AmicaToken address")
  .setAction(async (taskArgs, hre) => {
    const amicaAddress = await getAmicaAddress(taskArgs.amica, hre);
    const amica = await hre.ethers.getContractAt("AmicaToken", amicaAddress);
    
    const amount = parseEther(taskArgs.amount);
    
    console.log("\n💸 Withdrawing AMICA:");
    console.log(`  Amount: ${taskArgs.amount} AMICA`);
    console.log(`  To: ${taskArgs.to}`);
    
    const tx = await amica.withdraw(taskArgs.to, amount);
    const receipt = await tx.wait();
    
    console.log("\n✅ Withdrawal complete!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

task("deposit-tokens", "Deposit tokens to AMICA for distribution")
  .addParam("token", "Token address to deposit")
  .addParam("amount", "Amount to deposit in ether units")
  .addOptionalParam("amica", "AmicaToken address")
  .setAction(async (taskArgs, hre) => {
    const amicaAddress = await getAmicaAddress(taskArgs.amica, hre);
    const amica = await hre.ethers.getContractAt("AmicaToken", amicaAddress);
    
    const amount = parseEther(taskArgs.amount);
    const token = await hre.ethers.getContractAt("IERC20", taskArgs.token);
    const symbol = await token.symbol();
    
    console.log("\n📥 Depositing Tokens:");
    console.log(`  Token: ${symbol} (${taskArgs.token})`);
    console.log(`  Amount: ${taskArgs.amount}`);
    
    // Approve
    const approveTx = await token.approve(amicaAddress, amount);
    await approveTx.wait();
    
    // Deposit
    const tx = await amica.deposit(taskArgs.token, amount);
    const receipt = await tx.wait();
    
    console.log("\n✅ Deposit complete!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

// ============================================================================
// BRIDGE WRAPPER TASKS
// ============================================================================

task("bridge-info", "Get bridge wrapper information")
  .addOptionalParam("wrapper", "BridgeWrapper address")
  .setAction(async (taskArgs, hre) => {
    const wrapperAddress = await getBridgeWrapperAddress(taskArgs.wrapper, hre);
    if (!wrapperAddress) {
      console.log("❌ No bridge wrapper deployed on this chain");
      return;
    }
    
    const wrapper = await hre.ethers.getContractAt("AmicaBridgeWrapper", wrapperAddress);
    
    const bridgedToken = await wrapper.bridgedAmicaToken();
    const nativeToken = await wrapper.nativeAmicaToken();
    const totalIn = await wrapper.totalBridgedIn();
    const totalOut = await wrapper.totalBridgedOut();
    const balance = await wrapper.bridgedBalance();
    const isPaused = await wrapper.paused();
    
    console.log("\n🌉 Bridge Wrapper Information:");
    console.log("=" * 50);
    console.log(`  Address: ${wrapperAddress}`);
    console.log(`  Status: ${isPaused ? "Paused ⏸️" : "Active ✅"}`);
    console.log(`  Bridged Token: ${bridgedToken}`);
    console.log(`  Native Token: ${nativeToken}`);
    console.log(`  Total Bridged In: ${formatEther(totalIn)}`);
    console.log(`  Total Bridged Out: ${formatEther(totalOut)}`);
    console.log(`  Current Balance: ${formatEther(balance)}`);
  });

task("pause-bridge", "Pause the bridge wrapper")
  .addOptionalParam("wrapper", "BridgeWrapper address")
  .setAction(async (taskArgs, hre) => {
    const wrapperAddress = await getBridgeWrapperAddress(taskArgs.wrapper, hre);
    if (!wrapperAddress) {
      console.log("❌ No bridge wrapper deployed on this chain");
      return;
    }
    
    const wrapper = await hre.ethers.getContractAt("AmicaBridgeWrapper", wrapperAddress);
    
    console.log("\n⏸️  Pausing Bridge Wrapper...");
    const tx = await wrapper.pause();
    const receipt = await tx.wait();
    
    console.log("✅ Bridge wrapper paused!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

task("unpause-bridge", "Unpause the bridge wrapper")
  .addOptionalParam("wrapper", "BridgeWrapper address")
  .setAction(async (taskArgs, hre) => {
    const wrapperAddress = await getBridgeWrapperAddress(taskArgs.wrapper, hre);
    if (!wrapperAddress) {
      console.log("❌ No bridge wrapper deployed on this chain");
      return;
    }
    
    const wrapper = await hre.ethers.getContractAt("AmicaBridgeWrapper", wrapperAddress);
    
    console.log("\n▶️  Unpausing Bridge Wrapper...");
    const tx = await wrapper.unpause();
    const receipt = await tx.wait();
    
    console.log("✅ Bridge wrapper unpaused!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

// ============================================================================
// USER TASKS
// ============================================================================

task("update-snapshot", "Update AMICA balance snapshot for fee reduction")
  .addOptionalParam("factory", "PersonaTokenFactory address")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const factoryAddress = await getFactoryAddress(taskArgs.factory, hre);
    const factory = await hre.ethers.getContractAt("PersonaTokenFactory", factoryAddress);
    
    console.log("\n📸 Updating AMICA Snapshot...");
    
    const tx = await factory.updateAmicaSnapshot();
    const receipt = await tx.wait();
    
    console.log("✅ Snapshot updated!");
    console.log(`  Transaction: ${receipt?.hash}`);
    console.log("\n⏳ Note: Snapshot will be active after 100 blocks");
  });

task("fee-info", "Get fee information for an address")
  .addParam("address", "Address to check")
  .addOptionalParam("factory", "PersonaTokenFactory address")
  .setAction(async (taskArgs, hre) => {
    const factoryAddress = await getFactoryAddress(taskArgs.factory, hre);
    const factory = await hre.ethers.getContractAt("PersonaTokenFactory", factoryAddress);
    
    const feeInfo = await factory.getUserFeeInfo(taskArgs.address);
    
    console.log("\n💰 Fee Information:");
    console.log("=" * 50);
    console.log(`  Current AMICA Balance: ${formatEther(feeInfo.currentBalance)}`);
    console.log(`  Snapshot Balance: ${formatEther(feeInfo.snapshotBalance)}`);
    console.log(`  Effective Balance: ${formatEther(feeInfo.effectiveBalance)}`);
    console.log(`  Snapshot Block: ${feeInfo.snapshotBlock_}`);
    console.log(`  Eligible: ${feeInfo.isEligible ? "Yes ✅" : "No ❌"}`);
    if (!feeInfo.isEligible && feeInfo.blocksUntilEligible > 0) {
      console.log(`  Blocks Until Eligible: ${feeInfo.blocksUntilEligible}`);
    }
    console.log(`\n📊 Fee Rates:`);
    console.log(`  Base Fee: ${Number(feeInfo.baseFeePercentage) / 100}%`);
    console.log(`  Your Fee: ${Number(feeInfo.effectiveFeePercentage) / 100}%`);
    console.log(`  Discount: ${Number(feeInfo.discountPercentage) / 100}%`);
  });

task("withdraw-unlocked", "Withdraw unlocked persona tokens")
  .addParam("tokenId", "Persona token ID")
  .addOptionalParam("factory", "PersonaTokenFactory address")
  .setAction(async (taskArgs, hre) => {
    const factoryAddress = await getFactoryAddress(taskArgs.factory, hre);
    const factory = await hre.ethers.getContractAt("PersonaTokenFactory", factoryAddress);
    
    console.log("\n🔓 Withdrawing Unlocked Tokens...");
    
    const tx = await factory.withdrawTokens(taskArgs.tokenId);
    const receipt = await tx.wait();
    
    console.log("✅ Tokens withdrawn!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function getFactoryAddress(providedAddress: string | undefined, hre: HardhatRuntimeEnvironment): Promise<string> {
  if (providedAddress) return providedAddress;
  
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  const deploymentManager = new DeploymentManager();
  const latest = await deploymentManager.getLatestDeployment(chainId);
  
  if (!latest) {
    throw new Error("No deployment found. Please provide factory address.");
  }
  
  return latest.addresses.personaFactory;
}

async function getAmicaAddress(providedAddress: string | undefined, hre: HardhatRuntimeEnvironment): Promise<string> {
  if (providedAddress) return providedAddress;
  
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  const deploymentManager = new DeploymentManager();
  const latest = await deploymentManager.getLatestDeployment(chainId);
  
  if (!latest) {
    throw new Error("No deployment found. Please provide AMICA address.");
  }
  
  return latest.addresses.amicaToken;
}

async function getBridgeWrapperAddress(providedAddress: string | undefined, hre: HardhatRuntimeEnvironment): Promise<string | undefined> {
  if (providedAddress) return providedAddress;
  
  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  const deploymentManager = new DeploymentManager();
  const latest = await deploymentManager.getLatestDeployment(chainId);
  
  return latest?.addresses.bridgeWrapper;
}

// Export for use in other scripts
export {};
