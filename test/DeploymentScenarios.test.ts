import { expect } from "chai";
import { ethers } from "hardhat";

describe("Multi-chain Deployment Scenarios", function () {
    const TOTAL_SUPPLY = ethers.parseEther("1000000000");

    describe("Scenario 1: Fresh deployment on Ethereum mainnet", function () {
        it("Should deploy with initial supply minted to contract", async function () {
            const [owner] = await ethers.getSigners();
            
            // Use the mainnet mock to simulate mainnet behavior
            const AmicaTokenMainnetMock = await ethers.getContractFactory("AmicaTokenMainnetMock");
            const amicaToken = await AmicaTokenMainnetMock.deploy(owner.address);
            
            // Verify initial state
            expect(await amicaToken.totalSupply()).to.equal(TOTAL_SUPPLY);
            expect(await amicaToken.balanceOf(await amicaToken.getAddress())).to.equal(TOTAL_SUPPLY);
            expect(await amicaToken.circulatingSupply()).to.equal(0);
            
            // Bridge wrapper should not be set
            expect(await amicaToken.bridgeWrapper()).to.equal(ethers.ZeroAddress);
        });
    });

    describe("Scenario 2: Fresh deployment on L2 (Arbitrum/Optimism/Base)", function () {
        it("Should deploy with zero supply on L2", async function () {
            const [owner] = await ethers.getSigners();
            
            // Normal deployment (not mainnet mock)
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const amicaToken = await AmicaToken.deploy(owner.address);
            
            // Verify initial state
            expect(await amicaToken.totalSupply()).to.equal(0);
            expect(await amicaToken.balanceOf(await amicaToken.getAddress())).to.equal(0);
            expect(await amicaToken.circulatingSupply()).to.equal(0);
        });

        it("Should set up bridge wrapper and enable minting", async function () {
            const [owner, user] = await ethers.getSigners();
            
            // Deploy contracts
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const amicaToken = await AmicaToken.deploy(owner.address);
            
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const bridgedAmica = await TestERC20.deploy("Bridged Amica", "BAMICA", TOTAL_SUPPLY);
            
            const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");
            const bridgeWrapper = await AmicaBridgeWrapper.deploy(
                await bridgedAmica.getAddress(),
                await amicaToken.getAddress(),
                owner.address
            );
            
            // Configure
            await amicaToken.setBridgeWrapper(await bridgeWrapper.getAddress());
            
            // Test minting through wrapper
            await bridgedAmica.transfer(user.address, ethers.parseEther("1000"));
            await bridgedAmica.connect(user).approve(
                await bridgeWrapper.getAddress(),
                ethers.parseEther("1000")
            );
            
            await bridgeWrapper.connect(user).wrap(ethers.parseEther("1000"));
            
            // Verify
            expect(await amicaToken.balanceOf(user.address)).to.equal(ethers.parseEther("1000"));
            expect(await amicaToken.totalSupply()).to.equal(ethers.parseEther("1000"));
        });
    });

    describe("Scenario 3: User journey - Mainnet to L2 and back", function () {
        it("Should handle complete user flow", async function () {
            const [owner, user] = await ethers.getSigners();
            
            // Step 1: User has AMICA on mainnet (simulated)
            const mainnetBalance = ethers.parseEther("50000");
            
            // Step 2: User bridges to L2 (in reality through native bridge)
            // This gives them bridged AMICA on L2
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const bridgedAmica = await TestERC20.deploy("Bridged Amica", "BAMICA", TOTAL_SUPPLY);
            await bridgedAmica.transfer(user.address, mainnetBalance);
            
            // Step 3: L2 setup
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const l2Amica = await AmicaToken.deploy(owner.address);
            
            const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");
            const bridgeWrapper = await AmicaBridgeWrapper.deploy(
                await bridgedAmica.getAddress(),
                await l2Amica.getAddress(),
                owner.address
            );
            
            await l2Amica.setBridgeWrapper(await bridgeWrapper.getAddress());
            
            // Step 4: User converts bridged to native L2 AMICA
            await bridgedAmica.connect(user).approve(
                await bridgeWrapper.getAddress(),
                mainnetBalance
            );
            await bridgeWrapper.connect(user).wrap(mainnetBalance);
            
            expect(await l2Amica.balanceOf(user.address)).to.equal(mainnetBalance);
            expect(await bridgedAmica.balanceOf(user.address)).to.equal(0);
            
            // Step 5: User uses AMICA on L2 (e.g., creates personas, trades, etc.)
            // Simulate some usage - transfer to another user
            const [, , recipient] = await ethers.getSigners();
            await l2Amica.connect(user).transfer(recipient.address, ethers.parseEther("10000"));
            
            // Step 6: User converts back to bridged for mainnet return
            const remainingBalance = ethers.parseEther("40000");
            await l2Amica.connect(user).approve(
                await bridgeWrapper.getAddress(),
                remainingBalance
            );
            await bridgeWrapper.connect(user).unwrap(remainingBalance);
            
            // Verify final state
            expect(await l2Amica.balanceOf(user.address)).to.equal(0);
            expect(await bridgedAmica.balanceOf(user.address)).to.equal(remainingBalance);
            
            // User would then bridge back to mainnet using native bridge
        });
    });

    describe("Scenario 4: Multiple L2s deployment", function () {
        it("Should deploy independently on multiple L2s", async function () {
            const [owner, user] = await ethers.getSigners();
            
            // Deploy on Arbitrum
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const arbitrumAmica = await AmicaToken.deploy(owner.address);
            
            // Deploy on Optimism
            const optimismAmica = await AmicaToken.deploy(owner.address);
            
            // Deploy on Base
            const baseAmica = await AmicaToken.deploy(owner.address);
            
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
            
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const amicaToken = await AmicaToken.deploy(owner.address);
            
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
            
            // Setup
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const amicaToken = await AmicaToken.deploy(owner.address);
            
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
});
