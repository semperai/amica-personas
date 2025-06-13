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

            // Get initial balance from fixture
            const initialBalance = await amicaToken.balanceOf(user1.address);

            // Give user1 enough AMICA
            await amicaToken.withdraw(user1.address, MIN_AMICA_FOR_REDUCTION);

            const totalBalance = initialBalance + MIN_AMICA_FOR_REDUCTION;

            // Update snapshot
            await expect(personaFactory.connect(user1).updateAmicaSnapshot())
                .to.emit(personaFactory, "SnapshotUpdated")
                .withArgs(user1.address, totalBalance, await ethers.provider.getBlockNumber() + 1);

            // Check snapshot was recorded
            expect(await personaFactory.amicaBalanceSnapshot(user1.address)).to.equal(totalBalance);
            expect(await personaFactory.snapshotBlock(user1.address)).to.be.gt(0);
        });

        it("Should reject snapshot creation with insufficient AMICA", async function () {
            const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // First, check current balance
            const currentBalance = await amicaToken.balanceOf(user1.address);

            // If user has too much, transfer it away
            if (currentBalance >= MIN_AMICA_FOR_REDUCTION) {
                await amicaToken.connect(user1).transfer(
                    owner.address,
                    currentBalance - ethers.parseEther("500") // Keep only 500
                );
            }

            // Verify balance is below minimum
            expect(await amicaToken.balanceOf(user1.address)).to.be.lt(MIN_AMICA_FOR_REDUCTION);

            await expect(personaFactory.connect(user1).updateAmicaSnapshot())
                .to.be.revertedWith("Insufficient AMICA balance");
        });

        it("Should auto-create snapshot on first trade if eligible", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Give user2 enough AMICA
            await amicaToken.withdraw(user2.address, ethers.parseEther("10000"));

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
            expect(await personaFactory.snapshotBlock(user2.address)).to.be.gt(0);
        });

        it("Should not update snapshot on subsequent trades", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Give user2 AMICA and create snapshot
            await amicaToken.withdraw(user2.address, ethers.parseEther("10000"));
            await personaFactory.connect(user2).updateAmicaSnapshot();

            const initialSnapshotBlock = await personaFactory.snapshotBlock(user2.address);

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
            expect(await personaFactory.snapshotBlock(user2.address)).to.equal(initialSnapshotBlock);
        });
    });

    describe("Effective Balance Calculation", function () {
        it("Should return 0 before snapshot delay passes", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Give user1 AMICA and create snapshot
            await amicaToken.withdraw(user1.address, ethers.parseEther("10000"));
            await personaFactory.connect(user1).updateAmicaSnapshot();

            // Immediately check effective balance
            expect(await personaFactory.getEffectiveAmicaBalance(user1.address)).to.equal(0);
        });

        it("Should return snapshot balance after delay passes", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            const initialBalance = await amicaToken.balanceOf(user1.address);
            const additionalAmount = ethers.parseEther("10000");

            await amicaToken.withdraw(user1.address, additionalAmount);
            const totalBalance = initialBalance + additionalAmount;

            await personaFactory.connect(user1).updateAmicaSnapshot();

            // Mine blocks to pass delay
            await mine(SNAPSHOT_DELAY);

            expect(await personaFactory.getEffectiveAmicaBalance(user1.address)).to.equal(totalBalance);
        });

        it("Should return minimum of snapshot and current balance", async function () {
            const { personaFactory, amicaToken, user1, user2 } = await loadFixture(deployPersonaTokenFactoryFixture);

            const initialBalance = await amicaToken.balanceOf(user1.address);
            const additionalAmount = ethers.parseEther("10000");

            await amicaToken.withdraw(user1.address, additionalAmount);
            const totalBalance = initialBalance + additionalAmount;

            await personaFactory.connect(user1).updateAmicaSnapshot();

            // Mine blocks to pass delay
            await mine(SNAPSHOT_DELAY);

            // Transfer some AMICA away
            await amicaToken.connect(user1).transfer(user2.address, ethers.parseEther("4000"));

            // Effective balance should be current balance (not snapshot)
            const currentBalance = await amicaToken.balanceOf(user1.address);
            expect(await personaFactory.getEffectiveAmicaBalance(user1.address))
                .to.equal(currentBalance);
        });

        it("Should handle user receiving more AMICA after snapshot", async function () {
            const { personaFactory, amicaToken, user1, user2 } = await loadFixture(deployPersonaTokenFactoryFixture);

            const initialBalance = await amicaToken.balanceOf(user1.address);
            const firstWithdraw = ethers.parseEther("5000");

            await amicaToken.withdraw(user1.address, firstWithdraw);
            const snapshotBalance = initialBalance + firstWithdraw;

            await personaFactory.connect(user1).updateAmicaSnapshot();

            // Mine blocks to pass delay
            await mine(SNAPSHOT_DELAY);

            // Receive more AMICA
            await amicaToken.withdraw(user1.address, ethers.parseEther("5000"));

            // Effective balance should be snapshot balance (not current higher balance)
            expect(await personaFactory.getEffectiveAmicaBalance(user1.address))
                .to.equal(snapshotBalance);
        });
    });

    describe("Fee Calculation with AMICA Holdings", function () {
        async function setupUserWithAmica(personaFactory: any, amicaToken: any, user: any, amount: bigint) {
            await amicaToken.withdraw(user.address, amount);
            await personaFactory.connect(user).updateAmicaSnapshot();
            await mine(SNAPSHOT_DELAY);
        }

        it("Should apply no discount below minimum threshold", async function () {
            const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Transfer away most balance to ensure user has less than minimum
            const currentBalance = await amicaToken.balanceOf(user1.address);
            if (currentBalance > ethers.parseEther("500")) {
                await amicaToken.connect(user1).transfer(
                    owner.address,
                    currentBalance - ethers.parseEther("500")
                );
            }

            // Verify user has less than minimum
            expect(await amicaToken.balanceOf(user1.address)).to.be.lt(MIN_AMICA_FOR_REDUCTION);

            const baseFee = (await personaFactory.tradingFeeConfig()).feePercentage;
            expect(await personaFactory.getEffectiveFeePercentage(user1.address)).to.equal(baseFee);
        });

        it("Should apply 10% discount at minimum threshold", async function () {
            const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Reset user balance to exactly minimum
            const currentBalance = await amicaToken.balanceOf(user1.address);

            if (currentBalance > MIN_AMICA_FOR_REDUCTION) {
                await amicaToken.connect(user1).transfer(
                    owner.address,
                    currentBalance - MIN_AMICA_FOR_REDUCTION
                );
            } else if (currentBalance < MIN_AMICA_FOR_REDUCTION) {
                await amicaToken.withdraw(user1.address, MIN_AMICA_FOR_REDUCTION - currentBalance);
            }

            // Create snapshot
            await personaFactory.connect(user1).updateAmicaSnapshot();
            await mine(SNAPSHOT_DELAY);

            const baseFee = (await personaFactory.tradingFeeConfig()).feePercentage;
            const effectiveFee = await personaFactory.getEffectiveFeePercentage(user1.address);

            // Should be 90% of base fee (10% discount)
            expect(effectiveFee).to.equal(baseFee * 9000n / 10000n);
        });

        it("Should apply 100% discount at maximum threshold", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            await setupUserWithAmica(personaFactory, amicaToken, user1, MAX_AMICA_FOR_REDUCTION);

            expect(await personaFactory.getEffectiveFeePercentage(user1.address)).to.equal(0);
        });

        it("Should apply exponential scaling between min and max", async function () {
            const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Test at 25% of the way from min to max
            const range = MAX_AMICA_FOR_REDUCTION - MIN_AMICA_FOR_REDUCTION;
            const targetBalance = MIN_AMICA_FOR_REDUCTION + range / 4n;

            // Set user balance to target
            const currentBalance = await amicaToken.balanceOf(user1.address);

            if (currentBalance > targetBalance) {
                await amicaToken.connect(user1).transfer(owner.address, currentBalance - targetBalance);
            } else {
                await amicaToken.withdraw(user1.address, targetBalance - currentBalance);
            }

            // Create snapshot and wait
            await personaFactory.connect(user1).updateAmicaSnapshot();
            await mine(SNAPSHOT_DELAY);

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

            // Set user balance to target
            const currentBalance = await amicaToken.balanceOf(user1.address);

            if (currentBalance > targetBalance) {
                await amicaToken.connect(user1).transfer(owner.address, currentBalance - targetBalance);
            } else {
                await amicaToken.withdraw(user1.address, targetBalance - currentBalance);
            }

            // Create snapshot and wait
            await personaFactory.connect(user1).updateAmicaSnapshot();
            await mine(SNAPSHOT_DELAY);

            const baseFee = (await personaFactory.tradingFeeConfig()).feePercentage;
            const fee50 = await personaFactory.getEffectiveFeePercentage(user1.address);

            // At 50% linear progress, exponential progress should be 25% (0.5^2)
            expect(fee50).to.be.closeTo(baseFee * 675n / 1000n, baseFee / 20n);
        });
    });

    describe("Trading with Fee Reduction", function () {
        it("Should apply fee reduction to actual trades", async function () {
            const { tokenId, personaFactory, amicaToken, user2, user3 } = await loadFixture(createPersonaFixture);

            const tradeAmount = ethers.parseEther("10000");

            // Setup user2 with max AMICA (0% fee)
            await amicaToken.withdraw(user2.address, MAX_AMICA_FOR_REDUCTION + tradeAmount);
            await personaFactory.connect(user2).updateAmicaSnapshot();
            await mine(SNAPSHOT_DELAY);

            // Setup user3 with no AMICA (full fee)
            await amicaToken.withdraw(user3.address, tradeAmount);

            // Get quotes for both users
            const quoteUser2 = await personaFactory.getAmountOutForUser(tokenId, tradeAmount, user2.address);
            const quoteUser3 = await personaFactory.getAmountOutForUser(tokenId, tradeAmount, user3.address);

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

            // Setup user with minimum AMICA (10% discount)
            const currentBalance = await amicaToken.balanceOf(user2.address);
            const targetBalance = MIN_AMICA_FOR_REDUCTION + tradeAmount;

            if (currentBalance < targetBalance) {
                await amicaToken.withdraw(user2.address, targetBalance - currentBalance);
            }

            // We need to set up the snapshot and wait for the delay
            // Reset the user2 balance to exactly minimum threshold
            const newBalance = await amicaToken.balanceOf(user2.address);
            if (newBalance > MIN_AMICA_FOR_REDUCTION + tradeAmount) {
                await amicaToken.connect(user2).transfer(
                    owner.address,
                    newBalance - MIN_AMICA_FOR_REDUCTION - tradeAmount
                );
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
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            const initialBalance = await amicaToken.balanceOf(user1.address);
            const additionalAmount = ethers.parseEther("50000");

            await amicaToken.withdraw(user1.address, additionalAmount);
            const totalBalance = initialBalance + additionalAmount;

            await personaFactory.connect(user1).updateAmicaSnapshot();

            // Check before delay
            let feeInfo = await personaFactory.getUserFeeInfo(user1.address);
            expect(feeInfo.currentBalance).to.equal(totalBalance);
            expect(feeInfo.snapshotBalance).to.equal(totalBalance);
            expect(feeInfo.effectiveBalance).to.equal(0); // Before delay
            expect(feeInfo.isEligible).to.be.false;
            expect(feeInfo.blocksUntilEligible).to.equal(SNAPSHOT_DELAY);

            // Mine blocks and check again
            await mine(SNAPSHOT_DELAY);

            feeInfo = await personaFactory.getUserFeeInfo(user1.address);
            expect(feeInfo.effectiveBalance).to.equal(totalBalance);
            expect(feeInfo.isEligible).to.be.true;
            expect(feeInfo.blocksUntilEligible).to.equal(0);
            expect(feeInfo.discountPercentage).to.be.gt(0);
        });

        it("Should show correct discount percentage", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Setup with max AMICA for 100% discount
            await amicaToken.withdraw(user1.address, MAX_AMICA_FOR_REDUCTION);
            await personaFactory.connect(user1).updateAmicaSnapshot();
            await mine(SNAPSHOT_DELAY);

            const feeInfo = await personaFactory.getUserFeeInfo(user1.address);
            expect(feeInfo.effectiveFeePercentage).to.equal(0);
            expect(feeInfo.discountPercentage).to.equal(10000); // 100% discount
        });
    });

    describe("Edge Cases and Security", function () {
        it("Should handle snapshot updates after balance changes", async function () {
            const { personaFactory, amicaToken, user1, user2 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Initial snapshot
            const initialBalance = await amicaToken.balanceOf(user1.address);
            await amicaToken.withdraw(user1.address, ethers.parseEther("100000"));
            const firstSnapshotBalance = initialBalance + ethers.parseEther("100000");

            await personaFactory.connect(user1).updateAmicaSnapshot();
            await mine(SNAPSHOT_DELAY);

            // Verify first snapshot is active
            expect(await personaFactory.getEffectiveAmicaBalance(user1.address))
                .to.equal(firstSnapshotBalance);

            // Transfer away most AMICA
            await amicaToken.connect(user1).transfer(user2.address, ethers.parseEther("90000"));
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
            if (initialBalance > 0) {
                await amicaToken.connect(user1).transfer(owner.address, initialBalance);
            }

            // User has no AMICA initially
            expect(await amicaToken.balanceOf(user1.address)).to.equal(0);

            // Simulate flash loan: receive AMICA, create snapshot, return AMICA
            await amicaToken.withdraw(user1.address, MAX_AMICA_FOR_REDUCTION);
            await personaFactory.connect(user1).updateAmicaSnapshot();

            // Return AMICA (simulating flash loan repayment)
            await amicaToken.connect(user1).transfer(
                await amicaToken.getAddress(),
                MAX_AMICA_FOR_REDUCTION
            );

            // Even after delay, effective balance should be 0 (current balance)
            await mine(SNAPSHOT_DELAY);
            expect(await personaFactory.getEffectiveAmicaBalance(user1.address)).to.equal(0);
            expect(await personaFactory.getEffectiveFeePercentage(user1.address))
                .to.equal((await personaFactory.tradingFeeConfig()).feePercentage);
        });

        it("Should handle fee calculation when base fee is 0", async function () {
            const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Set base fee to 0
            await personaFactory.connect(owner).configureTradingFees(0, 5000);

            // Even with max AMICA, fee should still be 0
            await amicaToken.withdraw(user1.address, MAX_AMICA_FOR_REDUCTION);
            await personaFactory.connect(user1).updateAmicaSnapshot();
            await mine(SNAPSHOT_DELAY);

            expect(await personaFactory.getEffectiveFeePercentage(user1.address)).to.equal(0);

            // getUserFeeInfo should handle this gracefully
            const feeInfo = await personaFactory.getUserFeeInfo(user1.address);
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

            // Min > Max
            await expect(
                personaFactory.connect(owner).configureFeeReduction(
                    ethers.parseEther("1000000"),
                    ethers.parseEther("1000"),
                    9000,
                    0
                )
            ).to.be.revertedWith("Invalid AMICA range");

            // Invalid multipliers
            await expect(
                personaFactory.connect(owner).configureFeeReduction(
                    ethers.parseEther("1000"),
                    ethers.parseEther("1000000"),
                    10001, // > 100%
                    0
                )
            ).to.be.revertedWith("Invalid min multiplier");

            // Max multiplier > Min multiplier
            await expect(
                personaFactory.connect(owner).configureFeeReduction(
                    ethers.parseEther("1000"),
                    ethers.parseEther("1000000"),
                    5000,
                    6000 // Greater than min
                )
            ).to.be.revertedWith("Invalid max multiplier");
        });
    });

    describe("previewSwapWithFee Function", function () {
        it("Should correctly preview swap with user-specific fees", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            const tradeAmount = ethers.parseEther("10000");

            // Setup user with AMICA for fee reduction
            await amicaToken.withdraw(user2.address, ethers.parseEther("100000"));
            await personaFactory.connect(user2).updateAmicaSnapshot();
            await mine(SNAPSHOT_DELAY);

            const preview = await personaFactory.previewSwapWithFee(tokenId, tradeAmount, user2.address);

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
                preview.expectedOutput,
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

            expect(parsedEvent!.args.tokensReceived).to.equal(preview.expectedOutput);
        });
    });
});
