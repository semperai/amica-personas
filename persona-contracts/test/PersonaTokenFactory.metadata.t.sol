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

        string[] memory keys = new string[](2);
        keys[0] = "description";
        keys[1] = "twitter";

        string[] memory values = new string[](2);
        values[0] = "Updated description";
        values[1] = "@coolpersona";

        // Expect both MetadataUpdated events
        vm.expectEmit(true, true, false, false);
        emit PersonaTokenFactory.MetadataUpdated(testTokenId, "description");
        vm.expectEmit(true, true, false, false);
        emit PersonaTokenFactory.MetadataUpdated(testTokenId, "twitter");

        personaFactory.updateMetadata(testTokenId, keys, values);

        // Use viewer to get metadata
        string[] memory metadata = viewer.getMetadata(testTokenId, keys);
        assertEq(metadata[0], "Updated description");
        assertEq(metadata[1], "@coolpersona");
    }

    function test_UpdateMetadata_RevertNonOwner() public {
        // User2 doesn't own the token
        vm.prank(user2);

        string[] memory keys = new string[](1);
        keys[0] = "description";

        string[] memory values = new string[](1);
        values[0] = "Hacked!";

        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 0)); // 0 = NotOwner
        personaFactory.updateMetadata(testTokenId, keys, values);
    }

    function test_UpdateMetadata_RevertMismatchedArrays() public {
        vm.prank(user1);

        string[] memory keys = new string[](2);
        keys[0] = "key1";
        keys[1] = "key2";

        string[] memory values = new string[](1);
        values[0] = "value1"; // Missing value2

        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 5)); // 5 = Metadata
        personaFactory.updateMetadata(testTokenId, keys, values);
    }

    function test_GetMetadata_NonExistentKeys() public view {
        string[] memory keys = new string[](1);
        keys[0] = "nonexistent";

        // Use viewer to get metadata
        string[] memory metadata = viewer.getMetadata(testTokenId, keys);
        assertEq(metadata[0], "");
    }

    function test_BatchMetadataUpdate() public {
        vm.prank(user1);

        // Update multiple metadata keys at once
        uint256 numKeys = 10;
        string[] memory keys = new string[](numKeys);
        string[] memory values = new string[](numKeys);

        for (uint256 i = 0; i < numKeys; i++) {
            keys[i] = string(abi.encodePacked("key", vm.toString(i)));
            values[i] = string(abi.encodePacked("value", vm.toString(i)));
        }

        // We expect 10 events to be emitted
        for (uint256 i = 0; i < numKeys; i++) {
            vm.expectEmit(true, true, false, false);
            emit PersonaTokenFactory.MetadataUpdated(testTokenId, keys[i]);
        }

        personaFactory.updateMetadata(testTokenId, keys, values);

        // Verify all were set using viewer
        string[] memory retrievedValues = viewer.getMetadata(testTokenId, keys);
        for (uint256 i = 0; i < numKeys; i++) {
            assertEq(retrievedValues[i], values[i]);
        }
    }

    function test_TokenURI_ValidToken() public view {
        string memory uri = personaFactory.tokenURI(testTokenId);

        // Verify the URI starts with the expected data URI prefix
        assertTrue(_startsWith(uri, "data:application/json;utf8,"));

        // Extract JSON from URI
        string memory jsonStr = _substring(uri, 27, bytes(uri).length);

        // Verify it contains expected fields (basic checks)
        assertTrue(_contains(jsonStr, '"name":"Test Persona"'));
        assertTrue(_contains(jsonStr, '"symbol":"TESTP"'));
        assertTrue(
            _contains(
                jsonStr,
                string(
                    abi.encodePacked(
                        '"tokenId":"', vm.toString(testTokenId), '"'
                    )
                )
            )
        );
        assertTrue(_contains(jsonStr, '"token":"0x')); // Should contain the token address
    }

    function test_TokenURI_RevertNonExistentToken() public {
        vm.expectRevert(
            abi.encodeWithSignature("ERC721NonexistentToken(uint256)", 999)
        );
        personaFactory.tokenURI(999);
    }

    function test_UpdateMetadata_RevertNonExistentToken() public {
        string[] memory keys = new string[](1);
        keys[0] = "key";

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

        string[] memory keys = new string[](1);
        keys[0] = "longData";

        string[] memory values = new string[](1);
        values[0] = longValue;

        vm.expectEmit(true, true, false, false);
        emit PersonaTokenFactory.MetadataUpdated(testTokenId, "longData");

        personaFactory.updateMetadata(testTokenId, keys, values);

        // Use viewer to get metadata
        string[] memory metadata = viewer.getMetadata(testTokenId, keys);
        assertEq(metadata[0], longValue);
    }

    function test_SpecialCharactersMetadata() public {
        vm.prank(user1);

        string[] memory keys = new string[](3);
        keys[0] = "emoji";
        keys[1] = "unicode";
        keys[2] = "special";

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

        string[] memory keys = new string[](1);
        keys[0] = "empty";

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
        string[] memory keys = new string[](1);
        keys[0] = "owner";
        string[] memory values = new string[](1);
        values[0] = "user1";

        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 0)); // 0 = NotOwner
        personaFactory.updateMetadata(testTokenId, keys, values);

        // Verify user2 can now update metadata
        vm.prank(user2);
        values[0] = "user2";

        vm.expectEmit(true, true, false, false);
        emit PersonaTokenFactory.MetadataUpdated(testTokenId, "owner");

        personaFactory.updateMetadata(testTokenId, keys, values);

        // Verify the update
        string[] memory metadata = viewer.getMetadata(testTokenId, keys);
        assertEq(metadata[0], "user2");
    }

    function test_UpdateSameKeyMultipleTimes() public {
        string[] memory keys = new string[](1);
        keys[0] = "version";
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

    // Helper functions for string operations
    function _startsWith(string memory str, string memory prefix)
        private
        pure
        returns (bool)
    {
        bytes memory strBytes = bytes(str);
        bytes memory prefixBytes = bytes(prefix);

        if (strBytes.length < prefixBytes.length) {
            return false;
        }

        for (uint256 i = 0; i < prefixBytes.length; i++) {
            if (strBytes[i] != prefixBytes[i]) {
                return false;
            }
        }

        return true;
    }

    function _contains(string memory str, string memory substr)
        private
        pure
        returns (bool)
    {
        bytes memory strBytes = bytes(str);
        bytes memory substrBytes = bytes(substr);

        if (strBytes.length < substrBytes.length) {
            return false;
        }

        for (uint256 i = 0; i <= strBytes.length - substrBytes.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < substrBytes.length; j++) {
                if (strBytes[i + j] != substrBytes[j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return true;
            }
        }

        return false;
    }

    function _substring(string memory str, uint256 start, uint256 end)
        private
        pure
        returns (string memory)
    {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(end - start);

        for (uint256 i = start; i < end; i++) {
            result[i - start] = strBytes[i];
        }

        return string(result);
    }
}
