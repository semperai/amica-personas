// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {console} from "forge-std/console.sol";
import {Fixtures} from "./shared/Fixtures.sol";
import {PersonaTokenFactory, Invalid} from "../src/PersonaTokenFactory.sol";

contract SubdomainValidationTest is Fixtures {
    // ==================== Valid Subdomain Tests ====================

    function test_ValidSubdomain_SingleLetter() public {
        assertTrue(personaFactory.isValidSubdomain(bytes32("a")));
        assertTrue(personaFactory.isValidSubdomain(bytes32("z")));
    }

    function test_InvalidSubdomain_SingleNumber() public {
        assertFalse(personaFactory.isValidSubdomain(bytes32("0")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("9")));
    }

    function test_ValidSubdomain_Letters() public {
        assertTrue(personaFactory.isValidSubdomain(bytes32("hello")));
        assertTrue(personaFactory.isValidSubdomain(bytes32("world")));
        assertTrue(
            personaFactory.isValidSubdomain(
                bytes32("abcdefghijklmnopqrstuvwxyz")
            )
        );
    }

    function test_ValidSubdomain_MixedAlphanumeric() public {
        assertTrue(personaFactory.isValidSubdomain(bytes32("hello123")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("123hello"))); // This starts with number, so invalid
        assertTrue(personaFactory.isValidSubdomain(bytes32("h3ll0")));
        assertTrue(personaFactory.isValidSubdomain(bytes32("test42")));
    }

    function test_ValidSubdomain_WithHyphens() public {
        assertTrue(personaFactory.isValidSubdomain(bytes32("hello-world")));
        assertTrue(personaFactory.isValidSubdomain(bytes32("test-123")));
        assertTrue(personaFactory.isValidSubdomain(bytes32("a-b-c")));
        assertTrue(
            personaFactory.isValidSubdomain(bytes32("multi-word-subdomain"))
        );
    }

    function test_ValidSubdomain_MaxLength() public {
        // 32 bytes filled with valid characters
        bytes32 maxLengthDomain = bytes32("abcdefghijklmnopqrstuvwxyz123456");
        assertTrue(personaFactory.isValidSubdomain(maxLengthDomain));
    }

    // ==================== Invalid Subdomain Tests ====================

    function test_InvalidSubdomain_Empty() public {
        assertFalse(personaFactory.isValidSubdomain(bytes32(0)));
    }

    function test_InvalidSubdomain_StartsWithHyphen() public {
        assertFalse(personaFactory.isValidSubdomain(bytes32("-hello")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("-")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("-test-123")));
    }

    function test_InvalidSubdomain_StartsWithNumber() public {
        assertFalse(personaFactory.isValidSubdomain(bytes32("123hello")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("0xuser")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("42test")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("9lives")));
    }

    function test_InvalidSubdomain_EndsWithHyphen() public {
        assertFalse(personaFactory.isValidSubdomain(bytes32("hello-")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("test-123-")));
    }

    function test_InvalidSubdomain_Numbers() public {
        assertFalse(personaFactory.isValidSubdomain(bytes32("123")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("0123456789")));
    }

    function test_InvalidSubdomain_UppercaseLetters() public {
        assertFalse(personaFactory.isValidSubdomain(bytes32("Hello")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("HELLO")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("hELLo")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("Test123")));
    }

    function test_InvalidSubdomain_SpecialCharacters() public {
        assertFalse(personaFactory.isValidSubdomain(bytes32("hello!")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("hello@world")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("hello#")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("hello$")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("hello%")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("hello&")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("hello*")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("hello+")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("hello=")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("hello_world"))); // underscore not allowed
        assertFalse(personaFactory.isValidSubdomain(bytes32("hello.world"))); // dot not allowed
        assertFalse(personaFactory.isValidSubdomain(bytes32("hello/world"))); // slash not allowed
    }

    function test_InvalidSubdomain_Whitespace() public {
        assertFalse(personaFactory.isValidSubdomain(bytes32("hello world")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("hello ")));
        assertFalse(personaFactory.isValidSubdomain(bytes32(" hello")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("hello\tworld"))); // tab
        assertFalse(personaFactory.isValidSubdomain(bytes32("hello\nworld"))); // newline
    }

    // ==================== Edge Case Tests ====================

    function test_EdgeCase_MultipleHyphens() public {
        assertTrue(personaFactory.isValidSubdomain(bytes32("a-b-c-d-e")));
        assertTrue(personaFactory.isValidSubdomain(bytes32("test--test"))); // consecutive hyphens are technically valid in the middle
    }

    function test_EdgeCase_HyphenPositions() public {
        assertFalse(personaFactory.isValidSubdomain(bytes32("-"))); // just hyphen - invalid (not a letter)
        assertFalse(personaFactory.isValidSubdomain(bytes32("--"))); // just hyphens - invalid
        assertFalse(personaFactory.isValidSubdomain(bytes32("-a"))); // starts with hyphen - invalid
        assertFalse(personaFactory.isValidSubdomain(bytes32("a-"))); // ends with hyphen - invalid
        assertFalse(personaFactory.isValidSubdomain(bytes32("-a-"))); // starts and ends with hyphen - invalid
    }

    function test_EdgeCase_BytesPadding() public {
        // Solidity stores strings left-aligned in bytes32
        bytes32 paddedDomain = bytes32("hello");
        assertTrue(personaFactory.isValidSubdomain(paddedDomain));
    }

    // ==================== Common Domain Pattern Tests ====================

    function test_CommonPatterns_Web3Names() public {
        assertTrue(personaFactory.isValidSubdomain(bytes32("vitalik")));
        assertTrue(personaFactory.isValidSubdomain(bytes32("satoshi")));
        assertTrue(personaFactory.isValidSubdomain(bytes32("defi-user")));
        assertTrue(personaFactory.isValidSubdomain(bytes32("nft-collector")));
        assertFalse(personaFactory.isValidSubdomain(bytes32("0xuser"))); // starts with number - invalid
        assertTrue(personaFactory.isValidSubdomain(bytes32("user-2024"))); // starts with letter - valid
    }

    function test_CommonPatterns_InvalidWeb3Names() public {
        assertFalse(personaFactory.isValidSubdomain(bytes32("DefiUser"))); // uppercase
        assertFalse(personaFactory.isValidSubdomain(bytes32("user_name"))); // underscore
        assertFalse(personaFactory.isValidSubdomain(bytes32("user.eth"))); // dot
        assertFalse(personaFactory.isValidSubdomain(bytes32("@username"))); // special char
        assertFalse(personaFactory.isValidSubdomain(bytes32("user name"))); // space
    }

    // ==================== Fuzzing Tests ====================

    function testFuzz_ValidCharacters(bytes32 domain) public {
        bool result = personaFactory.isValidSubdomain(domain);

        // Verify the result matches our expectations
        bool expectedValid = _isValidByOurRules(domain);
        assertEq(result, expectedValid, "Validation mismatch");
    }

    function testFuzz_SingleCharacter(uint8 charCode) public {
        bytes32 domain = bytes32(0);
        domain = bytes32(uint256(charCode) << 248); // Put char in first position

        bool result = personaFactory.isValidSubdomain(domain);

        // Valid ONLY if: lowercase letter (97-122)
        // Single hyphens and numbers are invalid as they don't meet start/end requirements
        bool shouldBeValid = (charCode >= 97 && charCode <= 122);

        assertEq(result, shouldBeValid, "Single character validation incorrect");
    }

    // ==================== Gas Tests ====================

    function test_GasUsage() public view {
        uint256 gasBefore;
        uint256 gasAfter;

        // Short domain
        gasBefore = gasleft();
        personaFactory.isValidSubdomain(bytes32("hello"));
        gasAfter = gasleft();
        console.log("Gas for short domain (5 chars):", gasBefore - gasAfter);

        // Long domain
        gasBefore = gasleft();
        personaFactory.isValidSubdomain(
            bytes32("this-is-a-very-long-subdomain")
        );
        gasAfter = gasleft();
        console.log("Gas for long domain (29 chars):", gasBefore - gasAfter);

        // Max length domain
        gasBefore = gasleft();
        personaFactory.isValidSubdomain(
            bytes32("abcdefghijklmnopqrstuvwxyz123456")
        );
        gasAfter = gasleft();
        console.log(
            "Gas for max length domain (32 chars):", gasBefore - gasAfter
        );
    }

    // ==================== Helper Functions ====================

    function _isValidByOurRules(bytes32 domain) internal pure returns (bool) {
        // Find length
        uint256 length = 0;
        for (uint256 i = 0; i < 32; i++) {
            if (domain[i] == 0x00) break;
            length++;
        }

        if (length == 0) return false;

        // Check first character - must be a letter
        if (!(domain[0] >= 0x61 && domain[0] <= 0x7A)) return false;

        // Check last character - must be a letter or digit
        bytes1 lastChar = domain[length - 1];
        if (
            !(
                (lastChar >= 0x61 && lastChar <= 0x7A)
                    || (lastChar >= 0x30 && lastChar <= 0x39)
            )
        ) {
            return false;
        }

        // Check all characters
        for (uint256 i = 0; i < length; i++) {
            bytes1 char = domain[i];
            if (
                // a-z
                // 0-9
                !(
                    (char >= 0x61 && char <= 0x7A)
                        || (char >= 0x30 && char <= 0x39) || (char == 0x2D)
                )
            ) {
                // -
                return false;
            }
        }

        return true;
    }

    // ==================== Specific Bug Tests ====================

    function test_BugCheck_NullByteHandling() public {
        // Create "hello" with proper byte ordering
        bytes32 domain = bytes32("hello");

        // Should be valid because it reads as "hello"
        assertTrue(personaFactory.isValidSubdomain(domain));
    }

    function test_BugCheck_AllNullBytes() public {
        // All null bytes should be invalid (empty string)
        assertFalse(personaFactory.isValidSubdomain(bytes32(0)));
    }

    // ==================== Integration with Domain Registration ====================

    function test_Integration_DuplicateDomainPrevention() public {
        // First, create a persona with a valid domain
        vm.startPrank(user1);
        amicaToken.approve(address(personaFactory), DEFAULT_MINT_COST);

        bytes32 domain = bytes32("test-domain");
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TEST",
            domain,
            0,
            address(0),
            0
        );

        // Verify domain is registered
        assertEq(personaFactory.domains(domain), tokenId);

        // Try to create another persona with the same domain
        amicaToken.approve(address(personaFactory), DEFAULT_MINT_COST);
        vm.expectRevert(abi.encodeWithSelector(Invalid.selector, 11)); // Already registered
        personaFactory.createPersona(
            address(amicaToken),
            "Another Persona",
            "TEST2",
            domain,
            0,
            address(0),
            0
        );
        vm.stopPrank();
    }

    function test_Integration_InvalidDomainRejection() public {
        vm.startPrank(user1);
        amicaToken.approve(address(personaFactory), DEFAULT_MINT_COST);

        // Try invalid domains
        bytes32[] memory invalidDomains = new bytes32[](5);
        invalidDomains[0] = bytes32("Test-Domain"); // uppercase
        invalidDomains[1] = bytes32("-invalid"); // starts with hyphen
        invalidDomains[2] = bytes32("invalid-"); // ends with hyphen
        invalidDomains[3] = bytes32("test_domain"); // underscore
        invalidDomains[4] = bytes32(0); // empty

        for (uint256 i = 0; i < invalidDomains.length; i++) {
            uint8 expectedError = invalidDomains[i] == bytes32(0) ? 10 : 13; // Empty vs format error
            vm.expectRevert(
                abi.encodeWithSelector(Invalid.selector, expectedError)
            );
            personaFactory.createPersona(
                address(amicaToken),
                "Test Persona",
                "TEST",
                invalidDomains[i],
                0,
                address(0),
                0
            );
        }

        vm.stopPrank();
    }
}
