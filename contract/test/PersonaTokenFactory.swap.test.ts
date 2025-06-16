import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { TestERC20, PersonaFactoryViewer } from "../typechain-types";
import {
    getDeadline,
    createPersonaFixture,
    deployPersonaTokenFactoryFixture,
    getQuote,
    swapTokensForPersona,
    DEFAULT_GRADUATION_THRESHOLD,
    PERSONA_TOKEN_SUPPLY,
    AMICA_DEPOSIT_AMOUNT,
    LIQUIDITY_TOKEN_AMOUNT,
    BONDING_CURVE_AMOUNT,
} from "./shared/fixtures";

describe("Swap Tests", function () {
    // Helper to deploy viewer contract
    async function deployViewer(factoryAddress: string): Promise<PersonaFactoryViewer> {
        const PersonaFactoryViewer = await ethers.getContractFactory("PersonaFactoryViewer");
        return await PersonaFactoryViewer.deploy(factoryAddress) as PersonaFactoryViewer;
    }

    describe("Buy Tests", function () {
        it("Should respect deadline parameter", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            const purchaseAmount = ethers.parseEther("1000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            // Set deadline in the past
            const pastDeadline = Math.floor(Date.now() / 1000) - 100;

            // Updated error expectation - using NotAllowed(5) for expired deadline
            await expect(
                personaFactory.connect(user2).swapExactTokensForTokens(
                    tokenId,
                    purchaseAmount,
                    0,
                    user2.address,
                    pastDeadline
                )
            ).to.be.revertedWithCustomError(personaFactory, "NotAllowed")
              .withArgs(5); // 5 = ExpiredDeadline
        });

        it("Should allow swapping to different recipient", async function () {
            const { tokenId, personaFactory, amicaToken, user2, user3 } = await loadFixture(createPersonaFixture);
            const viewer = await deployViewer(await personaFactory.getAddress());

            const purchaseAmount = ethers.parseEther("1000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            const expectedTokens = await getQuote(personaFactory, tokenId, purchaseAmount);

            // user2 pays but sends tokens to user3
            await swapTokensForPersona(
                personaFactory,
                tokenId,
                purchaseAmount,
                expectedTokens,
                user2,
                user3.address
            );

            // Check user3 has the purchase tracked in userPurchases
            expect(await personaFactory.userPurchases(tokenId, user3.address)).to.equal(expectedTokens);
            expect(await personaFactory.userPurchases(tokenId, user2.address)).to.equal(0);

            // Tokens should not be in wallets yet (held in contract)
            const personaInfo = await viewer.getPersona(tokenId);
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const personaToken = TestERC20.attach(personaInfo.erc20Token) as TestERC20;

            expect(await personaToken.balanceOf(user3.address)).to.equal(0);
            expect(await personaToken.balanceOf(user2.address)).to.equal(0);
        });

        it("Should reject swap to zero address", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            const purchaseAmount = ethers.parseEther("1000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            const deadline = getDeadline();

            // Updated error expectation - using Invalid(2) for invalid recipient
            await expect(
                personaFactory.connect(user2).swapExactTokensForTokens(
                    tokenId,
                    purchaseAmount,
                    0,
                    ethers.ZeroAddress,
                    deadline
                )
            ).to.be.revertedWithCustomError(personaFactory, "Invalid")
              .withArgs(2); // 2 = Recipient
        });

        it("Should handle very small swaps correctly", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Test with small but meaningful amount
            const smallAmount = ethers.parseEther("10"); // 10 tokens instead of 1 wei
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                smallAmount
            );

            // Should get a quote greater than 0
            const quote = await getQuote(personaFactory, tokenId, smallAmount);
            expect(quote).to.be.gt(0);

            // Should be able to swap
            await expect(
                swapTokensForPersona(personaFactory, tokenId, smallAmount, 0n, user2)
            ).to.not.be.reverted;
        });

        it("Should properly update state after multiple swaps", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);
            const viewer = await deployViewer(await personaFactory.getAddress());

            const swapAmounts = [
                ethers.parseEther("100"),
                ethers.parseEther("500"),
                ethers.parseEther("1000"),
                ethers.parseEther("5000")
            ];

            let totalIn = 0n;
            let totalOut = 0n;

            for (const amount of swapAmounts) {
                await amicaToken.connect(user2).approve(
                    await personaFactory.getAddress(),
                    amount
                );

                const quoteBefore = await getQuote(personaFactory, tokenId, amount);
                await swapTokensForPersona(personaFactory, tokenId, amount, quoteBefore, user2);

                totalIn += amount;
                totalOut += quoteBefore;

                // Verify the price increased (next quote should give fewer tokens)
                if (amount < swapAmounts[swapAmounts.length - 1]) {
                    const quoteAfter = await getQuote(personaFactory, tokenId, amount);
                    expect(quoteAfter).to.be.lt(quoteBefore);
                }
            }

            // Verify total tokens received using viewer and userPurchases
            const personaInfo = await viewer.getPersona(tokenId);
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const personaToken = TestERC20.attach(personaInfo.erc20Token) as TestERC20;

            // Tokens should be tracked in userPurchases, not in wallet
            expect(await personaFactory.userPurchases(tokenId, user2.address)).to.equal(totalOut);
            expect(await personaToken.balanceOf(user2.address)).to.equal(0);
        });

        it("Should apply trading fees on purchases", async function () {
            const { tokenId, personaFactory, amicaToken, user1, user2 } = await loadFixture(createPersonaFixture);

            const purchaseAmount = ethers.parseEther("10000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            const creatorBalanceBefore = await amicaToken.balanceOf(user1.address);

            // Get quote (which should account for fees)
            const expectedTokens = await personaFactory.getAmountOut(tokenId, purchaseAmount);

            await expect(
                swapTokensForPersona(personaFactory, tokenId, purchaseAmount, expectedTokens, user2)
            ).to.emit(personaFactory, "TradingFeesCollected");

            // Check fee distribution (1% fee, 50/50 split by default)
            const feeAmount = purchaseAmount * 100n / 10000n; // 1%
            const creatorFee = feeAmount * 5000n / 10000n; // 50%

            expect(await amicaToken.balanceOf(user1.address)).to.equal(
                creatorBalanceBefore + creatorFee
            );
        });

        it("Should reject purchase exceeding available tokens", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Try to buy more than available for sale
            const hugeAmount = ethers.parseEther("5000000"); // 5M AMICA should be enough

            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                hugeAmount
            );

            const deadline = Math.floor(Date.now() / 1000) + 3600;

            // Updated error expectation - using Insufficient(2) for insufficient liquidity
            await expect(
                personaFactory.connect(user2).swapExactTokensForTokens(tokenId, hugeAmount, 0, user2.address, deadline)
            ).to.be.revertedWithCustomError(personaFactory, "Insufficient")
              .withArgs(2); // 2 = Liquidity
        });

        it("Should reject purchase after pair creation", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            const deadline = Math.floor(Date.now() / 1000) + 3600;

            // Purchase enough to trigger graduation (accounting for fees)
            const purchaseAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n; // Add buffer for fees
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            // This should trigger pair creation
            await personaFactory.connect(user2).swapExactTokensForTokens(tokenId, purchaseAmount, 0, user2.address, deadline);

            // Try to purchase more
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                ethers.parseEther("1000")
            );

            // Updated error expectation - using NotAllowed(4) for trading on Uniswap
            await expect(
                personaFactory.connect(user2).swapExactTokensForTokens(
                    tokenId,
                    ethers.parseEther("1000"),
                    0,
                    user2.address,
                    deadline
                )
            ).to.be.revertedWithCustomError(personaFactory, "NotAllowed")
              .withArgs(4); // 4 = TradingOnUniswap
        });
    });

    describe("Sell Tests", function () {
        it("Should allow selling tokens back to bonding curve", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // First buy some tokens
            const purchaseAmount = ethers.parseEther("10000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            const tokensBought = await personaFactory.getAmountOut(tokenId, purchaseAmount);
            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                purchaseAmount,
                0,
                user2.address,
                getDeadline()
            );

            // Now sell half back (tokens are held in contract, tracked via userPurchases)
            const sellAmount = tokensBought / 2n;
            
            const expectedOutput = await personaFactory.getAmountOutForSell(tokenId, sellAmount);
            const amicaBalanceBefore = await amicaToken.balanceOf(user2.address);

            const tx = await personaFactory.connect(user2).swapExactTokensForPairingTokens(
                tokenId,
                sellAmount,
                0,
                user2.address,
                getDeadline()
            );

            // Get the actual amount received from the transaction
            const amicaBalanceAfter = await amicaToken.balanceOf(user2.address);
            const amountReceived = amicaBalanceAfter - amicaBalanceBefore;

            // Check the event was emitted with correct arguments
            await expect(tx).to.emit(personaFactory, "TokensSold")
                .withArgs(tokenId, user2.address, sellAmount, amountReceived);

            // Verify user received pairing tokens back (minus fees)
            const feeAmount = (expectedOutput * 100n) / 10000n; // 1% fee
            expect(amountReceived).to.be.closeTo(expectedOutput - feeAmount, ethers.parseEther("0.1"));
            
            // Verify userPurchases was updated
            const remainingBalance = await personaFactory.userPurchases(tokenId, user2.address);
            expect(remainingBalance).to.equal(tokensBought - sellAmount);
        });

        it("Should apply fees on sell transactions", async function () {
            const { tokenId, personaFactory, amicaToken, user1, user2 } = await loadFixture(createPersonaFixture);

            // First buy tokens
            const purchaseAmount = ethers.parseEther("10000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            const tokensBought = await personaFactory.getAmountOut(tokenId, purchaseAmount);
            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                purchaseAmount,
                0,
                user2.address,
                getDeadline()
            );

            // Sell tokens
            const creatorBalanceBefore = await amicaToken.balanceOf(user1.address);

            await expect(
                personaFactory.connect(user2).swapExactTokensForPairingTokens(
                    tokenId,
                    tokensBought,
                    0,
                    user2.address,
                    getDeadline()
                )
            ).to.emit(personaFactory, "TradingFeesCollected");

            // Check creator received their fee share
            const creatorBalanceAfter = await amicaToken.balanceOf(user1.address);
            expect(creatorBalanceAfter).to.be.gt(creatorBalanceBefore);
        });

        it("Should reject selling more tokens than user owns", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Buy some tokens first
            const purchaseAmount = ethers.parseEther("1000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            const tokensBought = await personaFactory.getAmountOut(tokenId, purchaseAmount);
            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                purchaseAmount,
                0,
                user2.address,
                getDeadline()
            );

            // Try to sell more than owned
            const oversellAmount = tokensBought * 2n;

            await expect(
                personaFactory.connect(user2).swapExactTokensForPairingTokens(
                    tokenId,
                    oversellAmount,
                    0,
                    user2.address,
                    getDeadline()
                )
            ).to.be.revertedWithCustomError(personaFactory, "Insufficient")
              .withArgs(4); // 4 = Balance
        });

        it("Should reject selling with expired deadline", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Buy tokens first
            const purchaseAmount = ethers.parseEther("1000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            const tokensBought = await personaFactory.getAmountOut(tokenId, purchaseAmount);
            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                purchaseAmount,
                0,
                user2.address,
                getDeadline()
            );

            const pastDeadline = Math.floor(Date.now() / 1000) - 100;

            await expect(
                personaFactory.connect(user2).swapExactTokensForPairingTokens(
                    tokenId,
                    tokensBought,
                    0,
                    user2.address,
                    pastDeadline
                )
            ).to.be.revertedWithCustomError(personaFactory, "NotAllowed")
              .withArgs(5); // 5 = ExpiredDeadline
        });

        it("Should reject selling to zero address", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Buy tokens first
            const purchaseAmount = ethers.parseEther("1000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            const tokensBought = await personaFactory.getAmountOut(tokenId, purchaseAmount);
            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                purchaseAmount,
                0,
                user2.address,
                getDeadline()
            );

            await expect(
                personaFactory.connect(user2).swapExactTokensForPairingTokens(
                    tokenId,
                    tokensBought,
                    0,
                    ethers.ZeroAddress,
                    getDeadline()
                )
            ).to.be.revertedWithCustomError(personaFactory, "Invalid")
              .withArgs(2); // 2 = Recipient
        });

        it("Should reject selling zero tokens", async function () {
            const { tokenId, personaFactory, user2 } = await loadFixture(createPersonaFixture);

            await expect(
                personaFactory.connect(user2).swapExactTokensForPairingTokens(
                    tokenId,
                    0,
                    0,
                    user2.address,
                    getDeadline()
                )
            ).to.be.revertedWithCustomError(personaFactory, "Invalid")
              .withArgs(1); // 1 = Amount
        });

        it("Should reject selling after graduation", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Purchase enough to trigger graduation
            const purchaseAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                purchaseAmount,
                0,
                user2.address,
                getDeadline()
            );

            // Try to sell after graduation
            await expect(
                personaFactory.connect(user2).swapExactTokensForPairingTokens(
                    tokenId,
                    ethers.parseEther("100"),
                    0,
                    user2.address,
                    getDeadline()
                )
            ).to.be.revertedWithCustomError(personaFactory, "NotAllowed")
              .withArgs(4); // 4 = TradingOnUniswap
        });

        it("Should handle slippage protection on sells", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Buy tokens first
            const purchaseAmount = ethers.parseEther("10000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            const tokensBought = await personaFactory.getAmountOut(tokenId, purchaseAmount);
            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                purchaseAmount,
                0,
                user2.address,
                getDeadline()
            );

            // Get expected output
            const expectedOutput = await personaFactory.getAmountOutForSell(tokenId, tokensBought);
            const feeAmount = (expectedOutput * 100n) / 10000n;
            const expectedAfterFee = expectedOutput - feeAmount;

            // Require more than expected (should fail)
            await expect(
                personaFactory.connect(user2).swapExactTokensForPairingTokens(
                    tokenId,
                    tokensBought,
                    expectedAfterFee + ethers.parseEther("1"),
                    user2.address,
                    getDeadline()
                )
            ).to.be.revertedWithCustomError(personaFactory, "Insufficient")
              .withArgs(1); // 1 = Output
        });

        it("Should maintain bonding curve consistency on buy/sell", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Buy tokens
            const buyAmount = ethers.parseEther("10000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                buyAmount
            );

            const tokensBought = await personaFactory.getAmountOut(tokenId, buyAmount);
            const initialAmicaBalance = await amicaToken.balanceOf(user2.address);

            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                buyAmount,
                0,
                user2.address,
                getDeadline()
            );

            // Sell all tokens back
            await personaFactory.connect(user2).swapExactTokensForPairingTokens(
                tokenId,
                tokensBought,
                0,
                user2.address,
                getDeadline()
            );

            const finalAmicaBalance = await amicaToken.balanceOf(user2.address);

            // User should have less AMICA than started due to fees on both buy and sell
            expect(finalAmicaBalance).to.be.lt(initialAmicaBalance);

            // The loss should be approximately 2% (1% buy fee + 1% sell fee)
            const totalLoss = initialAmicaBalance - finalAmicaBalance;
            const expectedLoss = buyAmount * 200n / 10000n; // ~2%
            
            // Allow some variance due to bonding curve mechanics
            expect(totalLoss).to.be.closeTo(expectedLoss, ethers.parseEther("10"));
        });

        it("Should update purchase state correctly on sells", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Buy tokens
            const buyAmount = ethers.parseEther("10000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                buyAmount
            );

            const tokensBought = await personaFactory.getAmountOut(tokenId, buyAmount);
            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                buyAmount,
                0,
                user2.address,
                getDeadline()
            );

            // Get initial purchase state
            const purchaseBefore = await personaFactory.purchases(tokenId);

            // Sell half
            const sellAmount = tokensBought / 2n;
            const expectedOutput = await personaFactory.getAmountOutForSell(tokenId, sellAmount);

            await personaFactory.connect(user2).swapExactTokensForPairingTokens(
                tokenId,
                sellAmount,
                0,
                user2.address,
                getDeadline()
            );

            // Check purchase state updated
            const purchaseAfter = await personaFactory.purchases(tokenId);
            
            // Tokens sold should decrease
            expect(purchaseAfter.tokensSold).to.equal(purchaseBefore.tokensSold - sellAmount);
            
            // Total deposited should decrease by output amount
            expect(purchaseAfter.totalDeposited).to.be.closeTo(
                purchaseBefore.totalDeposited - expectedOutput,
                ethers.parseEther("0.1")
            );
        });

        it("Should allow selling to different recipient", async function () {
            const { tokenId, personaFactory, amicaToken, user2, user3 } = await loadFixture(createPersonaFixture);

            // Buy tokens
            const buyAmount = ethers.parseEther("5000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                buyAmount
            );

            const tokensBought = await personaFactory.getAmountOut(tokenId, buyAmount);
            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                buyAmount,
                0,
                user2.address,
                getDeadline()
            );

            // user2 sells but sends AMICA to user3
            const user3BalanceBefore = await amicaToken.balanceOf(user3.address);

            await personaFactory.connect(user2).swapExactTokensForPairingTokens(
                tokenId,
                tokensBought,
                0,
                user3.address,
                getDeadline()
            );

            // Check user3 received the AMICA
            const user3BalanceAfter = await amicaToken.balanceOf(user3.address);
            expect(user3BalanceAfter).to.be.gt(user3BalanceBefore);
        });
    });

    describe("Viewer Functions", function () {
        it("Should correctly preview buy with fees", async function () {
            const { tokenId, personaFactory, user2 } = await loadFixture(createPersonaFixture);
            const viewer = await deployViewer(await personaFactory.getAddress());

            const amountIn = ethers.parseEther("10000");
            
            const preview = await viewer.previewBuyWithFee(tokenId, amountIn, user2.address);
            
            // Verify fee calculation
            expect(preview.feeAmount).to.equal(amountIn * 100n / 10000n); // 1% fee
            expect(preview.amountInAfterFee).to.equal(amountIn - preview.feeAmount);
            expect(preview.expectedOutput).to.be.gt(0);
        });

        it("Should correctly preview sell with fees", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);
            const viewer = await deployViewer(await personaFactory.getAddress());

            // First buy some tokens
            const buyAmount = ethers.parseEther("10000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                buyAmount
            );

            const tokensBought = await personaFactory.getAmountOut(tokenId, buyAmount);
            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                buyAmount,
                0,
                user2.address,
                getDeadline()
            );

            // Preview selling half
            const sellAmount = tokensBought / 2n;
            const preview = await viewer.previewSellWithFee(tokenId, sellAmount, user2.address);
            
            expect(preview.expectedOutput).to.be.gt(0);
            expect(preview.feeAmount).to.equal(preview.expectedOutput * 100n / 10000n); // 1% fee
            expect(preview.amountOutAfterFee).to.equal(preview.expectedOutput - preview.feeAmount);
        });

        it("Should calculate price impact for buys", async function () {
            const { tokenId, personaFactory } = await loadFixture(createPersonaFixture);
            const viewer = await deployViewer(await personaFactory.getAddress());

            // Small trade should have small impact
            const smallTrade = ethers.parseEther("100");
            const smallImpact = await viewer.calculateBuyPriceImpact(tokenId, smallTrade);
            expect(smallImpact).to.be.lt(100); // Less than 1% (100 basis points)

            // Large trade should have larger impact
            const largeTrade = ethers.parseEther("100000");
            const largeImpact = await viewer.calculateBuyPriceImpact(tokenId, largeTrade);
            expect(largeImpact).to.be.gt(smallImpact);
        });

        it("Should calculate price impact for sells", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);
            const viewer = await deployViewer(await personaFactory.getAddress());

            // First buy some tokens
            const buyAmount = ethers.parseEther("50000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                buyAmount
            );

            const tokensBought = await personaFactory.getAmountOut(tokenId, buyAmount);
            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                buyAmount,
                0,
                user2.address,
                getDeadline()
            );

            // Calculate sell impact
            const sellAmount = tokensBought / 10n; // Sell 10%
            const sellImpact = await viewer.calculateSellPriceImpact(tokenId, sellAmount);
            
            expect(sellImpact).to.be.gt(0); // Should show negative impact (price decrease)
        });
    });

    describe("Legacy Functions", function () {
        it("Should handle withdrawTokens for backwards compatibility", async function () {
            const { tokenId, personaFactory, amicaToken, user2, owner } = await loadFixture(createPersonaFixture);
            const viewer = await deployViewer(await personaFactory.getAddress());

            // Buy tokens first
            const buyAmount = ethers.parseEther("1000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                buyAmount
            );

            const expectedTokens = await personaFactory.getAmountOut(tokenId, buyAmount);

            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                buyAmount,
                0,
                user2.address,
                getDeadline()
            );

            // Get persona token
            const personaInfo = await viewer.getPersona(tokenId);
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const personaToken = TestERC20.attach(personaInfo.erc20Token) as TestERC20;

            // Check tokens are NOT in user's wallet yet
            const balanceBefore = await personaToken.balanceOf(user2.address);
            expect(balanceBefore).to.equal(0);

            // Check tokens are tracked in userPurchases
            const tracked = await personaFactory.userPurchases(tokenId, user2.address);
            expect(tracked).to.equal(expectedTokens);

            // Try to withdraw before graduation - should fail
            await expect(
                personaFactory.connect(user2).withdrawTokens(tokenId)
            ).to.be.revertedWithCustomError(personaFactory, "NotAllowed")
              .withArgs(3); // 3 = NotGraduated

            // Force graduation by purchasing enough to reach threshold
            const purchaseAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;

            // Transfer tokens to owner if needed
            const ownerBalance = await amicaToken.balanceOf(owner.address);
            if (ownerBalance < purchaseAmount) {
                // Transfer from user2 who has 10M AMICA from fixture
                await amicaToken.connect(user2).transfer(owner.address, purchaseAmount);
            }

            await amicaToken.connect(owner).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );


            await personaFactory.connect(owner).swapExactTokensForTokens(
                tokenId,
                purchaseAmount,
                0,
                owner.address,
                getDeadline()
            );

            // Now withdraw after graduation
            await personaFactory.connect(user2).withdrawTokens(tokenId);

            // Should have cleared tracking
            const trackedAfter = await personaFactory.userPurchases(tokenId, user2.address);
            expect(trackedAfter).to.equal(0);

            // Should have tokens in wallet
            const balanceAfter = await personaToken.balanceOf(user2.address);
            expect(balanceAfter).to.equal(expectedTokens);
        });
    });

    describe("Withdrawal After Graduation", function () {
        it("Should allow users to withdraw tokens after graduation", async function () {
            const { tokenId, personaFactory, amicaToken, user2, user3, owner } = await loadFixture(createPersonaFixture);
            const viewer = await deployViewer(await personaFactory.getAddress());

            // Multiple users buy tokens
            const user2Amount = ethers.parseEther("5000");
            const user3Amount = ethers.parseEther("8000");

            await amicaToken.connect(user2).approve(await personaFactory.getAddress(), user2Amount);
            await amicaToken.connect(user3).approve(await personaFactory.getAddress(), user3Amount);

            // Execute purchases
            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId, user2Amount, 0, user2.address, getDeadline()
            );
            await personaFactory.connect(user3).swapExactTokensForTokens(
                tokenId, user3Amount, 0, user3.address, getDeadline()
            );

            // Get actual token amounts from userPurchases
            const user2Tokens = await personaFactory.userPurchases(tokenId, user2.address);
            const user3Tokens = await personaFactory.userPurchases(tokenId, user3.address);

            // Verify tokens are tracked but not distributed
            expect(user2Tokens).to.be.gt(0);
            expect(user3Tokens).to.be.gt(0);

            const personaInfo = await viewer.getPersona(tokenId);
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const personaToken = TestERC20.attach(personaInfo.erc20Token) as TestERC20;

            expect(await personaToken.balanceOf(user2.address)).to.equal(0);
            expect(await personaToken.balanceOf(user3.address)).to.equal(0);

            // Force graduation
            const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;
            const ownerBalance = await amicaToken.balanceOf(owner.address);
            if (ownerBalance < graduationAmount) {
                // FIX: Transfer from user2 or user3 who have tokens from the fixture
                // User2 and user3 each have 10M AMICA from the fixture
                await amicaToken.connect(user2).transfer(owner.address, graduationAmount);
            }

            await amicaToken.connect(owner).approve(await personaFactory.getAddress(), graduationAmount);
            await personaFactory.connect(owner).swapExactTokensForTokens(
                tokenId, graduationAmount, 0, owner.address, getDeadline()
            );

            // Now users can withdraw
            await personaFactory.connect(user2).withdrawTokens(tokenId);
            await personaFactory.connect(user3).withdrawTokens(tokenId);

            // Verify tokens are now in wallets
            expect(await personaToken.balanceOf(user2.address)).to.equal(user2Tokens);
            expect(await personaToken.balanceOf(user3.address)).to.equal(user3Tokens);

            // Verify tracking is cleared
            expect(await personaFactory.userPurchases(tokenId, user2.address)).to.equal(0);
            expect(await personaFactory.userPurchases(tokenId, user3.address)).to.equal(0);
        });
    });

    // Keep existing tests below...
    it("Should apply fee correctly", async function () {
        const { tokenId, personaFactory } = await loadFixture(createPersonaFixture);

        const amountIn = ethers.parseEther("10000");
        const total = BONDING_CURVE_AMOUNT;

        // Get output from the public getAmountOut function
        const output = await personaFactory.getAmountOut(tokenId, amountIn);

        // The getAmountOut function already applies the fee internally
        // Let's verify the calculation matches what we expect
        
        // With 1% fee, amount after fee = 99% of input
        const feeAmount = (amountIn * 100n) / 10000n;
        const amountInAfterFee = amountIn - feeAmount;

        // Bonding curve calculation
        const virtualAmicaReserve = ethers.parseEther("100000");
        const virtualTokenReserve = total / 10n;

        const currentTokenReserve = virtualTokenReserve + total;
        const currentAmicaReserve = virtualAmicaReserve;

        const k = currentTokenReserve * currentAmicaReserve;
        const newAmicaReserve = currentAmicaReserve + amountInAfterFee;
        const newTokenReserve = k / newAmicaReserve;
        let expectedOutput = currentTokenReserve - newTokenReserve;

        // Apply 1% slippage protection
        expectedOutput = expectedOutput * 99n / 100n;

        // The output should be close to our calculation
        expect(output).to.be.closeTo(expectedOutput, ethers.parseEther("0.1"));
    });

    it("Should maintain constant product invariant", async function () {
        const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

        // First, let's understand the bonding curve parameters
        const virtualAmicaReserve = ethers.parseEther("100000");
        const virtualTokenReserve = BONDING_CURVE_AMOUNT / 10n;

        // Initial state
        const currentTokenReserve = virtualTokenReserve + BONDING_CURVE_AMOUNT;
        const currentAmicaReserve = virtualAmicaReserve;
        const k = currentTokenReserve * currentAmicaReserve;

        // Test a swap
        const amountIn = ethers.parseEther("10000");
        
        // Approve and execute swap
        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            amountIn
        );

        const outputQuote = await personaFactory.getAmountOut(tokenId, amountIn);
        
        await personaFactory.connect(user2).swapExactTokensForTokens(
            tokenId,
            amountIn,
            0,
            user2.address,
            getDeadline()
        );

        // After the swap, the invariant should still hold (approximately)
        // The new reserves would be:
        // - Token reserve decreased by outputQuote
        // - AMICA reserve increased by amountIn (minus fees)
        
        const feeAmount = (amountIn * 100n) / 10000n;
        const amountInAfterFee = amountIn - feeAmount;
        
        const newTokenReserve = currentTokenReserve - outputQuote;
        const newAmicaReserve = currentAmicaReserve + amountInAfterFee;
        
        // The product should be approximately the same (allowing for rounding)
        const newK = newTokenReserve * newAmicaReserve;
        
        // Allow for some rounding error (0.1%)
        const tolerance = k / 1000n;
        expect(newK).to.be.closeTo(k, tolerance);
    });

    it("Should return correct available tokens", async function () {
        const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

        const initialAvailable = await personaFactory.getAvailableTokens(tokenId);
        const expectedInitial = BONDING_CURVE_AMOUNT;
        expect(initialAvailable).to.equal(expectedInitial);

        // Purchase some tokens
        const purchaseAmount = ethers.parseEther("10000");
        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            purchaseAmount
        );

        const tokensBought = await personaFactory.getAmountOut(tokenId, purchaseAmount);
        const deadline = Math.floor(Date.now() / 1000) + 3600;

        await personaFactory.connect(user2).swapExactTokensForTokens(tokenId, purchaseAmount, 0, user2.address, deadline);

        const availableAfter = await personaFactory.getAvailableTokens(tokenId);
        expect(availableAfter).to.be.closeTo(
            expectedInitial - tokensBought,
            ethers.parseEther("1") // Allow small rounding difference
        );
    });
});
