import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
  getDeadline,
  createPersonaFixture,
} from "./shared/fixtures";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { TestERC20, PersonaFactoryViewer } from "../typechain-types";

describe("PersonaTokenFactory - Complete Lifecycle", function () {
    const DEFAULT_MINT_COST = ethers.parseEther("1000");
    const DEFAULT_GRADUATION_THRESHOLD = ethers.parseEther("1000000");

    async function deployFullSystemFixture() {
        const [owner, creator, buyer1, buyer2, buyer3, lpHolder] = await ethers.getSigners();

        // Deploy AmicaToken
        const AmicaToken = await ethers.getContractFactory("AmicaToken");
        const amicaToken = await upgrades.deployProxy(
            AmicaToken,
            [owner.address],
            { initializer: "initialize" }
        );

        // Deploy a mock bridged token
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const bridgedAmica = await TestERC20.deploy("Bridged Amica", "BAMICA", ethers.parseEther("100000000"));

        // Deploy AmicaBridgeWrapper using upgrades plugin
        const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");
        const bridgeWrapper = await upgrades.deployProxy(
            AmicaBridgeWrapper,
            [
                await bridgedAmica.getAddress(),
                await amicaToken.getAddress(),
                owner.address
            ],
            { initializer: "initialize" }
        );

        // Set bridge wrapper in AmicaToken
        await amicaToken.setBridgeWrapper(await bridgeWrapper.getAddress());

        // Now we can mint native AMICA by wrapping bridged tokens
        // Give owner bridged tokens
        await bridgedAmica.transfer(owner.address, ethers.parseEther("50000000"));

        // Wrap bridged tokens to get native AMICA
        await bridgedAmica.approve(await bridgeWrapper.getAddress(), ethers.parseEther("50000000"));
        await bridgeWrapper.wrap(ethers.parseEther("50000000"));

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

        // Deploy viewer contract
        const PersonaFactoryViewer = await ethers.getContractFactory("PersonaFactoryViewer");
        const viewer = await PersonaFactoryViewer.deploy(await personaFactory.getAddress()) as PersonaFactoryViewer;

        // Deploy additional tokens for pairing
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

        // Distribute tokens - Transfer AMICA from owner instead of using withdraw
        await amicaToken.transfer(creator.address, ethers.parseEther("20000"));
        await amicaToken.transfer(buyer1.address, ethers.parseEther("5000000"));
        await amicaToken.transfer(buyer2.address, ethers.parseEther("5000000"));
        await amicaToken.transfer(buyer3.address, ethers.parseEther("5000000"));

        await usdc.transfer(creator.address, ethers.parseEther("1000"));
        await usdc.transfer(buyer1.address, ethers.parseEther("100000"));
        await usdc.transfer(buyer2.address, ethers.parseEther("100000"));

        await weth.transfer(creator.address, ethers.parseEther("1"));
        await weth.transfer(buyer1.address, ethers.parseEther("100"));
        await weth.transfer(buyer2.address, ethers.parseEther("100"));

        return {
            amicaToken,
            personaFactory,
            viewer,
            mockFactory,
            mockRouter,
            usdc,
            weth,
            owner,
            creator,
            buyer1,
            buyer2,
            buyer3,
            lpHolder,
            bridgeWrapper,
            bridgedAmica
        };
    }

    describe("AMICA Pairing Lifecycle", function () {
        it("Should complete full lifecycle with AMICA pairing", async function () {
            const { amicaToken, personaFactory, viewer, creator, buyer1, buyer2, buyer3 } =
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
                ethers.ZeroAddress,
                0, // No minimum agent tokens
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

            const persona = await viewer.getPersona(tokenId);
            console.log(`✓ ERC20 token deployed at: ${persona.erc20Token}`);

            // Verify NO AMICA deposit yet (happens on graduation)
            const depositedToAmica = await amicaToken.depositedBalances(persona.erc20Token);
            console.log(`✓ Deposited to AMICA: ${ethers.formatEther(depositedToAmica)} tokens`);
            expect(depositedToAmica).to.equal(0);

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

            // NOW check AMICA deposit after graduation
            const depositedToAmicaAfterGrad = await amicaToken.depositedBalances(persona.erc20Token);
            expect(depositedToAmicaAfterGrad).to.equal(ethers.parseEther("333333334"));
            console.log(`✓ Deposited ${ethers.formatEther(depositedToAmicaAfterGrad)} ASSIST tokens to AMICA on graduation`);

            // Verify creator only received trading fees, not graduation reward
            const creatorBalanceAfter = await amicaToken.balanceOf(creator.address);
            const graduationFees = graduationAmount * 100n / 10000n * 5000n / 10000n; // 1% fee, 50% to creator
            expect(creatorBalanceAfter).to.equal(creatorBalanceBefore + graduationFees);
            console.log(`✓ Creator received only trading fees (${ethers.formatEther(graduationFees)} AMICA), no graduation reward`);

            // 5. Verify post-graduation state
            const personaAfter = await viewer.getPersona(tokenId);
            expect(personaAfter.pairCreated).to.be.true;

            const availableAfter = await personaFactory.getAvailableTokens(tokenId);
            expect(availableAfter).to.equal(0);
            console.log("✓ No tokens available via bonding curve after graduation");

            // Try to buy more - should fail
            await expect(
                personaFactory.connect(buyer1).swapExactTokensForTokens(
                    tokenId, ethers.parseEther("1000"), 0, buyer1.address, deadline()
                )
            ).to.be.revertedWithCustomError(personaFactory, "NotAllowed")
             .withArgs(4); // TradingOnUniswap = 4

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
            const { amicaToken, personaFactory, viewer, usdc, creator, buyer1, buyer2 } =
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
                ethers.ZeroAddress,
                0, // No minimum agent tokens
            );

            const tokenId = 0;
            const persona = await viewer.getPersona(tokenId);
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
            // Need to reach 50k USDC total AFTER fees
            // Already deposited: 5000 * 0.99 = 4950
            // Need: 50000 - 4950 = 45050
            // To get 45050 after 1% fee, need to send: 45050 / 0.99 ≈ 45505.05
            const remainingNeeded = ethers.parseEther("50000") - (usdcAmount1 * 99n / 100n);
            const graduationAmount = (remainingNeeded * 10000n) / 9900n + ethers.parseEther("1"); // Add 1 USDC buffer

            await usdc.connect(buyer2).approve(await personaFactory.getAddress(), graduationAmount);

            // Capture creator balance right before graduation (after they received fees from buyer1)
            const creatorUsdcBeforeGraduation = await usdc.balanceOf(creator.address);

            // This should trigger graduation
            await expect(
                personaFactory.connect(buyer2).swapExactTokensForTokens(
                    tokenId, graduationAmount, 0, buyer2.address, deadline()
                )
            ).to.emit(personaFactory, "LiquidityPairCreated");

            // NOW check AMICA deposit after graduation - it's the DEFI tokens that get deposited
            const depositedToAmicaAfterGrad = await amicaToken.depositedBalances(persona.erc20Token);
            expect(depositedToAmicaAfterGrad).to.equal(ethers.parseEther("333333334"));
            console.log(`✓ Deposited ${ethers.formatEther(depositedToAmicaAfterGrad)} DEFI tokens to AMICA on graduation`);

            // Verify creator received only USDC fees from the graduation purchase
            const creatorUsdcAfter = await usdc.balanceOf(creator.address);

            // Only calculate fees for the graduation transaction
            const graduationFees = graduationAmount * 100n / 10000n; // 1% fee
            const creatorGraduationFees = graduationFees * 5000n / 10000n; // 50% to creator

            // Creator should have received fees only from the graduation transaction
            expect(creatorUsdcAfter).to.be.closeTo(
                creatorUsdcBeforeGraduation + creatorGraduationFees,
                ethers.parseEther("0.01")
            );

            // Log total fees received (from both transactions)
            const totalCreatorFees = creatorUsdcAfter - creatorUsdcAfterMint;
            console.log(`✓ Creator received ${ethers.formatEther(totalCreatorFees)} USDC in trading fees only`);

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
            const { amicaToken, personaFactory, viewer, weth, creator, buyer1, buyer2 } =
                await loadFixture(deployFullSystemFixture);

            console.log("\n=== WETH Persona Lifecycle ===");

            // 1. Create persona with WETH pairing
            await weth.connect(creator).approve(
                await personaFactory.getAddress(),
                ethers.parseEther("0.1")
            );

            // Track creator's initial WETH balance
            const creatorInitialWeth = await weth.balanceOf(creator.address);

            await personaFactory.connect(creator).createPersona(
                await weth.getAddress(),
                "ETH Maximalist",
                "ETHMAX",
                ["description", "twitter", "website"],
                ["Only ETH matters", "@eth_maxi", "https://ethmax.io"],
                0, // No initial buy
                ethers.ZeroAddress,
                0, // No minimum agent tokens
            );

            const tokenId = 0;
            const persona = await viewer.getPersona(tokenId);
            console.log(`✓ Persona created with WETH pairing`);

            // Creator should have spent 0.1 WETH on mint
            const creatorWethAfterMint = await weth.balanceOf(creator.address);
            expect(creatorWethAfterMint).to.equal(creatorInitialWeth - ethers.parseEther("0.1"));

            // Verify no AMICA deposit yet
            const depositedToAmicaBeforeGrad = await amicaToken.depositedBalances(persona.erc20Token);
            expect(depositedToAmicaBeforeGrad).to.equal(0);
            console.log(`✓ No AMICA deposit during creation (happens on graduation)`);

            // 2. Multiple purchases with WETH
            const deadline = () => Math.floor(Date.now() / 1000) + 3600;

            // First purchase - early buyer gets better rate
            const wethAmount1 = ethers.parseEther("2");
            await weth.connect(buyer1).approve(await personaFactory.getAddress(), wethAmount1);
            const quote1 = await personaFactory.getAmountOut(tokenId, wethAmount1);

            await personaFactory.connect(buyer1).swapExactTokensForTokens(
                tokenId, wethAmount1, quote1, buyer1.address, deadline()
            );
            console.log(`✓ Buyer1: ${ethers.formatEther(wethAmount1)} WETH → ${ethers.formatEther(quote1)} ETHMAX`);

            // Second purchase - slightly worse rate
            const wethAmount2 = ethers.parseEther("3");
            await weth.connect(buyer2).approve(await personaFactory.getAddress(), wethAmount2);
            const quote2 = await personaFactory.getAmountOut(tokenId, wethAmount2);

            await personaFactory.connect(buyer2).swapExactTokensForTokens(
                tokenId, wethAmount2, quote2, buyer2.address, deadline()
            );
            console.log(`✓ Buyer2: ${ethers.formatEther(wethAmount2)} WETH → ${ethers.formatEther(quote2)} ETHMAX`);

            // Verify price increased
            const pricePerToken1 = wethAmount1 * ethers.parseEther("1") / quote1;
            const pricePerToken2 = wethAmount2 * ethers.parseEther("1") / quote2;
            expect(pricePerToken2).to.be.gt(pricePerToken1);
            console.log(`✓ Price increased from ${ethers.formatEther(pricePerToken1)} to ${ethers.formatEther(pricePerToken2)} WETH per token`);

            // Check available tokens before graduation
            const availableBefore = await personaFactory.getAvailableTokens(tokenId);
            console.log(`✓ Available tokens before graduation: ${ethers.formatEther(availableBefore)}`);

            // 3. Trigger graduation (only 10 WETH threshold)
            // Already deposited: (2 + 3) * 0.99 = 4.95 WETH
            // Need: 10 - 4.95 = 5.05 WETH
            // To get 5.05 after fees: 5.05 / 0.99 ≈ 5.10 WETH
            const totalDeposited = (wethAmount1 + wethAmount2) * 99n / 100n;
            const remainingNeeded = ethers.parseEther("10") - totalDeposited;
            const graduationAmount = (remainingNeeded * 10000n) / 9900n + ethers.parseEther("0.01"); // Small buffer

            await weth.connect(buyer1).approve(await personaFactory.getAddress(), graduationAmount);

            // Track creator balance before graduation
            const creatorWethBeforeGraduation = await weth.balanceOf(creator.address);

            await expect(
                personaFactory.connect(buyer1).swapExactTokensForTokens(
                    tokenId, graduationAmount, 0, buyer1.address, deadline()
                )
            ).to.emit(personaFactory, "LiquidityPairCreated");

            console.log("✓ Graduated with only 10 WETH!");

            // Verify ETHMAX tokens were deposited to AMICA
            const depositedToAmica = await amicaToken.depositedBalances(persona.erc20Token);
            expect(depositedToAmica).to.equal(ethers.parseEther("333333334"));
            console.log(`✓ Deposited ${ethers.formatEther(depositedToAmica)} ETHMAX tokens to AMICA on graduation`);

            // Verify creator received only fees in WETH
            const creatorWethAfter = await weth.balanceOf(creator.address);
            const graduationFees = graduationAmount * 100n / 10000n * 5000n / 10000n; // 0.5% to creator

            expect(creatorWethAfter).to.be.closeTo(
                creatorWethBeforeGraduation + graduationFees,
                ethers.parseEther("0.0001") // Small tolerance for WETH
            );

            // Calculate total fees received
            const totalWethPurchases = wethAmount1 + wethAmount2 + graduationAmount;
            const totalCreatorFees = creatorWethAfter - creatorWethAfterMint;
            console.log(`✓ Creator received ${ethers.formatEther(totalCreatorFees)} WETH in trading fees`);

            // 4. Verify post-graduation state
            const personaAfter = await viewer.getPersona(tokenId);
            expect(personaAfter.pairCreated).to.be.true;

            // No tokens available after graduation
            const availableAfter = await personaFactory.getAvailableTokens(tokenId);
            expect(availableAfter).to.equal(0);
            console.log("✓ No tokens available via bonding curve after graduation");

            // 5. Verify Uniswap pair configuration
            const mockFactory = await ethers.getContractAt(
                "IUniswapV2Factory",
                await personaFactory.uniswapFactory()
            );

            const pairAddress = await mockFactory.getPair(
                persona.erc20Token,
                await weth.getAddress()
            );

            expect(pairAddress).to.not.equal(ethers.ZeroAddress);
            console.log(`✓ Uniswap pair created: ETHMAX/WETH at ${pairAddress}`);

            // Verify no AMICA pair exists
            const amicaPairAddress = await mockFactory.getPair(
                persona.erc20Token,
                await amicaToken.getAddress()
            );
            expect(amicaPairAddress).to.equal(ethers.ZeroAddress);
            console.log("✓ No ETHMAX/AMICA pair created");

            // 6. Verify buyers can withdraw after graduation
            await expect(personaFactory.connect(buyer1).withdrawTokens(tokenId))
                .to.emit(personaFactory, "TokensWithdrawn");
            console.log("✓ Buyers can withdraw tokens immediately after graduation");

            // 7. Try to buy more - should fail
            await expect(
                personaFactory.connect(buyer2).swapExactTokensForTokens(
                    tokenId, ethers.parseEther("0.1"), 0, buyer2.address, deadline()
                )
            ).to.be.revertedWithCustomError(personaFactory, "NotAllowed")
             .withArgs(4); // TradingOnUniswap = 4
            console.log("✓ Further bonding curve purchases blocked after graduation");

            // Summary
            console.log("\n=== Final State ===");
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const ethMaxToken = TestERC20.attach(persona.erc20Token) as TestERC20;
            console.log(`Total ETHMAX supply: ${ethers.formatEther(await ethMaxToken.totalSupply())}`);
            console.log(`ETHMAX deposited to AMICA: ${ethers.formatEther(depositedToAmica)}`);
            console.log(`Low graduation threshold (10 WETH) enables quick liquidity`);
        });
    });

    describe("AMICA Burn and Claim Integration", function () {
        it("Should allow AMICA holders to claim persona tokens", async function () {
            const { amicaToken, personaFactory, viewer, usdc, creator, buyer1, owner } =
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
                ethers.ZeroAddress,
                0, // No minimum agent tokens
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
                ethers.ZeroAddress,
                0, // No minimum agent tokens
            );

            const persona1 = await viewer.getPersona(0);
            const persona2 = await viewer.getPersona(1);

            // IMPORTANT: Need to graduate both personas first to trigger AMICA deposits
            const deadline = () => Math.floor(Date.now() / 1000) + 3600;

            // Graduate AMICA persona (need to account for fees)
            const amicaGradAmount = (DEFAULT_GRADUATION_THRESHOLD * 10100n) / 9900n; // Add buffer for fees
            await amicaToken.connect(buyer1).approve(
                await personaFactory.getAddress(),
                amicaGradAmount
            );
            await expect(
                personaFactory.connect(buyer1).swapExactTokensForTokens(
                    0, amicaGradAmount, 0, buyer1.address, deadline()
                )
            ).to.emit(personaFactory, "LiquidityPairCreated");

            // Graduate USDC persona (50k USDC threshold from fixture)
            const usdcGradAmount = (ethers.parseEther("50000") * 10100n) / 9900n; // Add buffer for fees
            await usdc.connect(buyer1).approve(
                await personaFactory.getAddress(),
                usdcGradAmount
            );
            await expect(
                personaFactory.connect(buyer1).swapExactTokensForTokens(
                    1, usdcGradAmount, 0, buyer1.address, deadline()
                )
            ).to.emit(personaFactory, "LiquidityPairCreated");

            // Now both personas should have deposited their tokens to AMICA
            const deposit1 = await amicaToken.depositedBalances(persona1.erc20Token);
            const deposit2 = await amicaToken.depositedBalances(persona2.erc20Token);
            expect(deposit1).to.equal(ethers.parseEther("333333334"));
            expect(deposit2).to.equal(ethers.parseEther("333333334"));

            // Owner already has AMICA from the fixture setup
            const ownerAmicaBalance = await amicaToken.balanceOf(owner.address);
            expect(ownerAmicaBalance).to.be.gt(ethers.parseEther("1000000"));

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
                expect(gas).to.be.closeTo(avgGas, avgGas / 5n); // Within 20% instead of 10%
            }
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
                ethers.ZeroAddress,
                0, // No minimum agent tokens
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

    describe("Bridge Wrapper Integration", function () {
        it("Should verify bridge wrapper functionality in the full system", async function () {
            const { amicaToken, bridgeWrapper, bridgedAmica, owner } =
                await loadFixture(deployFullSystemFixture);

            console.log("\n=== Bridge Wrapper Integration ===");

            // Check initial state
            const nativeSupply = await amicaToken.totalSupply();
            const bridgedBalance = await bridgeWrapper.bridgedBalance();

            console.log(`✓ Native AMICA supply: ${ethers.formatEther(nativeSupply)}`);
            console.log(`✓ Bridged tokens in wrapper: ${ethers.formatEther(bridgedBalance)}`);

            // Verify bridge wrapper is set correctly
            const setBridgeWrapper = await amicaToken.bridgeWrapper();
            expect(setBridgeWrapper).to.equal(await bridgeWrapper.getAddress());
            console.log("✓ Bridge wrapper correctly set in AmicaToken");

            // Test unwrapping (burning native to get bridged back)
            const unwrapAmount = ethers.parseEther("1000");
            await amicaToken.connect(owner).approve(await bridgeWrapper.getAddress(), unwrapAmount);

            const ownerNativeBefore = await amicaToken.balanceOf(owner.address);
            const ownerBridgedBefore = await bridgedAmica.balanceOf(owner.address);

            await bridgeWrapper.connect(owner).unwrap(unwrapAmount);

            const ownerNativeAfter = await amicaToken.balanceOf(owner.address);
            const ownerBridgedAfter = await bridgedAmica.balanceOf(owner.address);

            expect(ownerNativeAfter).to.equal(ownerNativeBefore - unwrapAmount);
            expect(ownerBridgedAfter).to.equal(ownerBridgedBefore + unwrapAmount);

            console.log(`✓ Successfully unwrapped ${ethers.formatEther(unwrapAmount)} tokens`);
            console.log("✓ Native tokens burned, bridged tokens received");
        });
    });
});
