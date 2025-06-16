import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
    deployAmicaTokenFixture,
    deployAmicaTokenMainnetMockFixture,
    deployAmicaTokenWithTokensFixture,
    setupCrossChainScenario
} from "./shared/fixtures";

describe("AmicaToken Multi-chain Behavior", function () {
    const TOTAL_SUPPLY = ethers.parseEther("1000000000");

    describe("Mainnet Behavior (using mock)", function () {
        it("Should mint total supply to contract on mainnet", async function () {
            const { amicaToken } = await loadFixture(deployAmicaTokenMainnetMockFixture);

            // On mainnet, total supply should be minted to the contract
            expect(await amicaToken.totalSupply()).to.equal(TOTAL_SUPPLY);
            expect(await amicaToken.balanceOf(await amicaToken.getAddress())).to.equal(TOTAL_SUPPLY);
        });

        it("Should allow withdraw on mainnet", async function () {
            const { amicaToken, owner, user1 } = await loadFixture(deployAmicaTokenMainnetMockFixture);

            const withdrawAmount = ethers.parseEther("10000");

            await expect(amicaToken.withdraw(user1.address, withdrawAmount))
                .to.emit(amicaToken, "TokensWithdrawn")
                .withArgs(user1.address, withdrawAmount);

            expect(await amicaToken.balanceOf(user1.address)).to.equal(withdrawAmount);
        });

        it("Should reject mint calls on mainnet", async function () {
            const { amicaToken, owner } = await loadFixture(deployAmicaTokenMainnetMockFixture);

            // Even if we set a bridge wrapper, mint should fail on mainnet
            const mockBridgeWrapper = owner.address;
            await amicaToken.setBridgeWrapper(mockBridgeWrapper);

            await expect(
                amicaToken.mint(owner.address, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(amicaToken, "CannotMintOnMainnet");
        });

        it("Should handle burn and claim correctly on mainnet", async function () {
            const { amicaToken, owner, user1 } = await loadFixture(deployAmicaTokenMainnetMockFixture);

            // Withdraw some tokens to user
            await amicaToken.withdraw(user1.address, ethers.parseEther("100000"));

            // Deploy and deposit a test token
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const testToken = await TestERC20.deploy("Test", "TEST", ethers.parseEther("1000000"));

            await testToken.approve(await amicaToken.getAddress(), ethers.parseEther("100000"));
            await amicaToken.deposit(await testToken.getAddress(), ethers.parseEther("100000"));

            // Burn and claim
            const burnAmount = ethers.parseEther("10000");
            const tokenIndex = await amicaToken.tokenIndex(await testToken.getAddress());

            await expect(
                amicaToken.connect(user1).burnAndClaim(burnAmount, [tokenIndex])
            ).to.emit(amicaToken, "TokensBurnedAndClaimed");

            // Verify user received tokens
            expect(await testToken.balanceOf(user1.address)).to.be.gt(0);
        });
    });

    describe("Non-Mainnet Behavior", function () {
        it("Should start with zero supply on non-mainnet chains", async function () {
            // Deploy a fresh AmicaToken without any minting
            const [owner] = await ethers.getSigners();
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const amicaToken = await upgrades.deployProxy(
                AmicaToken,
                [owner.address],
                { initializer: "initialize" }
            );

            // On non-mainnet, should start with 0 supply
            expect(await amicaToken.totalSupply()).to.equal(0);
            expect(await amicaToken.balanceOf(await amicaToken.getAddress())).to.equal(0);
        });

        it("Should only allow minting through bridge wrapper on non-mainnet", async function () {
            // Deploy a fresh AmicaToken without setting bridge wrapper
            const [owner, user1] = await ethers.getSigners();
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const amicaToken = await upgrades.deployProxy(
                AmicaToken,
                [owner.address],
                { initializer: "initialize" }
            );

            // Try to mint without bridge wrapper - should fail
            await expect(
                amicaToken.mint(user1.address, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(amicaToken, "OnlyBridgeWrapper");

            // Set bridge wrapper
            await amicaToken.setBridgeWrapper(owner.address);

            // Now owner (acting as bridge wrapper) can mint
            await expect(
                amicaToken.mint(user1.address, ethers.parseEther("1000"))
            ).to.emit(amicaToken, "Transfer")
             .withArgs(ethers.ZeroAddress, user1.address, ethers.parseEther("1000"));
        });

        it("Should integrate with bridge wrapper correctly", async function () {
            const { l2AmicaToken, bridgedAmica, bridgeWrapper, user1 } = await loadFixture(setupCrossChainScenario);

            // Give user1 some bridged tokens
            await bridgedAmica.transfer(user1.address, ethers.parseEther("10000"));

            // User wraps bridged tokens
            await bridgedAmica.connect(user1).approve(
                await bridgeWrapper.getAddress(),
                ethers.parseEther("10000")
            );

            await expect(bridgeWrapper.connect(user1).wrap(ethers.parseEther("10000")))
                .to.emit(bridgeWrapper, "TokensWrapped")
                .withArgs(user1.address, ethers.parseEther("10000"));

            // Verify native AMICA was minted
            expect(await l2AmicaToken.balanceOf(user1.address)).to.equal(ethers.parseEther("10000"));
            expect(await l2AmicaToken.totalSupply()).to.equal(ethers.parseEther("10000"));
        });

        it("Should reject withdraw on non-mainnet when contract has no balance", async function () {
            const [owner, user1] = await ethers.getSigners();

            // Deploy fresh AmicaToken with no balance
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const amicaToken = await upgrades.deployProxy(
                AmicaToken,
                [owner.address],
                { initializer: "initialize" }
            );

            // Contract has 0 balance on non-mainnet
            await expect(
                amicaToken.withdraw(user1.address, ethers.parseEther("1000"))
            ).to.be.revertedWithCustomError(amicaToken, "InsufficientBalance");
        });
    });

    describe("Bridge Wrapper Setting", function () {
        it("Should only allow owner to set bridge wrapper", async function () {
            const { amicaToken, user1 } = await loadFixture(deployAmicaTokenFixture);

            await expect(
                amicaToken.connect(user1).setBridgeWrapper(user1.address)
            ).to.be.revertedWithCustomError(amicaToken, "OwnableUnauthorizedAccount");
        });

        it("Should reject zero address for bridge wrapper", async function () {
            const { amicaToken } = await loadFixture(deployAmicaTokenFixture);

            // First set to a valid address
            await amicaToken.setBridgeWrapper(amicaToken.owner());

            // Then try to set to zero (which should be rejected)
            await expect(
                amicaToken.setBridgeWrapper(ethers.ZeroAddress)
            ).to.be.revertedWithCustomError(amicaToken, "InvalidWrapperAddress");
        });

        it("Should emit event when bridge wrapper is set", async function () {
            const { amicaToken, owner } = await loadFixture(deployAmicaTokenFixture);

            // Use a different address than the current bridge wrapper
            const newWrapper = owner.address;

            await expect(amicaToken.setBridgeWrapper(newWrapper))
                .to.emit(amicaToken, "BridgeWrapperSet")
                .withArgs(newWrapper);

            expect(await amicaToken.bridgeWrapper()).to.equal(newWrapper);
        });
    });

    describe("Cross-chain Scenarios", function () {
        it("Should handle full cross-chain flow", async function () {
            const { l2AmicaToken, bridgedAmica, bridgeWrapper, user1 } = await loadFixture(setupCrossChainScenario);

            // Step 1: User bridges from mainnet (simulated by having bridged tokens)
            await bridgedAmica.transfer(user1.address, ethers.parseEther("50000"));

            // Step 2: User converts to native L2 AMICA
            await bridgedAmica.connect(user1).approve(
                await bridgeWrapper.getAddress(),
                ethers.parseEther("50000")
            );
            await bridgeWrapper.connect(user1).wrap(ethers.parseEther("50000"));

            // Verify user has native L2 AMICA
            expect(await l2AmicaToken.balanceOf(user1.address)).to.equal(ethers.parseEther("50000"));

            // Step 3: User uses AMICA on L2 (could integrate with PersonaFactory here)
            // ... application-specific logic ...

            // Step 4: User bridges back to mainnet
            await l2AmicaToken.connect(user1).approve(
                await bridgeWrapper.getAddress(),
                ethers.parseEther("30000")
            );
            await bridgeWrapper.connect(user1).unwrap(ethers.parseEther("30000"));

            // Verify user got bridged tokens back
            expect(await bridgedAmica.balanceOf(user1.address)).to.equal(ethers.parseEther("30000"));
            expect(await l2AmicaToken.balanceOf(user1.address)).to.equal(ethers.parseEther("20000"));
        });

        it("Should handle upgrade scenarios on both mainnet and L2", async function () {
            const [owner] = await ethers.getSigners();

            // Deploy upgradeable contracts
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const AmicaTokenMainnetMock = await ethers.getContractFactory("AmicaTokenMainnetMock");

            // Deploy on L2
            const l2Token = await upgrades.deployProxy(
                AmicaToken,
                [owner.address],
                { initializer: "initialize" }
            );

            // Deploy on mainnet (mock)
            const mainnetToken = await upgrades.deployProxy(
                AmicaTokenMainnetMock,
                [owner.address],
                { initializer: "initialize" }
            );

            // Verify both are upgradeable
            expect(await upgrades.erc1967.getImplementationAddress(await l2Token.getAddress())).to.not.equal(ethers.ZeroAddress);
            expect(await upgrades.erc1967.getImplementationAddress(await mainnetToken.getAddress())).to.not.equal(ethers.ZeroAddress);

            // Could test actual upgrades here if needed
        });
    });
});
