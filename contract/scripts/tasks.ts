import { task } from "hardhat/config";
import fs from "fs";
import path from "path";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeploymentManager } from "./utils/deployment-manager";
import { formatEther, parseEther } from "ethers";
import { TestERC20 } from "../typechain-types";

// ============================================================================
// UTILITY TASKS
// ============================================================================

task("accounts", "Prints the list of accounts", async (_, hre) => {
  const accounts = await hre.ethers.getSigners();
  console.log("\n📝 Available Accounts:");
  console.log("=".repeat(50));
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
      const token = await hre.ethers.getContractAt("ERC20", taskArgs.token);
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
    console.log("=".repeat(60));

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
      if (deployment.addresses.stakingRewards) {
        console.log(`    StakingRewards: ${deployment.addresses.stakingRewards}`);
      }
    });
  });

task("deploy-token", "Deploy a TestERC20 token")
  .addOptionalParam("name", "The token name", "Test Token")
  .addOptionalParam("symbol", "The token symbol", "TEST")
  .addOptionalParam("supply", "The total supply (without decimals)", "1000000000")
  .addOptionalParam("decimals", "The number of decimals", "18")
  .setAction(async ({ name, symbol, supply, decimals }, hre) => {
    const { ethers } = hre;

    // Get network and signer info
    const network = await ethers.provider.getNetwork();
    const [deployer] = await ethers.getSigners();

    console.log(`\n🚀 Deploying TestERC20 Token`);
    console.log(`Network: ${network.name} (chainId: ${network.chainId})`);
    console.log(`Deployer: ${deployer.address}`);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Deployer balance: ${ethers.formatEther(balance)} ETH`);
    console.log("");

    // Token parameters
    console.log(`📋 Token Parameters:`);
    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Total Supply: ${supply} ${symbol}`);
    console.log(`Decimals: ${decimals}`);
    console.log("");

    // Calculate actual supply with decimals
    const actualSupply = ethers.parseUnits(supply, parseInt(decimals));

    // Deploy the token
    console.log(`⏳ Deploying ${symbol} token...`);
    const TestERC20 = await ethers.getContractFactory("TestERC20");
    const token = await TestERC20.deploy(name, symbol, actualSupply);

    console.log(`✅ ${symbol} token deployed at: ${await token.getAddress()}`);

    // Save deployment info
    const deploymentInfo = {
      token: {
        name: name,
        symbol: symbol,
        decimals: parseInt(decimals.toString()),
        totalSupply: supply.toString(),
        address: await token.getAddress(),
      },
      network: network.name,
      chainId: network.chainId.toString(),
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
    };

    // Save to file
    const deploymentsDir = path.join(process.cwd(), 'deployments/tokens');
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const filename = `${symbol.toLowerCase()}-${network.name}-${network.chainId}.json`;
    const filepath = path.join(deploymentsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n💾 Deployment info saved to: deployments/tokens/${filename}`);

    console.log("\n✨ Deployment complete!");
  });


// ============================================================================
// PERSONA TASKS WITH AGENT TOKEN SUPPORT
// ============================================================================

task("create-persona", "Creates a new persona with optional agent token")
  .addParam("name", "Persona name")
  .addParam("symbol", "Persona symbol")
  .addOptionalParam("factory", "PersonaTokenFactory address (uses latest if not provided)")
  .addOptionalParam("pairingToken", "Pairing token address (default: AMICA)")
  .addOptionalParam("initialBuy", "Initial buy amount in ether units (default: 0)")
  .addOptionalParam("metadata", "JSON string of metadata key-value pairs")
  .addOptionalParam("agentToken", "Agent token address (optional)")
  .addOptionalParam("minAgentTokens", "Minimum agent tokens for graduation (default: 0)")
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

    // Parse agent token parameters
    const agentToken = taskArgs.agentToken || "0x0000000000000000000000000000000000000000";
    const minAgentTokens = taskArgs.minAgentTokens ? parseEther(taskArgs.minAgentTokens) : 0;

    console.log("\n🎨 Creating Persona:");
    console.log(`  Name: ${taskArgs.name}`);
    console.log(`  Symbol: ${taskArgs.symbol}`);
    console.log(`  Pairing Token: ${pairingToken}`);
    console.log(`  Initial Buy: ${taskArgs.initialBuy || "0"} tokens`);
    if (agentToken !== "0x0000000000000000000000000000000000000000") {
      console.log(`  Agent Token: ${agentToken}`);
      console.log(`  Min Agent Tokens: ${taskArgs.minAgentTokens || "0"}`);
    }

    const tx = await factory.createPersona(
      pairingToken,
      taskArgs.name,
      taskArgs.symbol,
      metadataKeys,
      metadataValues,
      initialBuy,
      agentToken,
      minAgentTokens
    );

    const receipt = await tx.wait();
    console.log("\n✅ Persona created!");
    console.log(`  Transaction: ${receipt?.hash}`);

    // Get the token ID from events
    const event = receipt?.logs.find((log: any) => {
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
    const distribution = await factory.getTokenDistribution(taskArgs.tokenId);

    console.log("\n🎭 Persona Information:");
    console.log("=".repeat(50));
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
    console.log(`\n📊 Token Distribution:`);
    console.log(`  Liquidity: ${formatEther(distribution.liquidityAmount)}`);
    console.log(`  Bonding: ${formatEther(distribution.bondingAmount)}`);
    console.log(`  AMICA: ${formatEther(distribution.amicaAmount)}`);
    console.log(`  Agent Rewards: ${formatEther(distribution.agentRewardsAmount)}`);

    // Check graduation eligibility
    const [eligible, reason] = await factory.canGraduate(taskArgs.tokenId);
    console.log(`\n🎓 Graduation Status:`);
    console.log(`  Eligible: ${eligible ? "Yes ✅" : "No ❌"}`);
    if (!eligible) {
      console.log(`  Reason: ${reason}`);
    }
  });

// ============================================================================
// AGENT TOKEN TASKS
// ============================================================================

task("approve-agent-token", "Approve an agent token for use in the system")
  .addParam("token", "Agent token address")
  .addParam("approved", "true or false")
  .addOptionalParam("factory", "PersonaTokenFactory address")
  .setAction(async (taskArgs, hre) => {
    const factoryAddress = await getFactoryAddress(taskArgs.factory, hre);
    const factory = await hre.ethers.getContractAt("PersonaTokenFactory", factoryAddress);

    const approved = taskArgs.approved.toLowerCase() === "true";

    console.log(`\n🔐 ${approved ? "Approving" : "Revoking"} Agent Token:`);
    console.log(`  Token: ${taskArgs.token}`);

    const tx = await factory.approveAgentToken(taskArgs.token, approved);
    const receipt = await tx.wait();

    console.log(`\n✅ Agent token ${approved ? "approved" : "revoked"}!`);
    console.log(`  Transaction: ${receipt?.hash}`);
  });

task("deposit-agent-tokens", "Deposit agent tokens for a persona")
  .addParam("tokenId", "The persona token ID")
  .addParam("amount", "Amount to deposit in ether units")
  .addOptionalParam("factory", "PersonaTokenFactory address")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const factoryAddress = await getFactoryAddress(taskArgs.factory, hre);
    const factory = await hre.ethers.getContractAt("PersonaTokenFactory", factoryAddress);

    const amount = parseEther(taskArgs.amount);
    const persona = await factory.personas(taskArgs.tokenId);

    console.log("\n💎 Depositing Agent Tokens:");
    console.log(`  Token ID: ${taskArgs.tokenId}`);
    console.log(`  Amount: ${taskArgs.amount}`);
    console.log(`  Agent Token: ${persona.agentToken}`);

    // Approve agent token
    const agentToken = await hre.ethers.getContractAt("IERC20", persona.agentToken);
    const approveTx = await agentToken.approve(factoryAddress, amount);
    await approveTx.wait();

    // Deposit
    const tx = await factory.depositAgentTokens(taskArgs.tokenId, amount);
    const receipt = await tx.wait();

    console.log("\n✅ Agent tokens deposited!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

task("withdraw-agent-tokens", "Withdraw agent tokens before graduation")
  .addParam("tokenId", "The persona token ID")
  .addOptionalParam("factory", "PersonaTokenFactory address")
  .setAction(async (taskArgs, hre) => {
    const factoryAddress = await getFactoryAddress(taskArgs.factory, hre);
    const factory = await hre.ethers.getContractAt("PersonaTokenFactory", factoryAddress);

    console.log("\n💎 Withdrawing Agent Tokens...");
    console.log(`  Token ID: ${taskArgs.tokenId}`);

    const tx = await factory.withdrawAgentTokens(taskArgs.tokenId);
    const receipt = await tx.wait();

    console.log("\n✅ Agent tokens withdrawn!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

task("claim-agent-rewards", "Claim persona token rewards after graduation")
  .addParam("tokenId", "The persona token ID")
  .addOptionalParam("factory", "PersonaTokenFactory address")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const factoryAddress = await getFactoryAddress(taskArgs.factory, hre);
    const factory = await hre.ethers.getContractAt("PersonaTokenFactory", factoryAddress);

    // Calculate expected rewards
    const [personaReward, agentAmount] = await factory.calculateAgentRewards(taskArgs.tokenId, signer.address);

    console.log("\n🎁 Claiming Agent Rewards:");
    console.log(`  Token ID: ${taskArgs.tokenId}`);
    console.log(`  Your Agent Deposits: ${formatEther(agentAmount)}`);
    console.log(`  Expected Persona Tokens: ${formatEther(personaReward)}`);

    const tx = await factory.claimAgentRewards(taskArgs.tokenId);
    const receipt = await tx.wait();

    console.log("\n✅ Rewards claimed!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

// ============================================================================
// STAKING TASKS
// ============================================================================

// Add these tasks to your existing tasks file

// ============================================================================
// STAKING REWARDS TASKS - UPDATED FOR NEW CONTRACT
// ============================================================================

task("staking-pools", "List all staking pools")
  .addOptionalParam("staking", "StakingRewards address")
  .setAction(async (taskArgs, hre) => {
    const stakingAddress = await getStakingAddress(taskArgs.staking, hre);
    if (!stakingAddress) {
      console.log("❌ No staking rewards contract deployed");
      return;
    }

    const staking = await hre.ethers.getContractAt("PersonaStakingRewards", stakingAddress);
    const poolLength = await staking.poolLength();

    console.log("\n🌾 Staking Pools:");
    console.log("=".repeat(60));

    for (let i = 0; i < poolLength; i++) {
      const poolInfo = await staking.getPoolInfo(i);
      const lpToken = await hre.ethers.getContractAt("IERC20", poolInfo.lpToken) as TestERC20;
      const symbol = await lpToken.symbol();

      console.log(`\nPool #${i}:`);
      console.log(`  LP Token: ${poolInfo.lpToken} (${symbol})`);
      console.log(`  Allocation: ${Number(poolInfo.allocBasisPoints) / 100}%`);
      console.log(`  Total Staked: ${formatEther(poolInfo.totalStaked)}`);
      console.log(`  Weighted Total: ${formatEther(poolInfo.weightedTotal)}`);
      console.log(`  Active: ${poolInfo.isActive ? "Yes ✅" : "No ❌"}`);
      console.log(`  Agent Pool: ${poolInfo.isAgentPool ? "Yes" : "No"}`);
    }

    const remaining = await staking.getRemainingAllocation();
    console.log(`\n💡 Remaining Allocation: ${Number(remaining) / 100}%`);
  });

