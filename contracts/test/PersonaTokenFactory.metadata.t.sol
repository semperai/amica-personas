// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Fixtures} from "./shared/Fixtures.sol";
import {PersonaTokenFactory} from "../src/PersonaTokenFactory.sol";
import {PersonaFactoryViewer} from "../src/PersonaFactoryViewer.sol";

contract PersonaTokenFactoryMetadataTest is Fixtures {
    PersonaFactoryViewer public viewer;
    uint256 public testTokenId;

    function setUp() public override {
        super.setUp();

        // Deploy the viewer contract
        viewer = new PersonaFactoryViewer(address(personaFactory));

        // Create a test persona for metadata tests
        // IMPORTANT: We need to prank as user1 to ensure they own the NFT
        vm.startPrank(user1);
        amicaToken.approve(address(personaFactory), 1000 ether);

        testTokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TESTP",
            bytes32("testpersona"),
            0,
            address(0),
            0
        );
        vm.stopPrank();

        // Verify that user1 owns the token
        assertEq(personaFactory.ownerOf(testTokenId), user1);
    }

    function test_UpdateMetadata_ByTokenOwner() public {
        // User1 owns the token, so they can update metadata
        vm.prank(user1);

        bytes32[] memory keys = new bytes32[](2);
        keys[0] = bytes32("description");
        keys[1] = bytes32("twitter");

        string[] memory values = new string[](2);
        values[0] = "Updated description";
        values[1] = "@coolpersona";

        // Expect both MetadataUpdated events
        vm.expectEmit(true, true, true, false);
        emit PersonaTokenFactory.MetadataUpdated(
            testTokenId, bytes32("description")
        );
        vm.expectEmit(true, true, true, false);
        emit PersonaTokenFactory.MetadataUpdated(
            testTokenId, bytes32("twitter")
        );

        personaFactory.updateMetadata(testTokenId, keys, values);

        // Use viewer to get metadata
        string[] memory metadata = viewer.getMetadata(testTokenId, keys);
        assertEq(metadata[0], "Updated description");
        assertEq(metadata[1], "@coolpersona");
    }

    function test_UpdateMetadata_RevertNonOwner() public {
        // User2 doesn't own the token
        vm.prank(user2);

        bytes32[] memory keys = new bytes32[](1);
        keys[0] = bytes32("description");

        string[] memory values = new string[](1);
        values[0] = "Hacked!";

        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 0)); // 0 = NotOwner
        personaFactory.updateMetadata(testTokenId, keys, values);
    }

    function test_UpdateMetadata_RevertMismatchedArrays() public {
        vm.prank(user1);

        bytes32[] memory keys = new bytes32[](2);
        keys[0] = bytes32("key1");
        keys[1] = bytes32("key2");

        string[] memory values = new string[](1);
        values[0] = "value1"; // Missing value2

        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 5)); // 5 = Metadata
        personaFactory.updateMetadata(testTokenId, keys, values);
    }

    function test_GetMetadata_NonExistentKeys() public view {
        bytes32[] memory keys = new bytes32[](1);
        keys[0] = bytes32("nonexistent");

        // Use viewer to get metadata
        string[] memory metadata = viewer.getMetadata(testTokenId, keys);
        assertEq(metadata[0], "");
    }

    function test_BatchMetadataUpdate() public {
        vm.prank(user1);

        // Update multiple metadata keys at once
        uint256 numKeys = 10;
        bytes32[] memory keys = new bytes32[](numKeys);
        string[] memory values = new string[](numKeys);

        for (uint256 i = 0; i < numKeys; i++) {
            keys[i] = keccak256(abi.encodePacked("key", vm.toString(i)));
            values[i] = string(abi.encodePacked("value", vm.toString(i)));
        }

        // We expect 10 events to be emitted
        for (uint256 i = 0; i < numKeys; i++) {
            vm.expectEmit(true, true, true, false);
            emit PersonaTokenFactory.MetadataUpdated(testTokenId, keys[i]);
        }

        personaFactory.updateMetadata(testTokenId, keys, values);

        // Verify all were set using viewer
        string[] memory retrievedValues = viewer.getMetadata(testTokenId, keys);
        for (uint256 i = 0; i < numKeys; i++) {
            assertEq(retrievedValues[i], values[i]);
        }
    }

    function test_TokenURI_ValidToken() public {
        // First set a base URI
        vm.prank(factoryOwner);
        personaFactory.setBaseURI("https://api.amica.com/metadata/");

        string memory uri = personaFactory.tokenURI(testTokenId);

        // The default ERC721 implementation concatenates baseURI + tokenId
        string memory expectedURI = string(
            abi.encodePacked(
                "https://api.amica.com/metadata/", vm.toString(testTokenId)
            )
        );
        assertEq(uri, expectedURI);
    }

    function test_TokenURI_NoBaseURI() public {
        // When no base URI is set, the default ERC721 implementation returns an empty string
        string memory uri = personaFactory.tokenURI(testTokenId);
        assertEq(uri, "");
    }

    function test_TokenURI_RevertNonExistentToken() public {
        vm.expectRevert(
            abi.encodeWithSignature("ERC721NonexistentToken(uint256)", 999)
        );
        personaFactory.tokenURI(999);
    }

    function test_UpdateMetadata_RevertNonExistentToken() public {
        bytes32[] memory keys = new bytes32[](1);
        keys[0] = bytes32("key");

        string[] memory values = new string[](1);
        values[0] = "value";

        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSignature("ERC721NonexistentToken(uint256)", 999)
        );
        personaFactory.updateMetadata(999, keys, values);
    }

    function test_MaxLengthMetadata() public {
        vm.prank(user1);

        // Create a very long metadata value
        bytes memory longBytes = new bytes(1000);
        for (uint256 i = 0; i < 1000; i++) {
            longBytes[i] = "a";
        }
        string memory longValue = string(longBytes);

        bytes32[] memory keys = new bytes32[](1);
        keys[0] = bytes32("longData");

        string[] memory values = new string[](1);
        values[0] = longValue;

        vm.expectEmit(true, true, true, false);
        emit PersonaTokenFactory.MetadataUpdated(
            testTokenId, bytes32("longData")
        );

        personaFactory.updateMetadata(testTokenId, keys, values);

        // Use viewer to get metadata
        string[] memory metadata = viewer.getMetadata(testTokenId, keys);
        assertEq(metadata[0], longValue);
    }

    function test_SpecialCharactersMetadata() public {
        vm.prank(user1);

        bytes32[] memory keys = new bytes32[](3);
        keys[0] = bytes32("emoji");
        keys[1] = bytes32("unicode");
        keys[2] = bytes32("special");

        string[] memory values = new string[](3);
        values[0] = unicode"🚀🌟💎 Rocket to the moon!";
        values[1] = unicode"Üñïçødé tëxt wîth spéçiål çhars";
        values[2] = "<script>alert('xss')</script> & \"quotes\" 'test'";

        personaFactory.updateMetadata(testTokenId, keys, values);

        // Use viewer to get metadata
        string[] memory retrieved = viewer.getMetadata(testTokenId, keys);
        assertEq(retrieved[0], values[0]);
        assertEq(retrieved[1], values[1]);
        assertEq(retrieved[2], values[2]);
    }

    function test_EmptyMetadataValues() public {
        vm.prank(user1);

        bytes32[] memory keys = new bytes32[](1);
        keys[0] = bytes32("empty");

        string[] memory values = new string[](1);
        values[0] = "";

        personaFactory.updateMetadata(testTokenId, keys, values);

        // Use viewer to get metadata
        string[] memory retrieved = viewer.getMetadata(testTokenId, keys);
        assertEq(retrieved[0], "");
    }

    function test_TransferOwnershipAndUpdateMetadata() public {
        // First, user1 needs to approve the test contract to transfer the NFT
        vm.prank(user1);
        personaFactory.approve(address(this), testTokenId);

        // Now transfer the NFT from user1 to user2
        vm.prank(user1);
        personaFactory.transferFrom(user1, user2, testTokenId);

        // Verify user1 can no longer update metadata
        vm.prank(user1);
        bytes32[] memory keys = new bytes32[](1);
        keys[0] = bytes32("owner");
        string[] memory values = new string[](1);
        values[0] = "user1";

        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 0)); // 0 = NotOwner
        personaFactory.updateMetadata(testTokenId, keys, values);

        // Verify user2 can now update metadata
        vm.prank(user2);
        values[0] = "user2";

        vm.expectEmit(true, true, true, false);
        emit PersonaTokenFactory.MetadataUpdated(testTokenId, bytes32("owner"));

        personaFactory.updateMetadata(testTokenId, keys, values);

        // Verify the update
        string[] memory metadata = viewer.getMetadata(testTokenId, keys);
        assertEq(metadata[0], "user2");
    }

    function test_UpdateSameKeyMultipleTimes() public {
        bytes32[] memory keys = new bytes32[](1);
        keys[0] = bytes32("version");
        string[] memory values = new string[](1);

        // Update 1
        vm.prank(user1);
        values[0] = "v1";
        personaFactory.updateMetadata(testTokenId, keys, values);
        string[] memory metadata = viewer.getMetadata(testTokenId, keys);
        assertEq(metadata[0], "v1");

        // Update 2
        vm.prank(user1);
        values[0] = "v2";
        personaFactory.updateMetadata(testTokenId, keys, values);
        metadata = viewer.getMetadata(testTokenId, keys);
        assertEq(metadata[0], "v2");

        // Update 3
        vm.prank(user1);
        values[0] = "v3";
        personaFactory.updateMetadata(testTokenId, keys, values);
        metadata = viewer.getMetadata(testTokenId, keys);
        assertEq(metadata[0], "v3");
    }

    function test_DifferentBytes32Keys() public {
        vm.prank(user1);

        // Test with various types of bytes32 keys
        bytes32[] memory keys = new bytes32[](5);
        keys[0] = bytes32(uint256(1)); // Numeric key
        keys[1] = keccak256("hashed_key"); // Hashed string
        keys[2] = bytes32("short"); // Short string converted to bytes32
        keys[3] = bytes32(0); // Zero key
        keys[4] = bytes32(type(uint256).max); // Max value key

        string[] memory values = new string[](5);
        values[0] = "numeric key value";
        values[1] = "hashed key value";
        values[2] = "short key value";
        values[3] = "zero key value";
        values[4] = "max key value";

        personaFactory.updateMetadata(testTokenId, keys, values);

        // Verify all were set
        string[] memory retrieved = viewer.getMetadata(testTokenId, keys);
        for (uint256 i = 0; i < 5; i++) {
            assertEq(retrieved[i], values[i]);
        }
    }

    function test_CollisionResistantKeys() public {
        vm.prank(user1);

        // Create keys that might collide if not handled properly
        bytes32[] memory keys = new bytes32[](3);
        keys[0] = keccak256(abi.encodePacked("key1"));
        keys[1] = keccak256(abi.encodePacked("key2"));
        keys[2] = keccak256(abi.encodePacked("key3"));

        string[] memory values = new string[](3);
        values[0] = "value1";
        values[1] = "value2";
        values[2] = "value3";

        personaFactory.updateMetadata(testTokenId, keys, values);

        // Verify each key maps to its own value
        string[] memory retrieved = viewer.getMetadata(testTokenId, keys);
        assertEq(retrieved[0], "value1");
        assertEq(retrieved[1], "value2");
        assertEq(retrieved[2], "value3");
    }

    function test_SetBaseURI() public {
        // Only owner can set base URI
        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSignature(
                "OwnableUnauthorizedAccount(address)", user1
            )
        );
        personaFactory.setBaseURI("https://invalid.com/");

        // Owner can set base URI
        vm.prank(factoryOwner);
        personaFactory.setBaseURI("https://metadata.amica.com/");

        // Verify the URI is updated
        string memory uri = personaFactory.tokenURI(testTokenId);
        string memory expectedURI = string(
            abi.encodePacked(
                "https://metadata.amica.com/", vm.toString(testTokenId)
            )
        );
        assertEq(uri, expectedURI);
    }
}
