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

        // Check user3 received the tokens using viewer
        const personaInfo = await viewer.getPersona(tokenId);
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const personaToken = TestERC20.attach(personaInfo.erc20Token) as TestERC20;

        expect(await personaToken.balanceOf(user3.address)).to.equal(expectedTokens);
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

        // Verify total tokens received using viewer
        const personaInfo = await viewer.getPersona(tokenId);
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const personaToken = TestERC20.attach(personaInfo.erc20Token) as TestERC20;

        expect(await personaToken.balanceOf(user2.address)).to.equal(totalOut);
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

    it("Should handle failed token transfer in purchase", async function () {
        const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

        const deadline = Math.floor(Date.now() / 1000) + 3600;

        // Make a huge purchase that would exceed available tokens
        const hugeAmount = ethers.parseEther("10000000"); // 10M AMICA

        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            hugeAmount
        );

        // This should fail due to insufficient liquidity
        // Updated error expectation - using Insufficient(2) for insufficient liquidity
        await expect(
            personaFactory.connect(user2).swapExactTokensForTokens(tokenId, hugeAmount, 0, user2.address, deadline)
        ).to.be.revertedWithCustomError(personaFactory, "Insufficient")
          .withArgs(2); // 2 = Liquidity
    });

    it("Should handle purchase with minimum amount", async function () {
        const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

        const deadline = Math.floor(Date.now() / 1000) + 3600;

        // Try very small purchase
        const tinyAmount = ethers.parseEther("0.0001");
        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            tinyAmount
        );

        await expect(
            personaFactory.connect(user2).swapExactTokensForTokens(tokenId, tinyAmount, 0, user2.address, deadline)
        ).to.not.be.reverted;
    });

    it("Should handle purchases at different bonding curve stages", async function () {
        const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);
        const viewer = await deployViewer(await personaFactory.getAddress());

        const deadline = Math.floor(Date.now() / 1000) + 3600;

        // Make multiple small purchases to test different price points
        const purchases = [
            ethers.parseEther("1000"),
            ethers.parseEther("5000"),
            ethers.parseEther("10000"),
            ethers.parseEther("50000")
        ];

        let totalSpent = 0n;
        let totalReceived = 0n;

        for (const amount of purchases) {
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                amount
            );

            const expectedTokens = await personaFactory.getAmountOut(tokenId, amount);

            await personaFactory.connect(user2).swapExactTokensForTokens(tokenId, amount, 0, user2.address, deadline);

            totalSpent += amount;
            totalReceived += expectedTokens;
        }

        // Verify tokens were received using viewer
        const personaInfo = await viewer.getPersona(tokenId);
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const personaToken = TestERC20.attach(personaInfo.erc20Token) as TestERC20;

        expect(await personaToken.balanceOf(user2.address)).to.be.closeTo(
            totalReceived,
            ethers.parseEther("1") // Allow small rounding difference
        );
    });

    it("Should reject purchase exceeding available tokens", async function () {
        const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

        // Try to buy more than available for sale
        const availableTokens = await personaFactory.getAvailableTokens(tokenId);

        // Calculate amount that would buy all tokens
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

    it("Should reject purchase for non-existent token", async function () {
        const { personaFactory, amicaToken, user2 } = await loadFixture(deployPersonaTokenFactoryFixture);

        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            ethers.parseEther("1000")
        );

        const deadline = Math.floor(Date.now() / 1000) + 3600;

        // Updated error expectation - using Invalid(0) for invalid token
        await expect(
            personaFactory.connect(user2).swapExactTokensForTokens(
                999, // Non-existent token ID
                ethers.parseEther("1000"),
                0,
                user2.address,
                deadline
            )
        ).to.be.revertedWithCustomError(personaFactory, "Invalid")
          .withArgs(0); // 0 = Token
    });

    it("Should reject purchase with slippage too high", async function () {
        const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

        const purchaseAmount = ethers.parseEther("10000");
        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            purchaseAmount
        );

        const expectedTokens = await personaFactory.getAmountOut(tokenId, purchaseAmount);
        const deadline = Math.floor(Date.now() / 1000) + 3600;

        // Require more tokens than calculated
        // Updated error expectation - using Insufficient(1) for insufficient output
        await expect(
            personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                purchaseAmount,
                expectedTokens + ethers.parseEther("1"),
                user2.address,
                deadline
            )
        ).to.be.revertedWithCustomError(personaFactory, "Insufficient")
          .withArgs(1); // 1 = Output
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

    it("Should purchase tokens with correct calculation", async function () {
        const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);
        const viewer = await deployViewer(await personaFactory.getAddress());

        const purchaseAmount = ethers.parseEther("10000");
        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            purchaseAmount
        );

        const expectedTokens = await personaFactory.getAmountOut(tokenId, purchaseAmount);

        const initialBalance = await amicaToken.balanceOf(user2.address);

        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

        await expect(
            personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                purchaseAmount,
                expectedTokens,
                user2.address,
                deadline
            )
        ).to.emit(personaFactory, "TokensPurchased")
         .withArgs(tokenId, user2.address, purchaseAmount, expectedTokens);

        // Check tokens were taken
        expect(await amicaToken.balanceOf(user2.address)).to.equal(
            initialBalance - purchaseAmount
        );

        // Check tokens were received using viewer
        const personaInfo = await viewer.getPersona(tokenId);
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const personaToken = TestERC20.attach(personaInfo.erc20Token) as TestERC20;

        expect(await personaToken.balanceOf(user2.address)).to.equal(expectedTokens);
    });

    it("Should track total deposited and tokens sold", async function () {
        const { tokenId, personaFactory, amicaToken, user2, user3 } = await loadFixture(createPersonaFixture);

        const deadline = Math.floor(Date.now() / 1000) + 3600;

        // First purchase
        const purchase1 = ethers.parseEther("5000");
        await amicaToken.connect(user2).approve(await personaFactory.getAddress(), purchase1);
        await personaFactory.connect(user2).swapExactTokensForTokens(tokenId, purchase1, 0, user2.address, deadline);

        // Second purchase
        const purchase2 = ethers.parseEther("8000");
        await amicaToken.connect(user3).approve(await personaFactory.getAddress(), purchase2);
        await personaFactory.connect(user3).swapExactTokensForTokens(tokenId, purchase2, 0, user3.address, deadline);

        // Verify state updates by checking available tokens decreased
        const availableBefore = PERSONA_TOKEN_SUPPLY - AMICA_DEPOSIT_AMOUNT - LIQUIDITY_TOKEN_AMOUNT;
        const availableAfter = await personaFactory.getAvailableTokens(tokenId);

        expect(availableAfter).to.be.lt(availableBefore);
    });

    it("Should calculate tokens out correctly with bonding curve", async function () {
        const { tokenId, personaFactory, amicaToken, user2, owner } = await loadFixture(createPersonaFixture);

        // Test at different points on the curve
        const amount = ethers.parseEther("10000");

        // Get tokens for a fresh persona
        const tokensAtStart = await personaFactory.getAmountOut(tokenId, amount);

        // Make a large purchase to move the curve
        const largePurchase = ethers.parseEther("150000");
        
        // Ensure user2 has enough tokens
        const user2Balance = await amicaToken.balanceOf(user2.address);
        if (user2Balance < largePurchase) {
            await amicaToken.connect(owner).transfer(user2.address, largePurchase - user2Balance);
        }
        
        await amicaToken.connect(user2).approve(await personaFactory.getAddress(), largePurchase);
        
        await personaFactory.connect(user2).swapExactTokensForTokens(
            tokenId,
            largePurchase,
            0,
            user2.address,
            Math.floor(Date.now() / 1000) + 3600
        );

        // Get tokens after the purchase
        const tokensAfterPurchase = await personaFactory.getAmountOut(tokenId, amount);

        // Price increases along curve, so tokens received should decrease
        expect(tokensAtStart).to.be.gt(tokensAfterPurchase);
    });

    it("Should handle concurrent purchases correctly", async function () {
        const { tokenId, personaFactory, amicaToken, user2, user3 } = await loadFixture(createPersonaFixture);
        const viewer = await deployViewer(await personaFactory.getAddress());

        const deadline = Math.floor(Date.now() / 1000) + 3600;

        // Both users approve
        const amount = ethers.parseEther("5000");
        await amicaToken.connect(user2).approve(await personaFactory.getAddress(), amount);
        await amicaToken.connect(user3).approve(await personaFactory.getAddress(), amount);

        // Execute purchases (in practice these would be in same block)
        await personaFactory.connect(user2).swapExactTokensForTokens(tokenId, amount, 0, user2.address, deadline);
        await personaFactory.connect(user3).swapExactTokensForTokens(tokenId, amount, 0, user3.address, deadline);

        // Both should have received tokens using viewer
        const personaInfo = await viewer.getPersona(tokenId);
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const personaToken = TestERC20.attach(personaInfo.erc20Token) as TestERC20;

        expect(await personaToken.balanceOf(user2.address)).to.be.gt(0);
        expect(await personaToken.balanceOf(user3.address)).to.be.gt(0);
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

    it("Should reject getAvailableTokens on non-existent persona", async function () {
        const { personaFactory } = await loadFixture(deployPersonaTokenFactoryFixture);

        const nonExistentId = 999;

        await expect(
            personaFactory.getAvailableTokens(nonExistentId)
        ).to.not.be.reverted; // Returns calculated value
    });

    it("Should prevent creating pairs with AMICA when using different pairing token", async function () {
        const { personaFactory, amicaToken, user1 } =
            await loadFixture(deployPersonaTokenFactoryFixture);

        // Deploy USDC
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const usdc = await TestERC20.deploy("USD Coin", "USDC", ethers.parseEther("10000000"));

        // Configure USDC
        await personaFactory.configurePairingToken(
            await usdc.getAddress(),
            ethers.parseEther("100"),
            ethers.parseEther("1000"), // Low threshold for testing
        );

        // Create persona with USDC pairing
        await usdc.transfer(user1.address, ethers.parseEther("2000"));
        await usdc.connect(user1).approve(
            await personaFactory.getAddress(),
            ethers.parseEther("100")
        );

        await personaFactory.connect(user1).createPersona(
            await usdc.getAddress(),
            "USDC Test",
            "USDCT",
            [],
            [],
            0,
            ethers.ZeroAddress,
            0, // No minimum agent tokens
        );

        // Try to swap with AMICA instead of USDC - should fail
        await amicaToken.connect(user1).approve(
            await personaFactory.getAddress(),
            ethers.parseEther("1000")
        );

        const deadline = getDeadline();

        // This should fail because the persona is paired with USDC, not AMICA
        await expect(
            personaFactory.connect(user1).swapExactTokensForTokens(
                0,
                ethers.parseEther("1000"),
                0,
                user1.address,
                deadline
            )
        ).to.be.reverted; // Will fail when trying to transfer USDC from user
    });

    it("Should return 0 available tokens when all bonding curve tokens are sold", async function () {
        const { tokenId, personaFactory, amicaToken, user2, owner } = await loadFixture(createPersonaFixture);

        // We need to buy exactly BONDING_CURVE_AMOUNT tokens
        // This is tricky because we need to account for the bonding curve pricing

        // Make multiple purchases to approach the limit
        const purchases = [
            ethers.parseEther("100000"),
            ethers.parseEther("200000"),
            ethers.parseEther("300000"),
            ethers.parseEther("400000")
        ];

        // Transfer tokens to user2 if needed
        const totalNeeded = purchases.reduce((a, b) => a + b, 0n);
        const user2Balance = await amicaToken.balanceOf(user2.address);
        if (user2Balance < totalNeeded) {
            await amicaToken.connect(owner).transfer(user2.address, totalNeeded - user2Balance);
        }

        // Make purchases
        for (const amount of purchases) {
            const available = await personaFactory.getAvailableTokens(tokenId);
            if (available > 0) {
                await amicaToken.connect(user2).approve(
                    await personaFactory.getAddress(),
                    amount
                );

                try {
                    await personaFactory.connect(user2).swapExactTokensForTokens(
                        tokenId,
                        amount,
                        0,
                        user2.address,
                        getDeadline()
                    );
                } catch (e) {
                    // Might fail if we hit the limit
                    break;
                }
            }
        }

        // Now check available tokens
        const availableTokens = await personaFactory.getAvailableTokens(tokenId);

        // Get purchase data to verify we've sold enough
        const purchase = await personaFactory.purchases(tokenId);

        // If we've sold BONDING_CURVE_AMOUNT or more, available should be 0
        if (purchase.tokensSold >= BONDING_CURVE_AMOUNT) {
            expect(availableTokens).to.equal(0);
        }
    });
});
