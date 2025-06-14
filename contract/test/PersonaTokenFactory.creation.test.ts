import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { TestERC20 } from "../typechain-types";
import {
    getDeadline,
    createPersonaFixture,
    deployPersonaTokenFactoryFixture,
    AMICA_DEPOSIT_AMOUNT,
    DEFAULT_GRADUATION_THRESHOLD,
    DEFAULT_MINT_COST,
    PERSONA_TOKEN_SUPPLY
} from "./shared/fixtures";

describe("PersonaTokenFactory Creation", function () {
    it("Should create persona with correct parameters", async function () {
        const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

        // Approve AMICA
        await amicaToken.connect(user1).approve(
            await personaFactory.getAddress(),
            DEFAULT_MINT_COST
        );

        // Create persona
        const tx = await personaFactory.connect(user1).createPersona(
            await amicaToken.getAddress(),
            "Cool Persona",
            "COOL",
            ["description", "website"],
            ["A cool AI persona", "https://coolpersona.ai"],
            0,
            ethers.ZeroAddress,
            0, // No minimum agent tokens
        );

        const receipt = await tx.wait();
        const event = receipt?.logs.find(
            log => {
                try {
                    const parsed = personaFactory.interface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    });
                    return parsed?.name === 'PersonaCreated';
                } catch {
                    return false;
                }
            }
        );

        expect(event).to.not.be.undefined;

        const parsedEvent = personaFactory.interface.parseLog({
            topics: event!.topics as string[],
            data: event!.data
        });

        expect(parsedEvent!.args.creator).to.equal(user1.address);
        expect(parsedEvent!.args.name).to.equal("Cool Persona");
        expect(parsedEvent!.args.symbol).to.equal("COOL");

        // Check NFT ownership
        const tokenId = parsedEvent!.args.tokenId;
        expect(await personaFactory.ownerOf(tokenId)).to.equal(user1.address);

        // Check persona data
        const persona = await personaFactory.getPersona(tokenId);
        expect(persona.name).to.equal("Cool Persona");
        expect(persona.symbol).to.equal("COOL");
        expect(persona.pairToken).to.equal(await amicaToken.getAddress());
        expect(persona.pairCreated).to.be.false;
        expect(persona.erc20Token).to.not.equal(ethers.ZeroAddress);

        // Check metadata
        const metadata = await personaFactory.getMetadata(tokenId, ["description", "website"]);
        expect(metadata[0]).to.equal("A cool AI persona");
        expect(metadata[1]).to.equal("https://coolpersona.ai");
    });

    it("Should create ERC20 token with correct supply and name", async function () {
        const { tokenId, personaFactory } = await loadFixture(createPersonaFixture);

        const persona = await personaFactory.getPersona(tokenId);
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const erc20Token = TestERC20.attach(persona.erc20Token) as TestERC20;

        expect(await erc20Token.name()).to.equal("Test Persona.amica");
        expect(await erc20Token.symbol()).to.equal("TESTP.amica");
        expect(await erc20Token.totalSupply()).to.equal(PERSONA_TOKEN_SUPPLY);

        // Factory now holds all tokens initially (AMICA deposit happens on graduation)
        expect(await erc20Token.balanceOf(await personaFactory.getAddress())).to.equal(
            PERSONA_TOKEN_SUPPLY // Changed from PERSONA_TOKEN_SUPPLY - AMICA_DEPOSIT_AMOUNT
        );
    });

    it("Should deposit tokens to AMICA contract", async function () {
        const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

        const persona = await personaFactory.getPersona(tokenId);
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const erc20Token = TestERC20.attach(persona.erc20Token) as TestERC20;

        // Initially, factory holds all tokens
        expect(await erc20Token.balanceOf(await personaFactory.getAddress())).to.equal(
            PERSONA_TOKEN_SUPPLY
        );

        // No deposit to AMICA yet
        expect(await amicaToken.depositedBalances(persona.erc20Token)).to.equal(0);

        // Trigger graduation to see the deposit
        const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10000n) / 9900n;
        await amicaToken.connect(user2).approve(await personaFactory.getAddress(), graduationAmount);
        await personaFactory.connect(user2).swapExactTokensForTokens(
            tokenId, graduationAmount, 0, user2.address, getDeadline()
        );

        // Now check deposit happened
        expect(await amicaToken.depositedBalances(persona.erc20Token)).to.equal(AMICA_DEPOSIT_AMOUNT);
    });


    it("Should take payment from creator", async function () {
        const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

        const initialBalance = await amicaToken.balanceOf(user1.address);

        await amicaToken.connect(user1).approve(
            await personaFactory.getAddress(),
            DEFAULT_MINT_COST
        );

        await personaFactory.connect(user1).createPersona(
            await amicaToken.getAddress(),
            "Test",
            "TEST",
            [],
            [],
            0,
            ethers.ZeroAddress,
            0, // No minimum agent tokens
        );

        expect(await amicaToken.balanceOf(user1.address)).to.equal(
            initialBalance - DEFAULT_MINT_COST
        );
        expect(await amicaToken.balanceOf(await personaFactory.getAddress())).to.equal(
            DEFAULT_MINT_COST
        );
    });

    it("Should reject creation with disabled pairing token", async function () {
        const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

        // Disable AMICA
        await personaFactory.disablePairingToken(await amicaToken.getAddress());

        await amicaToken.connect(user1).approve(
            await personaFactory.getAddress(),
            DEFAULT_MINT_COST
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
                0, // No minimum agent tokens
            )
        ).to.be.revertedWith("Pairing token not enabled");
    });

    it("Should reject creation with invalid name length", async function () {
        const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

        await amicaToken.connect(user1).approve(
            await personaFactory.getAddress(),
            DEFAULT_MINT_COST * 2n
        );

        // Empty name
        await expect(
            personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "",
                "TEST",
                [],
                [],
                0,
                ethers.ZeroAddress,
                0, // No minimum agent tokens
            )
        ).to.be.revertedWith("Invalid name length");

        // Name too long (33 characters)
        await expect(
            personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "ThisNameIsWayTooLongForTheContract",
                "TEST",
                [],
                [],
                0,
                ethers.ZeroAddress,
                0, // No minimum agent tokens
            )
        ).to.be.revertedWith("Invalid name length");
    });

    it("Should reject creation with invalid symbol length", async function () {
        const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

        await amicaToken.connect(user1).approve(
            await personaFactory.getAddress(),
            DEFAULT_MINT_COST * 2n
        );

        // Empty symbol
        await expect(
            personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Test",
                "",
                [],
                [],
                0,
                ethers.ZeroAddress,
                0, // No minimum agent tokens
            )
        ).to.be.revertedWith("Invalid symbol length");

        // Symbol too long (11 characters)
        await expect(
            personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Test",
                "VERYLONGSYM",
                [],
                [],
                0,
                ethers.ZeroAddress,
                0, // No minimum agent tokens
            )
        ).to.be.revertedWith("Invalid symbol length");
    });

    it("Should reject creation with mismatched metadata arrays", async function () {
        const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

        await amicaToken.connect(user1).approve(
            await personaFactory.getAddress(),
            DEFAULT_MINT_COST
        );

        await expect(
            personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Test",
                "TEST",
                ["key1", "key2"],
                ["value1"], // Missing value2
                0,
                ethers.ZeroAddress,
                0, // No minimum agent tokens
            )
        ).to.be.revertedWith("Metadata mismatch");
    });

    it("Should reject creation without payment approval", async function () {
        const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

        await expect(
            personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Test",
                "TEST",
                [],
                [],
                0,
                ethers.ZeroAddress,
                0, // No minimum agent tokens
            )
        ).to.be.revertedWithCustomError(amicaToken, "ERC20InsufficientAllowance");
    });

    it("Should handle persona creation with all valid name/symbol lengths", async function () {
        const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

        // Test minimum valid lengths
        await amicaToken.connect(user1).approve(
            await personaFactory.getAddress(),
            DEFAULT_MINT_COST * 3n
        );

        await personaFactory.connect(user1).createPersona(
            await amicaToken.getAddress(),
            "A", // 1 char name
            "A", // 1 char symbol
            [],
            [],
            0,
            ethers.ZeroAddress,
            0, // No minimum agent tokens
        );

        // Test maximum valid lengths
        await personaFactory.connect(user1).createPersona(
            await amicaToken.getAddress(),
            "A".repeat(32), // 32 char name
            "A".repeat(10), // 10 char symbol
            [],
            [],
            0,
            ethers.ZeroAddress,
            0, // No minimum agent tokens
        );

        expect(await personaFactory.ownerOf(0)).to.equal(user1.address);
        expect(await personaFactory.ownerOf(1)).to.equal(user1.address);
    });

    it("Should allow creator to buy tokens at launch", async function () {
        const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

        const initialBuyAmount = ethers.parseEther("5000");
        const totalPayment = DEFAULT_MINT_COST + initialBuyAmount;

        await amicaToken.connect(user1).approve(
            await personaFactory.getAddress(),
            totalPayment
        );

        const tx = await personaFactory.connect(user1).createPersona(
            await amicaToken.getAddress(),
            "Launch Test",
            "LAUNCH",
            [],
            [],
            initialBuyAmount,
            ethers.ZeroAddress,
            0, // No minimum agent tokens
        );

        await expect(tx).to.emit(personaFactory, "TokensPurchased");

        // Creator should have bought tokens (but locked)
        const tokenId = 0;
        const purchases = await personaFactory.getUserPurchases(tokenId, user1.address);
        expect(purchases.length).to.equal(1);
        expect(purchases[0].amount).to.be.gt(0);
    });

    it("Should handle insufficient balance gracefully", async function () {
        const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

        // Transfer most balance away to owner, keeping just a bit
        const balance = await amicaToken.balanceOf(user1.address);
        const keepAmount = ethers.parseEther("100");

        if (balance > DEFAULT_MINT_COST + keepAmount) {
            await amicaToken.connect(user1).transfer(
                owner.address, // Send to owner, not self
                balance - keepAmount
            );
        }

        // Approve more than we have
        await amicaToken.connect(user1).approve(
            await personaFactory.getAddress(),
            DEFAULT_MINT_COST
        );

        // Should fail with proper error
        await expect(
            personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Test",
                "TEST",
                [],
                [],
                0,
                ethers.ZeroAddress,
                0, // No minimum agent tokens
            )
        ).to.be.revertedWith("Insufficient balance");
    });

    it("Should handle failed payment transfer gracefully", async function () {
        const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

        // Transfer away most of user1's balance
        const balance = await amicaToken.balanceOf(user1.address);
        if (balance > DEFAULT_MINT_COST) {
            await amicaToken.connect(user1).transfer(
                owner.address,
                balance - ethers.parseEther("100") // Keep only 100 tokens
            );
        }

        // Now user1 has less than DEFAULT_MINT_COST
        expect(await amicaToken.balanceOf(user1.address)).to.be.lt(DEFAULT_MINT_COST);

        // Approve more than they have
        await amicaToken.connect(user1).approve(
            await personaFactory.getAddress(),
            DEFAULT_MINT_COST
        );

        // Should fail with proper error
        await expect(
            personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Test",
                "TEST",
                [],
                [],
                0,
                ethers.ZeroAddress,
                0, // No minimum agent tokens
            )
        ).to.be.revertedWith("Insufficient balance");
    });

    it("Should verify token suffix is applied correctly", async function () {
        const { tokenId, personaFactory } = await loadFixture(createPersonaFixture);

        const persona = await personaFactory.getPersona(tokenId);
        const TestERC20 = await ethers.getContractFactory("TestERC20");
        const erc20Token = TestERC20.attach(persona.erc20Token) as TestERC20;

        // Check both name and symbol have .amica suffix
        expect(await erc20Token.name()).to.include(".amica");
        expect(await erc20Token.symbol()).to.include(".amica");
    });

    it("Should handle multiple personas created by same user", async function () {
        const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

        // Approve for multiple creations
        await amicaToken.connect(user1).approve(
            await personaFactory.getAddress(),
            DEFAULT_MINT_COST * 3n
        );

        // Create 3 personas
        for (let i = 0; i < 3; i++) {
            await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                `Persona ${i}`,
                `P${i}`,
                [],
                [],
                0,
                ethers.ZeroAddress,
                0, // No minimum agent tokens
            );
        }

        // Check all are owned by user1
        expect(await personaFactory.ownerOf(0)).to.equal(user1.address);
        expect(await personaFactory.ownerOf(1)).to.equal(user1.address);
        expect(await personaFactory.ownerOf(2)).to.equal(user1.address);

        // Check all have different ERC20 tokens
        const persona0 = await personaFactory.getPersona(0);
        const persona1 = await personaFactory.getPersona(1);
        const persona2 = await personaFactory.getPersona(2);

        expect(persona0.erc20Token).to.not.equal(persona1.erc20Token);
        expect(persona1.erc20Token).to.not.equal(persona2.erc20Token);
        expect(persona0.erc20Token).to.not.equal(persona2.erc20Token);
    });

    it("Should return 0 available tokens after pair creation", async function () {
        const { tokenId, personaFactory, amicaToken, user2 } = await loadFixture(createPersonaFixture);

        const deadline = Math.floor(Date.now() / 1000) + 3600;

        // Trigger pair creation
        const graduationAmount = (DEFAULT_GRADUATION_THRESHOLD * 10000n) / 9900n;
        await amicaToken.connect(user2).approve(
            await personaFactory.getAddress(),
            graduationAmount
        );
        await personaFactory.connect(user2).swapExactTokensForTokens(
            tokenId,
            graduationAmount,
            0,
            user2.address,
            deadline
        );

        expect(await personaFactory.getAvailableTokens(tokenId)).to.equal(0);
    });

    it("Should handle pairing tokens with different decimals", async function () {
        const { personaFactory, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

        // Deploy a 6-decimal token (like USDC)
        const SixDecimalToken = await ethers.getContractFactory("TestERC20");
        const usdc6 = await SixDecimalToken.deploy("USDC", "USDC", ethers.parseUnits("10000000", 6));

        // Configure with appropriate values for 6 decimals
        await personaFactory.configurePairingToken(
            await usdc6.getAddress(),
            ethers.parseUnits("100", 6),  // 100 USDC mint cost
            ethers.parseUnits("10000", 6), // 10k USDC graduation threshold
        );

        // Give user some tokens
        await usdc6.transfer(user1.address, ethers.parseUnits("1000", 6));

        // Create persona
        await usdc6.connect(user1).approve(
            await personaFactory.getAddress(),
            ethers.parseUnits("100", 6)
        );

        await personaFactory.connect(user1).createPersona(
            await usdc6.getAddress(),
            "USDC6 Persona",
            "USDC6P",
            [],
            [],
            0,
            ethers.ZeroAddress,
            0, // No minimum agent tokens
        );

        // Test swapping with 6-decimal token
        await usdc6.connect(user1).approve(
            await personaFactory.getAddress(),
            ethers.parseUnits("500", 6)
        );

        const deadline = getDeadline();
        await expect(
            personaFactory.connect(user1).swapExactTokensForTokens(
                0,
                ethers.parseUnits("500", 6),
                0,
                user1.address,
                deadline
            )
        ).to.emit(personaFactory, "TokensPurchased");
    });

    it("Should handle initial buy that triggers immediate graduation", async function () {
        const { personaFactory, amicaToken, user1, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

        // Configure with very low graduation threshold
        const TestToken = await ethers.getContractFactory("TestERC20");
        const testToken = await TestToken.deploy("Test", "TEST", ethers.parseEther("10000000"));

        await personaFactory.connect(owner).configurePairingToken(
            await testToken.getAddress(),
            ethers.parseEther("100"),
            ethers.parseEther("500") // Very low graduation threshold
        );

        // Give user enough tokens
        await testToken.transfer(user1.address, ethers.parseEther("1000"));
        await testToken.connect(user1).approve(
            await personaFactory.getAddress(),
            ethers.parseEther("1000")
        );

        // Create with initial buy that exceeds graduation
        await expect(
            personaFactory.connect(user1).createPersona(
                await testToken.getAddress(),
                "Instant Grad",
                "INSTG",
                [],
                [],
                ethers.parseEther("600"), // More than graduation threshold
                ethers.ZeroAddress,
                0, // No minimum agent tokens
            )
        ).to.emit(personaFactory, "LiquidityPairCreated");
    });

    it("Should handle initial buy with maximum metadata", async function () {
        const { personaFactory, amicaToken, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

        // Create maximum metadata
        const maxKeys = 50; // Reasonable maximum
        const keys = Array.from({ length: maxKeys }, (_, i) => `key${i}`);
        const values = Array.from({ length: maxKeys }, (_, i) => `value${i}`.repeat(20)); // Long values

        const totalCost = DEFAULT_MINT_COST + ethers.parseEther("5000");
        await amicaToken.connect(user1).approve(
            await personaFactory.getAddress(),
            totalCost
        );

        // This should work but consume more gas
        const tx = await personaFactory.connect(user1).createPersona(
            await amicaToken.getAddress(),
            "Max Metadata",
            "MAXM",
            keys,
            values,
            ethers.parseEther("5000"),
            ethers.ZeroAddress,
            0, // No minimum agent tokens
        );

        const receipt = await tx.wait();
        expect(receipt?.gasUsed).to.be.gt(0);

        // Verify all metadata was stored
        const retrievedValues = await personaFactory.getMetadata(0, keys);
        expect(retrievedValues).to.deep.equal(values);
    });
});
