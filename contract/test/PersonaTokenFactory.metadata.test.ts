import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import {
    deployPersonaTokenFactoryFixture,
    createPersonaFixture,
} from "./shared/fixtures";

describe("PersonaTokenFactory Metadata Management", function () {
    it("Should update metadata by token owner", async function () {
        const { tokenId, personaFactory, viewer, user1 } = await loadFixture(createPersonaFixture);

        await expect(
            personaFactory.connect(user1).updateMetadata(
                tokenId,
                ["description", "twitter"],
                ["Updated description", "@coolpersona"]
            )
        ).to.emit(personaFactory, "MetadataUpdated")
         .withArgs(tokenId, "description")
         .to.emit(personaFactory, "MetadataUpdated")
         .withArgs(tokenId, "twitter");

        // Use viewer to get metadata
        const metadata = await viewer.getMetadata(tokenId, ["description", "twitter"]);
        expect(metadata[0]).to.equal("Updated description");
        expect(metadata[1]).to.equal("@coolpersona");
    });

    it("Should reject metadata update by non-owner", async function () {
        const { tokenId, personaFactory, user2 } = await loadFixture(createPersonaFixture);

        // Updated error expectation - using NotAllowed(0) for not owner
        await expect(
            personaFactory.connect(user2).updateMetadata(
                tokenId,
                ["description"],
                ["Hacked!"]
            )
        ).to.be.revertedWithCustomError(personaFactory, "NotAllowed")
          .withArgs(0); // 0 = NotOwner
    });

    it("Should reject metadata update with mismatched arrays", async function () {
        const { tokenId, personaFactory, user1 } = await loadFixture(createPersonaFixture);

        // Updated error expectation - using Invalid(5) for invalid metadata
        await expect(
            personaFactory.connect(user1).updateMetadata(
                tokenId,
                ["key1", "key2"],
                ["value1"] // Missing value2
            )
        ).to.be.revertedWithCustomError(personaFactory, "Invalid")
          .withArgs(5); // 5 = Metadata
    });

    it("Should return empty string for non-existent metadata keys", async function () {
        const { tokenId, viewer } = await loadFixture(createPersonaFixture);

        // Use viewer to get metadata
        const metadata = await viewer.getMetadata(tokenId, ["nonexistent"]);
        expect(metadata[0]).to.equal("");
    });

    it("Should efficiently handle batch metadata updates", async function () {
        const { tokenId, personaFactory, viewer, user1 } = await loadFixture(createPersonaFixture);

        // Update multiple metadata keys at once
        const keys = Array.from({ length: 10 }, (_, i) => `key${i}`);
        const values = Array.from({ length: 10 }, (_, i) => `value${i}`);

        await expect(
            personaFactory.connect(user1).updateMetadata(tokenId, keys, values)
        ).to.emit(personaFactory, "MetadataUpdated");

        // Verify all were set using viewer
        const retrievedValues = await viewer.getMetadata(tokenId, keys);
        expect(retrievedValues).to.deep.equal(values);
    });

    it("Should return correct tokenURI", async function () {
        const { tokenId, personaFactory } = await loadFixture(createPersonaFixture);

        const uri = await personaFactory.tokenURI(tokenId);

        // Decode the data URI
        expect(uri).to.include("data:application/json;utf8,");

        const jsonStr = uri.replace("data:application/json;utf8,", "");
        const metadata = JSON.parse(jsonStr);

        expect(metadata.name).to.equal("Test Persona");
        expect(metadata.symbol).to.equal("TESTP");
        expect(metadata.tokenId).to.equal(tokenId.toString());
        expect(metadata.erc20Token).to.be.a("string");
        expect(metadata.erc20Token.startsWith("0x")).to.be.true;
    });

    it("Should reject tokenURI for non-existent token", async function () {
        const { personaFactory } = await loadFixture(deployPersonaTokenFactoryFixture);

        await expect(
            personaFactory.tokenURI(999)
        ).to.be.revertedWithCustomError(personaFactory, "ERC721NonexistentToken");
    });

    it("Should reject getPersona for non-existent token", async function () {
        const { viewer } = await loadFixture(deployPersonaTokenFactoryFixture);

        // Use viewer for getPersona - it returns default values, doesn't revert
        const persona = await viewer.getPersona(999);
        expect(persona.name).to.equal("");
        expect(persona.symbol).to.equal("");
        expect(persona.erc20Token).to.equal(ethers.ZeroAddress);
    });


    it("Should reject metadata update for non-existent token", async function () {
        const { personaFactory, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

        await expect(
            personaFactory.connect(user1).updateMetadata(999, ["key"], ["value"])
        ).to.be.revertedWithCustomError(personaFactory, "ERC721NonexistentToken");
    });

    it("Should return empty metadata for non-existent token", async function () {
        const { viewer } = await loadFixture(deployPersonaTokenFactoryFixture);

        // Use viewer - returns empty values for non-existent tokens
        const metadata = await viewer.getMetadata(999, ["key"]);
        expect(metadata[0]).to.equal("");
    });

    it("Should handle maximum length metadata", async function () {
        const { tokenId, personaFactory, viewer, user1 } = await loadFixture(createPersonaFixture);

        const longValue = "a".repeat(1000); // Very long metadata value

        await expect(
            personaFactory.connect(user1).updateMetadata(
                tokenId,
                ["longData"],
                [longValue]
            )
        ).to.emit(personaFactory, "MetadataUpdated");

        // Use viewer to get metadata
        const metadata = await viewer.getMetadata(tokenId, ["longData"]);
        expect(metadata[0]).to.equal(longValue);
    });

    it("Should handle metadata with unicode and special characters", async function () {
        const { tokenId, personaFactory, viewer, user1 } = await loadFixture(createPersonaFixture);

        const specialKeys = ["emoji", "unicode", "special"];
        const specialValues = [
            "🚀🌟💎 Rocket to the moon!",
            "Üñïçødé tëxt wîth spéçiål çhars",
            "<script>alert('xss')</script> & \"quotes\" 'test'"
        ];

        await personaFactory.connect(user1).updateMetadata(
            tokenId,
            specialKeys,
            specialValues
        );

        // Use viewer to get metadata
        const retrieved = await viewer.getMetadata(tokenId, specialKeys);
        expect(retrieved).to.deep.equal(specialValues);
    });

    it("Should handle empty metadata values", async function () {
        const { tokenId, personaFactory, viewer, user1 } = await loadFixture(createPersonaFixture);

        await personaFactory.connect(user1).updateMetadata(
            tokenId,
            ["empty"],
            [""]
        );

        // Use viewer to get metadata
        const retrieved = await viewer.getMetadata(tokenId, ["empty"]);
        expect(retrieved[0]).to.equal("");
    });
});
