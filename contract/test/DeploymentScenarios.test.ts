import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("Multi-chain Deployment Scenarios", function () {
    const TOTAL_SUPPLY = ethers.parseEther("1000000000");

    describe("Scenario 1: Fresh deployment on Ethereum mainnet", function () {
        it("Should deploy with initial supply minted to contract", async function () {
            const [owner] = await ethers.getSigners();

            // Deploy mainnet version
            const AmicaTokenMainnetMock = await ethers.getContractFactory("AmicaTokenMainnetMock");
            const amicaToken = await upgrades.deployProxy(
                AmicaTokenMainnetMock,
                [owner.address],
                { initializer: "initialize" }
            );

            // Verify total supply is minted to contract
            expect(await amicaToken.totalSupply()).to.equal(TOTAL_SUPPLY);
            expect(await amicaToken.balanceOf(await amicaToken.getAddress())).to.equal(TOTAL_SUPPLY);
        });
    });

    describe("Scenario 2: Fresh deployment on L2 (Arbitrum/Optimism/Base)", function () {
        it("Should deploy with zero supply on L2", async function () {
            const [owner] = await ethers.getSigners();

            // Deploy L2 version
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const l2AmicaToken = await upgrades.deployProxy(
                AmicaToken,
                [owner.address],
                { initializer: "initialize" }
            );

            // Verify zero supply
            expect(await l2AmicaToken.totalSupply()).to.equal(0);
            expect(await l2AmicaToken.balanceOf(await l2AmicaToken.getAddress())).to.equal(0);
        });

        it("Should set up bridge wrapper and enable minting", async function () {
            const [owner, bridgeWrapper] = await ethers.getSigners();

            // Deploy L2 version
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const l2AmicaToken = await upgrades.deployProxy(
                AmicaToken,
                [owner.address],
                { initializer: "initialize" }
            );

            // Set bridge wrapper
            await l2AmicaToken.setBridgeWrapper(bridgeWrapper.address);
            expect(await l2AmicaToken.bridgeWrapper()).to.equal(bridgeWrapper.address);

            // Bridge wrapper can mint
            await expect(
                l2AmicaToken.connect(bridgeWrapper).mint(owner.address, ethers.parseEther("1000"))
            ).to.emit(l2AmicaToken, "Transfer");

            expect(await l2AmicaToken.balanceOf(owner.address)).to.equal(ethers.parseEther("1000"));
        });
    });

    describe("Scenario 3: User journey - Mainnet to L2 and back", function () {
        it("Should handle complete user flow", async function () {
            const [owner, user] = await ethers.getSigners();

            // 1. Deploy mainnet AMICA
            const AmicaTokenMainnetMock = await ethers.getContractFactory("AmicaTokenMainnetMock");
            const mainnetAmica = await upgrades.deployProxy(
                AmicaTokenMainnetMock,
                [owner.address],
                { initializer: "initialize" }
            );

            // 2. User gets AMICA on mainnet
            await mainnetAmica.withdraw(user.address, ethers.parseEther("10000"));

            // 3. Deploy L2 AMICA
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const l2AmicaToken = await upgrades.deployProxy(
                AmicaToken,
                [owner.address],
                { initializer: "initialize" }
            );

            // 4. Deploy bridged token (simulating the bridge)
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const bridgedAmica = await TestERC20.deploy("Bridged AMICA", "bAMICA", ethers.parseEther("10000"));
            await bridgedAmica.transfer(user.address, ethers.parseEther("10000"));

            // 5. Deploy and setup bridge wrapper
            const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");
            const bridgeWrapper = await upgrades.deployProxy(
                AmicaBridgeWrapper,
                [
                    await bridgedAmica.getAddress(),
                    await l2AmicaToken.getAddress(),
                    owner.address
                ],
                { initializer: "initialize" }
            );

            await l2AmicaToken.setBridgeWrapper(await bridgeWrapper.getAddress());

            // 6. User wraps bridged tokens to get native L2 tokens
            await bridgedAmica.connect(user).approve(
                await bridgeWrapper.getAddress(),
                ethers.parseEther("10000")
            );
            await bridgeWrapper.connect(user).wrap(ethers.parseEther("10000"));

            expect(await l2AmicaToken.balanceOf(user.address)).to.equal(ethers.parseEther("10000"));

            // 7. User unwraps some tokens to bridge back
            await l2AmicaToken.connect(user).approve(
                await bridgeWrapper.getAddress(),
                ethers.parseEther("5000")
            );
            await bridgeWrapper.connect(user).unwrap(ethers.parseEther("5000"));

            expect(await bridgedAmica.balanceOf(user.address)).to.equal(ethers.parseEther("5000"));
            expect(await l2AmicaToken.balanceOf(user.address)).to.equal(ethers.parseEther("5000"));
        });
    });

    describe("Scenario 4: Multiple L2s deployment", function () {
        it("Should deploy independently on multiple L2s", async function () {
            const [owner] = await ethers.getSigners();

            // Deploy AMICA on multiple L2s
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

            // Deploy bridged token
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const bridgedAmica = await TestERC20.deploy("Bridged AMICA", "bAMICA", ethers.parseEther("30000"));

            // Deploy bridge wrappers for each L2
            const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");

            const arbitrumWrapper = await upgrades.deployProxy(
                AmicaBridgeWrapper,
                [
                    await bridgedAmica.getAddress(),
                    await arbitrumAmica.getAddress(),
                    owner.address
                ],
                { initializer: "initialize" }
            );

            const optimismWrapper = await upgrades.deployProxy(
                AmicaBridgeWrapper,
                [
                    await bridgedAmica.getAddress(),
                    await optimismAmica.getAddress(),
                    owner.address
                ],
                { initializer: "initialize" }
            );

            const baseWrapper = await upgrades.deployProxy(
                AmicaBridgeWrapper,
                [
                    await bridgedAmica.getAddress(),
                    await baseAmica.getAddress(),
                    owner.address
                ],
                { initializer: "initialize" }
            );

            // Set bridge wrappers
            await arbitrumAmica.setBridgeWrapper(await arbitrumWrapper.getAddress());
            await optimismAmica.setBridgeWrapper(await optimismWrapper.getAddress());
            await baseAmica.setBridgeWrapper(await baseWrapper.getAddress());

            // Verify independent deployment
            expect(await arbitrumAmica.getAddress()).to.not.equal(await optimismAmica.getAddress());
            expect(await optimismAmica.getAddress()).to.not.equal(await baseAmica.getAddress());
            expect(await arbitrumWrapper.getAddress()).to.not.equal(await optimismWrapper.getAddress());
        });
    });

    describe("Scenario 5: Security considerations", function () {
        it("Should prevent unauthorized minting on L2", async function () {
            const [owner, attacker] = await ethers.getSigners();

            // Deploy L2 AMICA
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const l2AmicaToken = await upgrades.deployProxy(
                AmicaToken,
                [owner.address],
                { initializer: "initialize" }
            );

            // Attacker tries to mint without being bridge wrapper
            await expect(
                l2AmicaToken.connect(attacker).mint(attacker.address, ethers.parseEther("1000000"))
            ).to.be.revertedWith("Only bridge wrapper can mint");
        });

        it("Should ensure 1:1 backing between bridged and native tokens", async function () {
            const [owner, user1, user2, user3] = await ethers.getSigners();

            // Deploy L2 AMICA
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const l2AmicaToken = await upgrades.deployProxy(
                AmicaToken,
                [owner.address],
                { initializer: "initialize" }
            );

            // Deploy bridged token with limited supply
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const bridgedAmica = await TestERC20.deploy("Bridged AMICA", "bAMICA", ethers.parseEther("20000"));

            // Deploy bridge wrapper
            const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");
            const bridgeWrapper = await upgrades.deployProxy(
                AmicaBridgeWrapper,
                [
                    await bridgedAmica.getAddress(),
                    await l2AmicaToken.getAddress(),
                    owner.address
                ],
                { initializer: "initialize" }
            );

            await l2AmicaToken.setBridgeWrapper(await bridgeWrapper.getAddress());

            // User1 bridges all available tokens
            await bridgedAmica.transfer(user1.address, ethers.parseEther("20000"));
            await bridgedAmica.connect(user1).approve(
                await bridgeWrapper.getAddress(),
                ethers.parseEther("20000")
            );
            await bridgeWrapper.connect(user1).wrap(ethers.parseEther("20000"));

            // User1 unwraps some tokens first, reducing the wrapper's balance
            await l2AmicaToken.connect(user1).approve(
                await bridgeWrapper.getAddress(),
                ethers.parseEther("15000")
            );
            await bridgeWrapper.connect(user1).unwrap(ethers.parseEther("15000"));

            // Now wrapper has 5000 bridged tokens left
            // User1 has 5000 native tokens left

            // User1 transfers all remaining native tokens to user2
            await l2AmicaToken.connect(user1).transfer(user2.address, ethers.parseEther("5000"));

            // User2 successfully unwraps all 5000 (depleting the wrapper)
            await l2AmicaToken.connect(user2).approve(
                await bridgeWrapper.getAddress(),
                ethers.parseEther("5000")
            );
            await bridgeWrapper.connect(user2).unwrap(ethers.parseEther("5000"));

            // Now wrapper has 0 bridged tokens
            // Give user1 some bridged tokens back to test the scenario
            await bridgedAmica.connect(user2).transfer(user1.address, ethers.parseEther("1"));
            await bridgedAmica.connect(user1).approve(
                await bridgeWrapper.getAddress(),
                ethers.parseEther("1")
            );
            await bridgeWrapper.connect(user1).wrap(ethers.parseEther("1"));

            // User1 transfers their native token to user3
            await l2AmicaToken.connect(user1).transfer(user3.address, ethers.parseEther("1"));

            // User3 tries to unwrap 2 tokens but wrapper only has 1
            await l2AmicaToken.connect(user3).approve(
                await bridgeWrapper.getAddress(),
                ethers.parseEther("2")
            );

            await expect(
                bridgeWrapper.connect(user3).unwrap(ethers.parseEther("2"))
            ).to.be.revertedWith("Insufficient bridged tokens");
        });
    });

    describe("Scenario 6: Integration with PersonaTokenFactory on L2", function () {
        it("Should work seamlessly with PersonaTokenFactory", async function () {
            const [owner, user, factory] = await ethers.getSigners();

            // Deploy L2 AMICA
            const AmicaToken = await ethers.getContractFactory("AmicaToken");
            const l2AmicaToken = await upgrades.deployProxy(
                AmicaToken,
                [owner.address],
                { initializer: "initialize" }
            );

            // Deploy bridged token
            const TestERC20 = await ethers.getContractFactory("TestERC20");
            const bridgedAmica = await TestERC20.deploy("Bridged AMICA", "bAMICA", ethers.parseEther("10000"));

            // Deploy bridge wrapper
            const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");
            const bridgeWrapper = await upgrades.deployProxy(
                AmicaBridgeWrapper,
                [
                    await bridgedAmica.getAddress(),
                    await l2AmicaToken.getAddress(),
                    owner.address
                ],
                { initializer: "initialize" }
            );

            await l2AmicaToken.setBridgeWrapper(await bridgeWrapper.getAddress());

            // User gets native AMICA on L2
            await bridgedAmica.transfer(user.address, ethers.parseEther("10000"));
            await bridgedAmica.connect(user).approve(
                await bridgeWrapper.getAddress(),
                ethers.parseEther("10000")
            );
            await bridgeWrapper.connect(user).wrap(ethers.parseEther("10000"));

            // Simulate PersonaTokenFactory using AMICA for fees
            const factoryFee = ethers.parseEther("100");
            await l2AmicaToken.connect(user).transfer(factory.address, factoryFee);

            expect(await l2AmicaToken.balanceOf(factory.address)).to.equal(factoryFee);
            expect(await l2AmicaToken.balanceOf(user.address)).to.equal(
                ethers.parseEther("10000") - factoryFee
            );
        });
    });
});
