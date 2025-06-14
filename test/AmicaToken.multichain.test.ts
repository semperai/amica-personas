import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, network } from "hardhat";

describe("AmicaToken Multi-chain Behavior", function () {
    const TOTAL_SUPPLY = ethers.parseEther("1000000000");

    async function deployAmicaTokenFixture() {
        const [owner, user1, user2] = await ethers.getSigners();
        const AmicaToken = await ethers.getContractFactory("AmicaToken");
        const amicaToken = await AmicaToken.deploy(owner.address);
        return { amicaToken, owner, user1, user2 };
    }

    describe("Mainnet Behavior (chainId = 1)", function () {
        before(async function () {
            // Fork mainnet or set chainId to 1
            await network.provider.request({
                method: "hardhat_reset",
                params: [{
                    forking: {
                        jsonRpcUrl: process.env.MAINNET_RPC_URL || "https://eth-mainnet.alchemyapi.io/v2/your-api-key",
                        blockNumber: 19000000, // Recent mainnet block
                    },
                    chainId: 1
                }]
            });
        });

        after(async function () {
            // Reset back to hardhat network
            await network.provider.request({
                method: "hardhat_reset",
                params: []
            });
        });

        it("Should mint total supply to contract on mainnet", async function () {
            const { amicaToken } = await loadFixture(deployAmicaTokenFixture);
            
            // On mainnet, total supply should be minted to the contract
            expect(await amicaToken.totalSupply()).to.equal(TOTAL_SUPPLY);
            expect(await amicaToken.balanceOf(await amicaToken.getAddress())).to.equal(TOTAL_SUPPLY);
        });

        it("Should allow withdraw on mainnet", async function () {
            const { amicaToken, owner, user1 } = await loadFixture(deployAmicaTokenFixture);
            
            const withdrawAmount = ethers.parseEther("10000");
            
            await expect(amicaToken.withdraw(user1.address, withdrawAmount))
                .to.emit(amicaToken, "TokensWithdrawn")
                .withArgs(user1.address, withdrawAmount);
                
            expect(await amicaToken.balanceOf(user1.address)).to.equal(withdrawAmount);
        });

        it("Should reject mint calls on mainnet", async function () {
            const { amicaToken, owner } = await loadFixture(deployAmicaTokenFixture);
            
            // Even if we set a bridge wrapper, mint should fail on mainnet
            const mockBridgeWrapper = owner.address;
            await amicaToken.setBridgeWrapper(mockBridgeWrapper);
            
            await expect(
                amicaToken.mint(owner.address, ethers.parseEther("1000"))
            ).to.be.revertedWith("Cannot mint on mainnet");
        });

        it("Should handle burn and claim correctly on mainnet", async function () {
            const { amicaToken, owner, user1 } = await loadFixture(deployAmicaTokenFixture);
            
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
            const { amicaToken } = await loadFixture(deployAmicaTokenFixture);
            
            // On non-mainnet, should start with 0 supply
            expect(await amicaToken.totalSupply()).to.equal(0);
            expect(await amicaToken.balanceOf(await amicaToken.getAddress())).to.equal(0);
        });

        it("Should only allow minting through bridge wrapper on non-mainnet", async function () {
            const { amicaToken, owner, user1 } = await loadFixture(deployAmicaTokenFixture);
            
            // Try to mint without bridge wrapper - should fail
            await expect(
                amicaToken.mint(user1.address, ethers.parseEther("1000"))
            ).to.be.revertedWith("Only bridge wrapper can mint");
            
            // Set bridge wrapper
            await amicaToken.setBridgeWrapper(owner.address);
            
            // Now owner (acting as bridge wrapper) can mint
            await expect(
                amicaToken.mint(user1.address, ethers.parseEther("1000"))
            ).to.emit(amicaToken, "Transfer")
             .withArgs(ethers.ZeroAddress, user1.address, ethers.parseEther("1000"));
             
            expect(await amicaToken.balanceOf(user1.address)).to.equal(ethers.parseEther("1000"));
            expect(await amicaToken.totalSupply()).to.equal(ethers.parseEther("1000"));
        });

        it("Should integrate with bridge wrapper correctly", async function () {
            const { amicaToken, owner, user1 } = await loadFixture(deployAmicaTokenFixture);
            
            // Deploy bridge wrapper components
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const bridgedAmica = await TestERC20.deploy("Bridged Amica", "BAMICA", ethers.parseEther("1000000"));
            
            const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");
            const bridgeWrapper = await AmicaBridgeWrapper.deploy(
                await bridgedAmica.getAddress(),
                await amicaToken.getAddress(),
                owner.address
            );
            
            // Set bridge wrapper
            await amicaToken.setBridgeWrapper(await bridgeWrapper.getAddress());
            
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
            expect(await amicaToken.balanceOf(user1.address)).to.equal(ethers.parseEther("10000"));
            expect(await amicaToken.totalSupply()).to.equal(ethers.parseEther("10000"));
        });

        it("Should reject withdraw on non-mainnet when contract has no balance", async function () {
            const { amicaToken, owner, user1 } = await loadFixture(deployAmicaTokenFixture);
            
            // Contract has 0 balance on non-mainnet
            await expect(
                amicaToken.withdraw(user1.address, ethers.parseEther("1000"))
            ).to.be.revertedWith("Insufficient balance");
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
            
            await expect(
                amicaToken.setBridgeWrapper(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid wrapper address");
        });

        it("Should emit event when bridge wrapper is set", async function () {
            const { amicaToken, owner } = await loadFixture(deployAmicaTokenFixture);
            
            await expect(amicaToken.setBridgeWrapper(owner.address))
                .to.emit(amicaToken, "BridgeWrapperSet")
                .withArgs(owner.address);
                
            expect(await amicaToken.bridgeWrapper()).to.equal(owner.address);
        });
    });

    describe("Cross-chain Scenarios", function () {
        it("Should handle full cross-chain flow", async function () {
            // This test simulates the full flow from mainnet to L2 and back
            const [owner, user1] = await ethers.getSigners();
            
            // Step 1: Deploy on "mainnet" (we'll simulate with chainId check)
            // In reality, this would be on actual mainnet
            
            // Step 2: Deploy on L2
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const l2AmicaToken = await AmicaToken.deploy(owner.address);
            
            // Step 3: Deploy bridge wrapper on L2
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const bridgedAmica = await TestERC20.deploy("Bridged Amica", "BAMICA", ethers.parseEther("1000000"));
            
            const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");
            const bridgeWrapper = await AmicaBridgeWrapper.deploy(
                await bridgedAmica.getAddress(),
                await l2AmicaToken.getAddress(),
                owner.address
            );
            
            await l2AmicaToken.setBridgeWrapper(await bridgeWrapper.getAddress());
            
            // Step 4: User bridges from mainnet (simulated by having bridged tokens)
            await bridgedAmica.transfer(user1.address, ethers.parseEther("50000"));
            
            // Step 5: User converts to native L2 AMICA
            await bridgedAmica.connect(user1).approve(
                await bridgeWrapper.getAddress(),
                ethers.parseEther("50000")
            );
            await bridgeWrapper.connect(user1).wrap(ethers.parseEther("50000"));
            
            // Verify user has native L2 AMICA
            expect(await l2AmicaToken.balanceOf(user1.address)).to.equal(ethers.parseEther("50000"));
            
            // Step 6: User uses AMICA on L2 (deposit to PersonaFactory, etc.)
            // ... application-specific logic ...
            
            // Step 7: User bridges back to mainnet
            await l2AmicaToken.connect(user1).approve(
                await bridgeWrapper.getAddress(),
                ethers.parseEther("30000")
            );
            await bridgeWrapper.connect(user1).unwrap(ethers.parseEther("30000"));
            
            // Verify user got bridged tokens back
            expect(await bridgedAmica.balanceOf(user1.address)).to.equal(ethers.parseEther("30000"));
            expect(await l2AmicaToken.balanceOf(user1.address)).to.equal(ethers.parseEther("20000"));
        });
    });
});
