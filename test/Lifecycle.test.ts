import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { TestERC20 } from "../typechain-types";

describe("PersonaTokenFactory - Complete Lifecycle", function () {
    const DEFAULT_MINT_COST = ethers.parseEther("1000");
    const DEFAULT_GRADUATION_THRESHOLD = ethers.parseEther("1000000");

    async function deployFullSystemFixture() {
        const [owner, creator, buyer1, buyer2, buyer3, lpHolder] = await ethers.getSigners();

        // Deploy AmicaToken
        const AmicaToken = await ethers.getContractFactory("AmicaToken");
        const amicaToken = await AmicaToken.deploy(owner.address);

        // Deploy mocks
        const MockUniswapV2Factory = await ethers.getContractFactory("MockUniswapV2Factory");
        const mockFactory = await MockUniswapV2Factory.deploy();

        const MockUniswapV2Router = await ethers.getContractFactory("MockUniswapV2Router");
        const mockRouter = await MockUniswapV2Router.deploy();

        // Deploy ERC20Implementation
        const ERC20Implementation = await ethers.getContractFactory("ERC20Implementation");
        const erc20Implementation = await ERC20Implementation.deploy();

        // Deploy PersonaTokenFactory
        const PersonaTokenFactory = await ethers.getContractFactory("PersonaTokenFactory");
        const personaFactory = await upgrades.deployProxy(
            PersonaTokenFactory,
            [
                await amicaToken.getAddress(),
                await mockFactory.getAddress(),
                await mockRouter.getAddress(),
                await erc20Implementation.getAddress()
            ],
            { initializer: "initialize" }
        );

        // Deploy additional tokens for pairing
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const usdc = await TestERC20.deploy("USD Coin", "USDC", ethers.parseEther("100000000"));
        const weth = await TestERC20.deploy("Wrapped Ether", "WETH", ethers.parseEther("1000000"));

        // Configure pairing tokens
        await personaFactory.configurePairingToken(
            await usdc.getAddress(),
            ethers.parseEther("100"),      // 100 USDC mint cost
            ethers.parseEther("50000"),    // 50k USDC graduation
        );

        await personaFactory.configurePairingToken(
            await weth.getAddress(),
            ethers.parseEther("0.1"),      // 0.1 WETH mint cost
            ethers.parseEther("10"),       // 10 WETH graduation
        );

        // Distribute tokens - INCREASED AMOUNTS
        await amicaToken.withdraw(creator.address, ethers.parseEther("20000")); // Increased from 10000
        await amicaToken.withdraw(buyer1.address, ethers.parseEther("5000000"));
        await amicaToken.withdraw(buyer2.address, ethers.parseEther("5000000"));
        await amicaToken.withdraw(buyer3.address, ethers.parseEther("5000000"));

        await usdc.transfer(creator.address, ethers.parseEther("1000"));
        await usdc.transfer(buyer1.address, ethers.parseEther("100000"));
        await usdc.transfer(buyer2.address, ethers.parseEther("100000"));

        await weth.transfer(creator.address, ethers.parseEther("1"));
        await weth.transfer(buyer1.address, ethers.parseEther("100"));
        await weth.transfer(buyer2.address, ethers.parseEther("100"));

        return {
            amicaToken,
            personaFactory,
            mockFactory,
            mockRouter,
            usdc,
            weth,
            owner,
            creator,
            buyer1,
            buyer2,
            buyer3,
            lpHolder
        };
    }

    describe("AMICA Pairing Lifecycle", function () {
        it("Should complete full lifecycle with AMICA pairing", async function () {
            const { amicaToken, personaFactory, creator, buyer1, buyer2, buyer3 } =
                await loadFixture(deployFullSystemFixture);

            console.log("\n=== AMICA Persona Lifecycle ===");

            // 1. Create persona
            await amicaToken.connect(creator).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST
            );

            const createTx = await (personaFactory.connect(creator) as any).createPersona(
                await amicaToken.getAddress(),
                "AI Assistant",
                "ASSIST",
                ["description", "twitter", "website"],
                ["Your friendly AI assistant", "@ai_assist", "https://ai-assist.com"],
                0,
            );

            const receipt = await createTx.wait();
            const event = receipt?.logs.find((log: any) => {
                try {
                    const parsed = personaFactory.interface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    });
                    return parsed?.name === 'PersonaCreated';
                } catch {
                    return false;
                }
            });

            const tokenId = personaFactory.interface.parseLog({
                topics: event!.topics as string[],
                data: event!.data
            })!.args.tokenId;

            console.log(`✓ Persona created with tokenId: ${tokenId}`);

            const persona = await personaFactory.getPersona(tokenId);
            console.log(`✓ ERC20 token deployed at: ${persona.erc20Token}`);

            // Verify AMICA deposit
            const depositedToAmica = await amicaToken.depositedBalances(persona.erc20Token);
            console.log(`✓ Deposited to AMICA: ${ethers.formatEther(depositedToAmica)} tokens`);

            // 2. Early buyers purchase tokens
            const deadline = () => Math.floor(Date.now() / 1000) + 3600;

            // Track creator balance for fee verification
            const creatorInitialBalance = await amicaToken.balanceOf(creator.address);

            // Buyer 1 - Early bird
            const buy1Amount = ethers.parseEther("50000");
            await amicaToken.connect(buyer1).approve(await personaFactory.getAddress(), buy1Amount);
            const quote1 = await personaFactory.getAmountOut(tokenId, buy1Amount);

            await personaFactory.connect(buyer1).swapExactTokensForTokens(
                tokenId, buy1Amount, quote1, buyer1.address, deadline()
            );
            console.log(`✓ Buyer1: ${ethers.formatEther(buy1Amount)} AMICA → ${ethers.formatEther(quote1)} ASSIST`);

            // Buyer 2 - Mid stage
            const buy2Amount = ethers.parseEther("200000");
            await amicaToken.connect(buyer2).approve(await personaFactory.getAddress(), buy2Amount);
            const quote2 = await personaFactory.getAmountOut(tokenId, buy2Amount);

            await personaFactory.connect(buyer2).swapExactTokensForTokens(
                tokenId, buy2Amount, quote2, buyer2.address, deadline()
            );
            console.log(`✓ Buyer2: ${ethers.formatEther(buy2Amount)} AMICA → ${ethers.formatEther(quote2)} ASSIST`);

            // Verify price increased
            const pricePerToken1 = buy1Amount * ethers.parseEther("1") / quote1;
            const pricePerToken2 = buy2Amount * ethers.parseEther("1") / quote2;
            expect(pricePerToken2).to.be.gt(pricePerToken1);
            console.log(`✓ Price increased from ${ethers.formatEther(pricePerToken1)} to ${ethers.formatEther(pricePerToken2)} AMICA per token`);

            // Check creator received fees
            const totalPurchases = buy1Amount + buy2Amount;
            const expectedFees = totalPurchases * 100n / 10000n; // 1% fee
            const expectedCreatorFees = expectedFees * 5000n / 10000n; // 50% of fees

            const creatorCurrentBalance = await amicaToken.balanceOf(creator.address);
            expect(creatorCurrentBalance).to.equal(creatorInitialBalance + expectedCreatorFees);
            console.log(`✓ Creator received ${ethers.formatEther(expectedCreatorFees)} AMICA in trading fees`);

            // 3. Approach graduation
            const availableBefore = await personaFactory.getAvailableTokens(tokenId);
            console.log(`\nAvailable tokens before graduation: ${ethers.formatEther(availableBefore)}`);

            // 4. Graduation purchase
            const graduationAmount = DEFAULT_GRADUATION_THRESHOLD - buy1Amount - buy2Amount + ethers.parseEther("100000");
            await amicaToken.connect(buyer3).approve(await personaFactory.getAddress(), graduationAmount);

            const creatorBalanceBefore = await amicaToken.balanceOf(creator.address);

            const graduationTx = await personaFactory.connect(buyer3).swapExactTokensForTokens(
                tokenId, graduationAmount, 0, buyer3.address, deadline()
            );

            // Check for graduation event
            const gradReceipt = await graduationTx.wait();
            const liquidityEvent = gradReceipt?.logs.find(log => {
                try {
                    const parsed = personaFactory.interface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    });
                    return parsed?.name === 'LiquidityPairCreated';
                } catch {
                    return false;
                }
            });

            expect(liquidityEvent).to.not.be.undefined;
            console.log("\n✓ GRADUATION! Liquidity pair created on Uniswap");

            // Verify creator only received trading fees, not graduation reward
            const creatorBalanceAfter = await amicaToken.balanceOf(creator.address);
            const graduationFees = graduationAmount * 100n / 10000n * 5000n / 10000n; // 1% fee, 50% to creator
            expect(creatorBalanceAfter).to.equal(creatorBalanceBefore + graduationFees);
            console.log(`✓ Creator received only trading fees (${ethers.formatEther(graduationFees)} AMICA), no graduation reward`);

            // 5. Verify post-graduation state
            const personaAfter = await personaFactory.getPersona(tokenId);
            expect(personaAfter.pairCreated).to.be.true;

            const availableAfter = await personaFactory.getAvailableTokens(tokenId);
            expect(availableAfter).to.equal(0);
            console.log("✓ No tokens available via bonding curve after graduation");

            // Try to buy more - should fail
            await expect(
                personaFactory.connect(buyer1).swapExactTokensForTokens(
                    tokenId, ethers.parseEther("1000"), 0, buyer1.address, deadline()
                )
            ).to.be.revertedWith("Trading already on Uniswap");
            console.log("✓ Further bonding curve purchases blocked");

            // 6. Summary
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const assistToken = TestERC20.attach(persona.erc20Token) as TestERC20;

            console.log("\n=== Final State ===");
            console.log(`Total ASSIST supply: ${ethers.formatEther(await assistToken.totalSupply())}`);
            console.log(`Tokens locked for buyers (need to wait 1 week or graduation to withdraw)`);
            console.log(`AMICA deposited: ${ethers.formatEther(await amicaToken.depositedBalances(persona.erc20Token))}`);
        });
    });

    describe("USDC Pairing Lifecycle", function () {
        it("Should complete full lifecycle with USDC pairing", async function () {
            const { amicaToken, personaFactory, usdc, creator, buyer1, buyer2 } =
                await loadFixture(deployFullSystemFixture);

            console.log("\n=== USDC Persona Lifecycle ===");

            // 1. Create persona with USDC pairing
            await usdc.connect(creator).approve(
                await personaFactory.getAddress(),
                ethers.parseEther("100")
            );

            // Track creator's initial USDC balance
            const creatorInitialUsdc = await usdc.balanceOf(creator.address);

            await personaFactory.connect(creator).createPersona(
                await usdc.getAddress(),
                "DeFi Bot",
                "DEFI",
                ["description"],
                ["Automated DeFi trading bot"],
                0, // No initial buy
            );

            const tokenId = 0;
            const persona = await personaFactory.getPersona(tokenId);
            console.log(`✓ Persona created with USDC pairing`);

            // Creator should have spent 100 USDC on mint
            const creatorUsdcAfterMint = await usdc.balanceOf(creator.address);
            expect(creatorUsdcAfterMint).to.equal(creatorInitialUsdc - ethers.parseEther("100"));

            // IMPORTANT: No AMICA deposit happens yet during creation
            const depositedToAmicaBeforeGrad = await amicaToken.depositedBalances(persona.erc20Token);
            expect(depositedToAmicaBeforeGrad).to.equal(0);
            console.log(`✓ No AMICA deposit during creation (happens on graduation)`);

            // 2. Buy with USDC
            const deadline = () => Math.floor(Date.now() / 1000) + 3600;

            const usdcAmount1 = ethers.parseEther("5000");
            await usdc.connect(buyer1).approve(await personaFactory.getAddress(), usdcAmount1);
            const quote1 = await personaFactory.getAmountOut(tokenId, usdcAmount1);

            await personaFactory.connect(buyer1).swapExactTokensForTokens(
                tokenId, usdcAmount1, quote1, buyer1.address, deadline()
            );
            console.log(`✓ Buyer1: ${ethers.formatEther(usdcAmount1)} USDC → ${ethers.formatEther(quote1)} DEFI`);

            // 3. Trigger graduation with USDC
            const graduationAmount = ethers.parseEther("45000"); // Total 50k USDC
            await usdc.connect(buyer2).approve(await personaFactory.getAddress(), graduationAmount);

            // IMPORTANT: Capture creator balance AFTER mint but BEFORE graduation
            const creatorUsdcBefore = await usdc.balanceOf(creator.address);

            await personaFactory.connect(buyer2).swapExactTokensForTokens(
                tokenId, graduationAmount, 0, buyer2.address, deadline()
            );

            // NOW check AMICA deposit after graduation
            const depositedToAmicaAfterGrad = await amicaToken.depositedBalances(persona.erc20Token);
            expect(depositedToAmicaAfterGrad).to.equal(ethers.parseEther("333333333"));
            console.log(`✓ Deposited ${ethers.formatEther(depositedToAmicaAfterGrad)} tokens to AMICA on graduation`);

            // Verify creator received only USDC fees (not graduation reward)
            const creatorUsdcAfter = await usdc.balanceOf(creator.address);
            const totalUsdcPurchases = usdcAmount1 + graduationAmount;
            const totalFees = totalUsdcPurchases * 100n / 10000n; // 1% fee
            const creatorFees = totalFees * 5000n / 10000n; // 50% to creator

            // Use closeTo to handle any potential rounding issues
            expect(creatorUsdcAfter).to.be.closeTo(creatorUsdcBefore + creatorFees, ethers.parseEther("0.01"));
            console.log(`✓ Creator received ${ethers.formatEther(creatorFees)} USDC in trading fees only`);

            // 4. Verify Uniswap pair is DEFI/USDC (not DEFI/AMICA)
            const mockFactory = await ethers.getContractAt(
                "IUniswapV2Factory",
                await personaFactory.uniswapFactory()
            );

            const pairAddress = await mockFactory.getPair(
                persona.erc20Token,
                await usdc.getAddress()
            );

            expect(pairAddress).to.not.equal(ethers.ZeroAddress);
            console.log(`✓ Uniswap pair created: DEFI/USDC at ${pairAddress}`);

            // Verify no AMICA pair exists
            const amicaPairAddress = await mockFactory.getPair(
                persona.erc20Token,
                await amicaToken.getAddress()
            );
            expect(amicaPairAddress).to.equal(ethers.ZeroAddress);
            console.log("✓ No DEFI/AMICA pair created");
        });
    });

    describe("WETH Pairing Lifecycle", function () {
        it("Should complete full lifecycle with WETH pairing", async function () {
            const { amicaToken, personaFactory, weth, creator, buyer1, buyer2 } =
                await loadFixture(deployFullSystemFixture);

            console.log("\n=== WETH Persona Lifecycle ===");

            // 1. Create persona with WETH pairing
            await weth.connect(creator).approve(
                await personaFactory.getAddress(),
                ethers.parseEther("0.1")
            );

            await personaFactory.connect(creator).createPersona(
                await weth.getAddress(),
                "ETH Maximalist",
                "ETHMAX",
                ["description"],
                ["Only ETH matters"],
                0, // No initial buy
            );

            const tokenId = 0;
            const persona = await personaFactory.getPersona(tokenId);

            // 2. Small purchases with ETH
            const deadline = () => Math.floor(Date.now() / 1000) + 3600;

            const wethAmount1 = ethers.parseEther("2");
            await weth.connect(buyer1).approve(await personaFactory.getAddress(), wethAmount1);
            await personaFactory.connect(buyer1).swapExactTokensForTokens(
                tokenId, wethAmount1, 0, buyer1.address, deadline()
            );

            // 3. Quick graduation (only 10 WETH threshold)
            const wethAmount2 = ethers.parseEther("8.5"); // Extra for liquidity
            await weth.connect(buyer2).approve(await personaFactory.getAddress(), wethAmount2);

            await expect(
                personaFactory.connect(buyer2).swapExactTokensForTokens(
                    tokenId, wethAmount2, 0, buyer2.address, deadline()
                )
            ).to.emit(personaFactory, "LiquidityPairCreated");

            console.log("✓ Graduated with only 10 WETH!");

            // Verify creator received only fees in WETH
            const totalWethPurchases = wethAmount1 + wethAmount2;
            const expectedFees = totalWethPurchases * 100n / 10000n * 5000n / 10000n; // 1% fee, 50% to creator
            const creatorWethBalance = await weth.balanceOf(creator.address);
            expect(creatorWethBalance).to.be.gte(ethers.parseEther("0.9") + expectedFees); // Initial 1 WETH minus mint cost + fees
            console.log(`✓ Creator received fees in WETH`);
        });
    });

    describe("AMICA Burn and Claim Integration", function () {
        it("Should allow AMICA holders to claim persona tokens", async function () {
            const { amicaToken, personaFactory, usdc, creator, buyer1, owner } =
                await loadFixture(deployFullSystemFixture);

            // Create multiple personas with different pairings

            // AMICA persona
            await amicaToken.connect(creator).approve(await personaFactory.getAddress(), DEFAULT_MINT_COST);
            await personaFactory.connect(creator).createPersona(
                await amicaToken.getAddress(),
                "AMICA Test",
                "ATEST",
                [],
                [],
                0,
            );

            // USDC persona
            await usdc.connect(creator).approve(await personaFactory.getAddress(), ethers.parseEther("100"));
            await personaFactory.connect(creator).createPersona(
                await usdc.getAddress(),
                "USDC Test",
                "UTEST",
                [],
                [],
                0,
            );

            const persona1 = await personaFactory.getPersona(0);
            const persona2 = await personaFactory.getPersona(1);

            // IMPORTANT: Need to graduate both personas first to trigger AMICA deposits
            const deadline = () => Math.floor(Date.now() / 1000) + 3600;

            // Graduate AMICA persona
            await amicaToken.connect(buyer1).approve(
                await personaFactory.getAddress(),
                DEFAULT_GRADUATION_THRESHOLD + ethers.parseEther("100000")
            );
            await personaFactory.connect(buyer1).swapExactTokensForTokens(
                0, DEFAULT_GRADUATION_THRESHOLD + ethers.parseEther("100000"), 0, buyer1.address, deadline()
            );

            // Graduate USDC persona
            await usdc.connect(buyer1).approve(
                await personaFactory.getAddress(),
                ethers.parseEther("50000") // USDC graduation threshold
            );
            await personaFactory.connect(buyer1).swapExactTokensForTokens(
                1, ethers.parseEther("50000"), 0, buyer1.address, deadline()
            );

            // Now both personas should have deposited to AMICA
            expect(await amicaToken.depositedBalances(persona1.erc20Token)).to.be.gt(0);
            expect(await amicaToken.depositedBalances(persona2.erc20Token)).to.be.gt(0);

            // Give owner some AMICA to burn
            await amicaToken.withdraw(owner.address, ethers.parseEther("1000000"));

            // Get token indices in AMICA contract
            const index1 = await amicaToken.tokenIndex(persona1.erc20Token);
            const index2 = await amicaToken.tokenIndex(persona2.erc20Token);

            console.log("\n=== AMICA Burn & Claim ===");
            console.log(`Token indices: ${index1}, ${index2}`);

            // Get initial circulating supply for calculation
            const circulatingSupply = await amicaToken.circulatingSupply();

            // Burn AMICA and claim both persona tokens
            const burnAmount = ethers.parseEther("100000");
            await amicaToken.burnAndClaim(burnAmount, [index1, index2]);

            // Check received tokens
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const token1 = TestERC20.attach(persona1.erc20Token) as TestERC20;
            const token2 = TestERC20.attach(persona2.erc20Token) as TestERC20;

            const balance1 = await token1.balanceOf(owner.address);
            const balance2 = await token2.balanceOf(owner.address);

            console.log(`✓ Received ${ethers.formatEther(balance1)} ATEST tokens`);
            console.log(`✓ Received ${ethers.formatEther(balance2)} UTEST tokens`);

            expect(balance1).to.be.gt(0);
            expect(balance2).to.be.gt(0);

            // Both should be proportional to burn amount
            const sharePercentage = burnAmount * ethers.parseEther("1") / circulatingSupply;
            const expectedClaim = ethers.parseEther("333333333") * sharePercentage / ethers.parseEther("1");

            // Allow some tolerance for the calculation
            expect(balance1).to.be.closeTo(expectedClaim, ethers.parseEther("100"));
            expect(balance2).to.be.closeTo(expectedClaim, ethers.parseEther("100"));
        });
    });

    describe("Initial Buy Feature", function () {
        it("Should allow creator to buy tokens at launch to prevent sniping", async function () {
            const { amicaToken, personaFactory, creator } =
                await loadFixture(deployFullSystemFixture);

            console.log("\n=== Initial Buy Feature ===");

            const initialBuyAmount = ethers.parseEther("10000");
            const totalPayment = DEFAULT_MINT_COST + initialBuyAmount;

            await amicaToken.connect(creator).approve(
                await personaFactory.getAddress(),
                totalPayment
            );

            const creatorBalanceBefore = await amicaToken.balanceOf(creator.address);

            const tx = await personaFactory.connect(creator).createPersona(
                await amicaToken.getAddress(),
                "Anti-Snipe Token",
                "NOSNIPE",
                ["description"],
                ["Token with creator initial buy"],
                initialBuyAmount
            );

            await expect(tx).to.emit(personaFactory, "PersonaCreated");
            await expect(tx).to.emit(personaFactory, "TokensPurchased");

            const tokenId = 0;

            // Check creator's purchases
            const purchases = await personaFactory.getUserpurchases(tokenId, creator.address);
            expect(purchases.length).to.equal(1);
            expect(purchases[0].amount).to.be.gt(0);
            console.log(`✓ Creator bought ${ethers.formatEther(purchases[0].amount)} tokens at launch`);

            // Verify payment was taken
            const creatorBalanceAfter = await amicaToken.balanceOf(creator.address);
            const totalSpent = DEFAULT_MINT_COST + initialBuyAmount;
            const feeRefund = initialBuyAmount * 100n / 10000n * 5000n / 10000n; // Creator gets back their portion of fees
            expect(creatorBalanceAfter).to.equal(creatorBalanceBefore - totalSpent + feeRefund);
            console.log("✓ Creator paid mint cost + initial buy amount");

            // Verify tokens are locked
            await expect(
                personaFactory.connect(creator).withdrawTokens(tokenId)
            ).to.be.revertedWith("No tokens to withdraw");
            console.log("✓ Creator's tokens are locked for 1 week");
        });
    });

    describe("Trading Fee Scenarios", function () {
        it("Should handle different fee configurations", async function () {
            const { amicaToken, personaFactory, owner, creator, buyer1 } =
                await loadFixture(deployFullSystemFixture);

            // Configure 2% fee with 70/30 split (70% to creator)
            await personaFactory.configureTradingFees(200, 7000);

            // Create persona
            await amicaToken.connect(creator).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST
            );

            await personaFactory.connect(creator).createPersona(
                await amicaToken.getAddress(),
                "Fee Test",
                "FEE",
                [],
                [],
                0, // No initial buy
            );

            const tokenId = 0;
            const deadline = () => Math.floor(Date.now() / 1000) + 3600;

            // Track balances
            const creatorBalanceBefore = await amicaToken.balanceOf(creator.address);
            const amicaContractBalanceBefore = await amicaToken.balanceOf(await amicaToken.getAddress());

            // Buy tokens
            const buyAmount = ethers.parseEther("100000");
            await amicaToken.connect(buyer1).approve(await personaFactory.getAddress(), buyAmount);

            await personaFactory.connect(buyer1).swapExactTokensForTokens(
                tokenId, buyAmount, 0, buyer1.address, deadline()
            );

            // Check fee distribution
            const totalFees = buyAmount * 200n / 10000n; // 2%
            const creatorFees = totalFees * 7000n / 10000n; // 70%
            const amicaFees = totalFees - creatorFees; // 30%

            const creatorBalanceAfter = await amicaToken.balanceOf(creator.address);
            expect(creatorBalanceAfter).to.equal(creatorBalanceBefore + creatorFees);

            console.log(`✓ With 2% fee and 70/30 split:`);
            console.log(`  - Total fees: ${ethers.formatEther(totalFees)} AMICA`);
            console.log(`  - Creator received: ${ethers.formatEther(creatorFees)} AMICA`);
            console.log(`  - AMICA protocol received: ${ethers.formatEther(amicaFees)} AMICA`);
        });
    });
});
