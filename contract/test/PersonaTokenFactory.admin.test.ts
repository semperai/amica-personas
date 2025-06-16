import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
    deployPersonaTokenFactoryFixture,
} from "./shared/fixtures";

describe("PersonaTokenFactory Admin", function () {
    it("Should allow owner to configure new pairing tokens", async function () {
        const { personaFactory, owner } = await loadFixture(deployPersonaTokenFactoryFixture);
        
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const testToken = await TestERC20.deploy("Test", "TEST", ethers.parseEther("1000000"));
        
        const customMintCost = ethers.parseEther("500");
        const customThreshold = ethers.parseEther("500000");
        
        await expect(
            personaFactory.connect(owner).configurePairingToken(
                await testToken.getAddress(),
                customMintCost,
                customThreshold,
            )
        ).to.emit(personaFactory, "PairingConfigUpdated")
         .withArgs(await testToken.getAddress());
        
        const config = await personaFactory.pairingConfigs(await testToken.getAddress());
        expect(config.enabled).to.be.true;
        expect(config.mintCost).to.equal(customMintCost);
        expect(config.graduationThreshold).to.equal(customThreshold);
    });
    
    it("Should allow owner to disable pairing tokens", async function () {
        const { personaFactory, amicaToken, owner } = await loadFixture(deployPersonaTokenFactoryFixture);
        
        await expect(
            personaFactory.connect(owner).disablePairingToken(await amicaToken.getAddress())
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
            )
        ).to.be.revertedWithCustomError(personaFactory, "Invalid")
         .withArgs(0); // Invalid token = 0
    });
    
    it("Should configure trading fees correctly", async function () {
        const { personaFactory, owner } = await loadFixture(deployPersonaTokenFactoryFixture);
        
        // Set 2% fee with 60/40 split
        await expect(
            personaFactory.connect(owner).configureTradingFees(200, 6000)
        ).to.emit(personaFactory, "TradingFeeConfigUpdated")
         .withArgs(200, 6000);
        
        const config = await personaFactory.tradingFeeConfig();
        expect(config.feePercentage).to.equal(200);
        expect(config.creatorShare).to.equal(6000);
    });
    
    it("Should reject fees above 10%", async function () {
        const { personaFactory, owner } = await loadFixture(deployPersonaTokenFactoryFixture);
        
        await expect(
            personaFactory.connect(owner).configureTradingFees(1001, 5000) // 10.01%
        ).to.be.revertedWithCustomError(personaFactory, "NotAllowed")
         .withArgs(8); // FeeTooHigh = 8
    });
    
    it("Should reject invalid creator share", async function () {
        const { personaFactory, owner } = await loadFixture(deployPersonaTokenFactoryFixture);
        
        await expect(
            personaFactory.connect(owner).configureTradingFees(100, 10001) // >100% share
        ).to.be.revertedWithCustomError(personaFactory, "Invalid")
         .withArgs(8); // Invalid share = 8
    });
    
    it("Should allow owner to pause and unpause", async function () {
        const { personaFactory, owner, user1, amicaToken } = await loadFixture(deployPersonaTokenFactoryFixture);
        
        // Pause the contract
        await personaFactory.connect(owner).pause();
        
        // Try to create persona while paused
        await amicaToken.connect(user1).approve(
            await personaFactory.getAddress(),
            ethers.parseEther("1000")
        );
        
        await expect(
            personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Test",
                "TEST",
                [],
                [],
                0,
                ethers.ZeroAddress,
                0
            )
        ).to.be.revertedWithCustomError(personaFactory, "EnforcedPause");
        
        // Unpause
        await personaFactory.connect(owner).unpause();
        
        // Now should work
        await expect(
            personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Test",
                "TEST",
                [],
                [],
                0,
                ethers.ZeroAddress,
                0
            )
        ).to.emit(personaFactory, "PersonaCreated");
    });
    
    it("Should configure fee reduction correctly", async function () {
        const { personaFactory, owner } = await loadFixture(deployPersonaTokenFactoryFixture);
        
        const minAmica = ethers.parseEther("5000");
        const maxAmica = ethers.parseEther("500000");
        const minMultiplier = 8000; // 80% of original fee
        const maxMultiplier = 2000; // 20% of original fee
        
        await expect(
            personaFactory.connect(owner).configureFeeReduction(
                minAmica,
                maxAmica,
                minMultiplier,
                maxMultiplier
            )
        ).to.emit(personaFactory, "FeeReductionConfigUpdated")
         .withArgs(minAmica, maxAmica, minMultiplier, maxMultiplier);
        
        const config = await personaFactory.feeReductionConfig();
        expect(config.minAmicaForReduction).to.equal(minAmica);
        expect(config.maxAmicaForReduction).to.equal(maxAmica);
        expect(config.minReductionMultiplier).to.equal(minMultiplier);
        expect(config.maxReductionMultiplier).to.equal(maxMultiplier);
    });
    
    it("Should reject invalid fee reduction config", async function () {
        const { personaFactory, owner } = await loadFixture(deployPersonaTokenFactoryFixture);
        
        // Min >= Max
        await expect(
            personaFactory.connect(owner).configureFeeReduction(
                ethers.parseEther("500000"),
                ethers.parseEther("5000"), // Max < Min
                8000,
                2000
            )
        ).to.be.revertedWithCustomError(personaFactory, "NotAllowed")
         .withArgs(10); // Invalid fee range = 10
        
        // Min multiplier > 100%
        await expect(
            personaFactory.connect(owner).configureFeeReduction(
                ethers.parseEther("5000"),
                ethers.parseEther("500000"),
                10001, // > 100%
                2000
            )
        ).to.be.revertedWithCustomError(personaFactory, "Invalid")
         .withArgs(9); // Invalid multiplier = 9
        
        // Max multiplier > Min multiplier
        await expect(
            personaFactory.connect(owner).configureFeeReduction(
                ethers.parseEther("5000"),
                ethers.parseEther("500000"),
                2000,
                8000 // Max > Min
            )
        ).to.be.revertedWithCustomError(personaFactory, "Invalid")
         .withArgs(9); // Invalid multiplier = 9
    });
    
    it("Should set staking rewards address", async function () {
        const { personaFactory, owner, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);
        
        const stakingAddress = user1.address; // Using user1 as mock staking contract
        
        await expect(
            personaFactory.connect(owner).setStakingRewards(stakingAddress)
        ).to.emit(personaFactory, "StakingRewardsSet")
         .withArgs(stakingAddress);
        
        expect(await personaFactory.stakingRewards()).to.equal(stakingAddress);
    });
    
    it("Should reject staking rewards set by non-owner", async function () {
        const { personaFactory, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);
        
        await expect(
            personaFactory.connect(user1).setStakingRewards(user1.address)
        ).to.be.revertedWithCustomError(personaFactory, "OwnableUnauthorizedAccount");
    });
});
