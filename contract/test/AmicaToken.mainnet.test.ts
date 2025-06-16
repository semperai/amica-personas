import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { deployAmicaTokenMainnetMockFixture } from "./shared/fixtures";

describe("AmicaToken Mainnet Behavior (Mocked)", function () {
    const TOTAL_SUPPLY = ethers.parseEther("1000000000");

    describe("Mainnet-specific behavior", function () {
        it("Should mint total supply to contract on deployment", async function () {
            const { amicaToken } = await loadFixture(deployAmicaTokenMainnetMockFixture);

            expect(await amicaToken.totalSupply()).to.equal(TOTAL_SUPPLY);
            expect(await amicaToken.balanceOf(await amicaToken.getAddress())).to.equal(TOTAL_SUPPLY);
            expect(await amicaToken.circulatingSupply()).to.equal(0); // All in contract
        });

        it("Should allow owner to withdraw on mainnet", async function () {
            const { amicaToken, owner, user1 } = await loadFixture(deployAmicaTokenMainnetMockFixture);

            const withdrawAmount = ethers.parseEther("100000");
            const initialCirculating = await amicaToken.circulatingSupply();

            await expect(amicaToken.withdraw(user1.address, withdrawAmount))
                .to.emit(amicaToken, "TokensWithdrawn")
                .withArgs(user1.address, withdrawAmount);

            expect(await amicaToken.balanceOf(user1.address)).to.equal(withdrawAmount);
            expect(await amicaToken.circulatingSupply()).to.equal(initialCirculating + withdrawAmount);
        });

        it("Should prevent minting even with bridge wrapper set on mainnet", async function () {
            const { amicaToken, owner, user1 } = await loadFixture(deployAmicaTokenMainnetMockFixture);

            // Set bridge wrapper
            await amicaToken.setBridgeWrapper(owner.address);

            // Try to mint - should fail with CannotMintOnMainnet custom error
            await expect(
                amicaToken.mint(user1.address, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(amicaToken, "CannotMintOnMainnet");
        });

        it("Should handle deposits and burn/claim on mainnet", async function () {
            const { amicaToken, owner, user1 } = await loadFixture(deployAmicaTokenMainnetMockFixture);

            // Withdraw tokens to users
            await amicaToken.withdraw(owner.address, ethers.parseEther("500000"));
            await amicaToken.withdraw(user1.address, ethers.parseEther("100000"));

            // Deploy test tokens
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const usdc = await TestERC20.deploy("USDC", "USDC", ethers.parseEther("10000000"));
            const weth = await TestERC20.deploy("WETH", "WETH", ethers.parseEther("100000"));

            // Deposit tokens
            await usdc.approve(await amicaToken.getAddress(), ethers.parseEther("1000000"));
            await weth.approve(await amicaToken.getAddress(), ethers.parseEther("10000"));

            await amicaToken.deposit(await usdc.getAddress(), ethers.parseEther("1000000"));
            await amicaToken.deposit(await weth.getAddress(), ethers.parseEther("10000"));

            // User burns and claims
            const burnAmount = ethers.parseEther("10000");
            const usdcIndex = await amicaToken.tokenIndex(await usdc.getAddress());
            const wethIndex = await amicaToken.tokenIndex(await weth.getAddress());

            const initialUsdcBalance = await usdc.balanceOf(user1.address);
            const initialWethBalance = await weth.balanceOf(user1.address);

            await amicaToken.connect(user1).burnAndClaim(burnAmount, [usdcIndex, wethIndex]);

            // Verify user received proportional tokens
            expect(await usdc.balanceOf(user1.address)).to.be.gt(initialUsdcBalance);
            expect(await weth.balanceOf(user1.address)).to.be.gt(initialWethBalance);
            expect(await amicaToken.balanceOf(user1.address)).to.equal(ethers.parseEther("90000"));
        });

        it("Should correctly calculate circulating supply on mainnet", async function () {
            const { amicaToken, owner, user1, user2 } = await loadFixture(deployAmicaTokenMainnetMockFixture);

            // Initially all tokens in contract
            expect(await amicaToken.circulatingSupply()).to.equal(0);

            // Withdraw to users
            await amicaToken.withdraw(user1.address, ethers.parseEther("100000"));
            await amicaToken.withdraw(user2.address, ethers.parseEther("200000"));

            expect(await amicaToken.circulatingSupply()).to.equal(ethers.parseEther("300000"));

            // User sends back to contract
            await amicaToken.connect(user1).transfer(await amicaToken.getAddress(), ethers.parseEther("50000"));

            expect(await amicaToken.circulatingSupply()).to.equal(ethers.parseEther("250000"));
        });

        it("Should handle edge case: all tokens withdrawn from contract", async function () {
            const { amicaToken, owner } = await loadFixture(deployAmicaTokenMainnetMockFixture);

            // Withdraw all tokens
            await amicaToken.withdraw(owner.address, TOTAL_SUPPLY);

            expect(await amicaToken.balanceOf(await amicaToken.getAddress())).to.equal(0);
            expect(await amicaToken.circulatingSupply()).to.equal(TOTAL_SUPPLY);

            // Further withdrawals should fail with InsufficientBalance custom error
            await expect(
                amicaToken.withdraw(owner.address, 1)
            ).to.be.revertedWithCustomError(amicaToken, "InsufficientBalance");
        });
    });

    describe("Mainnet integration with PersonaTokenFactory", function () {
        it("Should work correctly with PersonaTokenFactory on mainnet", async function () {
            const { amicaToken, owner, user1 } = await loadFixture(deployAmicaTokenMainnetMockFixture);

            // Deploy mocks for PersonaTokenFactory
            const MockFactory = await ethers.getContractFactory("MockUniswapV2Factory");
            const mockFactory = await MockFactory.deploy();

            const MockRouter = await ethers.getContractFactory("MockUniswapV2Router");
            const mockRouter = await MockRouter.deploy();

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

            // Withdraw AMICA to user
            await amicaToken.withdraw(user1.address, ethers.parseEther("2000000"));

            // User creates persona
            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                ethers.parseEther("1000")
            );

            await expect(
                personaFactory.connect(user1).createPersona(
                    await amicaToken.getAddress(),
                    "Test Persona",
                    "TEST",
                    [],
                    [],
                    0,
                    ethers.ZeroAddress,
                    0, // No minimum agent tokens
                )
            ).to.emit(personaFactory, "PersonaCreated");

            // Verify AMICA was transferred
            expect(await amicaToken.balanceOf(user1.address)).to.equal(
                ethers.parseEther("2000000") - ethers.parseEther("1000")
            );
        });
    });
});
