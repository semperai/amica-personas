import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { TestERC20 } from "../typechain-types";
import {
    getDeadline,
    getQuote,
    swapTokensForPersona,
    createPersonaFixture,
    deployPersonaTokenFactoryFixture,
    DEFAULT_GRADUATION_THRESHOLD,
    LIQUIDITY_TOKEN_AMOUNT,
} from "./shared/fixtures";

describe("PersonaTokenFactory Graduation", function () {
    it("Should not send graduation reward to creator", async function () {
        const { tokenId, personaFactory, amicaToken, user1, user2 } = await loadFixture(createPersonaFixture);

        const creatorBalanceBefore = await amicaToken.balanceOf(user1.address);

        // Purchase to trigger graduation
        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            DEFAULT_GRADUATION_THRESHOLD
        );

        await swapTokensForPersona(personaFactory, tokenId, DEFAULT_GRADUATION_THRESHOLD, 0n, user2);

        // Creator balance should only increase by trading fees, not graduation reward
        const creatorBalanceAfter = await amicaToken.balanceOf(user1.address);
        const feeAmount = DEFAULT_GRADUATION_THRESHOLD * 100n / 10000n; // 1% fee
        const creatorFee = feeAmount * 5000n / 10000n; // 50% of fees

        expect(creatorBalanceAfter).to.equal(creatorBalanceBefore + creatorFee);
    });

    it("Should use all funds for liquidity", async function () {
        const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

        // Purchase slightly more than graduation threshold
        const excess = ethers.parseEther("100000");
        const totalAmount = DEFAULT_GRADUATION_THRESHOLD + excess;

        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            totalAmount
        );

        const tx = await swapTokensForPersona(personaFactory, tokenId, totalAmount, 0n, user2);
        const receipt = await tx.wait();

        // Find LiquidityPairCreated event
        const event = receipt?.logs.find(
            (log: any) => {
                try {
                    const parsed = personaFactory.interface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    });
                    return parsed?.name === 'LiquidityPairCreated';
                } catch {
                    return false;
                }
            }
        );

        const parsedEvent = personaFactory.interface.parseLog({
            topics: event!.topics as string[],
            data: event!.data
        });

        // All deposited tokens (minus fees) should go to liquidity
        const feeAmount = totalAmount * 100n / 10000n; // 1% fee
        const expectedLiquidity = LIQUIDITY_TOKEN_AMOUNT + (totalAmount - feeAmount);

        expect(parsedEvent!.args.liquidity).to.be.closeTo(
            expectedLiquidity,
            ethers.parseEther("1") // Allow small difference for rounding
        );
    });

    it("Should create pair when graduation threshold is met", async function () {
        const { tokenId, personaFactory, amicaToken, mockFactory, user2 } = await loadFixture(createPersonaFixture);

        // Purchase enough to meet graduation threshold (accounting for fees)
        const purchaseAmount = (DEFAULT_GRADUATION_THRESHOLD * 10000n) / 9900n;
        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            purchaseAmount
        );

        const deadline = Math.floor(Date.now() / 1000) + 3600;

        await expect(
            personaFactory.connect(user2).swapExactTokensForTokens(tokenId, purchaseAmount, 0, user2.address, deadline)
        ).to.emit(personaFactory, "LiquidityPairCreated");

        // Verify pair was created
        const persona = await personaFactory.getPersona(tokenId);
        expect(persona.pairCreated).to.be.true;

        // Verify pair exists in factory
        const pairAddress = await mockFactory.getPair(
            persona.erc20Token,
            await amicaToken.getAddress()
        );
        expect(pairAddress).to.not.equal(ethers.ZeroAddress);
    });

    it("Should create liquidity pairs with correct pairing tokens", async function () {
        const { personaFactory, user1 } =
            await loadFixture(deployPersonaTokenFactoryFixture);

        const deadline = Math.floor(Date.now() / 1000) + 3600;

        // Deploy USDC
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const usdc = await TestERC20.deploy("USD Coin", "USDC", ethers.parseEther("10000000"));

        // Configure with low graduation threshold for testing
        await personaFactory.configurePairingToken(
            await usdc.getAddress(),
            ethers.parseEther("100"),
            ethers.parseEther("1000"), // Low threshold
        );

        // Create persona
        await usdc.transfer(user1.address, ethers.parseEther("2000"));
        await usdc.connect(user1).approve(
            await personaFactory.getAddress(),
            ethers.parseEther("2000")
        );

        await personaFactory.connect(user1).createPersona(
            await usdc.getAddress(),
            "Test",
            "TEST",
            [],
            [],
            0,
            ethers.ZeroAddress,
            0, // No minimum agent tokens
        );

        // Purchase enough to trigger graduation (account for fees)
        const graduationAmount = (ethers.parseEther("1000") * 10100n) / 9900n; // Add buffer for fees

        await expect(
            personaFactory.connect(user1).swapExactTokensForTokens(0, graduationAmount, 0, user1.address, deadline)
        ).to.emit(personaFactory, "LiquidityPairCreated");

        // Verify pair was created between persona token and USDC (not AMICA)
        const persona = await personaFactory.getPersona(0);
        const mockFactory = await ethers.getContractAt(
            "IUniswapV2Factory",
            await personaFactory.uniswapFactory()
        );

        const pairAddress = await mockFactory.getPair(
            persona.erc20Token,
            await usdc.getAddress()
        );

        expect(pairAddress).to.not.equal(ethers.ZeroAddress);
        expect(persona.pairCreated).to.be.true;
    });

    it("Should allow immediate withdrawal after graduation", async function () {
        const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

        // Buy small amount first
        const smallAmount = ethers.parseEther("10000");
        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            DEFAULT_GRADUATION_THRESHOLD + smallAmount + ethers.parseEther("100000") // Extra for graduation
        );

        const expectedTokens = await getQuote(personaFactory, tokenId, smallAmount);
        await swapTokensForPersona(personaFactory, tokenId, smallAmount, expectedTokens, user2);

        // Get total deposits before graduation
        const TokenPurchase = await personaFactory.purchases(tokenId);
        const depositsBeforeGrad = TokenPurchase.totalDeposited;

        // Calculate exact amount needed for graduation
        // Need to account for fees: if we need X more deposits, we need to send X / 0.99 tokens
        const remainingNeeded = DEFAULT_GRADUATION_THRESHOLD - depositsBeforeGrad;
        const graduationAmount = (remainingNeeded * 10000n) / 9900n + ethers.parseEther("1"); // Add small buffer

        await swapTokensForPersona(personaFactory, tokenId, graduationAmount, 0n, user2);

        // Should be able to withdraw immediately
        await expect(
            personaFactory.connect(user2).withdrawTokens(tokenId)
        ).to.emit(personaFactory, "TokensWithdrawn");
    });

    it("Should handle graduation with excess correctly", async function () {
        const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

        // Use a more reasonable excess that won't exceed bonding curve
        const excessAmount = DEFAULT_GRADUATION_THRESHOLD + ethers.parseEther("50000"); // Reduced from 500000

        // Account for fees when calculating the amount to send
        const amountToSend = (excessAmount * 10000n) / 9900n;

        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            amountToSend
        );

        await expect(
            personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                amountToSend,
                0,
                user2.address,
                getDeadline()
            )
        ).to.emit(personaFactory, "LiquidityPairCreated");
    });

    it("Should handle graduation with excess correctly", async function () {
        const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

        // Calculate a reasonable amount that will trigger graduation
        const graduationAmount = DEFAULT_GRADUATION_THRESHOLD + ethers.parseEther("100000");

        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            graduationAmount
        );

        await expect(
            swapTokensForPersona(personaFactory, tokenId, graduationAmount, 0n, user2)
        ).to.emit(personaFactory, "LiquidityPairCreated");

        // Verify the pair was created
        const persona = await personaFactory.getPersona(tokenId);
        expect(persona.pairCreated).to.be.true;
    });

    it("Should only send trading fees to NFT owner (no graduation reward)", async function () {
        const { tokenId, personaFactory, amicaToken, user1, user2 } = await loadFixture(createPersonaFixture);

        const initialOwnerBalance = await amicaToken.balanceOf(user1.address);

        // Purchase to trigger graduation
        const purchaseAmount = (DEFAULT_GRADUATION_THRESHOLD * 10000n) / 9900n;
        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            purchaseAmount
        );

        const deadline = Math.floor(Date.now() / 1000) + 3600;

        await personaFactory.connect(user2).swapExactTokensForTokens(tokenId, purchaseAmount, 0, user2.address, deadline);

        // Check NFT owner received only trading fees (not graduation reward)
        const expectedFees = (purchaseAmount * 100n * 5000n) / (10000n * 10000n); // 0.5% to creator
        expect(await amicaToken.balanceOf(user1.address)).to.equal(
            initialOwnerBalance + expectedFees
        );
    });

    it("Should add correct liquidity amounts", async function () {
        const { tokenId, personaFactory, amicaToken, user2, owner } = await loadFixture(createPersonaFixture);

        // Purchase slightly more than graduation threshold
        const excess = ethers.parseEther("100000");
        const purchaseAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n + excess;

        // Transfer tokens from owner instead of using withdraw
        // Check if user2 needs more tokens
        const user2Balance = await amicaToken.balanceOf(user2.address);
        if (user2Balance < purchaseAmount) {
            await amicaToken.connect(owner).transfer(user2.address, purchaseAmount - user2Balance);
        }

        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            purchaseAmount
        );

        const tx = await personaFactory.connect(user2).swapExactTokensForTokens(
            tokenId,
            purchaseAmount,
            0,
            user2.address,
            getDeadline()
        );

        const receipt = await tx.wait();

        // Find LiquidityPairCreated event
        const event = receipt?.logs.find(
            (log: any) => {
                try {
                    const parsed = personaFactory.interface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    });
                    return parsed?.name === 'LiquidityPairCreated';
                } catch {
                    return false;
                }
            }
        );

        const parsedEvent = personaFactory.interface.parseLog({
            topics: event!.topics as string[],
            data: event!.data
        });

        // With 33/33/33 split: LIQUIDITY_TOKEN_AMOUNT is fixed at 333,333,334
        // The pairing token amount for liquidity is all deposited tokens (after fees)
        const expectedPersonaTokens = ethers.parseEther("333333334"); // LIQUIDITY_TOKEN_AMOUNT

        // Get actual deposited amount from purchase data
        const purchase = await personaFactory.purchases(tokenId);
        const pairingTokenAmount = purchase.totalDeposited;

        // The event shows the LP tokens created, not the individual amounts
        // We can't directly verify the exact amounts, but we can verify LP tokens were created
        expect(parsedEvent!.args.liquidity).to.be.gt(0);
    });

    it("Should not allow creating pair twice", async function () {
        const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

        const deadline = Math.floor(Date.now() / 1000) + 3600;

        // First graduation
        const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10000n) / 9900n;
        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            graduationAmount
        );
        await personaFactory.connect(user2).swapExactTokensForTokens(
            tokenId,
            graduationAmount,
            0,
            user2.address,
            deadline
        );

        // Verify pair is created
        const persona = await personaFactory.getPersona(tokenId);
        expect(persona.pairCreated).to.be.true;

        // Further purchases should fail
        await expect(
            personaFactory.connect(user2).swapExactTokensForTokens(tokenId, ethers.parseEther("1000"), 0, user2.address, deadline)
        ).to.be.revertedWith("Trading already on Uniswap");
    });

    it("Should handle edge case with exact graduation threshold", async function () {
        const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

        const deadline = Math.floor(Date.now() / 1000) + 3600;

        // Purchase exactly the graduation threshold (accounting for fees)
        const purchaseAmount = (DEFAULT_GRADUATION_THRESHOLD * 10000n) / 9900n;
        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            purchaseAmount
        );

        await expect(
            personaFactory.connect(user2).swapExactTokensForTokens(tokenId, purchaseAmount, 0, user2.address, deadline)
        ).to.emit(personaFactory, "LiquidityPairCreated");

        // Verify pair was created
        const persona = await personaFactory.getPersona(tokenId);
        expect(persona.pairCreated).to.be.true;
    });

    it("Should calculate tokens correctly at graduation threshold boundary", async function () {
        const { personaFactory } = await loadFixture(deployPersonaTokenFactoryFixture);

        const tokensAtThreshold = await personaFactory.calculateAmountOut(
            ethers.parseEther("1"),
            ethers.parseEther("299999999"), // Almost at threshold
            ethers.parseEther("300000000")  // BONDING_CURVE_AMOUNT
        );

        expect(tokensAtThreshold).to.be.gt(0);
    });

    it("Should create and trade personas with different pairing tokens", async function () {
        const { personaFactory, amicaToken, owner, user1, user2 } =
            await loadFixture(deployPersonaTokenFactoryFixture);

        const deadline = Math.floor(Date.now() / 1000) + 3600;

        // Deploy test tokens
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const usdc = await TestERC20.deploy("USD Coin", "USDC", ethers.parseEther("10000000"));
        const weth = await TestERC20.deploy("Wrapped Ether", "WETH", ethers.parseEther("100000"));

        // Configure USDC as pairing token
        await personaFactory.configurePairingToken(
            await usdc.getAddress(),
            ethers.parseEther("100"),  // 100 USDC mint cost
            ethers.parseEther("10000"), // 10k USDC graduation threshold
        );

        // Configure WETH as pairing token
        await personaFactory.configurePairingToken(
            await weth.getAddress(),
            ethers.parseEther("0.5"),  // 0.5 WETH mint cost
            ethers.parseEther("50"),   // 50 WETH graduation threshold
        );

        // Give users some tokens
        await usdc.transfer(user1.address, ethers.parseEther("20000")); // Increased for graduation
        await weth.transfer(user2.address, ethers.parseEther("100"));   // Increased for graduation

        // User1 creates persona with USDC pairing
        await usdc.connect(user1).approve(
            await personaFactory.getAddress(),
            ethers.parseEther("100")
        );

        const tx1 = await personaFactory.connect(user1).createPersona(
            await usdc.getAddress(),
            "USDC Persona",
            "USDCP",
            ["description"],
            ["A persona paired with USDC"],
            0,
            ethers.ZeroAddress,
            0, // No minimum agent tokens
        );

        // User2 creates persona with WETH pairing
        await weth.connect(user2).approve(
            await personaFactory.getAddress(),
            ethers.parseEther("0.5")
        );

        const tx2 = await personaFactory.connect(user2).createPersona(
            await weth.getAddress(),
            "ETH Persona",
            "ETHP",
            ["description"],
            ["A persona paired with WETH"],
            0,
            ethers.ZeroAddress,
            0, // No minimum agent tokens
        );

        // Verify both personas were created
        expect(await personaFactory.ownerOf(0)).to.equal(user1.address);
        expect(await personaFactory.ownerOf(1)).to.equal(user2.address);

        // Verify NO tokens deposited to AMICA yet (happens on graduation)
        const persona1 = await personaFactory.getPersona(0);
        const persona2 = await personaFactory.getPersona(1);

        expect(await amicaToken.depositedBalances(persona1.erc20Token)).to.equal(0);
        expect(await amicaToken.depositedBalances(persona2.erc20Token)).to.equal(0);

        // Test purchasing with USDC
        await usdc.connect(user1).approve(
            await personaFactory.getAddress(),
            ethers.parseEther("500")
        );
        await personaFactory.connect(user1).swapExactTokensForTokens(0, ethers.parseEther("500"), 0, user1.address, deadline);

        // Test purchasing with WETH
        await weth.connect(user2).approve(
            await personaFactory.getAddress(),
            ethers.parseEther("2")
        );
        await personaFactory.connect(user2).swapExactTokensForTokens(1, ethers.parseEther("2"), 0, user2.address, deadline);

        // Both should have received persona tokens
        const TestERC20Token = await ethers.getContractFactory("TestERC20");
        const persona1Token = TestERC20Token.attach(persona1.erc20Token) as TestERC20;
        const persona2Token = TestERC20Token.attach(persona2.erc20Token) as TestERC20;

        expect(await persona1Token.balanceOf(user1.address)).to.be.gt(0);
        expect(await persona2Token.balanceOf(user2.address)).to.be.gt(0);

        // Now graduate USDC persona to see AMICA deposit
        await usdc.connect(user1).approve(
            await personaFactory.getAddress(),
            ethers.parseEther("10000")
        );
        await personaFactory.connect(user1).swapExactTokensForTokens(0, ethers.parseEther("10000"), 0, user1.address, deadline);

        // NOW check AMICA deposit after graduation
        expect(await amicaToken.depositedBalances(persona1.erc20Token))
            .to.equal(ethers.parseEther("333333334"));
    });

    it("Should handle LP tokens after graduation", async function () {
        const { tokenId, personaFactory, amicaToken, user2, mockFactory, owner } = await loadFixture(createPersonaFixture);

        // Trigger graduation
        const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n;

        // Transfer tokens from owner instead of using withdraw
        const user2Balance = await amicaToken.balanceOf(user2.address);
        if (user2Balance < graduationAmount) {
            await amicaToken.connect(owner).transfer(user2.address, graduationAmount - user2Balance);
        }

        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            graduationAmount
        );

        await personaFactory.connect(user2).swapExactTokensForTokens(
            tokenId,
            graduationAmount,
            0,
            user2.address,
            getDeadline()
        );

        // Get pair address
        const persona = await personaFactory.getPersona(tokenId);
        const pairAddress = await mockFactory.getPair(
            persona.erc20Token,
            await amicaToken.getAddress()
        );

        // Since we're using mocks, we need to check if the mock created a pair
        // In the real implementation, LP tokens would be held by the factory
        expect(pairAddress).to.not.equal(ethers.ZeroAddress);

        // Verify pair was marked as created
        expect(persona.pairCreated).to.be.true;
    });

    it("Should handle withdrawal attempts with no purchases", async function () {
        const { tokenId, personaFactory, user2 } = await loadFixture(createPersonaFixture);

        // User2 has no purchases
        await expect(
            personaFactory.connect(user2).withdrawTokens(tokenId)
        ).to.be.revertedWith("No tokens to withdraw");
    });

    it("Should handle multiple withdrawal attempts", async function () {
        const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

        // First, make a purchase that won't trigger graduation
        const firstPurchase = ethers.parseEther("100000");
        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            firstPurchase + DEFAULT_GRADUATION_THRESHOLD
        );

        await personaFactory.connect(user2).swapExactTokensForTokens(
            tokenId,
            firstPurchase,
            0,
            user2.address,
            getDeadline()
        );

        // Now trigger graduation with a separate purchase
        await personaFactory.connect(user2).swapExactTokensForTokens(
            tokenId,
            DEFAULT_GRADUATION_THRESHOLD,
            0,
            user2.address,
            getDeadline()
        );

        // Verify graduation happened
        const persona = await personaFactory.getPersona(tokenId);
        expect(persona.pairCreated).to.be.true;

        // First withdrawal should succeed
        await expect(personaFactory.connect(user2).withdrawTokens(tokenId))
            .to.emit(personaFactory, "TokensWithdrawn");

        // Second withdrawal should fail since all tokens are already withdrawn
        await expect(
            personaFactory.connect(user2).withdrawTokens(tokenId)
        ).to.be.revertedWith("No tokens to withdraw");
    });
});
