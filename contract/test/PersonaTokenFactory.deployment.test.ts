import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import {
    deployPersonaTokenFactoryFixture,
    deployMocksFixture,
    DEFAULT_GRADUATION_THRESHOLD,
    DEFAULT_MINT_COST,
} from "./shared/fixtures";

describe("PersonaTokenFactory Deployment", function () {
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
    });

    it("Should initialize default trading fee config", async function () {
        const { personaFactory } = await loadFixture(deployPersonaTokenFactoryFixture);

        const config = await personaFactory.tradingFeeConfig();
        expect(config.feePercentage).to.equal(100); // 1%
        expect(config.creatorShare).to.equal(5000); // 50%
    });

    it("Should reject initialization with zero addresses", async function () {
        const [owner] = await ethers.getSigners();
        const { mockFactory, mockRouter } = await loadFixture(deployMocksFixture);

        const PersonaTokenFactory = await ethers.getContractFactory("PersonaTokenFactory");

        // The contract uses a consolidated error "Invalid(0)" for invalid token addresses
        // Test each zero address
        await expect(
            upgrades.deployProxy(PersonaTokenFactory, [
                ethers.ZeroAddress,
                await mockFactory.getAddress(),
                await mockRouter.getAddress(),
                owner.address
            ])
        ).to.be.revertedWithCustomError(PersonaTokenFactory, "Invalid")
            .withArgs(0); // 0 = Invalid token

        await expect(
            upgrades.deployProxy(PersonaTokenFactory, [
                owner.address,
                ethers.ZeroAddress,
                await mockRouter.getAddress(),
                owner.address
            ])
        ).to.be.revertedWithCustomError(PersonaTokenFactory, "Invalid")
            .withArgs(0);

        await expect(
            upgrades.deployProxy(PersonaTokenFactory, [
                owner.address,
                await mockFactory.getAddress(),
                ethers.ZeroAddress,
                owner.address
            ])
        ).to.be.revertedWithCustomError(PersonaTokenFactory, "Invalid")
            .withArgs(0);

        await expect(
            upgrades.deployProxy(PersonaTokenFactory, [
                owner.address,
                await mockFactory.getAddress(),
                await mockRouter.getAddress(),
                ethers.ZeroAddress
            ])
        ).to.be.revertedWithCustomError(PersonaTokenFactory, "Invalid")
            .withArgs(0);
    });
});

describe("PersonaTokenFactory Upgrade", function () {
    it("Should maintain state after upgrade", async function () {
        const { personaFactory, amicaToken, user1, viewer } = await loadFixture(deployPersonaTokenFactoryFixture);

        // Create a persona before upgrade
        await amicaToken.connect(user1).approve(
            await personaFactory.getAddress(),
            DEFAULT_MINT_COST
        );

        await personaFactory.connect(user1).createPersona(
            await amicaToken.getAddress(),
            "Pre-Upgrade",
            "PREUP",
            [],
            [],
            0,
            ethers.ZeroAddress,
            0, // No minimum agent tokens
        );

        // Deploy new implementation
        const PersonaTokenFactoryV2 = await ethers.getContractFactory("PersonaTokenFactory");
        const newImplementation = await PersonaTokenFactoryV2.deploy();

        // Upgrade
        const upgraded = await upgrades.upgradeProxy(
            await personaFactory.getAddress(),
            PersonaTokenFactoryV2
        );

        // Verify state is maintained using the viewer contract
        // The getPersona function is now in the viewer contract
        const persona = await viewer.getPersona(0);
        expect(persona.name).to.equal("Pre-Upgrade");
        expect(persona.symbol).to.equal("PREUP");

        // Verify can still create personas
        await amicaToken.connect(user1).approve(
            await upgraded.getAddress(),
            DEFAULT_MINT_COST
        );

        await expect(
            upgraded.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Post-Upgrade",
                "POSTUP",
                [],
                [],
                0,
                ethers.ZeroAddress,
                0, // No minimum agent tokens
            )
        ).to.not.be.reverted;
    });

    it("Should reject initialization on implementation contract", async function () {
        const {
            personaFactory,
            amicaToken,
            mockFactory,
            mockRouter,
            erc20Implementation,
        } = await loadFixture(deployPersonaTokenFactoryFixture);

        // The proxy pattern prevents re-initialization
        // Expecting the transaction to be reverted without a specific error message
        await expect(
            personaFactory.initialize(
                await amicaToken.getAddress(),
                await mockFactory.getAddress(),
                await mockRouter.getAddress(),
                await erc20Implementation.getAddress()
            )
        ).to.be.reverted;
    });
});
