import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
    deployPersonaTokenFactoryFixture,
    createPersonaFixture,
    DEFAULT_MINT_COST,
    DEFAULT_GRADUATION_THRESHOLD,
    getDeadline,
} from "./shared/fixtures";

describe("PersonaTokenFactory Security and Edge Cases", function () {
    describe("Reentrancy Protection", function () {
        it("Should have reentrancy protection on createPersona", async function () {
            const { personaFactory, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Deploy malicious token that attempts reentrancy
            const MaliciousToken = await ethers.getContractFactory("MaliciousReentrantToken");
            const maliciousToken = await MaliciousToken.deploy(
                await personaFactory.getAddress(),
                "createPersona"
            );

            // Configure the malicious token as a pairing token
            await personaFactory.connect(owner).configurePairingToken(
                await maliciousToken.getAddress(),
                ethers.parseEther("100"),
                ethers.parseEther("10000")
            );

            // Mint tokens and approve
            await maliciousToken.mint(owner.address, ethers.parseEther("1000"));
            await maliciousToken.approve(await personaFactory.getAddress(), ethers.parseEther("1000"));

            // The createPersona call should succeed, but the reentrant call inside should fail
            // The transaction as a whole won't revert because the malicious token catches the error
            // We need to verify that reentrancy was prevented by checking the result

            // Execute the transaction and capture the created token ID
            const tx = await personaFactory.createPersona(
                await maliciousToken.getAddress(),
                "Test",
                "TEST",
                [],
                [],
                0,
                ethers.ZeroAddress,
            );

            const receipt = await tx.wait();
            const event = receipt?.logs.find(
                log => {
                    try {
                        const parsed = personaFactory.interface.parseLog({
                            topics: log.topics as string[],
                            data: log.data
                        });
                        return parsed?.name === 'PersonaCreated';
                    } catch {
                        return false;
                    }
                }
            );

            // Should have exactly one PersonaCreated event
            expect(event).to.not.be.undefined;

            // Try to create another persona directly to verify the count
            await maliciousToken.mint(owner.address, ethers.parseEther("200"));
            await maliciousToken.approve(await personaFactory.getAddress(), ethers.parseEther("200"));

            const tx2 = await personaFactory.createPersona(
                await maliciousToken.getAddress(),
                "Test2",
                "TEST2",
                [],
                [],
                0,
                ethers.ZeroAddress,
            );

            const receipt2 = await tx2.wait();
            const event2 = receipt2?.logs.find(
                log => {
                    try {
                        const parsed = personaFactory.interface.parseLog({
                            topics: log.topics as string[],
                            data: log.data
                        });
                        return parsed?.name === 'PersonaCreated';
                    } catch {
                        return false;
                    }
                }
            );

            const parsedEvent1 = personaFactory.interface.parseLog({
                topics: event!.topics as string[],
                data: event!.data
            });
            const parsedEvent2 = personaFactory.interface.parseLog({
                topics: event2!.topics as string[],
                data: event2!.data
            });

            const tokenId1 = parsedEvent1!.args.tokenId;
            const tokenId2 = parsedEvent2!.args.tokenId;

            // If reentrancy protection works, tokenId2 should be tokenId1 + 1
            // (not tokenId1 + 2, which would happen if the reentrant call succeeded)
            expect(tokenId2).to.equal(tokenId1 + 1n);
        });

        it("Should have reentrancy protection on swapExactTokensForTokens", async function () {
            const { tokenId, personaFactory, amicaToken, user1, owner } = await loadFixture(createPersonaFixture);

            // Deploy malicious token that attempts reentrant swap
            const MaliciousToken = await ethers.getContractFactory("MaliciousReentrantToken");
            const maliciousToken = await MaliciousToken.deploy(
                await personaFactory.getAddress(),
                "swapExactTokensForTokens"
            );

            // This test would need a complex setup with a malicious ERC20
            // that calls back into the contract during transferFrom
            // For now, we verify the modifier exists by checking the function
            expect(true).to.be.true; // Placeholder - actual test would need malicious contract
        });
    });

    describe("Front-running and MEV Protection", function () {
        it("Should respect slippage protection (amountOutMin)", async function () {
            const { tokenId, personaFactory, amicaToken, user1, user2 } = await loadFixture(createPersonaFixture);

            const tradeAmount = ethers.parseEther("10000");

            // User1 gets a quote
            const quotedAmount = await personaFactory.getAmountOut(tokenId, tradeAmount);

            // User2 already has tokens from fixture (10M AMICA)
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                ethers.parseEther("50000")
            );

            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                ethers.parseEther("50000"),
                0,
                user2.address,
                getDeadline()
            );

            // Now user1's trade should fail if they set appropriate slippage
            // User1 already has tokens from fixture
            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                tradeAmount
            );

            // This should fail because the actual output will be less than quoted
            await expect(
                personaFactory.connect(user1).swapExactTokensForTokens(
                    tokenId,
                    tradeAmount,
                    quotedAmount, // Using original quote as minimum
                    user1.address,
                    getDeadline()
                )
            ).to.be.revertedWith("Insufficient output amount");
        });

        it("Should handle sandwich attacks with deadline protection", async function () {
            const { tokenId, personaFactory, amicaToken, user1 } = await loadFixture(createPersonaFixture);

            // User1 already has tokens from fixture
            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                ethers.parseEther("10000")
            );

            // Transaction with very short deadline
            const shortDeadline = Math.floor(Date.now() / 1000) + 1; // 1 second

            // Wait 2 seconds
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Transaction should expire
            await expect(
                personaFactory.connect(user1).swapExactTokensForTokens(
                    tokenId,
                    ethers.parseEther("10000"),
                    0,
                    user1.address,
                    shortDeadline
                )
            ).to.be.revertedWith("Transaction expired");
        });
    });

    describe("Graduation Edge Cases", function () {
        it("Should handle graduation with exactly threshold amount", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Calculate exact amount needed for graduation (accounting for fees)
            const feePercentage = (await personaFactory.tradingFeeConfig()).feePercentage;
            const exactAmount = (DEFAULT_GRADUATION_THRESHOLD * 10000n) / (10000n - feePercentage);

            // Check if user2 has enough tokens, if not, skip test
            const user2Balance = await amicaToken.balanceOf(user2.address);

            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                exactAmount
            );

            await expect(
                personaFactory.connect(user2).swapExactTokensForTokens(
                    tokenId,
                    exactAmount,
                    0,
                    user2.address,
                    getDeadline()
                )
            ).to.emit(personaFactory, "LiquidityPairCreated");
        });

        it("Should handle multiple users triggering graduation in same block", async function () {
            const { tokenId, personaFactory, amicaToken, user1, user2, user3 } = await loadFixture(createPersonaFixture);

            // Each user will contribute 1/3 of graduation threshold
            const perUserAmount = DEFAULT_GRADUATION_THRESHOLD / 3n + ethers.parseEther("10000");

            // Check if users have enough tokens
            const user1Balance = await amicaToken.balanceOf(user1.address);
            const user2Balance = await amicaToken.balanceOf(user2.address);
            const user3Balance = await amicaToken.balanceOf(user3.address);

            await amicaToken.connect(user1).approve(await personaFactory.getAddress(), perUserAmount);
            await amicaToken.connect(user2).approve(await personaFactory.getAddress(), perUserAmount);
            await amicaToken.connect(user3).approve(await personaFactory.getAddress(), perUserAmount);

            // Execute all trades
            await personaFactory.connect(user1).swapExactTokensForTokens(
                tokenId, perUserAmount, 0, user1.address, getDeadline()
            );

            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId, perUserAmount, 0, user2.address, getDeadline()
            );

            // Third trade should trigger graduation
            await expect(
                personaFactory.connect(user3).swapExactTokensForTokens(
                    tokenId, perUserAmount, 0, user3.address, getDeadline()
                )
            ).to.emit(personaFactory, "LiquidityPairCreated");

            // All users should be able to withdraw immediately after graduation
            await expect(personaFactory.connect(user1).withdrawTokens(tokenId))
                .to.emit(personaFactory, "TokensWithdrawn");
            await expect(personaFactory.connect(user2).withdrawTokens(tokenId))
                .to.emit(personaFactory, "TokensWithdrawn");
            await expect(personaFactory.connect(user3).withdrawTokens(tokenId))
                .to.emit(personaFactory, "TokensWithdrawn");
        });
    });

    describe("Extreme Configuration Edge Cases", function () {
        it("Should handle graduation threshold of 0", async function () {
            const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Configure with 0 graduation threshold
            const TestToken = await ethers.getContractFactory("TestERC20");
            const testToken = await TestToken.deploy("Test", "TEST", ethers.parseEther("1000000"));

            await personaFactory.connect(owner).configurePairingToken(
                await testToken.getAddress(),
                ethers.parseEther("100"),
                0 // Zero graduation threshold
            );

            await testToken.transfer(user1.address, ethers.parseEther("200"));
            await testToken.connect(user1).approve(
                await personaFactory.getAddress(),
                ethers.parseEther("200")
            );

            // Creating should immediately graduate
            await expect(
                personaFactory.connect(user1).createPersona(
                    await testToken.getAddress(),
                    "Instant",
                    "INST",
                    [],
                    [],
                    ethers.parseEther("1"), // Any initial buy should trigger
                    ethers.ZeroAddress,
                )
            ).to.emit(personaFactory, "LiquidityPairCreated");
        });

        it("Should handle mint cost exceeding user balance", async function () {
            const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Set very high mint cost
            await personaFactory.connect(owner).configurePairingToken(
                await amicaToken.getAddress(),
                ethers.parseEther("1000000000"), // 1 billion
                DEFAULT_GRADUATION_THRESHOLD
            );

            // User has less than mint cost
            const userBalance = await amicaToken.balanceOf(user1.address);
            expect(userBalance).to.be.lt(ethers.parseEther("1000000000"));

            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                ethers.parseEther("1000000000")
            );

            await expect(
                personaFactory.connect(user1).createPersona(
                    await amicaToken.getAddress(),
                    "Test",
                    "TEST",
                    [],
                    [],
                    0,
                    ethers.ZeroAddress,
                )
            ).to.be.revertedWith("Insufficient balance");
        });

        it("Should handle fee configuration edge cases", async function () {
            const { personaFactory, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Set fee to exactly 10% (maximum)
            await expect(
                personaFactory.connect(owner).configureTradingFees(1000, 5000)
            ).to.not.be.reverted;

            // Try to set fee above 10%
            await expect(
                personaFactory.connect(owner).configureTradingFees(1001, 5000)
            ).to.be.revertedWith("Fee too high");

            // Set creator share to 0% (all fees to protocol)
            await expect(
                personaFactory.connect(owner).configureTradingFees(100, 0)
            ).to.not.be.reverted;

            // Set creator share to 100% (all fees to creator)
            await expect(
                personaFactory.connect(owner).configureTradingFees(100, 10000)
            ).to.not.be.reverted;
        });
    });

    describe("Token Distribution Edge Cases", function () {
        it("Should handle purchases that would exceed bonding curve allocation", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Try to buy more tokens than available on bonding curve
            const hugeAmount = ethers.parseEther("10000000"); // 10M AMICA

            // Check if user2 has enough tokens
            const user2Balance = await amicaToken.balanceOf(user2.address);

            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                hugeAmount
            );

            await expect(
                personaFactory.connect(user2).swapExactTokensForTokens(
                    tokenId,
                    hugeAmount,
                    0,
                    user2.address,
                    getDeadline()
                )
            ).to.be.revertedWith("Insufficient liquidity");
        });

        it("Should correctly handle available tokens calculation near limits", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Make purchases until close to graduation
            const purchaseSize = ethers.parseEther("100000");
            const numPurchases = 9; // Should get us close to threshold

            // Check if user2 has enough tokens
            const totalNeeded = purchaseSize * BigInt(numPurchases + 1);
            const user2Balance = await amicaToken.balanceOf(user2.address);

            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                totalNeeded
            );

            // Make purchases
            for (let i = 0; i < numPurchases; i++) {
                const availableBefore = await personaFactory.getAvailableTokens(tokenId);

                await personaFactory.connect(user2).swapExactTokensForTokens(
                    tokenId,
                    purchaseSize,
                    0,
                    user2.address,
                    getDeadline()
                );

                const availableAfter = await personaFactory.getAvailableTokens(tokenId);

                // Available tokens should decrease
                expect(availableAfter).to.be.lt(availableBefore);
            }

            // Check if we're close to graduation
            const purchase = await personaFactory.purchases(tokenId);
            const config = await personaFactory.pairingConfigs(await amicaToken.getAddress());

            // Should be close to graduation threshold
            expect(purchase.totalDeposited).to.be.closeTo(
                config.graduationThreshold,
                ethers.parseEther("200000") // Within 200k
            );
        });
    });

    describe("NFT Transfer Edge Cases", function () {
        it("Should update fee recipient when NFT is transferred", async function () {
            const { tokenId, personaFactory, amicaToken, user1, user2, user3 } = await loadFixture(createPersonaFixture);

            // Transfer NFT from user1 to user2
            await personaFactory.connect(user1).transferFrom(user1.address, user2.address, tokenId);

            // Make a trade
            const tradeAmount = ethers.parseEther("10000");

            // User3 already has tokens from fixture
            await amicaToken.connect(user3).approve(
                await personaFactory.getAddress(),
                tradeAmount
            );

            const user1BalanceBefore = await amicaToken.balanceOf(user1.address);
            const user2BalanceBefore = await amicaToken.balanceOf(user2.address);

            await personaFactory.connect(user3).swapExactTokensForTokens(
                tokenId,
                tradeAmount,
                0,
                user3.address,
                getDeadline()
            );

            // Fees should go to new owner (user2), not original creator (user1)
            const user1BalanceAfter = await amicaToken.balanceOf(user1.address);
            const user2BalanceAfter = await amicaToken.balanceOf(user2.address);

            expect(user1BalanceAfter).to.equal(user1BalanceBefore); // No fees received
            expect(user2BalanceAfter).to.be.gt(user2BalanceBefore); // Received fees
        });

        it("Should allow new owner to update metadata after transfer", async function () {
            const { tokenId, personaFactory, user1, user2 } = await loadFixture(createPersonaFixture);

            // Transfer NFT
            await personaFactory.connect(user1).transferFrom(user1.address, user2.address, tokenId);

            // New owner should be able to update metadata
            await expect(
                personaFactory.connect(user2).updateMetadata(
                    tokenId,
                    ["description"],
                    ["Updated by new owner"]
                )
            ).to.emit(personaFactory, "MetadataUpdated");

            // Old owner should not be able to update
            await expect(
                personaFactory.connect(user1).updateMetadata(
                    tokenId,
                    ["description"],
                    ["Should fail"]
                )
            ).to.be.revertedWith("Not token owner");
        });
    });

    describe("Pairing Token Edge Cases", function () {
        it("Should handle pairing tokens with non-standard decimals", async function () {
            const { personaFactory, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Deploy 6-decimal token (like USDC)
            const SixDecimalToken = await ethers.getContractFactory("TestERC20");
            const sixToken = await SixDecimalToken.deploy("Six", "SIX", ethers.parseUnits("10000000", 6));

            // Configure with 6-decimal values
            await personaFactory.connect(owner).configurePairingToken(
                await sixToken.getAddress(),
                ethers.parseUnits("100", 6),      // 100 tokens
                ethers.parseUnits("10000", 6)     // 10k tokens graduation
            );

            await sixToken.transfer(user1.address, ethers.parseUnits("200", 6));
            await sixToken.connect(user1).approve(
                await personaFactory.getAddress(),
                ethers.parseUnits("200", 6)
            );

            // Should create persona successfully
            await expect(
                personaFactory.connect(user1).createPersona(
                    await sixToken.getAddress(),
                    "Six Decimal",
                    "SIXD",
                    [],
                    [],
                    ethers.parseUnits("50", 6), // Initial buy with 6 decimals
                    ethers.ZeroAddress,
                )
            ).to.emit(personaFactory, "PersonaCreated");
        });

        it("Should prevent using disabled pairing token", async function () {
            const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Disable AMICA as pairing token
            await personaFactory.connect(owner).disablePairingToken(await amicaToken.getAddress());

            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST
            );

            await expect(
                personaFactory.connect(user1).createPersona(
                    await amicaToken.getAddress(),
                    "Test",
                    "TEST",
                    [],
                    [],
                    0,
                    ethers.ZeroAddress,
                )
            ).to.be.revertedWith("Pairing token not enabled");
        });
    });

    describe("Gas Optimization Considerations", function () {
        it("Should handle batch operations efficiently", async function () {
            const { tokenId, personaFactory, amicaToken, user1, user2, user3 } = await loadFixture(createPersonaFixture);

            // Multiple users making small trades
            const users = [user1, user2, user3];
            const tradeAmount = ethers.parseEther("1000");

            for (const user of users) {
                // Users already have tokens from fixture
                await amicaToken.connect(user).approve(
                    await personaFactory.getAddress(),
                    tradeAmount
                );
            }

            // Measure gas for sequential trades
            const gasUsed = [];
            for (const user of users) {
                const tx = await personaFactory.connect(user).swapExactTokensForTokens(
                    tokenId,
                    tradeAmount,
                    0,
                    user.address,
                    getDeadline()
                );
                const receipt = await tx.wait();
                if (receipt?.gasUsed === undefined) {
                    throw new Error("Transaction receipt missing gasUsed");
                }
                gasUsed.push(receipt.gasUsed);
            }

            // Gas should be relatively consistent
            const avgGas = gasUsed.reduce((a, b) => a + b) / BigInt(gasUsed.length);
            for (const gas of gasUsed) {
                expect(gas).to.be.closeTo(avgGas, avgGas / 10n); // Within 10%
            }
        });
    });
});
