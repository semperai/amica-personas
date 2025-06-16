import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import {
    PersonaStakingRewards,
    AmicaToken,
    TestERC20
} from "../typechain-types";
import { deployAmicaTokenFixture } from "./shared/fixtures";

describe("PersonaStakingRewards", function () {
    // Constants
    const BLOCKS_PER_HOUR = 300; // ~12 seconds per block
    const BLOCKS_PER_DAY = 7200;
    const REWARD_PER_BLOCK = ethers.parseEther("10");
    const BASIS_POINTS = 10000n;
    const AGENT_POOL_BOOST = 15000n; // 1.5x
    const PRECISION = ethers.parseEther("1");

    // Lock durations
    const ONE_MONTH = 30 * 24 * 60 * 60;
    const THREE_MONTHS = 90 * 24 * 60 * 60;
    const SIX_MONTHS = 180 * 24 * 60 * 60;
    const ONE_YEAR = 365 * 24 * 60 * 60;

    // Fixture interfaces
    interface StakingRewardsFixture {
        stakingRewards: PersonaStakingRewards;
        amicaToken: AmicaToken;
        personaFactory: TestERC20; // Using TestERC20 as mock
        lpToken1: TestERC20;
        lpToken2: TestERC20;
        agentLpToken: TestERC20;
        owner: SignerWithAddress;
        user1: SignerWithAddress;
        user2: SignerWithAddress;
        user3: SignerWithAddress;
        treasury: SignerWithAddress;
    }

    interface StakingRewardsWithPoolsFixture extends StakingRewardsFixture {
        pool1Id: number;
        pool2Id: number;
        agentPoolId: number;
    }

    // Helper to mine blocks
    async function mineBlocks(blocks: number) {
        for (let i = 0; i < blocks; i++) {
            await ethers.provider.send("evm_mine", []);
        }
    }

    // Deploy staking rewards fixture
    async function deployStakingRewardsFixture(): Promise<StakingRewardsFixture> {
        const [owner, user1, user2, user3, treasury] = await ethers.getSigners();

        // Deploy AMICA token
        const { amicaToken } = await loadFixture(deployAmicaTokenFixture);

        // Deploy mock contracts
        const TestERC20 = await ethers.getContractFactory("TestERC20");

        // Mock PersonaTokenFactory - we just need any contract address
        const mockPersonaFactory = await TestERC20.deploy("Mock Factory", "MOCK", ethers.parseEther("0"));

        // Deploy mock LP tokens
        const lpToken1 = await TestERC20.deploy("LP Token 1", "LP1", ethers.parseEther("1000000"));
        const lpToken2 = await TestERC20.deploy("LP Token 2", "LP2", ethers.parseEther("1000000"));
        const agentLpToken = await TestERC20.deploy("Agent LP Token", "ALPT", ethers.parseEther("1000000"));

        // Deploy PersonaStakingRewards
        const currentBlock = await ethers.provider.getBlockNumber();
        const startBlock = currentBlock + 100;

        const PersonaStakingRewards = await ethers.getContractFactory("PersonaStakingRewards");
        const stakingRewards = await PersonaStakingRewards.deploy(
            await amicaToken.getAddress(),
            await mockPersonaFactory.getAddress(),
            REWARD_PER_BLOCK,
            startBlock
        );

        // Transfer AMICA to staking contract for rewards
        await amicaToken.transfer(
            await stakingRewards.getAddress(),
            ethers.parseEther("10000000")
        );

        // Transfer LP tokens to users
        const lpAmount = ethers.parseEther("10000");
        for (const user of [user1, user2, user3]) {
            await lpToken1.transfer(user.address, lpAmount);
            await lpToken2.transfer(user.address, lpAmount);
            await agentLpToken.transfer(user.address, lpAmount);
        }

        return {
            stakingRewards,
            amicaToken,
            personaFactory: mockPersonaFactory,
            lpToken1,
            lpToken2,
            agentLpToken,
            owner,
            user1,
            user2,
            user3,
            treasury
        };
    }

    // Deploy with pools already created
    async function deployStakingRewardsWithPoolsFixture(): Promise<StakingRewardsWithPoolsFixture> {
        const fixture = await loadFixture(deployStakingRewardsFixture);
        const { stakingRewards, lpToken1, lpToken2, agentLpToken } = fixture;

        // Add pools with different allocations
        // Pool 1: 30% (3000 basis points)
        await stakingRewards.addPool(
            await lpToken1.getAddress(),
            3000,
            false,
            0
        );

        // Pool 2: 20% (2000 basis points)
        await stakingRewards.addPool(
            await lpToken2.getAddress(),
            2000,
            false,
            1
        );

        // Agent Pool: 50% (5000 basis points) with boost
        await stakingRewards.addPool(
            await agentLpToken.getAddress(),
            5000,
            true,
            2
        );

        return {
            ...fixture,
            pool1Id: 0,
            pool2Id: 1,
            agentPoolId: 2
        };
    }

    describe("Deployment", function () {
        it("Should set correct initial parameters", async function () {
            const { stakingRewards, amicaToken, personaFactory, owner } = await loadFixture(deployStakingRewardsFixture);

            expect(await stakingRewards.amicaToken()).to.equal(await amicaToken.getAddress());
            expect(await stakingRewards.personaFactory()).to.equal(await personaFactory.getAddress());
            expect(await stakingRewards.amicaPerBlock()).to.equal(REWARD_PER_BLOCK);
            expect(await stakingRewards.owner()).to.equal(owner.address);
            expect(await stakingRewards.totalAllocBasisPoints()).to.equal(0);
            expect(await stakingRewards.poolLength()).to.equal(0);
        });

        it("Should initialize default lock tiers", async function () {
            const { stakingRewards } = await loadFixture(deployStakingRewardsFixture);

            expect(await stakingRewards.lockTiersLength()).to.equal(4);

            // Check each tier
            const tier0 = await stakingRewards.getLockTier(0);
            expect(tier0.duration).to.equal(ONE_MONTH);
            expect(tier0.multiplier).to.equal(12500); // 1.25x

            const tier1 = await stakingRewards.getLockTier(1);
            expect(tier1.duration).to.equal(THREE_MONTHS);
            expect(tier1.multiplier).to.equal(15000); // 1.5x

            const tier2 = await stakingRewards.getLockTier(2);
            expect(tier2.duration).to.equal(SIX_MONTHS);
            expect(tier2.multiplier).to.equal(20000); // 2x

            const tier3 = await stakingRewards.getLockTier(3);
            expect(tier3.duration).to.equal(ONE_YEAR);
            expect(tier3.multiplier).to.equal(25000); // 2.5x
        });

        it("Should set correct start block", async function () {
            const { stakingRewards } = await loadFixture(deployStakingRewardsFixture);

            const currentBlock = await ethers.provider.getBlockNumber();
            const startBlock = await stakingRewards.startBlock();

            expect(startBlock).to.be.gt(currentBlock);
        });
    });

    describe("Pool Management", function () {
        it("Should add new pool correctly", async function () {
            const { stakingRewards, lpToken1 } = await loadFixture(deployStakingRewardsFixture);

            await expect(stakingRewards.addPool(
                await lpToken1.getAddress(),
                3000,
                false,
                0
            ))
                .to.emit(stakingRewards, "PoolAdded")
                .withArgs(0, await lpToken1.getAddress(), 3000, false);

            expect(await stakingRewards.poolLength()).to.equal(1);
            expect(await stakingRewards.totalAllocBasisPoints()).to.equal(3000);

            const poolInfo = await stakingRewards.getPoolInfo(0);
            expect(poolInfo.lpToken).to.equal(await lpToken1.getAddress());
            expect(poolInfo.allocBasisPoints).to.equal(3000);
            expect(poolInfo.isActive).to.be.true;
            expect(poolInfo.isAgentPool).to.be.false;
        });

        it("Should reject adding pool exceeding 100% allocation", async function () {
            const { stakingRewards, lpToken1, lpToken2 } = await loadFixture(deployStakingRewardsFixture);

            await stakingRewards.addPool(await lpToken1.getAddress(), 6000, false, 0);

            await expect(
                stakingRewards.addPool(await lpToken2.getAddress(), 5000, false, 1)
            ).to.be.revertedWithCustomError(stakingRewards, "TotalAllocationExceeds100");
        });

        it("Should reject adding duplicate LP token", async function () {
            const { stakingRewards, lpToken1 } = await loadFixture(deployStakingRewardsFixture);

            await stakingRewards.addPool(await lpToken1.getAddress(), 3000, false, 0);

            await expect(
                stakingRewards.addPool(await lpToken1.getAddress(), 2000, false, 0)
            ).to.be.revertedWithCustomError(stakingRewards, "PoolAlreadyExists");
        });

        it("Should update pool allocation correctly", async function () {
            const { stakingRewards, pool1Id } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            // Update pool1 from 3000 to 1000 to avoid exceeding 100%
            await expect(stakingRewards.updatePool(pool1Id, 1000, true))
                .to.emit(stakingRewards, "PoolUpdated")
                .withArgs(pool1Id, 1000, true);

            const poolInfo = await stakingRewards.getPoolInfo(pool1Id);
            expect(poolInfo.allocBasisPoints).to.equal(1000);
            expect(await stakingRewards.totalAllocBasisPoints()).to.equal(8000); // 1000 + 2000 + 5000
        });

        it("Should handle pool deactivation", async function () {
            const { stakingRewards, pool1Id } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            await stakingRewards.updatePool(pool1Id, 3000, false);

            const poolInfo = await stakingRewards.getPoolInfo(pool1Id);
            expect(poolInfo.isActive).to.be.false;
        });

        it("Should get pool by LP token", async function () {
            const { stakingRewards, lpToken1, pool1Id } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            const poolId = await stakingRewards.getPoolIdByLpToken(await lpToken1.getAddress());
            expect(poolId).to.equal(pool1Id);
        });

        it("Should show remaining allocation", async function () {
            const { stakingRewards } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            const remaining = await stakingRewards.getRemainingAllocation();
            expect(remaining).to.equal(0); // 3000 + 2000 + 5000 = 10000 (100%)
        });
    });

    describe("Lock Tier Management", function () {
        it("Should add new lock tier", async function () {
            const { stakingRewards } = await loadFixture(deployStakingRewardsFixture);

            const newDuration = 60 * 24 * 60 * 60; // 60 days
            const newMultiplier = 17500; // 1.75x

            await expect(stakingRewards.setLockTier(4, newDuration, newMultiplier))
                .to.emit(stakingRewards, "LockTierAdded")
                .withArgs(newDuration, newMultiplier);

            expect(await stakingRewards.lockTiersLength()).to.equal(5);

            const tier = await stakingRewards.getLockTier(4);
            expect(tier.duration).to.equal(newDuration);
            expect(tier.multiplier).to.equal(newMultiplier);
        });

        it("Should update existing lock tier", async function () {
            const { stakingRewards } = await loadFixture(deployStakingRewardsFixture);

            const newMultiplier = 13000; // 1.3x

            await expect(stakingRewards.setLockTier(0, ONE_MONTH, newMultiplier))
                .to.emit(stakingRewards, "LockTierUpdated")
                .withArgs(0, ONE_MONTH, newMultiplier);

            const tier = await stakingRewards.getLockTier(0);
            expect(tier.multiplier).to.equal(newMultiplier);
        });

        it("Should reject invalid lock tier multipliers", async function () {
            const { stakingRewards } = await loadFixture(deployStakingRewardsFixture);

            // Too low (< 1x)
            await expect(
                stakingRewards.setLockTier(0, ONE_MONTH, 5000)
            ).to.be.revertedWithCustomError(stakingRewards, "InvalidMultiplier");

            // Too high (> 5x)
            await expect(
                stakingRewards.setLockTier(0, ONE_MONTH, 60000)
            ).to.be.revertedWithCustomError(stakingRewards, "InvalidMultiplier");
        });
    });

    describe("Flexible Staking", function () {
        it("Should stake LP tokens successfully", async function () {
            const { stakingRewards, lpToken1, user1, pool1Id } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            const stakeAmount = ethers.parseEther("1000");
            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount);

            await expect(stakingRewards.connect(user1).stake(pool1Id, stakeAmount))
                .to.emit(stakingRewards, "Deposit")
                .withArgs(user1.address, pool1Id, stakeAmount);

            const userInfo = await stakingRewards.getUserInfo(pool1Id, user1.address);
            expect(userInfo.flexibleAmount).to.equal(stakeAmount);
            expect(userInfo.effectiveStake).to.equal(stakeAmount);

            const poolInfo = await stakingRewards.getPoolInfo(pool1Id);
            expect(poolInfo.totalStaked).to.equal(stakeAmount);
            expect(poolInfo.weightedTotal).to.equal(stakeAmount);
        });

        it("Should withdraw flexible stake", async function () {
            const { stakingRewards, lpToken1, user1, pool1Id } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            // First stake
            const stakeAmount = ethers.parseEther("1000");
            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount);
            await stakingRewards.connect(user1).stake(pool1Id, stakeAmount);

            // Then withdraw
            const withdrawAmount = ethers.parseEther("400");
            await expect(stakingRewards.connect(user1).withdraw(pool1Id, withdrawAmount))
                .to.emit(stakingRewards, "Withdraw")
                .withArgs(user1.address, pool1Id, withdrawAmount);

            const userInfo = await stakingRewards.getUserInfo(pool1Id, user1.address);
            expect(userInfo.flexibleAmount).to.equal(stakeAmount - withdrawAmount);
        });

        it("Should track user active pools", async function () {
            const { stakingRewards, lpToken1, lpToken2, user1, pool1Id, pool2Id } =
                await loadFixture(deployStakingRewardsWithPoolsFixture);

            // Stake in multiple pools
            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), ethers.parseEther("1000"));
            await lpToken2.connect(user1).approve(await stakingRewards.getAddress(), ethers.parseEther("1000"));

            await stakingRewards.connect(user1).stake(pool1Id, ethers.parseEther("500"));
            await stakingRewards.connect(user1).stake(pool2Id, ethers.parseEther("500"));

            const activePools = await stakingRewards.getUserActivePools(user1.address);
            expect(activePools.length).to.equal(2);
            expect(activePools).to.include(BigInt(pool1Id));
            expect(activePools).to.include(BigInt(pool2Id));
        });

        it("Should reject staking zero amount", async function () {
            const { stakingRewards, user1, pool1Id } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            await expect(
                stakingRewards.connect(user1).stake(pool1Id, 0)
            ).to.be.revertedWithCustomError(stakingRewards, "AmountCannotBeZero");
        });

        it("Should reject staking in inactive pool", async function () {
            const { stakingRewards, lpToken1, user1, pool1Id } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            // Deactivate pool
            await stakingRewards.updatePool(pool1Id, 3000, false);

            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), ethers.parseEther("1000"));

            await expect(
                stakingRewards.connect(user1).stake(pool1Id, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(stakingRewards, "PoolNotActive");
        });
    });

    describe("Locked Staking", function () {
        it("Should stake with lock successfully", async function () {
            const { stakingRewards, lpToken1, user1, pool1Id } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            const stakeAmount = ethers.parseEther("1000");
            const lockTierIndex = 2; // 6 months, 2x multiplier

            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount);

            const tx = await stakingRewards.connect(user1).stakeLocked(pool1Id, stakeAmount, lockTierIndex);
            const receipt = await tx.wait();
            const block = await ethers.provider.getBlock(receipt!.blockNumber!);
            const expectedUnlockTime = block!.timestamp + SIX_MONTHS;

            await expect(tx)
                .to.emit(stakingRewards, "DepositLocked")
                .withArgs(user1.address, pool1Id, stakeAmount, 1, expectedUnlockTime, 20000);

            const userInfo = await stakingRewards.getUserInfo(pool1Id, user1.address);
            expect(userInfo.lockedAmount).to.equal(stakeAmount);
            expect(userInfo.effectiveStake).to.equal(stakeAmount * 2n); // 2x multiplier
            expect(userInfo.numberOfLocks).to.equal(1);
        });

        it("Should handle multiple locks per user", async function () {
            const { stakingRewards, lpToken1, user1, pool1Id } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            const stakeAmount = ethers.parseEther("500");
            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount * 3n);

            // Create 3 different locks
            await stakingRewards.connect(user1).stakeLocked(pool1Id, stakeAmount, 0); // 1 month
            await stakingRewards.connect(user1).stakeLocked(pool1Id, stakeAmount, 1); // 3 months
            await stakingRewards.connect(user1).stakeLocked(pool1Id, stakeAmount, 2); // 6 months

            const userInfo = await stakingRewards.getUserInfo(pool1Id, user1.address);
            expect(userInfo.lockedAmount).to.equal(stakeAmount * 3n);
            expect(userInfo.numberOfLocks).to.equal(3);

            // Check effective stake calculation
            const expectedEffective =
                (stakeAmount * 12500n / 10000n) + // 1.25x
                (stakeAmount * 15000n / 10000n) + // 1.5x
                (stakeAmount * 20000n / 10000n);  // 2x
            expect(userInfo.effectiveStake).to.equal(expectedEffective);
        });

        it("Should withdraw locked stake after unlock time", async function () {
            const { stakingRewards, lpToken1, user1, pool1Id } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            const stakeAmount = ethers.parseEther("1000");
            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount);

            // Lock for 1 month
            await stakingRewards.connect(user1).stakeLocked(pool1Id, stakeAmount, 0);

            // Try to withdraw immediately - should fail
            await expect(
                stakingRewards.connect(user1).withdrawLocked(pool1Id, 1)
            ).to.be.revertedWithCustomError(stakingRewards, "StillLocked");

            // Fast forward 1 month
            await time.increase(ONE_MONTH);

            // Now withdrawal should succeed
            await expect(stakingRewards.connect(user1).withdrawLocked(pool1Id, 1))
                .to.emit(stakingRewards, "WithdrawLocked")
                .withArgs(user1.address, pool1Id, 1, stakeAmount);

            const userInfo = await stakingRewards.getUserInfo(pool1Id, user1.address);
            expect(userInfo.lockedAmount).to.equal(0);
            expect(userInfo.numberOfLocks).to.equal(0);
        });

        it("Should reject withdrawal of non-existent lock", async function () {
            const { stakingRewards, user1, pool1Id } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            await expect(
                stakingRewards.connect(user1).withdrawLocked(pool1Id, 999)
            ).to.be.revertedWithCustomError(stakingRewards, "LockNotFound");
        });

        it("Should handle mixed flexible and locked stakes", async function () {
            const { stakingRewards, lpToken1, user1, pool1Id } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            const flexibleAmount = ethers.parseEther("500");
            const lockedAmount = ethers.parseEther("1000");

            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), flexibleAmount + lockedAmount);

            // Flexible stake
            await stakingRewards.connect(user1).stake(pool1Id, flexibleAmount);

            // Locked stake (2x multiplier)
            await stakingRewards.connect(user1).stakeLocked(pool1Id, lockedAmount, 2);

            const userInfo = await stakingRewards.getUserInfo(pool1Id, user1.address);
            expect(userInfo.flexibleAmount).to.equal(flexibleAmount);
            expect(userInfo.lockedAmount).to.equal(lockedAmount);
            expect(userInfo.effectiveStake).to.equal(flexibleAmount + (lockedAmount * 2n));
        });
    });

    describe("Rewards Calculation", function () {
        it("Should calculate rewards correctly for single staker", async function () {
            const { stakingRewards, lpToken1, user1, pool1Id } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            const stakeAmount = ethers.parseEther("1000");
            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount);

            // Wait for start block
            const startBlock = await stakingRewards.startBlock();
            const currentBlock = await ethers.provider.getBlockNumber();
            if (currentBlock < startBlock) {
                await mineBlocks(Number(startBlock - BigInt(currentBlock)));
            }

            await stakingRewards.connect(user1).stake(pool1Id, stakeAmount);

            // Mine 100 blocks
            await mineBlocks(100);

            // Pool gets 30% of rewards
            const expectedRewards = REWARD_PER_BLOCK * 100n * 3000n / 10000n;
            const pendingRewards = await stakingRewards.pendingRewardsForPool(pool1Id, user1.address);

            expect(pendingRewards).to.be.closeTo(expectedRewards, ethers.parseEther("0.1"));
        });

        it("Should calculate rewards with lock multiplier", async function () {
            const { stakingRewards, lpToken1, user1, user2, pool1Id } =
                await loadFixture(deployStakingRewardsWithPoolsFixture);

            const stakeAmount = ethers.parseEther("1000");
            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount);
            await lpToken1.connect(user2).approve(await stakingRewards.getAddress(), stakeAmount);

            // Wait for start block
            const startBlock = await stakingRewards.startBlock();
            const currentBlock = await ethers.provider.getBlockNumber();
            if (currentBlock < startBlock) {
                await mineBlocks(Number(startBlock - BigInt(currentBlock)));
            }

            // User1 stakes flexible
            await stakingRewards.connect(user1).stake(pool1Id, stakeAmount);

            // User2 stakes locked with 2x multiplier
            await stakingRewards.connect(user2).stakeLocked(pool1Id, stakeAmount, 2);

            // Mine 100 blocks
            await mineBlocks(100);

            const pending1 = await stakingRewards.pendingRewardsForPool(pool1Id, user1.address);
            const pending2 = await stakingRewards.pendingRewardsForPool(pool1Id, user2.address);

            // User2 should have approximately 2x the rewards of User1
            // Note: Not exactly 2x due to rounding
            expect(pending2 * 10n / pending1).to.be.closeTo(20n, 1n);
        });

        it("Should handle rewards when pool is deactivated", async function () {
            const { stakingRewards, lpToken1, user1, pool1Id } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            const stakeAmount = ethers.parseEther("1000");
            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount);

            // Wait for start block
            const startBlock = await stakingRewards.startBlock();
            const currentBlock = await ethers.provider.getBlockNumber();
            if (currentBlock < startBlock) {
                await mineBlocks(Number(startBlock - BigInt(currentBlock)));
            }

            await stakingRewards.connect(user1).stake(pool1Id, stakeAmount);

            // Mine 50 blocks
            await mineBlocks(50);

            // Deactivate pool
            await stakingRewards.updatePool(pool1Id, 3000, false);

            const pendingBefore = await stakingRewards.pendingRewardsForPool(pool1Id, user1.address);

            // Mine another 50 blocks
            await mineBlocks(50);

            const pendingAfter = await stakingRewards.pendingRewardsForPool(pool1Id, user1.address);

            // Rewards should not increase after deactivation
            expect(pendingAfter).to.equal(pendingBefore);
        });
    });

    describe("Claiming Rewards", function () {
        it("Should claim rewards from single pool", async function () {
            const { stakingRewards, lpToken1, amicaToken, user1, pool1Id } =
                await loadFixture(deployStakingRewardsWithPoolsFixture);

            const stakeAmount = ethers.parseEther("1000");
            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount);

            // Wait for start block
            const startBlock = await stakingRewards.startBlock();
            const currentBlock = await ethers.provider.getBlockNumber();
            if (currentBlock < startBlock) {
                await mineBlocks(Number(startBlock - BigInt(currentBlock)));
            }

            await stakingRewards.connect(user1).stake(pool1Id, stakeAmount);

            // Mine blocks
            await mineBlocks(100);

            const pendingRewards = await stakingRewards.pendingRewardsForPool(pool1Id, user1.address);
            const initialBalance = await amicaToken.balanceOf(user1.address);

            await expect(stakingRewards.connect(user1).claimPool(pool1Id))
                .to.emit(stakingRewards, "RewardsClaimed");

            const finalBalance = await amicaToken.balanceOf(user1.address);

            // The actual rewards will be slightly higher due to the block mined during claim
            // Pool gets 30% of rewards, plus one extra block
            const expectedRewards = REWARD_PER_BLOCK * 101n * 3000n / 10000n;
            expect(finalBalance - initialBalance).to.be.closeTo(expectedRewards, ethers.parseEther("0.1"));
        });

        it("Should claim all rewards across multiple pools", async function () {
            const { stakingRewards, lpToken1, lpToken2, amicaToken, user1, pool1Id, pool2Id } =
                await loadFixture(deployStakingRewardsWithPoolsFixture);

            const stakeAmount = ethers.parseEther("1000");
            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount);
            await lpToken2.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount);

            // Wait for start block
            const startBlock = await stakingRewards.startBlock();
            const currentBlock = await ethers.provider.getBlockNumber();
            if (currentBlock < startBlock) {
                await mineBlocks(Number(startBlock - BigInt(currentBlock)));
            }

            // Stake in both pools
            await stakingRewards.connect(user1).stake(pool1Id, stakeAmount);
            await stakingRewards.connect(user1).stake(pool2Id, stakeAmount);

            // Mine blocks
            await mineBlocks(100);

            const initialBalance = await amicaToken.balanceOf(user1.address);

            await expect(stakingRewards.connect(user1).claimAll())
                .to.emit(stakingRewards, "RewardsClaimed");

            const finalBalance = await amicaToken.balanceOf(user1.address);

            // Account for extra blocks: 101 blocks for pool1 (30%) + 102 blocks for pool2 (20%)
            // Pool2 gets an extra block because pool1 is updated first
            const expectedRewards = (REWARD_PER_BLOCK * 101n * 3000n / 10000n) +
                                   (REWARD_PER_BLOCK * 102n * 2000n / 10000n);

            expect(finalBalance - initialBalance).to.be.closeTo(expectedRewards, ethers.parseEther("1"));
        });

        it("Should update reward debt after claiming", async function () {
            const { stakingRewards, lpToken1, user1, pool1Id } =
                await loadFixture(deployStakingRewardsWithPoolsFixture);

            const stakeAmount = ethers.parseEther("1000");
            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount);

            // Wait for start block
            const startBlock = await stakingRewards.startBlock();
            const currentBlock = await ethers.provider.getBlockNumber();
            if (currentBlock < startBlock) {
                await mineBlocks(Number(startBlock - BigInt(currentBlock)));
            }

            await stakingRewards.connect(user1).stake(pool1Id, stakeAmount);
            await mineBlocks(100);

            await stakingRewards.connect(user1).claimPool(pool1Id);

            // Mine more blocks
            await mineBlocks(50);

            // Should only have rewards from the 50 blocks after claiming
            const pendingRewards = await stakingRewards.pendingRewardsForPool(pool1Id, user1.address);
            const expectedRewards = REWARD_PER_BLOCK * 50n * 3000n / 10000n;

            expect(pendingRewards).to.be.closeTo(expectedRewards, ethers.parseEther("0.1"));
        });

        it("Should handle claiming with no rewards", async function () {
            const { stakingRewards, user1, pool1Id } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            await expect(
                stakingRewards.connect(user1).claimPool(pool1Id)
            ).to.be.revertedWithCustomError(stakingRewards, "NoRewardsToClaim");
        });

        it("Should claim rewards from locked stakes", async function () {
            const { stakingRewards, lpToken1, amicaToken, user1, pool1Id } =
                await loadFixture(deployStakingRewardsWithPoolsFixture);

            const stakeAmount = ethers.parseEther("1000");
            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount);

            // Wait for start block
            const startBlock = await stakingRewards.startBlock();
            const currentBlock = await ethers.provider.getBlockNumber();
            if (currentBlock < startBlock) {
                await mineBlocks(Number(startBlock - BigInt(currentBlock)));
            }

            // Lock stake with 2x multiplier (tier 2 = 6 months = 2x)
            await stakingRewards.connect(user1).stakeLocked(pool1Id, stakeAmount, 2);
            const stakeBlock = await ethers.provider.getBlockNumber();

            // Mine blocks
            await mineBlocks(100);

            const pendingRewards = await stakingRewards.pendingRewardsForPool(pool1Id, user1.address);
            const initialBalance = await amicaToken.balanceOf(user1.address);

            // Claim rewards
            const tx = await stakingRewards.connect(user1).claimPool(pool1Id);
            await tx.wait();

            const finalBalance = await amicaToken.balanceOf(user1.address);
            const actualRewards = finalBalance - initialBalance;

            // Calculate expected rewards:
            // - Pool gets 30% allocation (3000 basis points)
            // - User has 2x multiplier from lock
            // - Total blocks = 101 (100 mined + 1 during claim)
            const blocksRewarded = 101n;
            const poolAllocation = 3000n;
            const lockMultiplier = 20000n; // 2x = 20000 basis points

            // With only one staker having 2x multiplier:
            // Pool weighted total = stakeAmount * 2
            // User weighted amount = stakeAmount * 2
            // User gets 100% of pool rewards
            const expectedRewards = (REWARD_PER_BLOCK * blocksRewarded * poolAllocation) / 10000n;

            expect(actualRewards).to.be.closeTo(expectedRewards, ethers.parseEther("0.1"));
        });
    });

    describe("Emergency Functions", function () {
        it("Should allow emergency exit from pool", async function () {
            const { stakingRewards, lpToken1, amicaToken, user1, pool1Id } =
                await loadFixture(deployStakingRewardsWithPoolsFixture);

            const stakeAmount = ethers.parseEther("1000");
            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount);

            // Wait for start block
            const startBlock = await stakingRewards.startBlock();
            const currentBlock = await ethers.provider.getBlockNumber();
            if (currentBlock < startBlock) {
                await mineBlocks(Number(startBlock - BigInt(currentBlock)));
            }

            await stakingRewards.connect(user1).stake(pool1Id, stakeAmount);
            await mineBlocks(100);

            // Emergency exit should return tokens but forfeit rewards
            const initialLpBalance = await lpToken1.balanceOf(user1.address);
            const initialAmicaBalance = await amicaToken.balanceOf(user1.address);

            await stakingRewards.connect(user1).emergencyExitPool(pool1Id);

            const finalLpBalance = await lpToken1.balanceOf(user1.address);
            const finalAmicaBalance = await amicaToken.balanceOf(user1.address);

            expect(finalLpBalance - initialLpBalance).to.equal(stakeAmount);
            expect(finalAmicaBalance).to.equal(initialAmicaBalance); // No rewards claimed
        });

        it("Should allow owner to withdraw stuck tokens", async function () {
            const { stakingRewards, owner } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            // Deploy and send random token to contract
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const randomToken = await TestERC20.deploy("Random", "RND", ethers.parseEther("1000"));

            const withdrawAmount = ethers.parseEther("100");
            await randomToken.transfer(await stakingRewards.getAddress(), withdrawAmount);

            const initialBalance = await randomToken.balanceOf(owner.address);

            await stakingRewards.emergencyWithdraw(
                await randomToken.getAddress(),
                withdrawAmount
            );

            const finalBalance = await randomToken.balanceOf(owner.address);
            expect(finalBalance - initialBalance).to.equal(withdrawAmount);
        });

        it("Should reject emergency withdraw of LP tokens", async function () {
            const { stakingRewards, lpToken1 } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            await expect(
                stakingRewards.emergencyWithdraw(await lpToken1.getAddress(), ethers.parseEther("100"))
            ).to.be.revertedWithCustomError(stakingRewards, "CannotWithdrawLPTokens");
        });
    });

    describe("View Functions", function () {
        it("Should return correct pool allocation percentage", async function () {
            const { stakingRewards, pool1Id } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            const allocation = await stakingRewards.getPoolAllocationPercentage(pool1Id);
            expect(allocation).to.equal(3000); // 30%
        });

        it("Should estimate total pending rewards", async function () {
            const { stakingRewards, lpToken1, lpToken2, user1, pool1Id, pool2Id } =
                await loadFixture(deployStakingRewardsWithPoolsFixture);

            const stakeAmount = ethers.parseEther("1000");
            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount);
            await lpToken2.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount);

            // Wait for start block
            const startBlock = await stakingRewards.startBlock();
            const currentBlock = await ethers.provider.getBlockNumber();
            if (currentBlock < startBlock) {
                await mineBlocks(Number(startBlock - BigInt(currentBlock)));
            }

            await stakingRewards.connect(user1).stake(pool1Id, stakeAmount);
            await stakingRewards.connect(user1).stake(pool2Id, stakeAmount);

            await mineBlocks(100);

            const totalPending = await stakingRewards.estimatedTotalPendingRewards(user1.address);
            const pending1 = await stakingRewards.pendingRewardsForPool(pool1Id, user1.address);
            const pending2 = await stakingRewards.pendingRewardsForPool(pool2Id, user1.address);

            expect(totalPending).to.equal(pending1 + pending2);
        });

        it("Should get user locks correctly", async function () {
            const { stakingRewards, lpToken1, user1, pool1Id } =
                await loadFixture(deployStakingRewardsWithPoolsFixture);

            const stakeAmount = ethers.parseEther("500");
            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount * 2n);

            // Create two locks
            await stakingRewards.connect(user1).stakeLocked(pool1Id, stakeAmount, 0);
            await stakingRewards.connect(user1).stakeLocked(pool1Id, stakeAmount, 1);

            const locks = await stakingRewards.getUserLocks(pool1Id, user1.address);
            expect(locks.length).to.equal(2);
            expect(locks[0].amount).to.equal(stakeAmount);
            expect(locks[1].amount).to.equal(stakeAmount);
            expect(locks[0].lockMultiplier).to.equal(12500); // 1.25x
            expect(locks[1].lockMultiplier).to.equal(15000); // 1.5x
        });

        it("Should calculate user total staked correctly", async function () {
            const { stakingRewards, lpToken1, user1, pool1Id } =
                await loadFixture(deployStakingRewardsWithPoolsFixture);

            const flexibleAmount = ethers.parseEther("300");
            const lockedAmount = ethers.parseEther("700");

            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), flexibleAmount + lockedAmount);

            await stakingRewards.connect(user1).stake(pool1Id, flexibleAmount);
            await stakingRewards.connect(user1).stakeLocked(pool1Id, lockedAmount, 1);

            const totalStaked = await stakingRewards.getUserTotalStaked(pool1Id, user1.address);
            expect(totalStaked).to.equal(flexibleAmount + lockedAmount);
        });
    });

    describe("Edge Cases", function () {
        it("Should handle zero rewards per block", async function () {
            const { stakingRewards, lpToken1, user1, pool1Id } =
                await loadFixture(deployStakingRewardsWithPoolsFixture);

            // Set rewards to zero
            await stakingRewards.updateRewardRate(0);

            const stakeAmount = ethers.parseEther("1000");
            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount);
            await stakingRewards.connect(user1).stake(pool1Id, stakeAmount);

            await mineBlocks(100);

            const pendingRewards = await stakingRewards.pendingRewardsForPool(pool1Id, user1.address);
            expect(pendingRewards).to.equal(0);
        });

        it("Should handle reward period end", async function () {
            const { stakingRewards, lpToken1, user1, pool1Id } =
                await loadFixture(deployStakingRewardsWithPoolsFixture);

            const stakeAmount = ethers.parseEther("1000");
            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount);

            // Wait for start block
            const startBlock = await stakingRewards.startBlock();
            let currentBlock = await ethers.provider.getBlockNumber();
            if (currentBlock < startBlock) {
                await mineBlocks(Number(startBlock - BigInt(currentBlock)));
            }

            // Set end block in the future
            currentBlock = await ethers.provider.getBlockNumber();
            const endBlock = currentBlock + 50;
            await stakingRewards.updateRewardPeriod(startBlock, endBlock);

            await stakingRewards.connect(user1).stake(pool1Id, stakeAmount);

            const stakeBlock = await ethers.provider.getBlockNumber();

            // Mine past end block
            await mineBlocks(100);

            const pendingRewards = await stakingRewards.pendingRewardsForPool(pool1Id, user1.address);

            // Should only have rewards up to end block
            const rewardBlocks = Number(endBlock) - Number(stakeBlock);
            const expectedRewards = REWARD_PER_BLOCK * BigInt(rewardBlocks) * 3000n / 10000n;

            expect(pendingRewards).to.be.closeTo(expectedRewards, ethers.parseEther("1"));
        });

        it("Should handle very small stakes", async function () {
            const { stakingRewards, lpToken1, user1, pool1Id } =
                await loadFixture(deployStakingRewardsWithPoolsFixture);

            const tinyStake = 1000n; // Very small amount
            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), tinyStake);

            await expect(
                stakingRewards.connect(user1).stake(pool1Id, tinyStake)
            ).to.not.be.reverted;
        });

        it("Should handle removing user from pool when all positions closed", async function () {
            const { stakingRewards, lpToken1, user1, pool1Id } =
                await loadFixture(deployStakingRewardsWithPoolsFixture);

            const stakeAmount = ethers.parseEther("1000");
            await lpToken1.connect(user1).approve(await stakingRewards.getAddress(), stakeAmount);

            // Stake and withdraw everything
            await stakingRewards.connect(user1).stake(pool1Id, stakeAmount);
            await stakingRewards.connect(user1).withdraw(pool1Id, stakeAmount);

            const activePools = await stakingRewards.getUserActivePools(user1.address);
            expect(activePools.length).to.equal(0);
        });
    });

    describe("Access Control", function () {
        it("Should only allow owner to add pools", async function () {
            const { stakingRewards, lpToken1, user1 } = await loadFixture(deployStakingRewardsFixture);

            await expect(
                stakingRewards.connect(user1).addPool(await lpToken1.getAddress(), 1000, false, 0)
            ).to.be.revertedWithCustomError(stakingRewards, "OwnableUnauthorizedAccount");
        });

        it("Should only allow owner to update pools", async function () {
            const { stakingRewards, user1, pool1Id } = await loadFixture(deployStakingRewardsWithPoolsFixture);

            await expect(
                stakingRewards.connect(user1).updatePool(pool1Id, 5000, true)
            ).to.be.revertedWithCustomError(stakingRewards, "OwnableUnauthorizedAccount");
        });

        it("Should only allow owner to update reward rate", async function () {
            const { stakingRewards, user1 } = await loadFixture(deployStakingRewardsFixture);

            await expect(
                stakingRewards.connect(user1).updateRewardRate(ethers.parseEther("20"))
            ).to.be.revertedWithCustomError(stakingRewards, "OwnableUnauthorizedAccount");
        });

        it("Should only allow owner to set lock tiers", async function () {
            const { stakingRewards, user1 } = await loadFixture(deployStakingRewardsFixture);

            await expect(
                stakingRewards.connect(user1).setLockTier(0, ONE_MONTH, 15000)
            ).to.be.revertedWithCustomError(stakingRewards, "OwnableUnauthorizedAccount");
        });
    });
});
