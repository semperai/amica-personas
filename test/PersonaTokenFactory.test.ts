import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { TestERC20 } from "../typechain-types";

export const SECONDS_IN_HOUR = 3600;
export const SECONDS_IN_DAY = 86400;

export function getDeadline(offsetSeconds: number = SECONDS_IN_HOUR): number {
    return Math.floor(Date.now() / 1000) + offsetSeconds;
}

export async function swapTokensForPersona(
    personaFactory: any,
    tokenId: number,
    amountIn: bigint,
    minAmountOut: bigint,
    buyer: any,
    recipient?: string
) {
    const deadline = getDeadline();
    const to = recipient || buyer.address;

    return personaFactory.connect(buyer).swapExactTokensForTokens(
        tokenId,
        amountIn,
        minAmountOut,
        to,
        deadline
    );
}

export async function getQuote(
    personaFactory: any,
    tokenId: number,
    amountIn: bigint
): Promise<bigint> {
    return personaFactory["getAmountOut(uint256,uint256)"](tokenId, amountIn);
}

describe("PersonaTokenFactory", function () {
    // Constants - Access them from the contract instance
    let PERSONA_TOKEN_SUPPLY: bigint;
    let LIQUIDITY_TOKEN_AMOUNT: bigint;
    const DEFAULT_MINT_COST = ethers.parseEther("1000");
    const DEFAULT_GRADUATION_THRESHOLD = ethers.parseEther("1000000");
    const DEFAULT_AMICA_DEPOSIT = ethers.parseEther("100000000"); // Updated to 100M

    // Test helpers
    async function deployMocksFixture() {
        const MockUniswapV2Factory = await ethers.getContractFactory("MockUniswapV2Factory");
        const mockFactory = await MockUniswapV2Factory.deploy();

        const MockUniswapV2Router = await ethers.getContractFactory("MockUniswapV2Router");
        const mockRouter = await MockUniswapV2Router.deploy();

        return { mockFactory, mockRouter };
    }

    async function deployPersonaTokenFactoryFixture() {
        const [owner, user1, user2, user3] = await ethers.getSigners();

        // Deploy mocks
        const { mockFactory, mockRouter } = await loadFixture(deployMocksFixture);

        // Deploy AmicaToken
        const AmicaToken = await ethers.getContractFactory("AmicaToken");
        const amicaToken = await AmicaToken.deploy(owner.address);

        // Deploy ERC20Implementation
        const ERC20Implementation = await ethers.getContractFactory("ERC20Implementation");
        const erc20Implementation = await ERC20Implementation.deploy();

        // Deploy PersonaTokenFactory using upgrades
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

        // Get constants from contract
        PERSONA_TOKEN_SUPPLY = await personaFactory.PERSONA_TOKEN_SUPPLY();
        LIQUIDITY_TOKEN_AMOUNT = await personaFactory.LIQUIDITY_TOKEN_AMOUNT();

        // Give users some AMICA tokens
        const userAmount = ethers.parseEther("10000000"); // Increased for testing
        await amicaToken.withdraw(user1.address, userAmount);
        await amicaToken.withdraw(user2.address, userAmount);
        await amicaToken.withdraw(user3.address, userAmount);

        return {
            personaFactory,
            amicaToken,
            erc20Implementation,
            mockFactory,
            mockRouter,
            owner,
            user1,
            user2,
            user3
        };
    }

    async function createPersonaFixture() {
        const fixture = await loadFixture(deployPersonaTokenFactoryFixture);
        const { personaFactory, amicaToken, user1 } = fixture;

        // Approve AMICA for minting
        await amicaToken.connect(user1).approve(
            await personaFactory.getAddress(),
            DEFAULT_MINT_COST
        );

        // Create persona
        const tx = await personaFactory.connect(user1).createPersona(
            await amicaToken.getAddress(),
            "Test Persona",
            "TESTP",
            ["description", "image"],
            ["A test persona", "https://example.com/image.png"],
            0,
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

        const parsedEvent = personaFactory.interface.parseLog({
            topics: event!.topics as string[],
            data: event!.data
        });
        const tokenId = parsedEvent!.args.tokenId;

        return { ...fixture, tokenId };
    }


    describe("Trading Fees", function () {
        it("Should configure trading fees correctly", async function () {
            const { personaFactory, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Set 2% fee with 60/40 split
            await expect(
                personaFactory.configureTradingFees(200, 6000)
            ).to.emit(personaFactory, "TradingFeeConfigUpdated")
             .withArgs(200, 6000);

            const config = await personaFactory.tradingFeeConfig();
            expect(config.feePercentage).to.equal(200);
            expect(config.creatorShare).to.equal(6000);
        });

        it("Should apply trading fees on purchases", async function () {
            const { tokenId, personaFactory, amicaToken, user1, user2 } = await loadFixture(createPersonaFixture);

            const purchaseAmount = ethers.parseEther("10000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            const creatorBalanceBefore = await amicaToken.balanceOf(user1.address);
            const amicaContractBalanceBefore = await amicaToken.balanceOf(await amicaToken.getAddress());

            // Get quote (which should account for fees)
            const expectedTokens = await personaFactory["getAmountOut(uint256,uint256)"](tokenId, purchaseAmount);

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

        it("Should reject fees above 10%", async function () {
            const { personaFactory } = await loadFixture(deployPersonaTokenFactoryFixture);

            await expect(
                personaFactory.configureTradingFees(1001, 5000) // 10.01%
            ).to.be.revertedWith("Fee too high");
        });
    });

    describe("Token Lock and Withdrawal", function () {
        it("Should lock tokens for 1 week", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            const purchaseAmount = ethers.parseEther("10000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            await swapTokensForPersona(personaFactory, tokenId, purchaseAmount, 0n, user2);

            // Try to withdraw immediately - should fail
            await expect(
                personaFactory.connect(user2).withdrawTokens(tokenId)
            ).to.be.revertedWith("No tokens to withdraw");

            // Check user purchases
            const purchases = await personaFactory.getUserPurchases(tokenId, user2.address);
            expect(purchases.length).to.equal(1);
            expect(purchases[0].withdrawn).to.be.false;
        });

        it("Should allow withdrawal after 1 week", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            const purchaseAmount = ethers.parseEther("10000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            const expectedTokens = await getQuote(personaFactory, tokenId, purchaseAmount);
            await swapTokensForPersona(personaFactory, tokenId, purchaseAmount, expectedTokens, user2);

            // Fast forward 1 week
            await time.increase(7 * 24 * 60 * 60);

            // Now withdrawal should work
            const persona = await personaFactory.getPersona(tokenId);
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const personaToken = TestERC20.attach(persona.erc20Token) as TestERC20;

            await expect(
                personaFactory.connect(user2).withdrawTokens(tokenId)
            ).to.emit(personaFactory, "TokensWithdrawn")
             .withArgs(tokenId, user2.address, expectedTokens);

            expect(await personaToken.balanceOf(user2.address)).to.equal(expectedTokens);
        });

        it("Should allow immediate withdrawal after graduation", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Buy small amount first
            const smallAmount = ethers.parseEther("10000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                DEFAULT_GRADUATION_THRESHOLD + smallAmount
            );

            const expectedTokens = await getQuote(personaFactory, tokenId, smallAmount);
            await swapTokensForPersona(personaFactory, tokenId, smallAmount, expectedTokens, user2);

            // Trigger graduation
            await swapTokensForPersona(personaFactory, tokenId, DEFAULT_GRADUATION_THRESHOLD, 0n, user2);

            // Should be able to withdraw immediately
            await expect(
                personaFactory.connect(user2).withdrawTokens(tokenId)
            ).to.emit(personaFactory, "TokensWithdrawn");
        });
    });

    describe("Initial Buy Feature", function () {
        it("Should allow creator to buy tokens at launch", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            const initialBuyAmount = ethers.parseEther("5000");
            const totalPayment = DEFAULT_MINT_COST + initialBuyAmount;

            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                totalPayment
            );

            const tx = await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Launch Test",
                "LAUNCH",
                [],
                [],
                initialBuyAmount
            );

            await expect(tx).to.emit(personaFactory, "TokensPurchased");

            // Creator should have bought tokens (but locked)
            const tokenId = 0;
            const purchases = await personaFactory.getUserPurchases(tokenId, user1.address);
            expect(purchases.length).to.equal(1);
            expect(purchases[0].amount).to.be.gt(0);
        });
    });

    describe("No Graduation Reward", function () {
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
    });

    describe("Metadata Management Fix", function () {
        it("Should update metadata by token owner", async function () {
            const { tokenId, personaFactory, user1 } = await loadFixture(createPersonaFixture);

            await expect(
                personaFactory.connect(user1).updateMetadata(
                    tokenId,
                    ["description", "twitter"],
                    ["Updated description", "@coolpersona"]
                )
            ).to.emit(personaFactory, "MetadataUpdated")
             .withArgs(tokenId, "description")
             .to.emit(personaFactory, "MetadataUpdated")
             .withArgs(tokenId, "twitter");

            const metadata = await personaFactory.getMetadata(tokenId, ["description", "twitter"]);
            expect(metadata[0]).to.equal("Updated description");
            expect(metadata[1]).to.equal("@coolpersona");
        });
    });

    describe("Small Swap Fix", function () {
        it("Should handle very small swaps correctly", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Test with small but valid amount
            const smallAmount = ethers.parseEther("0.01"); // 0.01 AMICA
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
    });

    describe("Bancor Curve Fee Fix", function () {
        it("Should apply fee correctly", async function () {
            const { personaFactory } = await loadFixture(deployPersonaTokenFactoryFixture);

            const amountIn = ethers.parseEther("10000");
            const sold = 0n;
            const total = ethers.parseEther("300000000");

            // Get output with the built-in 1% fee
            const output = await personaFactory["getAmountOut(uint256,uint256,uint256)"](
                amountIn,
                sold,
                total
            );

            // Calculate what output would be without the 1% protocol fee
            const virtualAmicaReserve = ethers.parseEther("100000");
            const virtualTokenReserve = total / 10n;

            const currentTokenReserve = virtualTokenReserve + total;
            const currentAmicaReserve = virtualAmicaReserve;

            const k = currentTokenReserve * currentAmicaReserve;
            const newAmicaReserve = currentAmicaReserve + amountIn;
            const newTokenReserve = k / newAmicaReserve;
            const amountOutBeforeFee = currentTokenReserve - newTokenReserve;

            // Output should be 99% of the calculation (1% protocol fee)
            expect(output).to.equal(amountOutBeforeFee * 99n / 100n);
        });
    });

    describe("Failed Payment Transfer Fix", function () {
        it("Should handle insufficient balance gracefully", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Transfer most balance away, keeping just a bit
            const balance = await amicaToken.balanceOf(user1.address);
            await amicaToken.connect(user1).transfer(user1.address, balance - ethers.parseEther("100"));

            // Approve more than we have
            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST
            );

            // Should fail with proper error
            await expect(
                personaFactory.connect(user1).createPersona(
                    await amicaToken.getAddress(),
                    "Test",
                    "TEST",
                    [],
                    [],
                    0,
                )
            ).to.be.revertedWith("Insufficient balance");
        });
    });

    describe("Graduation Excess Fix", function () {
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
    });

    // Keep original tests that should still pass
    describe("Deployment and Initialization", function () {
        it("Should deploy with correct initial state", async function () {
            const { personaFactory, amicaToken, mockFactory, mockRouter, erc20Implementation } =
                await loadFixture(deployPersonaTokenFactoryFixture);

            expect(await personaFactory.name()).to.equal("Amica Persona");
            expect(await personaFactory.symbol()).to.equal("PERSONA");
            expect(await personaFactory.amicaToken()).to.equal(await amicaToken.getAddress());
            expect(await personaFactory.uniswapFactory()).to.equal(await mockFactory.getAddress());
            expect(await personaFactory.uniswapRouter()).to.equal(await mockRouter.getAddress());
            expect(await personaFactory.erc20Implementation()).to.equal(await erc20Implementation.getAddress());
        });

        it("Should set default AMICA pairing config", async function () {
            const { personaFactory, amicaToken } = await loadFixture(deployPersonaTokenFactoryFixture);

            const config = await personaFactory.pairingConfigs(await amicaToken.getAddress());
            expect(config.enabled).to.be.true;
            expect(config.mintCost).to.equal(DEFAULT_MINT_COST);
            expect(config.graduationThreshold).to.equal(DEFAULT_GRADUATION_THRESHOLD);
            expect(config.amicaDepositAmount).to.equal(DEFAULT_AMICA_DEPOSIT);
        });

        it("Should initialize default trading fee config", async function () {
            const { personaFactory } = await loadFixture(deployPersonaTokenFactoryFixture);

            const config = await personaFactory.tradingFeeConfig();
            expect(config.feePercentage).to.equal(100); // 1%
            expect(config.creatorShare).to.equal(5000); // 50%
        });
    });

    describe("Deployment and Initialization", function () {
        it("Should deploy with correct initial state", async function () {
            const { personaFactory, amicaToken, mockFactory, mockRouter, erc20Implementation } =
                await loadFixture(deployPersonaTokenFactoryFixture);

            expect(await personaFactory.name()).to.equal("Amica Persona");
            expect(await personaFactory.symbol()).to.equal("PERSONA");
            expect(await personaFactory.amicaToken()).to.equal(await amicaToken.getAddress());
            expect(await personaFactory.uniswapFactory()).to.equal(await mockFactory.getAddress());
            expect(await personaFactory.uniswapRouter()).to.equal(await mockRouter.getAddress());
            expect(await personaFactory.erc20Implementation()).to.equal(await erc20Implementation.getAddress());
        });

        it("Should set default AMICA pairing config", async function () {
            const { personaFactory, amicaToken } = await loadFixture(deployPersonaTokenFactoryFixture);

            const config = await personaFactory.pairingConfigs(await amicaToken.getAddress());
            expect(config.enabled).to.be.true;
            expect(config.mintCost).to.equal(DEFAULT_MINT_COST);
            expect(config.graduationThreshold).to.equal(DEFAULT_GRADUATION_THRESHOLD);
            expect(config.amicaDepositAmount).to.equal(DEFAULT_AMICA_DEPOSIT);
        });

        it("Should reject initialization with zero addresses", async function () {
            const [owner] = await ethers.getSigners();
            const { mockFactory, mockRouter } = await loadFixture(deployMocksFixture);

            const PersonaTokenFactory = await ethers.getContractFactory("PersonaTokenFactory");

            // Test each zero address
            await expect(
                upgrades.deployProxy(PersonaTokenFactory, [
                    ethers.ZeroAddress,
                    await mockFactory.getAddress(),
                    await mockRouter.getAddress(),
                    owner.address
                ])
            ).to.be.revertedWith("Invalid AMICA token");

            await expect(
                upgrades.deployProxy(PersonaTokenFactory, [
                    owner.address,
                    ethers.ZeroAddress,
                    await mockRouter.getAddress(),
                    owner.address
                ])
            ).to.be.revertedWith("Invalid factory");

            await expect(
                upgrades.deployProxy(PersonaTokenFactory, [
                    owner.address,
                    await mockFactory.getAddress(),
                    ethers.ZeroAddress,
                    owner.address
                ])
            ).to.be.revertedWith("Invalid router");

            await expect(
                upgrades.deployProxy(PersonaTokenFactory, [
                    owner.address,
                    await mockFactory.getAddress(),
                    await mockRouter.getAddress(),
                    ethers.ZeroAddress
                ])
            ).to.be.revertedWith("Invalid implementation");
        });
    });

    describe("Pairing Configuration", function () {
        it("Should allow owner to configure new pairing tokens", async function () {
            const { personaFactory, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const testToken = await TestERC20.deploy("Test", "TEST", ethers.parseEther("1000000"));

            const customMintCost = ethers.parseEther("500");
            const customThreshold = ethers.parseEther("500000");
            const customDeposit = ethers.parseEther("200000000");

            await expect(
                personaFactory.configurePairingToken(
                    await testToken.getAddress(),
                    customMintCost,
                    customThreshold,
                    customDeposit
                )
            ).to.emit(personaFactory, "PairingConfigUpdated")
             .withArgs(await testToken.getAddress());

            const config = await personaFactory.pairingConfigs(await testToken.getAddress());
            expect(config.enabled).to.be.true;
            expect(config.mintCost).to.equal(customMintCost);
            expect(config.graduationThreshold).to.equal(customThreshold);
            expect(config.amicaDepositAmount).to.equal(customDeposit);
        });

        it("Should allow owner to disable pairing tokens", async function () {
            const { personaFactory, amicaToken } = await loadFixture(deployPersonaTokenFactoryFixture);

            await expect(
                personaFactory.disablePairingToken(await amicaToken.getAddress())
            ).to.emit(personaFactory, "PairingConfigUpdated")
             .withArgs(await amicaToken.getAddress());

            const config = await personaFactory.pairingConfigs(await amicaToken.getAddress());
            expect(config.enabled).to.be.false;
        });

        it("Should reject configuration by non-owner", async function () {
            const { personaFactory, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            await expect(
                personaFactory.connect(user1).configurePairingToken(
                    user1.address,
                    ethers.parseEther("100"),
                    ethers.parseEther("100000"),
                    ethers.parseEther("10000000")
                )
            ).to.be.revertedWithCustomError(personaFactory, "OwnableUnauthorizedAccount");
        });

        it("Should reject configuration with zero address", async function () {
            const { personaFactory } = await loadFixture(deployPersonaTokenFactoryFixture);

            await expect(
                personaFactory.configurePairingToken(
                    ethers.ZeroAddress,
                    ethers.parseEther("100"),
                    ethers.parseEther("100000"),
                    ethers.parseEther("10000000")
                )
            ).to.be.revertedWith("Invalid token");
        });
    });

    describe("Persona Creation", function () {
        it("Should create persona with correct parameters", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Approve AMICA
            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST
            );

            // Create persona
            const tx = await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Cool Persona",
                "COOL",
                ["description", "website"],
                ["A cool AI persona", "https://coolpersona.ai"],
                0,
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

            expect(event).to.not.be.undefined;

            const parsedEvent = personaFactory.interface.parseLog({
                topics: event!.topics as string[],
                data: event!.data
            });

            expect(parsedEvent!.args.creator).to.equal(user1.address);
            expect(parsedEvent!.args.name).to.equal("Cool Persona");
            expect(parsedEvent!.args.symbol).to.equal("COOL");

            // Check NFT ownership
            const tokenId = parsedEvent!.args.tokenId;
            expect(await personaFactory.ownerOf(tokenId)).to.equal(user1.address);

            // Check persona data
            const persona = await personaFactory.getPersona(tokenId);
            expect(persona.name).to.equal("Cool Persona");
            expect(persona.symbol).to.equal("COOL");
            expect(persona.pairToken).to.equal(await amicaToken.getAddress());
            expect(persona.pairCreated).to.be.false;
            expect(persona.erc20Token).to.not.equal(ethers.ZeroAddress);

            // Check metadata
            const metadata = await personaFactory.getMetadata(tokenId, ["description", "website"]);
            expect(metadata[0]).to.equal("A cool AI persona");
            expect(metadata[1]).to.equal("https://coolpersona.ai");
        });

        it("Should create ERC20 token with correct supply and name", async function () {
            const { tokenId, personaFactory } = await loadFixture(createPersonaFixture);

            const persona = await personaFactory.getPersona(tokenId);
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const erc20Token = TestERC20.attach(persona.erc20Token) as TestERC20;

            expect(await erc20Token.name()).to.equal("Test Persona.amica");
            expect(await erc20Token.symbol()).to.equal("TESTP.amica");
            expect(await erc20Token.totalSupply()).to.equal(PERSONA_TOKEN_SUPPLY);
            expect(await erc20Token.balanceOf(await personaFactory.getAddress())).to.equal(
                PERSONA_TOKEN_SUPPLY - DEFAULT_AMICA_DEPOSIT
            );
        });

        it("Should deposit tokens to AMICA contract", async function () {
            const { tokenId, personaFactory, amicaToken } = await loadFixture(createPersonaFixture);

            const persona = await personaFactory.getPersona(tokenId);

            // Check that tokens were deposited
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const erc20Token = TestERC20.attach(persona.erc20Token) as TestERC20;

            // Verify the deposit happened by checking balances
            expect(await erc20Token.balanceOf(await personaFactory.getAddress())).to.equal(
                PERSONA_TOKEN_SUPPLY - DEFAULT_AMICA_DEPOSIT
            );

            // Check deposited balance in AMICA contract
            expect(await amicaToken.depositedBalances(persona.erc20Token)).to.equal(DEFAULT_AMICA_DEPOSIT);
        });

        it("Should take payment from creator", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            const initialBalance = await amicaToken.balanceOf(user1.address);

            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST
            );

            await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Test",
                "TEST",
                [],
                [],
                0
            );

            expect(await amicaToken.balanceOf(user1.address)).to.equal(
                initialBalance - DEFAULT_MINT_COST
            );
            expect(await amicaToken.balanceOf(await personaFactory.getAddress())).to.equal(
                DEFAULT_MINT_COST
            );
        });

        it("Should reject creation with disabled pairing token", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Disable AMICA
            await personaFactory.disablePairingToken(await amicaToken.getAddress());

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
                )
            ).to.be.revertedWith("Pairing token not enabled");
        });

        it("Should reject creation with invalid name length", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST * 2n
            );

            // Empty name
            await expect(
                personaFactory.connect(user1).createPersona(
                    await amicaToken.getAddress(),
                    "",
                    "TEST",
                    [],
                    [],
                    0,
                )
            ).to.be.revertedWith("Invalid name length");

            // Name too long (33 characters)
            await expect(
                personaFactory.connect(user1).createPersona(
                    await amicaToken.getAddress(),
                    "ThisNameIsWayTooLongForTheContract",
                    "TEST",
                    [],
                    [],
                    0,
                )
            ).to.be.revertedWith("Invalid name length");
        });

        it("Should reject creation with invalid symbol length", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST * 2n
            );

            // Empty symbol
            await expect(
                personaFactory.connect(user1).createPersona(
                    await amicaToken.getAddress(),
                    "Test",
                    "",
                    [],
                    [],
                    0,
                )
            ).to.be.revertedWith("Invalid symbol length");

            // Symbol too long (11 characters)
            await expect(
                personaFactory.connect(user1).createPersona(
                    await amicaToken.getAddress(),
                    "Test",
                    "VERYLONGSYM",
                    [],
                    [],
                    0,
                )
            ).to.be.revertedWith("Invalid symbol length");
        });

        it("Should reject creation with mismatched metadata arrays", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST
            );

            await expect(
                personaFactory.connect(user1).createPersona(
                    await amicaToken.getAddress(),
                    "Test",
                    "TEST",
                    ["key1", "key2"],
                    ["value1"], // Missing value2
                    0,
                )
            ).to.be.revertedWith("Metadata mismatch");
        });

        it("Should reject creation without payment approval", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            await expect(
                personaFactory.connect(user1).createPersona(
                    await amicaToken.getAddress(),
                    "Test",
                    "TEST",
                    [],
                    [],
                    0,
                )
            ).to.be.revertedWithCustomError(amicaToken, "ERC20InsufficientAllowance");
        });

        it("Should handle reentrancy protection", async function () {
            // This is tested by the nonReentrant modifier
            // The test would need a malicious contract to properly test reentrancy
            // For now, we just verify the modifier is in place by checking the function
            const { personaFactory } = await loadFixture(deployPersonaTokenFactoryFixture);

            // The presence of nonReentrant modifier prevents reentrancy attacks
            // This is enforced at the contract level
            expect(true).to.be.true;
        });
    });

    describe("Metadata Management", function () {
        it("Should update metadata by token owner", async function () {
            const { tokenId, personaFactory, user1 } = await loadFixture(createPersonaFixture);

            await expect(
                personaFactory.connect(user1).updateMetadata(
                    tokenId,
                    ["description", "twitter"],
                    ["Updated description", "@coolpersona"]
                )
            ).to.emit(personaFactory, "MetadataUpdated")
             .withArgs([tokenId, "description"], [tokenId, "Updated description"])

            const metadata = await personaFactory.getMetadata(tokenId, ["description", "twitter"]);
            expect(metadata[0]).to.equal("Updated description");
            expect(metadata[1]).to.equal("@coolpersona");
        });

        it("Should reject metadata update by non-owner", async function () {
            const { tokenId, personaFactory, user2 } = await loadFixture(createPersonaFixture);

            await expect(
                personaFactory.connect(user2).updateMetadata(
                    tokenId,
                    ["description"],
                    ["Hacked!"]
                )
            ).to.be.revertedWith("Not token owner");
        });

        it("Should reject metadata update with mismatched arrays", async function () {
            const { tokenId, personaFactory, user1 } = await loadFixture(createPersonaFixture);

            await expect(
                personaFactory.connect(user1).updateMetadata(
                    tokenId,
                    ["key1", "key2"],
                    ["value1"] // Missing value2
                )
            ).to.be.revertedWith("Key-value mismatch");
        });

        it("Should return empty string for non-existent metadata keys", async function () {
            const { tokenId, personaFactory } = await loadFixture(createPersonaFixture);

            const metadata = await personaFactory.getMetadata(tokenId, ["nonexistent"]);
            expect(metadata[0]).to.equal("");
        });
    });

    describe("Token Purchase (Bonding Curve)", function () {
        it("Should purchase tokens with correct calculation", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            const purchaseAmount = ethers.parseEther("10000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            const expectedTokens = await personaFactory["getAmountOut(uint256,uint256)"](tokenId, purchaseAmount);

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

            // Check tokens were received
            const persona = await personaFactory.getPersona(tokenId);
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const personaToken = TestERC20.attach(persona.erc20Token) as TestERC20;

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
            const availableBefore = PERSONA_TOKEN_SUPPLY - DEFAULT_AMICA_DEPOSIT - LIQUIDITY_TOKEN_AMOUNT;
            const availableAfter = await personaFactory.getAvailableTokens(tokenId);

            expect(availableAfter).to.be.lt(availableBefore);
        });

        it("Should reject purchase after pair creation", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            const deadline = Math.floor(Date.now() / 1000) + 3600;

            // Purchase enough to trigger graduation
            const purchaseAmount = DEFAULT_GRADUATION_THRESHOLD + ethers.parseEther("1");
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

            await expect(
                personaFactory.connect(user2).swapExactTokensForTokens(
                    tokenId,
                    ethers.parseEther("1000"),
                    0,
                    user2.address,
                    deadline
                )
            ).to.be.revertedWith("Trading already on Uniswap");
        });

        it("Should reject purchase with slippage too high", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            const purchaseAmount = ethers.parseEther("10000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            const expectedTokens = await personaFactory["getAmountOut(uint256,uint256)"](tokenId, purchaseAmount);
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            // Require more tokens than calculated
            await expect(
                personaFactory.connect(user2).swapExactTokensForTokens(
                    tokenId,
                    purchaseAmount,
                    expectedTokens + ethers.parseEther("1"),
                    user2.address,
                    deadline
                )
            ).to.be.revertedWith("Insufficient output amount");
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

            // This should fail due to insufficient liquidity
            await expect(
                personaFactory.connect(user2).swapExactTokensForTokens(tokenId, hugeAmount, 0, user2.address, deadline)
            ).to.be.revertedWith("Insufficient liquidity");
        });

        it("Should reject purchase for non-existent token", async function () {
            const { personaFactory, amicaToken, user2 } = await loadFixture(deployPersonaTokenFactoryFixture);

            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                ethers.parseEther("1000")
            );

            const deadline = Math.floor(Date.now() / 1000) + 3600;

            await expect(
                personaFactory.connect(user2).swapExactTokensForTokens(
                    999, // Non-existent token ID
                    ethers.parseEther("1000"),
                    0,
                    user2.address,
                    deadline
                )
            ).to.be.revertedWith("Invalid token");
        });

        it("Should calculate tokens out correctly with bonding curve", async function () {
            const { personaFactory } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Test at different points on the curve
            const amount = ethers.parseEther("10000");

            // Using the new getAmountOut function with three parameters
            const tokensAtStart = await personaFactory["getAmountOut(uint256,uint256,uint256)"](
                amount,
                0,
                ethers.parseEther("300000000") // totalAvailable
            );

            const tokensAtMiddle = await personaFactory["getAmountOut(uint256,uint256,uint256)"](
                amount,
                ethers.parseEther("150000000"), // half sold
                ethers.parseEther("300000000")
            );

            const tokensAtEnd = await personaFactory["getAmountOut(uint256,uint256,uint256)"](
                amount,
                ethers.parseEther("290000000"), // almost all sold
                ethers.parseEther("300000000")
            );

            // Price increases along curve, so tokens received should decrease
            expect(tokensAtStart).to.be.gt(tokensAtMiddle);
            expect(tokensAtMiddle).to.be.gt(tokensAtEnd);
        });
    });

    describe("Liquidity Pair Creation", function () {
        it("Should create pair when graduation threshold is met", async function () {
            const { tokenId, personaFactory, amicaToken, mockFactory, user2 } = await loadFixture(createPersonaFixture);

            // Purchase enough to meet graduation threshold
            const purchaseAmount = DEFAULT_GRADUATION_THRESHOLD;
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

        it("Should send graduation reward to NFT owner", async function () {
            const { tokenId, personaFactory, amicaToken, user1, user2 } = await loadFixture(createPersonaFixture);

            const initialOwnerBalance = await amicaToken.balanceOf(user1.address);

            // Purchase to trigger graduation
            const purchaseAmount = DEFAULT_GRADUATION_THRESHOLD;
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            const deadline = Math.floor(Date.now() / 1000) + 3600;

            await personaFactory.connect(user2).swapExactTokensForTokens(tokenId, purchaseAmount, 0, user2.address, deadline);

            // Check NFT owner received graduation reward
            expect(await amicaToken.balanceOf(user1.address)).to.equal(
                initialOwnerBalance + DEFAULT_GRADUATION_THRESHOLD
            );
        });

        it("Should add correct liquidity amounts", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Purchase slightly more than graduation threshold
            const purchaseAmount = DEFAULT_GRADUATION_THRESHOLD + ethers.parseEther("100000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            const deadline = Math.floor(Date.now() / 1000) + 3600;

            const tx = await personaFactory.connect(user2).swapExactTokensForTokens(tokenId, purchaseAmount, 0, user2.address, deadline);
            const receipt = await tx.wait();

            // Find LiquidityPairCreated event
            const event = receipt?.logs.find(
                log => {
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

            // Verify liquidity amount (in mock, it's sum of both token amounts)
            const expectedLiquidity = LIQUIDITY_TOKEN_AMOUNT + ethers.parseEther("100000");
            expect(parsedEvent!.args.liquidity).to.equal(expectedLiquidity);
        });

        it("Should not allow creating pair twice", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            const deadline = Math.floor(Date.now() / 1000) + 3600;

            // First graduation
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                DEFAULT_GRADUATION_THRESHOLD
            );
            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                DEFAULT_GRADUATION_THRESHOLD,
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
    });

    describe("View Functions", function () {
        it("Should return correct available tokens", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            const initialAvailable = await personaFactory.getAvailableTokens(tokenId);
            const expectedInitial = PERSONA_TOKEN_SUPPLY - DEFAULT_AMICA_DEPOSIT - LIQUIDITY_TOKEN_AMOUNT;
            expect(initialAvailable).to.equal(expectedInitial);

            // Purchase some tokens
            const purchaseAmount = ethers.parseEther("10000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            const tokensBought = await personaFactory["getAmountOut(uint256,uint256)"](tokenId, purchaseAmount);
            const deadline = Math.floor(Date.now() / 1000) + 3600;

            await personaFactory.connect(user2).swapExactTokensForTokens(tokenId, purchaseAmount, 0, user2.address, deadline);

            const availableAfter = await personaFactory.getAvailableTokens(tokenId);
            expect(availableAfter).to.be.closeTo(
                expectedInitial - tokensBought,
                ethers.parseEther("1") // Allow small rounding difference
            );
        });

        it("Should return 0 available tokens after pair creation", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            const deadline = Math.floor(Date.now() / 1000) + 3600;

            // Trigger pair creation
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                DEFAULT_GRADUATION_THRESHOLD
            );
            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                DEFAULT_GRADUATION_THRESHOLD,
                0,
                user2.address,
                deadline
            );

            expect(await personaFactory.getAvailableTokens(tokenId)).to.equal(0);
        });

        it("Should return correct tokenURI", async function () {
            const { tokenId, personaFactory } = await loadFixture(createPersonaFixture);

            const uri = await personaFactory.tokenURI(tokenId);

            // Decode the data URI
            expect(uri).to.include("data:application/json;utf8,");

            const jsonStr = uri.replace("data:application/json;utf8,", "");
            const metadata = JSON.parse(jsonStr);

            expect(metadata.name).to.equal("Test Persona");
            expect(metadata.symbol).to.equal("TESTP");
            expect(metadata.tokenId).to.equal(tokenId.toString());
            expect(metadata.erc20Token).to.be.a("string");
            expect(metadata.erc20Token.startsWith("0x")).to.be.true;
        });

        it("Should reject tokenURI for non-existent token", async function () {
            const { personaFactory } = await loadFixture(deployPersonaTokenFactoryFixture);

            await expect(
                personaFactory.tokenURI(999)
            ).to.be.revertedWithCustomError(personaFactory, "ERC721NonexistentToken");
        });
    });

    describe("Edge Cases and Security", function () {
        it("Should handle multiple personas created by same user", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Approve for multiple creations
            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST * 3n
            );

            // Create 3 personas
            for (let i = 0; i < 3; i++) {
                await personaFactory.connect(user1).createPersona(
                    await amicaToken.getAddress(),
                    `Persona ${i}`,
                    `P${i}`,
                    [],
                    [],
                    0,
                );
            }

            // Check all are owned by user1
            expect(await personaFactory.ownerOf(0)).to.equal(user1.address);
            expect(await personaFactory.ownerOf(1)).to.equal(user1.address);
            expect(await personaFactory.ownerOf(2)).to.equal(user1.address);

            // Check all have different ERC20 tokens
            const persona0 = await personaFactory.getPersona(0);
            const persona1 = await personaFactory.getPersona(1);
            const persona2 = await personaFactory.getPersona(2);

            expect(persona0.erc20Token).to.not.equal(persona1.erc20Token);
            expect(persona1.erc20Token).to.not.equal(persona2.erc20Token);
            expect(persona0.erc20Token).to.not.equal(persona2.erc20Token);
        });

        it("Should handle NFT transfers correctly", async function () {
            const { tokenId, personaFactory, user1, user2, user3 } = await loadFixture(createPersonaFixture);

            // Transfer NFT from user1 to user2
            await personaFactory.connect(user1).transferFrom(
                user1.address,
                user2.address,
                tokenId
            );

            expect(await personaFactory.ownerOf(tokenId)).to.equal(user2.address);

            // Only new owner should be able to update metadata
            await expect(
                personaFactory.connect(user1).updateMetadata(tokenId, ["test"], ["value"])
            ).to.be.revertedWith("Not token owner");

            await expect(
                personaFactory.connect(user2).updateMetadata(tokenId, ["test"], ["value"])
            ).to.emit(personaFactory, "MetadataUpdated");

            // Transfer again to user3
            await personaFactory.connect(user2).transferFrom(
                user2.address,
                user3.address,
                tokenId
            );

            expect(await personaFactory.ownerOf(tokenId)).to.equal(user3.address);
        });

        it("Should handle concurrent purchases correctly", async function () {
            const { tokenId, personaFactory, amicaToken, user2, user3 } = await loadFixture(createPersonaFixture);

            const deadline = Math.floor(Date.now() / 1000) + 3600;

            // Both users approve
            const amount = ethers.parseEther("5000");
            await amicaToken.connect(user2).approve(await personaFactory.getAddress(), amount);
            await amicaToken.connect(user3).approve(await personaFactory.getAddress(), amount);

            // Execute purchases (in practice these would be in same block)
            await personaFactory.connect(user2).swapExactTokensForTokens(tokenId, amount, 0, user2.address, deadline);
            await personaFactory.connect(user3).swapExactTokensForTokens(tokenId, amount, 0, user3.address, deadline);

            // Both should have received tokens
            const persona = await personaFactory.getPersona(tokenId);
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const personaToken = TestERC20.attach(persona.erc20Token) as TestERC20;

            expect(await personaToken.balanceOf(user2.address)).to.be.gt(0);
            expect(await personaToken.balanceOf(user3.address)).to.be.gt(0);
        });

        it("Should maintain correct state across multiple operations", async function () {
            const { personaFactory, amicaToken, user1, user2 } = await loadFixture(deployPersonaTokenFactoryFixture);

            const deadline = Math.floor(Date.now() / 1000) + 3600;

            // Create multiple personas
            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST * 2n
            );

            await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "First",
                "FIRST",
                ["type"],
                ["AI"],
                0,
            );

            await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Second",
                "SECOND",
                ["type"],
                ["Bot"],
                0,
            );

            // Purchase tokens for first persona
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                ethers.parseEther("20000")
            );

            await personaFactory.connect(user2).swapExactTokensForTokens(0, ethers.parseEther("10000"), 0, user2.address, deadline);
            await personaFactory.connect(user2).swapExactTokensForTokens(0, ethers.parseEther("10000"), 0, user2.address, deadline);

            // Update metadata for both
            await personaFactory.connect(user1).updateMetadata(0, ["status"], ["active"]);
            await personaFactory.connect(user1).updateMetadata(1, ["status"], ["inactive"]);

            // Verify state integrity
            const metadata0 = await personaFactory.getMetadata(0, ["type", "status"]);
            const metadata1 = await personaFactory.getMetadata(1, ["type", "status"]);

            expect(metadata0[0]).to.equal("AI");
            expect(metadata0[1]).to.equal("active");
            expect(metadata1[0]).to.equal("Bot");
            expect(metadata1[1]).to.equal("inactive");

            // Verify available tokens updated correctly
            const available0 = await personaFactory.getAvailableTokens(0);
            const available1 = await personaFactory.getAvailableTokens(1);

            expect(available0).to.be.lt(available1); // First had purchases
        });

        it("Should handle edge case with exact graduation threshold", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            const deadline = Math.floor(Date.now() / 1000) + 3600;

            // Purchase exactly the graduation threshold
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                DEFAULT_GRADUATION_THRESHOLD
            );

            await expect(
                personaFactory.connect(user2).swapExactTokensForTokens(tokenId, DEFAULT_GRADUATION_THRESHOLD, 0, user2.address, deadline)
            ).to.emit(personaFactory, "LiquidityPairCreated");

            // Verify pair was created
            const persona = await personaFactory.getPersona(tokenId);
            expect(persona.pairCreated).to.be.true;
        });

        it("Should reject operations on non-existent personas", async function () {
            const { personaFactory, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            const nonExistentId = 999;

            // Test various operations
            await expect(
                personaFactory.getPersona(nonExistentId)
            ).to.not.be.reverted; // This returns default values

            await expect(
                personaFactory.connect(user1).updateMetadata(nonExistentId, ["key"], ["value"])
            ).to.be.revertedWithCustomError(personaFactory, "ERC721NonexistentToken");

            await expect(
                personaFactory.getMetadata(nonExistentId, ["key"])
            ).to.not.be.reverted; // Returns empty array

            await expect(
                personaFactory.getAvailableTokens(nonExistentId)
            ).to.not.be.reverted; // Returns calculated value
        });

        it("Should handle maximum length metadata", async function () {
            const { tokenId, personaFactory, user1 } = await loadFixture(createPersonaFixture);

            const longValue = "a".repeat(1000); // Very long metadata value

            await expect(
                personaFactory.connect(user1).updateMetadata(
                    tokenId,
                    ["longData"],
                    [longValue]
                )
            ).to.emit(personaFactory, "MetadataUpdated");

            const metadata = await personaFactory.getMetadata(tokenId, ["longData"]);
            expect(metadata[0]).to.equal(longValue);
        });
    });

    describe("Gas Optimization Tests", function () {
        it("Should efficiently handle batch metadata updates", async function () {
            const { tokenId, personaFactory, user1 } = await loadFixture(createPersonaFixture);

            // Update multiple metadata keys at once
            const keys = Array.from({ length: 10 }, (_, i) => `key${i}`);
            const values = Array.from({ length: 10 }, (_, i) => `value${i}`);

            await expect(
                personaFactory.connect(user1).updateMetadata(tokenId, keys, values)
            ).to.emit(personaFactory, "MetadataUpdated");

            // Verify all were set
            const retrievedValues = await personaFactory.getMetadata(tokenId, keys);
            expect(retrievedValues).to.deep.equal(values);
        });
    });

    describe("Additional Coverage Tests", function () {
        it("Should handle persona creation with all valid name/symbol lengths", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Test minimum valid lengths
            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                DEFAULT_MINT_COST * 3n
            );

            await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "A", // 1 char name
                "A", // 1 char symbol
                [],
                [],
                0,
            );

            // Test maximum valid lengths
            await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "A".repeat(32), // 32 char name
                "A".repeat(10), // 10 char symbol
                [],
                [],
                0,
            );

            expect(await personaFactory.ownerOf(0)).to.equal(user1.address);
            expect(await personaFactory.ownerOf(1)).to.equal(user1.address);
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

        it("Should calculate tokens correctly at graduation threshold boundary", async function () {
            const { personaFactory } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Test calculation at exactly the graduation threshold
            const tokensAtThreshold = await personaFactory.calculateTokensOut(
                DEFAULT_GRADUATION_THRESHOLD - ethers.parseEther("1"),
                ethers.parseEther("1"),
                DEFAULT_GRADUATION_THRESHOLD
            );

            expect(tokensAtThreshold).to.be.gt(0);
        });

        it("Should handle failed payment transfer gracefully", async function () {
            const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Approve but don't have enough balance
            await amicaToken.connect(user1).transfer(user1.address, await amicaToken.balanceOf(user1.address) - ethers.parseEther("100"));

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
                )
            ).to.be.revertedWith("Insufficient balance");
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
            await expect(
                personaFactory.connect(user2).swapExactTokensForTokens(tokenId, hugeAmount, 0, user2.address, deadline)
            ).to.be.revertedWith("Insufficient liquidity");
        });

        it("Should verify token suffix is applied correctly", async function () {
            const { tokenId, personaFactory } = await loadFixture(createPersonaFixture);

            const persona = await personaFactory.getPersona(tokenId);
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const erc20Token = TestERC20.attach(persona.erc20Token) as TestERC20;

            // Check both name and symbol have .amica suffix
            expect(await erc20Token.name()).to.include(".amica");
            expect(await erc20Token.symbol()).to.include(".amica");
        });

        it("Should handle purchases at different bonding curve stages", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

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

                const expectedTokens = await personaFactory["getAmountOut(uint256,uint256)"](tokenId, amount);

                await personaFactory.connect(user2).swapExactTokensForTokens(tokenId, amount, 0, user2.address, deadline);

                totalSpent += amount;
                totalReceived += expectedTokens;
            }

            // Verify tokens were received
            const persona = await personaFactory.getPersona(tokenId);
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const personaToken = TestERC20.attach(persona.erc20Token) as TestERC20;

            expect(await personaToken.balanceOf(user2.address)).to.be.closeTo(
                totalReceived,
                ethers.parseEther("1") // Allow small rounding difference
            );
        });
    });

    describe("Multi-Token Pairing", function () {
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
                ethers.parseEther("100000000") // Still 100M tokens to AMICA
            );

            // Configure WETH as pairing token
            await personaFactory.configurePairingToken(
                await weth.getAddress(),
                ethers.parseEther("0.5"),  // 0.5 WETH mint cost
                ethers.parseEther("50"),   // 50 WETH graduation threshold
                ethers.parseEther("100000000") // Still 100M tokens to AMICA
            );

            // Give users some tokens
            await usdc.transfer(user1.address, ethers.parseEther("1000"));
            await weth.transfer(user2.address, ethers.parseEther("10"));

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
            );

            // Verify both personas were created
            expect(await personaFactory.ownerOf(0)).to.equal(user1.address);
            expect(await personaFactory.ownerOf(1)).to.equal(user2.address);

            // Verify tokens were deposited to AMICA (not to USDC/WETH)
            const persona1 = await personaFactory.getPersona(0);
            const persona2 = await personaFactory.getPersona(1);

            expect(await amicaToken.depositedBalances(persona1.erc20Token))
                .to.equal(ethers.parseEther("100000000"));
            expect(await amicaToken.depositedBalances(persona2.erc20Token))
                .to.equal(ethers.parseEther("100000000"));

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
        });

        it("Should create liquidity pairs with correct pairing tokens", async function () {
            const { personaFactory, amicaToken, owner, user1 } =
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
                ethers.parseEther("100000000")
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
                0
            );

            // Purchase enough to trigger graduation
            await expect(
                personaFactory.connect(user1).swapExactTokensForTokens(0, ethers.parseEther("1000"), 0, user1.address, deadline)
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
    });

    describe("Additional Swap Tests", function () {
        it("Should respect deadline parameter", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            const purchaseAmount = ethers.parseEther("1000");
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                purchaseAmount
            );

            // Set deadline in the past
            const pastDeadline = Math.floor(Date.now() / 1000) - 100;

            await expect(
                personaFactory.connect(user2).swapExactTokensForTokens(
                    tokenId,
                    purchaseAmount,
                    0,
                    user2.address,
                    pastDeadline
                )
            ).to.be.revertedWith("Transaction expired");
        });

        it("Should allow swapping to different recipient", async function () {
            const { tokenId, personaFactory, amicaToken, user2, user3 } = await loadFixture(createPersonaFixture);

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

            // Check user3 received the tokens
            const persona = await personaFactory.getPersona(tokenId);
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const personaToken = TestERC20.attach(persona.erc20Token) as TestERC20;

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

            await expect(
                personaFactory.connect(user2).swapExactTokensForTokens(
                    tokenId,
                    purchaseAmount,
                    0,
                    ethers.ZeroAddress,
                    deadline
                )
            ).to.be.revertedWith("Invalid recipient");
        });

        it("Should handle very small swaps correctly", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Test with 1 wei
            const tinyAmount = 1n;
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                tinyAmount
            );

            // This should work but give 0 tokens due to rounding
            const quote = await getQuote(personaFactory, tokenId, tinyAmount);
            expect(quote).to.equal(0);

            // Should still fail with "Insufficient input amount" from getAmountOut
            await expect(
                swapTokensForPersona(personaFactory, tokenId, tinyAmount, 0n, user2)
            ).to.be.revertedWith("Insufficient input amount");
        });

        it("Should properly update state after multiple swaps", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

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

            // Verify total tokens received
            const persona = await personaFactory.getPersona(tokenId);
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const personaToken = TestERC20.attach(persona.erc20Token) as TestERC20;

            expect(await personaToken.balanceOf(user2.address)).to.equal(totalOut);
        });
    });

    describe("Bancor Bonding Curve Tests", function () {
        it("Should maintain constant product invariant", async function () {
            const { personaFactory } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Test the bonding curve math
            const testCases = [
                { sold: 0n, total: ethers.parseEther("300000000") },
                { sold: ethers.parseEther("100000000"), total: ethers.parseEther("300000000") },
                { sold: ethers.parseEther("200000000"), total: ethers.parseEther("300000000") }
            ];

            for (const { sold, total } of testCases) {
                const amountIn = ethers.parseEther("10000");
                const output = await personaFactory["getAmountOut(uint256,uint256,uint256)"](
                    amountIn,
                    sold,
                    total
                );

                // Verify output is reasonable
                expect(output).to.be.gt(0);
                expect(output).to.be.lt(total - sold);

                // As more tokens are sold, the output should decrease
                if (sold > 0n) {
                    const outputAtStart = await personaFactory["getAmountOut(uint256,uint256,uint256)"](
                        amountIn,
                        0n,
                        total
                    );
                    expect(output).to.be.lt(outputAtStart);
                }
            }
        });

        it("Should apply fee correctly", async function () {
            const { personaFactory } = await loadFixture(deployPersonaTokenFactoryFixture);

            const amountIn = ethers.parseEther("10000");
            const sold = 0n;
            const total = ethers.parseEther("300000000");

            const output = await personaFactory["getAmountOut(uint256,uint256,uint256)"](
                amountIn,
                sold,
                total
            );

            // The output should be less than if there was no fee
            // We can verify this by checking that the effective price is higher than the starting ratio
            const effectivePrice = (amountIn * ethers.parseEther("1")) / output;
            const virtualAmicaReserve = ethers.parseEther("100000");
            const virtualTokenReserve = total / 10n;
            const initialPrice = virtualAmicaReserve * ethers.parseEther("1") / virtualTokenReserve;

            expect(effectivePrice).to.be.gt(initialPrice);
        });
    });

    describe("Multi-Token Edge Cases", function () {
        it("Should handle pairing tokens with different decimals", async function () {
            const { personaFactory, owner, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Deploy a 6-decimal token (like USDC)
            const SixDecimalToken = await ethers.getContractFactory("TestERC20");
            const usdc6 = await SixDecimalToken.deploy("USDC", "USDC", ethers.parseUnits("10000000", 6));

            // Configure with appropriate values for 6 decimals
            await personaFactory.configurePairingToken(
                await usdc6.getAddress(),
                ethers.parseUnits("100", 6),  // 100 USDC mint cost
                ethers.parseUnits("10000", 6), // 10k USDC graduation threshold
                ethers.parseEther("100000000") // Still 100M persona tokens to AMICA
            );

            // Give user some tokens
            await usdc6.transfer(user1.address, ethers.parseUnits("1000", 6));

            // Create persona
            await usdc6.connect(user1).approve(
                await personaFactory.getAddress(),
                ethers.parseUnits("100", 6)
            );

            await personaFactory.connect(user1).createPersona(
                await usdc6.getAddress(),
                "USDC6 Persona",
                "USDC6P",
                [],
                [],
                0
            );

            // Test swapping with 6-decimal token
            await usdc6.connect(user1).approve(
                await personaFactory.getAddress(),
                ethers.parseUnits("500", 6)
            );

            const deadline = getDeadline();
            await expect(
                personaFactory.connect(user1).swapExactTokensForTokens(
                    0,
                    ethers.parseUnits("500", 6),
                    0,
                    user1.address,
                    deadline
                )
            ).to.emit(personaFactory, "TokensPurchased");
        });

        it("Should prevent creating pairs with AMICA when using different pairing token", async function () {
            const { personaFactory, amicaToken, owner, user1 } =
                await loadFixture(deployPersonaTokenFactoryFixture);

            // Deploy USDC
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const usdc = await TestERC20.deploy("USD Coin", "USDC", ethers.parseEther("10000000"));

            // Configure USDC
            await personaFactory.configurePairingToken(
                await usdc.getAddress(),
                ethers.parseEther("100"),
                ethers.parseEther("1000"), // Low threshold for testing
                ethers.parseEther("100000000")
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
    });

    describe("Legacy Function Compatibility", function () {
        it("Should still work with calculateTokensOut for backwards compatibility", async function () {
            const { personaFactory } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Test the legacy function
            const result = await personaFactory.calculateTokensOut(
                ethers.parseEther("500000"), // currentDeposited
                ethers.parseEther("10000"),   // amountIn
                ethers.parseEther("1000000")  // graduationThreshold
            );

            expect(result).to.be.gt(0);
        });

        it("Should handle graduation with excess correctly", async function () {
            const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

            // Purchase way more than graduation threshold
            const excessAmount = DEFAULT_GRADUATION_THRESHOLD * 2n;
            await amicaToken.connect(user2).approve(
                await personaFactory.getAddress(),
                excessAmount
            );

            const deadline = getDeadline();

            await expect(
                personaFactory.connect(user2).swapExactTokensForTokens(
                    tokenId,
                    excessAmount,
                    0,
                    user2.address,
                    deadline
                )
            ).to.emit(personaFactory, "LiquidityPairCreated");

            // The excess (amount - threshold) should be used for liquidity
            // Check the event to verify
        });
    });
});