task("stake-locked", "Stake LP tokens with time lock for bonus rewards")
  .addParam("poolId", "Pool ID")
  .addParam("amount", "Amount to stake in ether units")
  .addParam("lockTier", "Lock tier index (0=1month, 1=3months, 2=6months, 3=1year)")
  .addOptionalParam("staking", "StakingRewards address")
  .setAction(async (taskArgs, hre) => {
    const stakingAddress = await getStakingAddress(taskArgs.staking, hre);
    if (!stakingAddress) {
      console.log("❌ No staking rewards contract deployed");
      return;
    }

    const staking = await hre.ethers.getContractAt("PersonaStakingRewards", stakingAddress);
    const amount = parseEther(taskArgs.amount);

    // Get pool and lock tier info
    const poolInfo = await staking.getPoolInfo(taskArgs.poolId);
    const lockTier = await staking.getLockTier(taskArgs.lockTier);

    console.log("\n🔒 Staking LP Tokens with Lock:");
    console.log(`  Pool ID: ${taskArgs.poolId}`);
    console.log(`  Amount: ${taskArgs.amount}`);
    console.log(`  Lock Duration: ${Number(lockTier.duration) / 86400} days`);
    console.log(`  Multiplier: ${Number(lockTier.multiplier) / 10000}x`);

    // Approve LP token
    const lpToken = await hre.ethers.getContractAt("IERC20", poolInfo.lpToken);
    const approveTx = await lpToken.approve(stakingAddress, amount);
    await approveTx.wait();

    // Stake with lock
    const tx = await staking.stakeLocked(taskArgs.poolId, amount, taskArgs.lockTier);
    const receipt = await tx.wait();

    console.log("\n✅ LP tokens staked with lock!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

task("user-stakes", "Get user's staking positions")
  .addParam("address", "User address")
  .addOptionalParam("staking", "StakingRewards address")
  .setAction(async (taskArgs, hre) => {
    const stakingAddress = await getStakingAddress(taskArgs.staking, hre);
    if (!stakingAddress) {
      console.log("❌ No staking rewards contract deployed");
      return;
    }

    const staking = await hre.ethers.getContractAt("PersonaStakingRewards", stakingAddress);
    const activePools = await staking.getUserActivePools(taskArgs.address);

    console.log(`\n👤 Staking Positions for ${taskArgs.address}:`);
    console.log("=".repeat(60));

    if (activePools.length === 0) {
      console.log("  No active positions");
      return;
    }

    let totalPendingRewards = 0n;

    for (const poolId of activePools) {
      const userInfo = await staking.getUserInfo(poolId, taskArgs.address);
      const poolInfo = await staking.getPoolInfo(poolId);
      const lpToken = await hre.ethers.getContractAt("IERC20", poolInfo.lpToken) as TestERC20;
      const symbol = await lpToken.symbol();
      const pendingRewards = await staking.pendingRewardsForPool(poolId, taskArgs.address);

      console.log(`\nPool #${poolId} (${symbol}):`);
      console.log(`  Flexible Stake: ${formatEther(userInfo.flexibleAmount)}`);
      console.log(`  Locked Stake: ${formatEther(userInfo.lockedAmount)}`);
      console.log(`  Effective Stake: ${formatEther(userInfo.effectiveStake)}`);
      console.log(`  Number of Locks: ${userInfo.numberOfLocks}`);
      console.log(`  Unclaimed Rewards: ${formatEther(userInfo.unclaimedRewards)}`);
      console.log(`  Pending Rewards: ${formatEther(pendingRewards)}`);

      totalPendingRewards += pendingRewards;

      // Show lock details if any
      if (userInfo.numberOfLocks > 0) {
        const locks = await staking.getUserLocks(poolId, taskArgs.address);
        console.log("  Locks:");
        for (const lock of locks) {
          const unlockDate = new Date(Number(lock.unlockTime) * 1000);
          const isUnlocked = Date.now() >= Number(lock.unlockTime) * 1000;
          console.log(`    - ID: ${lock.lockId}, Amount: ${formatEther(lock.amount)}, Multiplier: ${Number(lock.lockMultiplier) / 10000}x`);
          console.log(`      Unlock: ${unlockDate.toLocaleString()} ${isUnlocked ? "✅" : "🔒"}`);
        }
      }
    }

    console.log(`\n💰 Total Pending Rewards: ${formatEther(totalPendingRewards)} AMICA`);
  });

task("withdraw-locked", "Withdraw a locked stake after unlock time")
  .addParam("poolId", "Pool ID")
  .addParam("lockId", "Lock ID to withdraw")
  .addOptionalParam("staking", "StakingRewards address")
  .setAction(async (taskArgs, hre) => {
    const stakingAddress = await getStakingAddress(taskArgs.staking, hre);
    if (!stakingAddress) {
      console.log("❌ No staking rewards contract deployed");
      return;
    }

    const staking = await hre.ethers.getContractAt("PersonaStakingRewards", stakingAddress);

    console.log("\n🔓 Withdrawing Locked Stake:");
    console.log(`  Pool ID: ${taskArgs.poolId}`);
    console.log(`  Lock ID: ${taskArgs.lockId}`);

    const tx = await staking.withdrawLocked(taskArgs.poolId, taskArgs.lockId);
    const receipt = await tx.wait();

    console.log("\n✅ Locked stake withdrawn!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

task("claim-pool", "Claim rewards from a specific pool")
  .addParam("poolId", "Pool ID")
  .addOptionalParam("staking", "StakingRewards address")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const stakingAddress = await getStakingAddress(taskArgs.staking, hre);
    if (!stakingAddress) {
      console.log("❌ No staking rewards contract deployed");
      return;
    }

    const staking = await hre.ethers.getContractAt("PersonaStakingRewards", stakingAddress);

    const pendingRewards = await staking.pendingRewardsForPool(taskArgs.poolId, signer.address);

    console.log("\n🎁 Claiming Pool Rewards:");
    console.log(`  Pool ID: ${taskArgs.poolId}`);
    console.log(`  Pending Rewards: ${formatEther(pendingRewards)} AMICA`);

    const tx = await staking.claimPool(taskArgs.poolId);
    const receipt = await tx.wait();

    console.log("\n✅ Rewards claimed!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

task("claim-all", "Claim all rewards from all pools")
  .addOptionalParam("staking", "StakingRewards address")
  .setAction(async (taskArgs, hre) => {
    const [signer] = await hre.ethers.getSigners();
    const stakingAddress = await getStakingAddress(taskArgs.staking, hre);
    if (!stakingAddress) {
      console.log("❌ No staking rewards contract deployed");
      return;
    }

    const staking = await hre.ethers.getContractAt("PersonaStakingRewards", stakingAddress);

    const totalPending = await staking.estimatedTotalPendingRewards(signer.address);

    console.log("\n🎁 Claiming All Rewards:");
    console.log(`  Total Pending: ${formatEther(totalPending)} AMICA`);

    if (totalPending === 0n) {
      console.log("  No rewards to claim");
      return;
    }

    const tx = await staking.claimAll();
    const receipt = await tx.wait();

    console.log("\n✅ All rewards claimed!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

task("emergency-exit", "Emergency exit from a pool (forfeit rewards)")
  .addParam("poolId", "Pool ID")
  .addOptionalParam("staking", "StakingRewards address")
  .setAction(async (taskArgs, hre) => {
    const stakingAddress = await getStakingAddress(taskArgs.staking, hre);
    if (!stakingAddress) {
      console.log("❌ No staking rewards contract deployed");
      return;
    }

    const staking = await hre.ethers.getContractAt("PersonaStakingRewards", stakingAddress);

    console.log("\n⚠️  EMERGENCY EXIT - This will forfeit all unclaimed rewards!");
    console.log(`  Pool ID: ${taskArgs.poolId}`);
    console.log("\n  Type 'CONFIRM' to proceed:");

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise<string>(resolve => {
      readline.question('', resolve);
    });
    readline.close();

    if (answer !== 'CONFIRM') {
      console.log("❌ Emergency exit cancelled");
      return;
    }

    const tx = await staking.emergencyExitPool(taskArgs.poolId);
    const receipt = await tx.wait();

    console.log("\n✅ Emergency exit complete!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

// ============================================================================
// ADMIN STAKING TASKS
// ============================================================================

task("update-pool", "Update pool allocation or status")
  .addParam("poolId", "Pool ID")
  .addParam("allocBasisPoints", "New allocation in basis points")
  .addParam("isActive", "Pool active status (true/false)")
  .addOptionalParam("staking", "StakingRewards address")
  .setAction(async (taskArgs, hre) => {
    const stakingAddress = await getStakingAddress(taskArgs.staking, hre);
    if (!stakingAddress) {
      console.log("❌ No staking rewards contract deployed");
      return;
    }

    const staking = await hre.ethers.getContractAt("PersonaStakingRewards", stakingAddress);
    const isActive = taskArgs.isActive.toLowerCase() === "true";

    console.log("\n⚙️  Updating Pool:");
    console.log(`  Pool ID: ${taskArgs.poolId}`);
    console.log(`  New Allocation: ${Number(taskArgs.allocBasisPoints) / 100}%`);
    console.log(`  Active: ${isActive ? "Yes" : "No"}`);

    const tx = await staking.updatePool(taskArgs.poolId, taskArgs.allocBasisPoints, isActive);
    const receipt = await tx.wait();

    console.log("\n✅ Pool updated!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

task("set-lock-tier", "Add or update a lock tier")
  .addParam("index", "Tier index")
  .addParam("duration", "Lock duration in days")
  .addParam("multiplier", "Reward multiplier (e.g., 15000 for 1.5x)")
  .addOptionalParam("staking", "StakingRewards address")
  .setAction(async (taskArgs, hre) => {
    const stakingAddress = await getStakingAddress(taskArgs.staking, hre);
    if (!stakingAddress) {
      console.log("❌ No staking rewards contract deployed");
      return;
    }

    const staking = await hre.ethers.getContractAt("PersonaStakingRewards", stakingAddress);
    const durationInSeconds = Number(taskArgs.duration) * 86400;

    console.log("\n🔒 Setting Lock Tier:");
    console.log(`  Index: ${taskArgs.index}`);
    console.log(`  Duration: ${taskArgs.duration} days`);
    console.log(`  Multiplier: ${Number(taskArgs.multiplier) / 10000}x`);

    const tx = await staking.setLockTier(taskArgs.index, durationInSeconds, taskArgs.multiplier);
    const receipt = await tx.wait();

    console.log("\n✅ Lock tier set!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

task("lock-tiers", "List all lock tiers")
  .addOptionalParam("staking", "StakingRewards address")
  .setAction(async (taskArgs, hre) => {
    const stakingAddress = await getStakingAddress(taskArgs.staking, hre);
    if (!stakingAddress) {
      console.log("❌ No staking rewards contract deployed");
      return;
    }

    const staking = await hre.ethers.getContractAt("PersonaStakingRewards", stakingAddress);
    const tierCount = await staking.lockTiersLength();

    console.log("\n🔒 Lock Tiers:");
    console.log("=".repeat(50));

    for (let i = 0; i < tierCount; i++) {
      const tier = await staking.getLockTier(i);
      console.log(`\nTier #${i}:`);
      console.log(`  Duration: ${Number(tier.duration) / 86400} days`);
      console.log(`  Multiplier: ${Number(tier.multiplier) / 10000}x`);
    }
  });

task("update-reward-rate", "Update AMICA rewards per block")
  .addParam("amicaPerBlock", "New AMICA per block in ether units")
  .addOptionalParam("staking", "StakingRewards address")
  .setAction(async (taskArgs, hre) => {
    const stakingAddress = await getStakingAddress(taskArgs.staking, hre);
    if (!stakingAddress) {
      console.log("❌ No staking rewards contract deployed");
      return;
    }

    const staking = await hre.ethers.getContractAt("PersonaStakingRewards", stakingAddress);
    const amicaPerBlock = parseEther(taskArgs.amicaPerBlock);

    console.log("\n💰 Updating Reward Rate:");
    console.log(`  New Rate: ${taskArgs.amicaPerBlock} AMICA per block`);

    const tx = await staking.updateRewardRate(amicaPerBlock);
    const receipt = await tx.wait();

    console.log("\n✅ Reward rate updated!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

task("update-reward-period", "Update reward start and end blocks")
  .addParam("startBlock", "Start block number")
  .addParam("endBlock", "End block number (0 for no end)")
  .addOptionalParam("staking", "StakingRewards address")
  .setAction(async (taskArgs, hre) => {
    const stakingAddress = await getStakingAddress(taskArgs.staking, hre);
    if (!stakingAddress) {
      console.log("❌ No staking rewards contract deployed");
      return;
    }

    const staking = await hre.ethers.getContractAt("PersonaStakingRewards", stakingAddress);

    console.log("\n📅 Updating Reward Period:");
    console.log(`  Start Block: ${taskArgs.startBlock}`);
    console.log(`  End Block: ${taskArgs.endBlock === "0" ? "No end" : taskArgs.endBlock}`);

    const tx = await staking.updateRewardPeriod(taskArgs.startBlock, taskArgs.endBlock);
    const receipt = await tx.wait();

    console.log("\n✅ Reward period updated!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

// Update the existing staking-info task to show the correct information
task("staking-info", "Get staking rewards contract information")
  .addOptionalParam("staking", "StakingRewards address")
  .setAction(async (taskArgs, hre) => {
    const stakingAddress = await getStakingAddress(taskArgs.staking, hre);
    if (!stakingAddress) {
      console.log("❌ No staking rewards contract deployed");
      return;
    }

    const staking = await hre.ethers.getContractAt("PersonaStakingRewards", stakingAddress);

    const amicaPerBlock = await staking.amicaPerBlock();
    const totalAllocBasisPoints = await staking.totalAllocBasisPoints();
    const poolLength = await staking.poolLength();
    const startBlock = await staking.startBlock();
    const endBlock = await staking.endBlock();
    const currentBlock = await hre.ethers.provider.getBlockNumber();

    console.log("\n🌾 Staking Rewards Information:");
    console.log("=".repeat(50));
    console.log(`  Address: ${stakingAddress}`);
    console.log(`  AMICA per Block: ${formatEther(amicaPerBlock)}`);
    console.log(`  Total Allocation: ${Number(totalAllocBasisPoints) / 100}%`);
    console.log(`  Number of Pools: ${poolLength}`);
    console.log(`  Start Block: ${startBlock}`);
    console.log(`  End Block: ${endBlock > 0 ? endBlock : "No end"}`);
    console.log(`  Current Block: ${currentBlock}`);
    console.log(`  Status: ${currentBlock >= startBlock ? "Active ✅" : "Not started yet ⏳"}`);
  });

// Update the add-staking-pool task to use basis points
task("add-staking-pool", "Add a new staking pool")
  .addParam("lpToken", "LP token address")
  .addParam("allocBasisPoints", "Allocation in basis points (100 = 1%)")
  .addParam("isAgentPool", "true if this is a Persona/Agent pool")
  .addParam("personaTokenId", "Associated persona token ID")
  .addOptionalParam("staking", "StakingRewards address")
  .setAction(async (taskArgs, hre) => {
    const stakingAddress = await getStakingAddress(taskArgs.staking, hre);
    if (!stakingAddress) {
      console.log("❌ No staking rewards contract deployed");
      return;
    }

    const staking = await hre.ethers.getContractAt("PersonaStakingRewards", stakingAddress);
    const isAgentPool = taskArgs.isAgentPool.toLowerCase() === "true";

    console.log("\n🌾 Adding Staking Pool:");
    console.log(`  LP Token: ${taskArgs.lpToken}`);
    console.log(`  Allocation: ${Number(taskArgs.allocBasisPoints) / 100}%`);
    console.log(`  Agent Pool: ${isAgentPool ? "Yes" : "No"}`);
    console.log(`  Persona Token ID: ${taskArgs.personaTokenId}`);

    const tx = await staking.addPool(
      taskArgs.lpToken,
      taskArgs.allocBasisPoints,
      isAgentPool,
      taskArgs.personaTokenId
    );
    const receipt = await tx.wait();

    console.log("\n✅ Pool added!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

task("stake-lp", "Stake LP tokens in a pool")
  .addParam("poolId", "Pool ID")
  .addParam("amount", "Amount to stake in ether units")
  .addOptionalParam("staking", "StakingRewards address")
  .setAction(async (taskArgs, hre) => {
    const stakingAddress = await getStakingAddress(taskArgs.staking, hre);
    if (!stakingAddress) {
      console.log("❌ No staking rewards contract deployed");
      return;
    }

    const staking = await hre.ethers.getContractAt("PersonaStakingRewards", stakingAddress);
    const amount = parseEther(taskArgs.amount);

    // Get pool info
    const pool = await staking.poolInfo(taskArgs.poolId);

    console.log("\n🌾 Staking LP Tokens:");
    console.log(`  Pool ID: ${taskArgs.poolId}`);
    console.log(`  Amount: ${taskArgs.amount}`);

    // Approve LP token
    const lpToken = await hre.ethers.getContractAt("IERC20", pool.lpToken);
    const approveTx = await lpToken.approve(stakingAddress, amount);
    await approveTx.wait();

    // Stake
    const tx = await staking.stake(taskArgs.poolId, amount);
    const receipt = await tx.wait();

    console.log("\n✅ LP tokens staked!");
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
    const bridgeWrapper = await amica.bridgeWrapper();

    console.log("\n🪙 AMICA Token Information:");
    console.log("=".repeat(50));
    console.log(`  Address: ${amicaAddress}`);
    console.log(`  Total Supply: ${formatEther(totalSupply)}`);
    console.log(`  Circulating Supply: ${formatEther(circulatingSupply)}`);
    console.log(`  Contract Balance: ${formatEther(contractBalance)}`);
    console.log(`  Bridge Wrapper: ${bridgeWrapper !== "0x0000000000000000000000000000000000000000" ? bridgeWrapper : "Not set"}`);
    console.log(`  Deposited Tokens: ${depositedTokens.length - 1}`); // -1 for index 0

    if (depositedTokens.length > 1) {
      console.log("\n📦 Deposited Tokens:");
      for (let i = 1; i < depositedTokens.length; i++) {
        const balance = await amica.depositedBalances(depositedTokens[i]);
        const token = await hre.ethers.getContractAt("ERC20", depositedTokens[i]);
        const symbol = await token.symbol();
        console.log(`  ${symbol}: ${formatEther(balance)}`);
      }
    }
  });

task("burn-and-claim", "Burn AMICA and claim proportional share of deposited tokens")
  .addParam("amount", "Amount of AMICA to burn in ether units")
  .addParam("tokenIndexes", "Comma-separated list of token indexes to claim")
  .addOptionalParam("amica", "AmicaToken address")
  .setAction(async (taskArgs, hre) => {
    const amicaAddress = await getAmicaAddress(taskArgs.amica, hre);
    const amica = await hre.ethers.getContractAt("AmicaToken", amicaAddress);

    const amount = parseEther(taskArgs.amount);
    const indexes = taskArgs.tokenIndexes.split(",").map((i: string) => parseInt(i.trim()));

    // Show what will be claimed
    const depositedTokens = await amica.getDepositedTokens();
    const circulatingSupply = await amica.circulatingSupply();
    const sharePercentage = (amount * BigInt(1e18)) / circulatingSupply;

    console.log("\n🔥 Burn and Claim Preview:");
    console.log(`  AMICA to burn: ${taskArgs.amount}`);
    console.log(`  Share percentage: ${Number(sharePercentage) / 1e16}%`);
    console.log("\n  Expected claims:");

    for (const index of indexes) {
      if (index < depositedTokens.length && index > 0) {
        const tokenAddress = depositedTokens[index];
        const deposited = await amica.depositedBalances(tokenAddress);
        const claimAmount = (deposited * sharePercentage) / BigInt(1e18);
        const token = await hre.ethers.getContractAt("ERC20", tokenAddress);
        const symbol = await token.symbol();
        console.log(`    ${symbol}: ${formatEther(claimAmount)}`);
      }
    }

    console.log("\n🔥 Burning AMICA and claiming tokens...");
    const tx = await amica.burnAndClaim(amount, indexes);
    const receipt = await tx.wait();

    console.log("\n✅ Burn and claim complete!");
    console.log(`  Transaction: ${receipt?.hash}`);
  });

// ============================================================================
// USER TASKS
// ============================================================================

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

    // Get quote with user-specific fee
    const expectedOut = await factory.getAmountOutForUser(taskArgs.tokenId, amountIn, signer.address);
    const minOut = expectedOut * BigInt(10000 - slippage) / 10000n;

    // Get fee info
    const feeInfo = await factory.previewSwapWithFee(taskArgs.tokenId, amountIn, signer.address);

    console.log("\n💸 Buying Persona Tokens:");
    console.log(`  Token ID: ${taskArgs.tokenId}`);
    console.log(`  Amount In: ${formatEther(amountIn)}`);
    console.log(`  Fee: ${formatEther(feeInfo.feeAmount)}`);
    console.log(`  Amount After Fee: ${formatEther(feeInfo.amountInAfterFee)}`);
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
    console.log("=".repeat(50));
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

async function getStakingAddress(providedAddress: string | undefined, hre: HardhatRuntimeEnvironment): Promise<string | undefined> {
  if (providedAddress) return providedAddress;

  const chainId = Number((await hre.ethers.provider.getNetwork()).chainId);
  const deploymentManager = new DeploymentManager();
  const latest = await deploymentManager.getLatestDeployment(chainId);

  return latest?.addresses.stakingRewards;
}

// Export for use in other scripts
export {};
