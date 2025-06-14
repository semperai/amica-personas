import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
    deployPersonaTokenFactoryFixture,
} from "./shared/fixtures";

describe("PersonaTokenFactory Pause/Unpause", function () {
    describe("Pause Functionality", function () {
        it("Should allow owner to pause the contract", async function () {
            const { personaFactory, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Check initial state (should be unpaused)
            expect(await personaFactory.paused()).to.be.false;

            // Pause the contract
            await expect(personaFactory.connect(owner).pause())
                .to.emit(personaFactory, "Paused")
                .withArgs(owner.address);

            // Verify paused state
            expect(await personaFactory.paused()).to.be.true;
        });

        it("Should reject pause by non-owner", async function () {
            const { personaFactory, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            await expect(
                personaFactory.connect(user1).pause()
            ).to.be.revertedWithCustomError(personaFactory, "OwnableUnauthorizedAccount");
        });

        it("Should prevent createPersona when paused", async function () {
            const { personaFactory, amicaToken, owner, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Pause the contract
            await personaFactory.connect(owner).pause();

            // Prepare createPersona parameters
            const mintCost = ethers.parseEther("1000");
            // User1 already has tokens from the fixture
            await amicaToken.connect(user1).approve(await personaFactory.getAddress(), mintCost);

            // Attempt to create persona while paused
            await expect(
                personaFactory.connect(user1).createPersona(
                    await amicaToken.getAddress(),
                    "Test Persona",
                    "TEST",
                    [],
                    [],
                    0
                )
            ).to.be.revertedWithCustomError(personaFactory, "EnforcedPause");
        });

        it("Should prevent swapExactTokensForTokens when paused", async function () {
            const { personaFactory, amicaToken, owner, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // First create a persona while unpaused
            const mintCost = ethers.parseEther("1000");
            await amicaToken.connect(user1).approve(await personaFactory.getAddress(), mintCost);

            const tx = await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Test Persona",
                "TEST",
                [],
                [],
                0
            );
            const receipt = await tx.wait();
            const event = receipt?.logs.find(log => {
                try {
                    const parsed = personaFactory.interface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    });
                    return parsed?.name === 'PersonaCreated';
                } catch {
                    return false;
                }
            });
            const parsedEvent = personaFactory.interface.parseLog({
                topics: event!.topics as string[],
                data: event!.data
            });
            const tokenId = parsedEvent!.args.tokenId;

            // Pause the contract
            await personaFactory.connect(owner).pause();

            // Prepare swap
            const swapAmount = ethers.parseEther("100");
            await amicaToken.connect(user1).approve(await personaFactory.getAddress(), swapAmount);

            // Attempt to swap while paused
            await expect(
                personaFactory.connect(user1).swapExactTokensForTokens(
                    tokenId,
                    swapAmount,
                    0,
                    user1.address,
                    Math.floor(Date.now() / 1000) + 3600
                )
            ).to.be.revertedWithCustomError(personaFactory, "EnforcedPause");
        });

        it("Should allow multiple pause/unpause cycles", async function () {
            const { personaFactory, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Initial state
            expect(await personaFactory.paused()).to.be.false;

            // First pause
            await personaFactory.connect(owner).pause();
            expect(await personaFactory.paused()).to.be.true;

            // First unpause
            await personaFactory.connect(owner).unpause();
            expect(await personaFactory.paused()).to.be.false;

            // Second pause
            await personaFactory.connect(owner).pause();
            expect(await personaFactory.paused()).to.be.true;

            // Second unpause
            await personaFactory.connect(owner).unpause();
            expect(await personaFactory.paused()).to.be.false;
        });
    });

    describe("Unpause Functionality", function () {
        it("Should allow owner to unpause the contract", async function () {
            const { personaFactory, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // First pause the contract
            await personaFactory.connect(owner).pause();
            expect(await personaFactory.paused()).to.be.true;

            // Unpause the contract
            await expect(personaFactory.connect(owner).unpause())
                .to.emit(personaFactory, "Unpaused")
                .withArgs(owner.address);

            // Verify unpaused state
            expect(await personaFactory.paused()).to.be.false;
        });

        it("Should reject unpause by non-owner", async function () {
            const { personaFactory, owner, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // First pause the contract as owner
            await personaFactory.connect(owner).pause();

            // Attempt to unpause as non-owner
            await expect(
                personaFactory.connect(user1).unpause()
            ).to.be.revertedWithCustomError(personaFactory, "OwnableUnauthorizedAccount");

            // Verify still paused
            expect(await personaFactory.paused()).to.be.true;
        });

        it("Should allow createPersona after unpause", async function () {
            const { personaFactory, amicaToken, owner, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Pause then unpause
            await personaFactory.connect(owner).pause();
            await personaFactory.connect(owner).unpause();

            // Prepare createPersona
            const mintCost = ethers.parseEther("1000");
            await amicaToken.connect(user1).approve(await personaFactory.getAddress(), mintCost);

            // Should succeed after unpause
            await expect(
                personaFactory.connect(user1).createPersona(
                    await amicaToken.getAddress(),
                    "Test Persona",
                    "TEST",
                    [],
                    [],
                    0
                )
            ).to.emit(personaFactory, "PersonaCreated");
        });

        it("Should allow swaps after unpause", async function () {
            const { personaFactory, amicaToken, owner, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Create a persona first
            const mintCost = ethers.parseEther("1000");
            await amicaToken.connect(user1).approve(await personaFactory.getAddress(), mintCost);

            const tx = await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Test Persona",
                "TEST",
                [],
                [],
                0
            );
            const receipt = await tx.wait();
            const event = receipt?.logs.find(log => {
                try {
                    const parsed = personaFactory.interface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    });
                    return parsed?.name === 'PersonaCreated';
                } catch {
                    return false;
                }
            });
            const parsedEvent = personaFactory.interface.parseLog({
                topics: event!.topics as string[],
                data: event!.data
            });
            const tokenId = parsedEvent!.args.tokenId;

            // Pause then unpause
            await personaFactory.connect(owner).pause();
            await personaFactory.connect(owner).unpause();

            // Prepare and execute swap
            const swapAmount = ethers.parseEther("100");
            await amicaToken.connect(user1).approve(await personaFactory.getAddress(), swapAmount);

            // Should succeed after unpause
            await expect(
                personaFactory.connect(user1).swapExactTokensForTokens(
                    tokenId,
                    swapAmount,
                    0,
                    user1.address,
                    Math.floor(Date.now() / 1000) + 3600
                )
            ).to.emit(personaFactory, "TokensPurchased");
        });
    });

    describe("Edge Cases and State Verification", function () {
        it("Should handle unpause when already unpaused", async function () {
            const { personaFactory, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Contract starts unpaused
            expect(await personaFactory.paused()).to.be.false;

            // Unpause when already unpaused should revert with ExpectedPause error
            await expect(
                personaFactory.connect(owner).unpause()
            ).to.be.revertedWithCustomError(personaFactory, "ExpectedPause");

            // State should remain unpaused
            expect(await personaFactory.paused()).to.be.false;
        });

        it("Should handle pause when already paused", async function () {
            const { personaFactory, owner } = await loadFixture(deployPersonaTokenFactoryFixture);

            // First pause
            await personaFactory.connect(owner).pause();
            expect(await personaFactory.paused()).to.be.true;

            // Second pause should revert
            await expect(
                personaFactory.connect(owner).pause()
            ).to.be.revertedWithCustomError(personaFactory, "EnforcedPause");
        });

        it("Should not affect view functions when paused", async function () {
            const { personaFactory, amicaToken, owner, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Create a persona first
            const mintCost = ethers.parseEther("1000");
            await amicaToken.connect(user1).approve(await personaFactory.getAddress(), mintCost);

            const tx = await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Test Persona",
                "TEST",
                ["key1"],
                ["value1"],
                0
            );
            const receipt = await tx.wait();
            const event = receipt?.logs.find(log => {
                try {
                    const parsed = personaFactory.interface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    });
                    return parsed?.name === 'PersonaCreated';
                } catch {
                    return false;
                }
            });
            const parsedEvent = personaFactory.interface.parseLog({
                topics: event!.topics as string[],
                data: event!.data
            });
            const tokenId = parsedEvent!.args.tokenId;

            // Pause the contract
            await personaFactory.connect(owner).pause();

            // View functions should still work
            const persona = await personaFactory.getPersona(tokenId);
            expect(persona.name).to.equal("Test Persona");

            const metadata = await personaFactory.getMetadata(tokenId, ["key1"]);
            expect(metadata[0]).to.equal("value1");

            const availableTokens = await personaFactory.getAvailableTokens(tokenId);
            expect(availableTokens).to.be.gt(0);

            const config = await personaFactory.pairingConfigs(await amicaToken.getAddress());
            expect(config.enabled).to.be.true;
        });

        it("Should not allow withdrawTokens when paused", async function () {
            const { personaFactory, amicaToken, owner, user1, user2 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Create persona and make a small purchase first
            const mintCost = ethers.parseEther("1000");
            const smallPurchase = ethers.parseEther("100000");

            // Approve for minting + small purchase
            await amicaToken.connect(user1).approve(await personaFactory.getAddress(), mintCost + smallPurchase);

            // Create persona with NO initial buy
            const tx = await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Test Persona",
                "TEST",
                [],
                [],
                0 // No initial buy
            );
            const receipt = await tx.wait();
            const event = receipt?.logs.find(log => {
                try {
                    const parsed = personaFactory.interface.parseLog({
                        topics: log.topics as string[],
                        data: log.data
                    });
                    return parsed?.name === 'PersonaCreated';
                } catch {
                    return false;
                }
            });
            const parsedEvent = personaFactory.interface.parseLog({
                topics: event!.topics as string[],
                data: event!.data
            });
            const tokenId = parsedEvent!.args.tokenId;

            // Make a small purchase
            await personaFactory.connect(user1).swapExactTokensForTokens(
                tokenId,
                smallPurchase,
                0,
                user1.address,
                Math.floor(Date.now() / 1000) + 3600
            );

            // Now user2 triggers graduation
            const graduationAmount = ethers.parseEther("1100000"); // More than threshold
            await amicaToken.connect(user2).approve(await personaFactory.getAddress(), graduationAmount);

            await personaFactory.connect(user2).swapExactTokensForTokens(
                tokenId,
                graduationAmount,
                0,
                user2.address,
                Math.floor(Date.now() / 1000) + 3600
            );

            // Verify pair was created
            const persona = await personaFactory.getPersona(tokenId);
            expect(persona.pairCreated).to.be.true;

            // Pause the contract
            await personaFactory.connect(owner).pause();

            // Attempt to withdraw tokens while paused (user1 has tokens to withdraw)
            await expect(
                personaFactory.connect(user1).withdrawTokens(tokenId)
            ).to.be.revertedWithCustomError(personaFactory, "EnforcedPause");
        });

        it("Should maintain pause state across multiple transactions", async function () {
            const { personaFactory, amicaToken, owner, user1, user2 } = await loadFixture(deployPersonaTokenFactoryFixture);

            // Setup users with approvals
            const mintCost = ethers.parseEther("1000");
            await amicaToken.connect(user1).approve(await personaFactory.getAddress(), mintCost);
            await amicaToken.connect(user2).approve(await personaFactory.getAddress(), mintCost);

            // User1 creates persona successfully
            await personaFactory.connect(user1).createPersona(
                await amicaToken.getAddress(),
                "Persona 1",
                "P1",
                [],
                [],
                0
            );

            // Owner pauses
            await personaFactory.connect(owner).pause();

            // User2 cannot create persona
            await expect(
                personaFactory.connect(user2).createPersona(
                    await amicaToken.getAddress(),
                    "Persona 2",
                    "P2",
                    [],
                    [],
                    0
                )
            ).to.be.revertedWithCustomError(personaFactory, "EnforcedPause");

            // Verify pause persists
            expect(await personaFactory.paused()).to.be.true;
        });
    });
});
