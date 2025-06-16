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
        ).to.be.revertedWithCustomError(personaFactory, "InvalidToken");
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
        ).to.be.revertedWithCustomError(personaFactory, "FeeTooHigh");
    });

});
