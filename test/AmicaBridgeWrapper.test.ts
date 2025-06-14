import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("AmicaBridgeWrapper", function () {
    async function deployBridgeWrapperFixture() {
        const [owner, user1, user2] = await ethers.getSigners();
        
        // Deploy a mock bridged AMICA token (simulating bridged from Ethereum)
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const bridgedAmica = await TestERC20.deploy(
            "Bridged Amica",
            "BAMICA",
            ethers.parseEther("1000000")
        );
        
        // Deploy native AMICA token (0 supply initially)
        const AmicaToken = await ethers.getContractFactory("AmicaToken");
        const nativeAmica = await AmicaToken.deploy(owner.address);
        
        // Deploy bridge wrapper
        const AmicaBridgeWrapper = await ethers.getContractFactory("AmicaBridgeWrapper");
        const bridgeWrapper = await AmicaBridgeWrapper.deploy(
            await bridgedAmica.getAddress(),
            await nativeAmica.getAddress(),
            owner.address
        );
        
        // Set bridge wrapper in native AMICA
        await nativeAmica.setBridgeWrapper(await bridgeWrapper.getAddress());
        
        // Give users some bridged tokens
        await bridgedAmica.transfer(user1.address, ethers.parseEther("10000"));
        await bridgedAmica.transfer(user2.address, ethers.parseEther("5000"));
        
        return {
            owner,
            user1,
            user2,
            bridgedAmica,
            nativeAmica,
            bridgeWrapper
        };
    }
    
    describe("Wrapping", function () {
        it("Should wrap bridged tokens for native tokens", async function () {
            const { user1, bridgedAmica, nativeAmica, bridgeWrapper } = await loadFixture(deployBridgeWrapperFixture);
            
            const wrapAmount = ethers.parseEther("1000");
            
            // Approve bridge wrapper
            await bridgedAmica.connect(user1).approve(
                await bridgeWrapper.getAddress(),
                wrapAmount
            );
            
            // Check initial balances
            const initialBridgedBalance = await bridgedAmica.balanceOf(user1.address);
            const initialNativeBalance = await nativeAmica.balanceOf(user1.address);
            
            // Wrap tokens
            await expect(bridgeWrapper.connect(user1).wrap(wrapAmount))
                .to.emit(bridgeWrapper, "TokensWrapped")
                .withArgs(user1.address, wrapAmount);
            
            // Check final balances
            expect(await bridgedAmica.balanceOf(user1.address)).to.equal(
                initialBridgedBalance - wrapAmount
            );
            expect(await nativeAmica.balanceOf(user1.address)).to.equal(
                initialNativeBalance + wrapAmount
            );
            expect(await bridgeWrapper.bridgedBalance()).to.equal(wrapAmount);
        });
        
        it("Should fail to wrap zero amount", async function () {
            const { user1, bridgeWrapper } = await loadFixture(deployBridgeWrapperFixture);
            
            await expect(
                bridgeWrapper.connect(user1).wrap(0)
            ).to.be.revertedWith("Amount must be greater than 0");
        });
        
        it("Should fail to wrap without approval", async function () {
            const { user1, bridgeWrapper } = await loadFixture(deployBridgeWrapperFixture);
            
            await expect(
                bridgeWrapper.connect(user1).wrap(ethers.parseEther("1000"))
            ).to.be.reverted;
        });
    });
    
    describe("Unwrapping", function () {
        it("Should unwrap native tokens for bridged tokens", async function () {
            const { user1, bridgedAmica, nativeAmica, bridgeWrapper } = await loadFixture(deployBridgeWrapperFixture);
            
            const wrapAmount = ethers.parseEther("1000");
            
            // First wrap some tokens
            await bridgedAmica.connect(user1).approve(
                await bridgeWrapper.getAddress(),
                wrapAmount
            );
            await bridgeWrapper.connect(user1).wrap(wrapAmount);
            
            // Approve native tokens for burning
            await nativeAmica.connect(user1).approve(
                await bridgeWrapper.getAddress(),
                wrapAmount
            );
            
            // Unwrap tokens
            await expect(bridgeWrapper.connect(user1).unwrap(wrapAmount))
                .to.emit(bridgeWrapper, "TokensUnwrapped")
                .withArgs(user1.address, wrapAmount);
            
            // Check balances are back to original
            expect(await bridgedAmica.balanceOf(user1.address)).to.equal(
                ethers.parseEther("10000")
            );
            expect(await nativeAmica.balanceOf(user1.address)).to.equal(0);
            expect(await bridgeWrapper.bridgedBalance()).to.equal(0);
        });
        
        it("Should fail to unwrap without sufficient bridged tokens in wrapper", async function () {
            const { user1, nativeAmica, bridgeWrapper } = await loadFixture(deployBridgeWrapperFixture);
            
            // Somehow user1 has native tokens but wrapper has no bridged tokens
            // This shouldn't happen in normal operation but we test for safety
            
            await expect(
                bridgeWrapper.connect(user1).unwrap(ethers.parseEther("1000"))
            ).to.be.revertedWith("Insufficient bridged tokens");
        });
    });
    
    describe("Multi-user wrapping/unwrapping", function () {
        it("Should handle multiple users correctly", async function () {
            const { user1, user2, bridgedAmica, nativeAmica, bridgeWrapper } = await loadFixture(deployBridgeWrapperFixture);
            
            const wrapAmount1 = ethers.parseEther("1000");
            const wrapAmount2 = ethers.parseEther("500");
            
            // Both users wrap
            await bridgedAmica.connect(user1).approve(await bridgeWrapper.getAddress(), wrapAmount1);
            await bridgedAmica.connect(user2).approve(await bridgeWrapper.getAddress(), wrapAmount2);
            
            await bridgeWrapper.connect(user1).wrap(wrapAmount1);
            await bridgeWrapper.connect(user2).wrap(wrapAmount2);
            
            expect(await bridgeWrapper.bridgedBalance()).to.equal(wrapAmount1 + wrapAmount2);
            expect(await nativeAmica.totalSupply()).to.equal(wrapAmount1 + wrapAmount2);
            
            // User1 unwraps partially
            const unwrapAmount = ethers.parseEther("300");
            await nativeAmica.connect(user1).approve(await bridgeWrapper.getAddress(), unwrapAmount);
            await bridgeWrapper.connect(user1).unwrap(unwrapAmount);
            
            expect(await bridgeWrapper.bridgedBalance()).to.equal(
                wrapAmount1 + wrapAmount2 - unwrapAmount
            );
            expect(await nativeAmica.balanceOf(user1.address)).to.equal(
                wrapAmount1 - unwrapAmount
            );
        });
    });
    
    describe("Emergency functions", function () {
        it("Should allow owner to withdraw excess bridged tokens", async function () {
            const { owner, user1, bridgedAmica, bridgeWrapper } = await loadFixture(deployBridgeWrapperFixture);
            
            // Wrap some tokens
            const wrapAmount = ethers.parseEther("1000");
            await bridgedAmica.connect(user1).approve(await bridgeWrapper.getAddress(), wrapAmount);
            await bridgeWrapper.connect(user1).wrap(wrapAmount);
            
            // Somehow extra tokens end up in the wrapper (e.g., someone sends directly)
            const extraAmount = ethers.parseEther("100");
            await bridgedAmica.transfer(await bridgeWrapper.getAddress(), extraAmount);
            
            // Check balances before withdrawal
            const totalBridgedIn = await bridgeWrapper.totalBridgedIn();
            const totalBridgedOut = await bridgeWrapper.totalBridgedOut();
            const contractBalance = await bridgedAmica.balanceOf(await bridgeWrapper.getAddress());
            const requiredBalance = totalBridgedIn - totalBridgedOut;
            
            // Verify there is excess
            expect(contractBalance).to.equal(wrapAmount + extraAmount);
            expect(requiredBalance).to.equal(wrapAmount);
            expect(contractBalance).to.be.gt(requiredBalance);
            
            // Owner can only withdraw the excess
            await expect(
                bridgeWrapper.connect(owner).emergencyWithdraw(
                    await bridgedAmica.getAddress(),
                    owner.address,
                    extraAmount
                )
            ).to.emit(bridgeWrapper, "EmergencyWithdraw")
             .withArgs(await bridgedAmica.getAddress(), owner.address, extraAmount);
            
            // Cannot withdraw more than excess
            await expect(
                bridgeWrapper.connect(owner).emergencyWithdraw(
                    await bridgedAmica.getAddress(),
                    owner.address,
                    BigInt(1) // Even 1 wei more than excess should fail
                )
            ).to.be.revertedWith("Amount exceeds excess");
        });
        
        it("Should not allow non-owner to call emergency withdraw", async function () {
            const { user1, bridgedAmica, bridgeWrapper } = await loadFixture(deployBridgeWrapperFixture);
            
            await expect(
                bridgeWrapper.connect(user1).emergencyWithdraw(
                    await bridgedAmica.getAddress(),
                    user1.address,
                    ethers.parseEther("1")
                )
            ).to.be.revertedWithCustomError(bridgeWrapper, "OwnableUnauthorizedAccount");
        });
    });
});
