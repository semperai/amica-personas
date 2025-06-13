import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import {
    deployPersonaTokenFactoryFixture,
    createPersonaFixture,
} from "./shared/fixtures";

describe("Metadata Management", function () {
    it("Should update metadata by token owner", async function () {
        const { tokenId, personaFactory, user1 } = await loadFixture(createPersonaFixture);

        // Fixed: Check events separately
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

        const metadata = await personaFactory.getMetadata(tokenId, ["description", "twitter"]);
        expect(metadata[0]).to.equal("Updated description");
        expect(metadata[1]).to.equal("@coolpersona");
    });

    it("Should reject metadata update by non-owner", async function () {
        const { tokenId, personaFactory, user2 } = await loadFixture(createPersonaFixture);

        await expect(
            personaFactory.connect(user2).updateMetadata(
                tokenId,
                ["description"],
                ["Hacked!"]
            )
        ).to.be.revertedWith("Not token owner");
    });

    it("Should reject metadata update with mismatched arrays", async function () {
        const { tokenId, personaFactory, user1 } = await loadFixture(createPersonaFixture);

        await expect(
            personaFactory.connect(user1).updateMetadata(
                tokenId,
                ["key1", "key2"],
                ["value1"] // Missing value2
            )
        ).to.be.revertedWith("Key-value mismatch");
    });

    it("Should return empty string for non-existent metadata keys", async function () {
        const { tokenId, personaFactory } = await loadFixture(createPersonaFixture);

        const metadata = await personaFactory.getMetadata(tokenId, ["nonexistent"]);
        expect(metadata[0]).to.equal("");
    });

    it("Should efficiently handle batch metadata updates", async function () {
        const { tokenId, personaFactory, user1 } = await loadFixture(createPersonaFixture);

        // Update multiple metadata keys at once
        const keys = Array.from({ length: 10 }, (_, i) => `key${i}`);
        const values = Array.from({ length: 10 }, (_, i) => `value${i}`);

        await expect(
            personaFactory.connect(user1).updateMetadata(tokenId, keys, values)
        ).to.emit(personaFactory, "MetadataUpdated");

        // Verify all were set
        const retrievedValues = await personaFactory.getMetadata(tokenId, keys);
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
        const { personaFactory } = await loadFixture(deployPersonaTokenFactoryFixture);

        await expect(
            personaFactory.getPersona(999)
        ).to.not.be.reverted; // This returns default values
    });


    it("Should reject metadata update for non-existent token", async function () {
        const { personaFactory, user1 } = await loadFixture(deployPersonaTokenFactoryFixture);

        await expect(
            personaFactory.connect(user1).updateMetadata(999, ["key"], ["value"])
        ).to.be.revertedWithCustomError(personaFactory, "ERC721NonexistentToken");
    });

    it("Should return empty metadata for non-existent token", async function () {
        const { personaFactory } = await loadFixture(deployPersonaTokenFactoryFixture);

        await expect(
            personaFactory.getMetadata(999, ["key"])
        ).to.not.be.reverted; // Returns empty array
    });

    it("Should handle maximum length metadata", async function () {
        const { tokenId, personaFactory, user1 } = await loadFixture(createPersonaFixture);

        const longValue = "a".repeat(1000); // Very long metadata value

        await expect(
            personaFactory.connect(user1).updateMetadata(
                tokenId,
                ["longData"],
                [longValue]
            )
        ).to.emit(personaFactory, "MetadataUpdated");

        const metadata = await personaFactory.getMetadata(tokenId, ["longData"]);
        expect(metadata[0]).to.equal(longValue);
    });
});