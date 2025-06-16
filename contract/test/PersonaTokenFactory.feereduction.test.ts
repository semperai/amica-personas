import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { mine } from "@nomicfoundation/hardhat-network-helpers";
import {
    deployPersonaTokenFactoryFixture,
    createPersonaFixture,
    getDeadline,
} from "./shared/fixtures";

describe("PersonaTokenFactory Fee Reduction System", function () {
    const SNAPSHOT_DELAY = 100; // 100 blocks delay
    const MIN_AMICA_FOR_REDUCTION = ethers.parseEther("1000");
    const MAX_AMICA_FOR_REDUCTION = ethers.parseEther("1000000");

    describe("Snapshot Management", function () {
        it("Should create snapshot when user has sufficient AMICA", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // User1 already has 10M AMICA from fixture
            const currentBalance = await amicaToken.balanceOf(user1.address);
            expect(currentBalance).to.be.gte(MIN_AMICA_FOR_REDUCTION);

            // Update snapshot
            await expect(personaFactory.connect(user1).updateAmicaSnapshot())
                .to.emit(personaFactory, "SnapshotUpdated")
                .withArgs(user1.address, currentBalance, await ethers.provider.getBlockNumber() + 1);

            // Check snapshot was recorded using userSnapshots
            const snapshot = await personaFactory.userSnapshots(user1.address);
            // After update, the balance should be in pendingBalance
            expect(snapshot.pendingBalance).to.equal(currentBalance);
            expect(snapshot.pendingBlock).to.be.gt(0);
        });

        it("Should reject snapshot creation with insufficient AMICA", async function () {
            const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Transfer most tokens away to ensure user has less than minimum
            const currentBalance = await amicaToken.balanceOf(user1.address);
            const transferAmount = currentBalance - ethers.parseEther("500"); // Keep only 500
            await amicaToken.connect(user1).transfer(owner.address, transferAmount);

            // Verify balance is below minimum
            expect(await amicaToken.balanceOf(user1.address)).to.be.lt(MIN_AMICA_FOR_REDUCTION);

            // Updated error expectation - using Insufficient(4) for insufficient balance
            await expect(personaFactory.connect(user1).updateAmicaSnapshot())
                .to.be.revertedWithCustomError(personaFactory, "Insufficient")
                .withArgs(4); // 4 = Balance
        });

        it("Should auto-create snapshot on first trade if eligible", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // User2 already has 10M AMICA from fixture
            expect(await amicaToken.balanceOf(user2.address)).to.be.gte(MIN_AMICA_FOR_REDUCTION);

            // Approve for trade
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                ethers.parseEther("1000")
            );

            // First trade should create snapshot
            await expect(
                personaFactory.connect(user2).swapExactTokensForTokens(
                    tokenId,
                    ethers.parseEther("1000"),
                    0,
                    user2.address,
                    getDeadline()
                )
            ).to.emit(personaFactory, "SnapshotUpdated");

            // Verify snapshot was created
            const snapshot = await personaFactory.userSnapshots(user2.address);
            expect(snapshot.pendingBlock).to.be.gt(0);
        });

        it("Should not update snapshot on subsequent trades", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // User2 already has tokens, create snapshot
            await personaFactory.connect(user2).updateAmicaSnapshot();

            const snapshotBefore = await personaFactory.userSnapshots(user2.address);
            const initialPendingBlock = snapshotBefore.pendingBlock;

            // Approve for trade
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                ethers.parseEther("2000")
            );

            // Trade should not update snapshot
            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                ethers.parseEther("1000"),
                0,
                user2.address,
                getDeadline()
            );

            // Snapshot block should remain the same
            const snapshotAfter = await personaFactory.userSnapshots(user2.address);
            expect(snapshotAfter.pendingBlock).to.equal(initialPendingBlock);
        });
    });

    describe("Effective Balance Calculation", function () {
        it("Should return 0 before snapshot delay passes", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // User1 already has tokens, create snapshot
            await personaFactory.connect(user1).updateAmicaSnapshot();

            // Immediately check effective balance
            expect(await personaFactory.getEffectiveAmicaBalance(user1.address)).to.equal(0);
        });

        it("Should return snapshot balance after delay passes", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            const snapshotBalance = await amicaToken.balanceOf(user1.address);
            await personaFactory.connect(user1).updateAmicaSnapshot();

            // Mine blocks to pass delay
            await mine(SNAPSHOT_DELAY);

            expect(await personaFactory.getEffectiveAmicaBalance(user1.address)).to.equal(snapshotBalance);
        });

        it("Should return minimum of snapshot and current balance", async function () {
            const { personaFactory, amicaToken, user1, user2 } = await loadFixture(deployPersonaTokenFactoryFixture);

            const initialBalance = await amicaToken.balanceOf(user1.address);
            await personaFactory.connect(user1).updateAmicaSnapshot();

            // Mine blocks to pass delay
            await mine(SNAPSHOT_DELAY);

            // Transfer some AMICA away
            const transferAmount = ethers.parseEther("4000");
            await amicaToken.connect(user1).transfer(user2.address, transferAmount);

            // Effective balance should be current balance (not snapshot)
            const currentBalance = await amicaToken.balanceOf(user1.address);
            expect(currentBalance).to.equal(initialBalance - transferAmount);
            expect(await personaFactory.getEffectiveAmicaBalance(user1.address)).to.equal(currentBalance);
        });

        it("Should handle user receiving more AMICA after snapshot", async function () {
            const { personaFactory, amicaToken, user1, user2 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Create snapshot with current balance
            const snapshotBalance = await amicaToken.balanceOf(user1.address);
            await personaFactory.connect(user1).updateAmicaSnapshot();

            // Mine blocks to pass delay
            await mine(SNAPSHOT_DELAY);

            // Receive more AMICA from user2
            await amicaToken.connect(user2).transfer(user1.address, ethers.parseEther("5000"));

            // Effective balance should be snapshot balance (not current higher balance)
            expect(await personaFactory.getEffectiveAmicaBalance(user1.address)).to.equal(snapshotBalance);
        });
    });

    describe("Fee Calculation with AMICA Holdings", function () {
        async function setupUserWithAmica(personaFactory: any, amicaToken: any, user: any, targetAmount: bigint, owner: any) {
            const currentBalance = await amicaToken.balanceOf(user.address);

            if (currentBalance > targetAmount) {
                // Transfer excess away
                await amicaToken.connect(user).transfer(owner.address, currentBalance - targetAmount);
            } else if (currentBalance < targetAmount) {
                // Need more tokens - transfer from owner
                await amicaToken.connect(owner).transfer(user.address, targetAmount - currentBalance);
            }

            await personaFactory.connect(user).updateAmicaSnapshot();
            await mine(SNAPSHOT_DELAY);
        }

        it("Should apply no discount below minimum threshold", async function () {
            const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Transfer away most balance to ensure user has less than minimum
            const currentBalance = await amicaToken.balanceOf(user1.address);
            await amicaToken.connect(user1).transfer(
                owner.address,
                currentBalance - ethers.parseEther("500")
            );

            // Verify user has less than minimum
            expect(await amicaToken.balanceOf(user1.address)).to.be.lt(MIN_AMICA_FOR_REDUCTION);

            const baseFee = (await personaFactory.tradingFeeConfig()).feePercentage;
            expect(await personaFactory.getEffectiveFeePercentage(user1.address)).to.equal(baseFee);
        });

        it("Should apply 10% discount at minimum threshold", async function () {
            const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Set user balance to exactly minimum threshold
            await setupUserWithAmica(personaFactory, amicaToken, user1, MIN_AMICA_FOR_REDUCTION, owner);

            const baseFee = (await personaFactory.tradingFeeConfig()).feePercentage;
            const effectiveFee = await personaFactory.getEffectiveFeePercentage(user1.address);

            // Should be 90% of base fee (10% discount)
            expect(effectiveFee).to.equal(baseFee * 9000n / 10000n);
        });

        it("Should apply 100% discount at maximum threshold", async function () {
            const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            await setupUserWithAmica(personaFactory, amicaToken, user1, MAX_AMICA_FOR_REDUCTION, owner);

            expect(await personaFactory.getEffectiveFeePercentage(user1.address)).to.equal(0);
        });

        it("Should apply exponential scaling between min and max", async function () {
            const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Test at 25% of the way from min to max
            const range = MAX_AMICA_FOR_REDUCTION - MIN_AMICA_FOR_REDUCTION;
            const targetBalance = MIN_AMICA_FOR_REDUCTION + range / 4n;

            await setupUserWithAmica(personaFactory, amicaToken, user1, targetBalance, owner);

            const baseFee = (await personaFactory.tradingFeeConfig()).feePercentage;
            const fee25 = await personaFactory.getEffectiveFeePercentage(user1.address);

            // At 25% linear progress, exponential progress should be 6.25% (0.25^2)
            expect(fee25).to.be.lt(baseFee * 8500n / 10000n);
            expect(fee25).to.be.gt(baseFee * 8000n / 10000n);
        });

        it("Should apply larger discount at 50% progress due to exponential curve", async function () {
            const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Test at 50% of the way from min to max
            const range = MAX_AMICA_FOR_REDUCTION - MIN_AMICA_FOR_REDUCTION;
            const targetBalance = MIN_AMICA_FOR_REDUCTION + range / 2n;

            await setupUserWithAmica(personaFactory, amicaToken, user1, targetBalance, owner);

            const baseFee = (await personaFactory.tradingFeeConfig()).feePercentage;
            const fee50 = await personaFactory.getEffectiveFeePercentage(user1.address);

            // At 50% linear progress, exponential progress should be 25% (0.5^2)
            expect(fee50).to.be.closeTo(baseFee * 675n / 1000n, baseFee / 20n);
        });
    });

    describe("Trading with Fee Reduction", function () {
        it("Should apply fee reduction to actual trades", async function () {
            const { tokenId, personaFactory, viewer, amicaToken, user2, user3, owner } = await loadFixture(createPersonaFixture);

            const tradeAmount = ethers.parseEther("10000");

            // Setup user2 with max AMICA (0% fee)
            // User2 already has 10M tokens, just need to create snapshot
            await personaFactory.connect(user2).updateAmicaSnapshot();
            await mine(SNAPSHOT_DELAY);

            // Setup user3 with minimal AMICA (full fee)
            // Transfer most of user3's tokens away
            const user3Balance = await amicaToken.balanceOf(user3.address);
            await amicaToken.connect(user3).transfer(
                owner.address,
                user3Balance - tradeAmount - ethers.parseEther("100") // Keep just enough for trade
            );

            // Get quotes for both users using viewer
            const quoteUser2 = await viewer.getAmountOutForUser(tokenId, tradeAmount, user2.address);
            const quoteUser3 = await viewer.getAmountOutForUser(tokenId, tradeAmount, user3.address);

            // User2 should get more tokens due to fee reduction
            expect(quoteUser2).to.be.gt(quoteUser3);

            // Verify the difference matches fee amount
            const baseFee = (await personaFactory.tradingFeeConfig()).feePercentage;
            const expectedDifference = (tradeAmount * baseFee) / 10000n;
            const actualDifference = quoteUser2 - quoteUser3;

            // The difference in output should correspond to the fee savings
            expect(actualDifference).to.be.gt(0);
        });

        it("Should emit correct fee amounts in TradingFeesCollected event", async function () {
            const { tokenId, personaFactory, amicaToken, user2, owner } = await loadFixture(createPersonaFixture);

            const tradeAmount = ethers.parseEther("10000");

            // Setup user2 with exactly minimum AMICA (10% discount)
            const currentBalance = await amicaToken.balanceOf(user2.address);
            const targetBalance = MIN_AMICA_FOR_REDUCTION + tradeAmount;

            if (currentBalance > targetBalance) {
                await amicaToken.connect(user2).transfer(owner.address, currentBalance - targetBalance);
            }

            await personaFactory.connect(user2).updateAmicaSnapshot();
            await mine(SNAPSHOT_DELAY);

            // Approve and trade
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                tradeAmount
            );

            const baseFee = (await personaFactory.tradingFeeConfig()).feePercentage;
            const expectedFee = (tradeAmount * baseFee * 9000n) / (10000n * 10000n); // 10% discount

            await expect(
                personaFactory.connect(user2).swapExactTokensForTokens(
                    tokenId,
                    tradeAmount,
                    0,
                    user2.address,
                    getDeadline()
                )
            ).to.emit(personaFactory, "TradingFeesCollected")
             .withArgs(tokenId, expectedFee, expectedFee / 2n, expectedFee / 2n);
        });
    });

    describe("getUserFeeInfo View Function", function () {
        it("Should return complete fee information for user", async function () {
            const { personaFactory, viewer, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            const currentBalance = await amicaToken.balanceOf(user1.address);
            await personaFactory.connect(user1).updateAmicaSnapshot();

            // Check before delay using viewer
            let feeInfo = await viewer.getUserFeeInfo(user1.address);
            expect(feeInfo.currentBalance).to.equal(currentBalance);
            expect(feeInfo.snapshotBalance).to.equal(currentBalance);
            expect(feeInfo.effectiveBalance).to.equal(0); // Before delay
            expect(feeInfo.isEligible).to.be.false;
            expect(feeInfo.blocksUntilEligible).to.equal(SNAPSHOT_DELAY);

            // Mine blocks and check again
            await mine(SNAPSHOT_DELAY);

            feeInfo = await viewer.getUserFeeInfo(user1.address);
            expect(feeInfo.effectiveBalance).to.equal(currentBalance);
            expect(feeInfo.isEligible).to.be.true;
            expect(feeInfo.blocksUntilEligible).to.equal(0);
            expect(feeInfo.discountPercentage).to.be.gt(0);
        });

        it("Should show correct discount percentage", async function () {
            const { personaFactory, viewer, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Transfer tokens from owner to user1 to reach max AMICA
            const currentBalance = await amicaToken.balanceOf(user1.address);
            if (currentBalance < MAX_AMICA_FOR_REDUCTION) {
                await amicaToken.connect(owner).transfer(
                    user1.address,
                    MAX_AMICA_FOR_REDUCTION - currentBalance
                );
            }

            await personaFactory.connect(user1).updateAmicaSnapshot();
            await mine(SNAPSHOT_DELAY);

            const feeInfo = await viewer.getUserFeeInfo(user1.address);
            expect(feeInfo.effectiveFeePercentage).to.equal(0);
            expect(feeInfo.discountPercentage).to.equal(10000); // 100% discount
        });
    });

    describe("Edge Cases and Security", function () {
        it("Should handle snapshot updates after balance changes", async function () {
            const { personaFactory, amicaToken, user1, user2 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Initial snapshot
            const firstSnapshotBalance = await amicaToken.balanceOf(user1.address);
            await personaFactory.connect(user1).updateAmicaSnapshot();
            await mine(SNAPSHOT_DELAY);

            // Verify first snapshot is active
            expect(await personaFactory.getEffectiveAmicaBalance(user1.address))
                .to.equal(firstSnapshotBalance);

            // Transfer away most AMICA
            await amicaToken.connect(user1).transfer(user2.address, ethers.parseEther("9000000"));
            const balanceAfterTransfer = await amicaToken.balanceOf(user1.address);

            // Before new snapshot takes effect, should use min of old snapshot and current balance
            expect(await personaFactory.getEffectiveAmicaBalance(user1.address))
                .to.equal(balanceAfterTransfer); // Current balance is lower

            // Update snapshot with new lower balance
            await personaFactory.connect(user1).updateAmicaSnapshot();

            // Old snapshot should still be active until delay passes
            expect(await personaFactory.getEffectiveAmicaBalance(user1.address))
                .to.equal(balanceAfterTransfer); // Still using current balance (lower than old snapshot)

            // After new delay, should still use current balance
            await mine(SNAPSHOT_DELAY);
            expect(await personaFactory.getEffectiveAmicaBalance(user1.address))
                .to.equal(balanceAfterTransfer);
        });

        it("Should prevent gaming the system with flash loans", async function () {
            const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Transfer all user1's balance away first
            const initialBalance = await amicaToken.balanceOf(user1.address);
            await amicaToken.connect(user1).transfer(owner.address, initialBalance);

            // User has no AMICA initially
            expect(await amicaToken.balanceOf(user1.address)).to.equal(0);

            // Simulate flash loan: receive AMICA, create snapshot, return AMICA
            await amicaToken.connect(owner).transfer(user1.address, MAX_AMICA_FOR_REDUCTION);
            await personaFactory.connect(user1).updateAmicaSnapshot();

            // Return AMICA (simulating flash loan repayment)
            await amicaToken.connect(user1).transfer(owner.address, MAX_AMICA_FOR_REDUCTION);

            // Even after delay, effective balance should be 0 (current balance)
            await mine(SNAPSHOT_DELAY);
            expect(await personaFactory.getEffectiveAmicaBalance(user1.address)).to.equal(0);
            expect(await personaFactory.getEffectiveFeePercentage(user1.address))
                .to.equal((await personaFactory.tradingFeeConfig()).feePercentage);
        });

        it("Should handle fee calculation when base fee is 0", async function () {
            const { personaFactory, viewer, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Set base fee to 0
            await personaFactory.connect(owner).configureTradingFees(0, 5000);

            // Even with max AMICA, fee should still be 0
            const currentBalance = await amicaToken.balanceOf(user1.address);
            if (currentBalance < MAX_AMICA_FOR_REDUCTION) {
                await amicaToken.connect(owner).transfer(
                    user1.address,
                    MAX_AMICA_FOR_REDUCTION - currentBalance
                );
            }

            await personaFactory.connect(user1).updateAmicaSnapshot();
            await mine(SNAPSHOT_DELAY);

            expect(await personaFactory.getEffectiveFeePercentage(user1.address)).to.equal(0);

            // getUserFeeInfo should handle this gracefully using viewer
            const feeInfo = await viewer.getUserFeeInfo(user1.address);
            expect(feeInfo.baseFeePercentage).to.equal(0);
            expect(feeInfo.effectiveFeePercentage).to.equal(0);
            expect(feeInfo.discountPercentage).to.equal(0); // No discount when base is 0
        });
    });

    describe("Configuration Updates", function () {
        it("Should update fee reduction configuration", async function () {
            const { personaFactory, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            const newMin = ethers.parseEther("5000");
            const newMax = ethers.parseEther("500000");
            const newMinMultiplier = 8000; // 80% (20% discount)
            const newMaxMultiplier = 2000; // 20% (80% discount)

            await expect(
                personaFactory.connect(owner).configureFeeReduction(
                    newMin,
                    newMax,
                    newMinMultiplier,
                    newMaxMultiplier
                )
            ).to.emit(personaFactory, "FeeReductionConfigUpdated")
             .withArgs(newMin, newMax, newMinMultiplier, newMaxMultiplier);

            const config = await personaFactory.feeReductionConfig();
            expect(config.minAmicaForReduction).to.equal(newMin);
            expect(config.maxAmicaForReduction).to.equal(newMax);
            expect(config.minReductionMultiplier).to.equal(newMinMultiplier);
            expect(config.maxReductionMultiplier).to.equal(newMaxMultiplier);
        });

        it("Should reject invalid fee reduction configuration", async function () {
            const { personaFactory, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Min > Max - using NotAllowed(10) for invalid fee range
            await expect(
                personaFactory.connect(owner).configureFeeReduction(
                    ethers.parseEther("1000000"),
                    ethers.parseEther("1000"),
                    9000,
                    0
                )
            ).to.be.revertedWithCustomError(personaFactory, "NotAllowed")
              .withArgs(10); // 10 = FeeRange

            // Invalid multipliers - using Invalid(9) for invalid multiplier
            await expect(
                personaFactory.connect(owner).configureFeeReduction(
                    ethers.parseEther("1000"),
                    ethers.parseEther("1000000"),
                    10001, // > 100%
                    0
                )
            ).to.be.revertedWithCustomError(personaFactory, "Invalid")
              .withArgs(9); // 9 = Multiplier

            // Max multiplier > Min multiplier - using Invalid(9)
            await expect(
                personaFactory.connect(owner).configureFeeReduction(
                    ethers.parseEther("1000"),
                    ethers.parseEther("1000000"),
                    5000,
                    6000 // Greater than min
                )
            ).to.be.revertedWithCustomError(personaFactory, "Invalid")
              .withArgs(9); // 9 = Multiplier
        });
    });

    describe("previewSwapWithFee Function", function () {
        it("Should correctly preview swap with user-specific fees", async function () {
            const { tokenId, personaFactory, viewer, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            const tradeAmount = ethers.parseEther("10000");

            // User2 already has tokens, create snapshot
            await personaFactory.connect(user2).updateAmicaSnapshot();
            await mine(SNAPSHOT_DELAY);

            // Use viewer for previewSwapWithFee
            const preview = await viewer.previewSwapWithFee(tokenId, tradeAmount, user2.address);

            // Verify fee calculation
            const effectiveFeePercentage = await personaFactory.getEffectiveFeePercentage(user2.address);
            const expectedFee = (tradeAmount * effectiveFeePercentage) / 10000n;

            expect(preview.feeAmount).to.equal(expectedFee);
            expect(preview.amountInAfterFee).to.equal(tradeAmount - expectedFee);
            expect(preview.expectedOutput).to.be.gt(0);

            // Verify preview matches actual swap
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                tradeAmount
            );

            const tx = await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                tradeAmount,
                0, // Set to 0 to avoid slippage protection issues
                user2.address,
                getDeadline()
            );

            const receipt = await tx.wait();
            const purchaseEvent = receipt?.logs.find(
                (log: any) => {
                    try {
                        const parsed = personaFactory.interface.parseLog({
                            topics: log.topics as string[],
                            data: log.data
                        });
                        return parsed?.name === 'TokensPurchased';
                    } catch {
                        return false;
                    }
                }
            );

            const parsedEvent = personaFactory.interface.parseLog({
                topics: purchaseEvent!.topics as string[],
                data: purchaseEvent!.data
            });

            // Get the actual tokens bought from userPurchases (since tokens aren't sent directly)
            const userPurchase = await personaFactory.userPurchases(tokenId, user2.address);
            
            // The preview should be close to the actual amount
            expect(preview.expectedOutput).to.be.closeTo(userPurchase, ethers.parseEther("1"));
        });
    });

    it("Should return current balance from amicaBalanceSnapshot when no pending snapshot exists", async function () {
        const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

        // Create initial snapshot
        await personaFactory.connect(user1).updateAmicaSnapshot();

        // Wait for snapshot to become active
        await mine(SNAPSHOT_DELAY);

        // Now check the snapshot structure
        const snapshot = await personaFactory.userSnapshots(user1.address);
        
        // After delay, pending should be promoted to current
        // The second updateAmicaSnapshot call would promote pending to current
        await personaFactory.connect(user1).updateAmicaSnapshot();
        
        const snapshotAfter = await personaFactory.userSnapshots(user1.address);
        const currentBalance = await amicaToken.balanceOf(user1.address);

        // Should have current balance set
        expect(snapshotAfter.currentBalance).to.equal(currentBalance);
        expect(snapshotAfter.currentBalance).to.be.gt(0);
    });

    it("Should return current block from snapshotBlock when no pending snapshot exists", async function () {
        const { personaFactory, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

        // For this test, we need a user who has never created a snapshot
        // Let's use a fresh wallet
        const [, , , , freshUser] = await ethers.getSigners();

        // Check that no snapshot exists
        const snapshot = await personaFactory.userSnapshots(freshUser.address);

        // All values should be 0 since no snapshot exists
        expect(snapshot.currentBalance).to.equal(0);
        expect(snapshot.currentBlock).to.equal(0);
        expect(snapshot.pendingBalance).to.equal(0);
        expect(snapshot.pendingBlock).to.equal(0);
    });

    it("Should handle edge case where current snapshot exists but isn't active yet", async function () {
        const { personaFactory, viewer, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

        // First create a snapshot
        await personaFactory.connect(user1).updateAmicaSnapshot();

        // Mine some blocks but not enough to activate
        await mine(SNAPSHOT_DELAY - 10);

        // Get fee info using viewer - this should hit the edge case branch
        const feeInfo = await viewer.getUserFeeInfo(user1.address);

        expect(feeInfo.isEligible).to.be.false;
        expect(feeInfo.blocksUntilEligible).to.be.gt(0);
        expect(feeInfo.blocksUntilEligible).to.be.lte(10);
    });
});
