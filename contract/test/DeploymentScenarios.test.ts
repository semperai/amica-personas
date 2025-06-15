import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import {
    deployAmicaTokenFixture,
    deployAmicaTokenMainnetMockFixture,
    setupCrossChainScenario
} from "./shared/fixtures";

describe("Multi-chain Deployment Scenarios", function () {
    const TOTAL_SUPPLY = ethers.parseEther("1000000000");

    describe("Scenario 1: Fresh deployment on Ethereum mainnet", function () {
        it("Should deploy with initial supply minted to contract", async function () {
            const { amicaToken } = await loadFixture(deployAmicaTokenMainnetMockFixture);

            // Verify initial state
            expect(await amicaToken.totalSupply()).to.equal(TOTAL_SUPPLY);
            expect(await amicaToken.balanceOf(await amicaToken.getAddress())).to.equal(TOTAL_SUPPLY);
            expect(await amicaToken.circulatingSupply()).to.equal(0);

            // Bridge wrapper should not be set on mainnet
            expect(await amicaToken.bridgeWrapper()).to.equal(ethers.ZeroAddress);
        });
    });

    describe("Scenario 2: Fresh deployment on L2 (Arbitrum/Optimism/Base)", function () {
        it("Should deploy with zero supply on L2", async function () {
            const [owner] = await ethers.getSigners();

            // Deploy fresh AmicaToken without any setup
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const amicaToken = await upgrades.deployProxy(
                AmicaToken,
                [owner.address],
                { initializer: "initialize" }
            );

            // Verify initial state
            expect(await amicaToken.totalSupply()).to.equal(0);
            expect(await amicaToken.balanceOf(await amicaToken.getAddress())).to.equal(0);
            expect(await amicaToken.circulatingSupply()).to.equal(0);
        });

        it("Should set up bridge wrapper and enable minting", async function () {
            const { l2AmicaToken, bridgedAmica, bridgeWrapper, user1 } = await loadFixture(setupCrossChainScenario);

            // Test minting through wrapper
            await bridgedAmica.transfer(user1.address, ethers.parseEther("1000"));
            await bridgedAmica.connect(user1).approve(
                await bridgeWrapper.getAddress(),
                ethers.parseEther("1000")
            );

            await bridgeWrapper.connect(user1).wrap(ethers.parseEther("1000"));

            // Verify
            expect(await l2AmicaToken.balanceOf(user1.address)).to.equal(ethers.parseEther("1000"));
            expect(await l2AmicaToken.totalSupply()).to.equal(ethers.parseEther("1000"));
        });
    });

    describe("Scenario 3: User journey - Mainnet to L2 and back", function () {
        it("Should handle complete user flow", async function () {
            const { l2AmicaToken, bridgedAmica, bridgeWrapper, user1 } = await loadFixture(setupCrossChainScenario);
            const [, , , recipient] = await ethers.getSigners();

            // Step 1: User has bridged AMICA on L2 (simulating they bridged from mainnet)
            const mainnetBalance = ethers.parseEther("50000");
            await bridgedAmica.transfer(user1.address, mainnetBalance);

            // Step 2: User converts bridged to native L2 AMICA
            await bridgedAmica.connect(user1).approve(
                await bridgeWrapper.getAddress(),
                mainnetBalance
            );
            await bridgeWrapper.connect(user1).wrap(mainnetBalance);

            expect(await l2AmicaToken.balanceOf(user1.address)).to.equal(mainnetBalance);
            expect(await bridgedAmica.balanceOf(user1.address)).to.equal(0);

            // Step 3: User uses AMICA on L2 (e.g., creates personas, trades, etc.)
            // Simulate some usage - transfer to another user
            await l2AmicaToken.connect(user1).transfer(recipient.address, ethers.parseEther("10000"));

            // Step 4: User converts back to bridged for mainnet return
            const remainingBalance = ethers.parseEther("40000");
            await l2AmicaToken.connect(user1).approve(
                await bridgeWrapper.getAddress(),
                remainingBalance
            );
            await bridgeWrapper.connect(user1).unwrap(remainingBalance);

            // Verify final state
            expect(await l2AmicaToken.balanceOf(user1.address)).to.equal(0);
            expect(await bridgedAmica.balanceOf(user1.address)).to.equal(remainingBalance);

            // User would then bridge back to mainnet using native bridge
        });
    });

    describe("Scenario 4: Multiple L2s deployment", function () {
        it("Should deploy independently on multiple L2s", async function () {
            const [owner, user] = await ethers.getSigners();

            // Deploy on multiple L2s using upgradeable pattern
            const AmicaToken = await ethers.getContractFactory("AmicaToken");

            const arbitrumAmica = await upgrades.deployProxy(
                AmicaToken,
                [owner.address],
                { initializer: "initialize" }
            );

            const optimismAmica = await upgrades.deployProxy(
                AmicaToken,
                [owner.address],
                { initializer: "initialize" }
            );

            const baseAmica = await upgrades.deployProxy(
                AmicaToken,
                [owner.address],
                { initializer: "initialize" }
            );

            // Each starts with zero supply
            expect(await arbitrumAmica.totalSupply()).to.equal(0);
            expect(await optimismAmica.totalSupply()).to.equal(0);
            expect(await baseAmica.totalSupply()).to.equal(0);

            // Each can have its own bridge wrapper
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");

            // Arbitrum bridge wrapper
            const arbBridgedAmica = await TestERC20.deploy("Arb Bridged Amica", "arbAMICA", TOTAL_SUPPLY);
            const arbBridgeWrapper = await AmicaBridgeWrapper.deploy(
                await arbBridgedAmica.getAddress(),
                await arbitrumAmica.getAddress(),
                owner.address
            );
            await arbitrumAmica.setBridgeWrapper(await arbBridgeWrapper.getAddress());

            // Test each works independently
            await arbBridgedAmica.transfer(user.address, ethers.parseEther("1000"));
            await arbBridgedAmica.connect(user).approve(
                await arbBridgeWrapper.getAddress(),
                ethers.parseEther("1000")
            );
            await arbBridgeWrapper.connect(user).wrap(ethers.parseEther("1000"));

            // Only Arbitrum should have supply
            expect(await arbitrumAmica.totalSupply()).to.equal(ethers.parseEther("1000"));
            expect(await optimismAmica.totalSupply()).to.equal(0);
            expect(await baseAmica.totalSupply()).to.equal(0);
        });
    });

    describe("Scenario 5: Security considerations", function () {
        it("Should prevent unauthorized minting on L2", async function () {
            const [owner, attacker] = await ethers.getSigners();

            // Deploy fresh token without bridge wrapper
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const amicaToken = await upgrades.deployProxy(
                AmicaToken,
                [owner.address],
                { initializer: "initialize" }
            );

            // Attacker tries to mint without being bridge wrapper
            await expect(
                amicaToken.connect(attacker).mint(attacker.address, ethers.parseEther("1000000"))
            ).to.be.revertedWith("Only bridge wrapper can mint");

            // Even owner cannot mint directly
            await expect(
                amicaToken.mint(owner.address, ethers.parseEther("1000"))
            ).to.be.revertedWith("Only bridge wrapper can mint");
        });

        it("Should ensure 1:1 backing between bridged and native tokens", async function () {
            const [owner, user1, user2] = await ethers.getSigners();

            // Deploy fresh setup for this test
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const amicaToken = await upgrades.deployProxy(
                AmicaToken,
                [owner.address],
                { initializer: "initialize" }
            );

            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const bridgedAmica = await TestERC20.deploy("Bridged Amica", "BAMICA", ethers.parseEther("1000"));

            const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");
            const bridgeWrapper = await AmicaBridgeWrapper.deploy(
                await bridgedAmica.getAddress(),
                await amicaToken.getAddress(),
                owner.address
            );

            await amicaToken.setBridgeWrapper(await bridgeWrapper.getAddress());

            // Give users bridged tokens
            await bridgedAmica.transfer(user1.address, ethers.parseEther("600"));
            await bridgedAmica.transfer(user2.address, ethers.parseEther("400"));

            // Both wrap their tokens
            await bridgedAmica.connect(user1).approve(
                await bridgeWrapper.getAddress(),
                ethers.parseEther("600")
            );
            await bridgeWrapper.connect(user1).wrap(ethers.parseEther("600"));

            await bridgedAmica.connect(user2).approve(
                await bridgeWrapper.getAddress(),
                ethers.parseEther("400")
            );
            await bridgeWrapper.connect(user2).wrap(ethers.parseEther("400"));

            // Verify 1:1 backing
            expect(await bridgeWrapper.totalBridgedIn()).to.equal(ethers.parseEther("1000"));
            expect(await amicaToken.totalSupply()).to.equal(ethers.parseEther("1000"));
            expect(await bridgeWrapper.bridgedBalance()).to.equal(ethers.parseEther("1000"));

            // User1 unwraps some
            await amicaToken.connect(user1).approve(
                await bridgeWrapper.getAddress(),
                ethers.parseEther("200")
            );
            await bridgeWrapper.connect(user1).unwrap(ethers.parseEther("200"));

            // Verify backing is maintained
            expect(await bridgeWrapper.totalBridgedIn()).to.equal(ethers.parseEther("1000"));
            expect(await bridgeWrapper.totalBridgedOut()).to.equal(ethers.parseEther("200"));
            expect(await amicaToken.totalSupply()).to.equal(ethers.parseEther("800"));
            expect(await bridgeWrapper.bridgedBalance()).to.equal(ethers.parseEther("800"));
        });
    });

    describe("Scenario 6: Integration with PersonaTokenFactory on L2", function () {
        it("Should work seamlessly with PersonaTokenFactory", async function () {
            const { amicaToken, user1 } = await loadFixture(deployAmicaTokenFixture);
            const [owner] = await ethers.getSigners();

            // Deploy PersonaTokenFactory infrastructure
            const MockUniswapV2Factory = await ethers.getContractFactory("MockUniswapV2Factory");
            const mockFactory = await MockUniswapV2Factory.deploy();

            const MockUniswapV2Router = await ethers.getContractFactory("MockUniswapV2Router");
            const mockRouter = await MockUniswapV2Router.deploy();

            const ERC20Implementation = await ethers.getContractFactory("ERC20Implementation");
            const erc20Implementation = await ERC20Implementation.deploy();

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

            // User creates a persona using their L2 AMICA
            await amicaToken.connect(user1).approve(
                await personaFactory.getAddress(),
                ethers.parseEther("1000")
            );

            await expect(
                personaFactory.connect(user1).createPersona(
                    await amicaToken.getAddress(),
                    "L2 Persona",
                    "L2P",
                    [],
                    [],
                    0,
                    ethers.ZeroAddress,
                    0
                )
            ).to.emit(personaFactory, "PersonaCreated");

            // Verify AMICA was transferred
            expect(await amicaToken.balanceOf(user1.address)).to.equal(
                ethers.parseEther("10000") - ethers.parseEther("1000")
            );
        });
    });
});
