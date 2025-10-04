// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Fixtures} from "./shared/Fixtures.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PersonaTokenFactory} from "../src/PersonaTokenFactory.sol";
import {PersonaToken} from "../src/PersonaToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PersonaTokenFactoryEdgeCasesTest
 * @notice Tests edge cases, boundary conditions, and complex scenarios
 */
contract PersonaTokenFactoryEdgeCasesTest is Fixtures {
    MockERC20 public agentToken;
    MockERC20 public secondPairingToken;

    // Constants
    uint256 constant PERSONA_TOKEN_SUPPLY = 1_000_000_000 ether;
    uint256 constant THIRD_SUPPLY = 333_333_333 ether;
    uint256 constant SIXTH_SUPPLY = 166_666_666 ether;

    event PersonaCreated(
        uint256 indexed tokenId, bytes32 indexed domain, address indexed token
    );
    event TokensPurchased(
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 amountSpent,
        uint256 tokensReceived
    );
    event TokensSold(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 tokensSold,
        uint256 amountReceived
    );
    event AgentTokensDeposited(
        uint256 indexed tokenId,
        address indexed depositor,
        uint256 amount,
        uint256 newTotal
    );
    event AgentTokensWithdrawn(
        uint256 indexed tokenId,
        address indexed depositor,
        uint256 amount,
        uint256 newTotal
    );

    function setUp() public override {
        super.setUp();

        // Deploy agent token
        agentToken = new MockERC20("Agent Token", "AGENT", 18);
        agentToken.mint(user1, 10_000_000 ether);
        agentToken.mint(user2, 10_000_000 ether);
        agentToken.mint(user3, 10_000_000 ether);

        // Deploy second pairing token
        secondPairingToken = new MockERC20("Second Token", "SECOND", 18);
        secondPairingToken.mint(user1, 10_000_000 ether);
        secondPairingToken.mint(user2, 10_000_000 ether);
        secondPairingToken.mint(user3, 10_000_000 ether);

        // Approve tokens for all users
        vm.startPrank(user1);
        amicaToken.approve(address(personaFactory), type(uint256).max);
        agentToken.approve(address(personaFactory), type(uint256).max);
        secondPairingToken.approve(address(personaFactory), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(user2);
        amicaToken.approve(address(personaFactory), type(uint256).max);
        agentToken.approve(address(personaFactory), type(uint256).max);
        secondPairingToken.approve(address(personaFactory), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(user3);
        amicaToken.approve(address(personaFactory), type(uint256).max);
        agentToken.approve(address(personaFactory), type(uint256).max);
        secondPairingToken.approve(address(personaFactory), type(uint256).max);
        vm.stopPrank();

        // Configure second pairing token
        vm.prank(factoryOwner);
        personaFactory.configurePairingToken(
            address(secondPairingToken),
            500 ether, // Different mint cost
            2000 ether, // Different pricing multiplier
            true
        );
    }

    // ==================== Boundary Conditions ====================

    function test_CreatePersona_MaxNameLength() public {
        // 32 character name (max allowed)
        string memory maxName = "12345678901234567890123456789012";
        bytes32 domain = bytes32("maxname");

        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken), maxName, "MAX", domain, 0, address(0), 0
        );

        (address token,,,,,,) = personaFactory.personas(tokenId);
        PersonaToken pToken = PersonaToken(token);
        assertEq(pToken.name(), string.concat(maxName, ".amica"));
    }

    function test_CreatePersona_RevertNameTooLong() public {
        // 33 character name (exceeds max)
        string memory tooLongName = "123456789012345678901234567890123";

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 3));
        personaFactory.createPersona(
            address(amicaToken),
            tooLongName,
            "LONG",
            bytes32("toolong"),
            0,
            address(0),
            0
        );
    }

    function test_CreatePersona_RevertEmptyName() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 3));
        personaFactory.createPersona(
            address(amicaToken), "", "SYM", bytes32("empty"), 0, address(0), 0
        );
    }

    function test_CreatePersona_MaxSymbolLength() public {
        // 10 character symbol (max allowed)
        string memory maxSymbol = "1234567890";
        bytes32 domain = bytes32("maxsym");

        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Max Symbol",
            maxSymbol,
            domain,
            0,
            address(0),
            0
        );

        (address token,,,,,,) = personaFactory.personas(tokenId);
        PersonaToken pToken = PersonaToken(token);
        assertEq(pToken.symbol(), string.concat(maxSymbol, ".amica"));
    }

    function test_CreatePersona_RevertSymbolTooLong() public {
        // 11 character symbol (exceeds max)
        string memory tooLongSymbol = "12345678901";

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 4));
        personaFactory.createPersona(
            address(amicaToken),
            "Name",
            tooLongSymbol,
            bytes32("toolongsym"),
            0,
            address(0),
            0
        );
    }

    function test_CreatePersona_RevertEmptySymbol() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 4));
        personaFactory.createPersona(
            address(amicaToken),
            "Name",
            "",
            bytes32("emptysym"),
            0,
            address(0),
            0
        );
    }

    function test_CreatePersona_RevertInsufficientBalance() public {
        // Create a user with insufficient balance
        address poorUser = address(0x999);

        vm.prank(poorUser);
        vm.expectRevert(abi.encodeWithSignature("Insufficient(uint8)", 0));
        personaFactory.createPersona(
            address(amicaToken),
            "Name",
            "SYM",
            bytes32("poor"),
            0,
            address(0),
            0
        );
    }

    function test_CreatePersona_RevertDisabledPairingToken() public {
        MockERC20 disabledToken = new MockERC20("Disabled", "DIS", 18);
        disabledToken.mint(user1, 10_000 ether);

        vm.startPrank(user1);
        disabledToken.approve(address(personaFactory), type(uint256).max);

        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 1));
        personaFactory.createPersona(
            address(disabledToken),
            "Name",
            "SYM",
            bytes32("disabled"),
            0,
            address(0),
            0
        );
        vm.stopPrank();
    }

    // ==================== Buy/Sell Edge Cases ====================

    function test_Buy_ZeroAmount_Reverts() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TST",
            bytes32("zerobuy"),
            0,
            address(0),
            0
        );

        vm.prank(user2);
        vm.expectRevert(); // Will revert in bonding curve calculation
        personaFactory.swapExactTokensForTokens(
            tokenId, 0, 0, user2, block.timestamp + 300
        );
    }

    function test_Buy_ExpiredDeadline_Reverts() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TST",
            bytes32("expired"),
            0,
            address(0),
            0
        );

        vm.warp(block.timestamp + 1000);

        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 5));
        personaFactory.swapExactTokensForTokens(
            tokenId, 1000 ether, 0, user2, block.timestamp - 1
        );
    }

    function test_Buy_ToZeroAddress_Reverts() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TST",
            bytes32("zeroaddr"),
            0,
            address(0),
            0
        );

        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 2));
        personaFactory.swapExactTokensForTokens(
            tokenId, 1000 ether, 0, address(0), block.timestamp + 300
        );
    }

    function test_Buy_SlippageProtection() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Slippage Test",
            "SLIP",
            bytes32("slippage"),
            0,
            address(0),
            0
        );

        // Set very high minAmountOut that can't be met
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("Insufficient(uint8)", 1));
        personaFactory.swapExactTokensForTokens(
            tokenId,
            1000 ether,
            type(uint256).max, // Impossible to meet
            user2,
            block.timestamp + 300
        );
    }

    function test_Sell_ZeroAmount_Reverts() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TST",
            bytes32("zerosell"),
            1000 ether,
            address(0),
            0
        );

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 1));
        personaFactory.swapExactTokensForPairingTokens(
            tokenId, 0, 0, user1, block.timestamp + 300
        );
    }

    function test_Sell_InsufficientBalance_Reverts() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TST",
            bytes32("insuf"),
            1000 ether,
            address(0),
            0
        );

        uint256 balance = personaFactory.bondingBalances(tokenId, user1);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("Insufficient(uint8)", 4));
        personaFactory.swapExactTokensForPairingTokens(
            tokenId, balance + 1, 0, user1, block.timestamp + 300
        );
    }

    function test_Sell_NonExistentPersona_Reverts() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 0));
        personaFactory.swapExactTokensForPairingTokens(
            999, // Non-existent tokenId
            100 ether,
            0,
            user1,
            block.timestamp + 300
        );
    }

    function test_BuyAndSell_RoundTrip() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Round Trip",
            "ROUND",
            bytes32("roundtrip"),
            0,
            address(0),
            0
        );

        uint256 initialBalance = amicaToken.balanceOf(user2);
        uint256 buyAmount = 10_000 ether;

        // Buy tokens
        vm.prank(user2);
        uint256 tokensReceived = personaFactory.swapExactTokensForTokens(
            tokenId, buyAmount, 0, user2, block.timestamp + 300
        );

        uint256 balanceAfterBuy = amicaToken.balanceOf(user2);
        assertEq(balanceAfterBuy, initialBalance - buyAmount);

        // Sell all tokens back
        vm.prank(user2);
        uint256 pairingTokensReceived =
            personaFactory.swapExactTokensForPairingTokens(
                tokenId, tokensReceived, 0, user2, block.timestamp + 300
            );

        uint256 finalBalance = amicaToken.balanceOf(user2);

        // Due to bonding curve, selling should return less than buying cost
        assertLt(finalBalance, initialBalance);
        assertEq(
            finalBalance, balanceAfterBuy + pairingTokensReceived, "Balance mismatch"
        );
    }

    // ==================== Agent Token Edge Cases ====================

    function test_DepositAgentTokens_ZeroAmount_Reverts() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Zero Deposit",
            "ZERO",
            bytes32("zerodeposit"),
            0,
            address(agentToken),
            1000 ether
        );

        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 1));
        personaFactory.depositAgentTokens(tokenId, 0);
    }

    function test_WithdrawAgentTokens_AfterGraduation_Reverts() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Withdraw After",
            "WITH",
            bytes32("withdraw"),
            0,
            address(agentToken),
            0
        );

        // Deposit
        vm.startPrank(user2);
        personaFactory.depositAgentTokens(tokenId, 1000 ether);
        vm.stopPrank();

        // Graduate
        _graduatePersona(tokenId);

        // Verify graduated
        (,,, uint256 gradTime,,,) = personaFactory.personas(tokenId);
        assertTrue(gradTime > 0, "Must be graduated");

        // Try to withdraw
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 2));
        personaFactory.withdrawAgentTokens(tokenId, 500 ether);
    }

    function test_DepositAgentTokens_MultipleDeposits_Accumulate() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Multi Deposit",
            "MULTI",
            bytes32("multideposit"),
            0,
            address(agentToken),
            5000 ether
        );

        // Multiple small deposits
        vm.startPrank(user2);
        for (uint256 i = 0; i < 5; i++) {
            personaFactory.depositAgentTokens(tokenId, 1000 ether);
        }
        vm.stopPrank();

        uint256 totalDeposit = personaFactory.agentDeposits(tokenId, user2);
        assertEq(totalDeposit, 5000 ether, "Deposits should accumulate");

        (,, uint256 totalAgentDeposited) =
            personaFactory.preGraduationStates(tokenId);
        assertEq(totalAgentDeposited, 5000 ether);
    }

    function test_WithdrawAgentTokens_PartialWithdrawals() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Partial Withdraw",
            "PART",
            bytes32("partial"),
            0,
            address(agentToken),
            0
        );

        // Deposit
        vm.startPrank(user2);
        personaFactory.depositAgentTokens(tokenId, 10_000 ether);

        // Withdraw in chunks
        personaFactory.withdrawAgentTokens(tokenId, 3000 ether);
        personaFactory.withdrawAgentTokens(tokenId, 2000 ether);
        personaFactory.withdrawAgentTokens(tokenId, 1000 ether);
        vm.stopPrank();

        uint256 remaining = personaFactory.agentDeposits(tokenId, user2);
        assertEq(remaining, 4000 ether, "Should have 4000 left");

        (,, uint256 totalAgentDeposited) =
            personaFactory.preGraduationStates(tokenId);
        assertEq(totalAgentDeposited, 4000 ether);
    }

    function test_AgentTokenDeposit_TriggersGraduation() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Auto Graduate",
            "AUTO",
            bytes32("autograd"),
            0,
            address(agentToken),
            10_000 ether // Requires agent tokens
        );

        // Buy enough tokens to reach 85% threshold (but don't graduate due to missing agent tokens)
        // Agent persona has 1/6 bonding supply = 166,666,666 ether
        // Need 85% = ~141,666,666 ether
        vm.startPrank(user2);
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 30; i++) {
            (,,, uint256 gradTime,,,) = personaFactory.personas(tokenId);
            if (gradTime > 0) break;

            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 300
            ) {} catch {
                break;
            }
        }
        vm.stopPrank();

        // Check not graduated yet (needs agent tokens)
        (,,, uint256 gradTime1,,,) = personaFactory.personas(tokenId);
        assertEq(gradTime1, 0, "Should not have graduated yet");

        // Deposit agent tokens - should trigger graduation
        vm.prank(user3);
        personaFactory.depositAgentTokens(tokenId, 10_000 ether);

        // Verify graduated
        (,,, uint256 gradTime2,,,) = personaFactory.personas(tokenId);
        assertTrue(gradTime2 > 0, "Should have graduated");
    }

    // ==================== Different Pairing Tokens ====================

    function test_CreatePersona_WithDifferentPairingToken() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(secondPairingToken),
            "Second Pair",
            "SEC",
            bytes32("secondpair"),
            0,
            address(0),
            0
        );

        (, address pairToken,,,,,) = personaFactory.personas(tokenId);
        assertEq(pairToken, address(secondPairingToken));
    }

    function test_MultiplePairingTokens_DifferentPricing() public {
        // Create two personas with different pairing tokens
        vm.startPrank(user1);
        uint256 tokenId1 = personaFactory.createPersona(
            address(amicaToken),
            "Amica Pair",
            "AMICA",
            bytes32("amicapair"),
            0,
            address(0),
            0
        );

        uint256 tokenId2 = personaFactory.createPersona(
            address(secondPairingToken),
            "Second Pair",
            "SECOND",
            bytes32("secondpair2"),
            0,
            address(0),
            0
        );
        vm.stopPrank();

        // Buy same amount for both
        uint256 buyAmount = 10_000 ether;

        vm.prank(user2);
        uint256 received1 = personaFactory.swapExactTokensForTokens(
            tokenId1, buyAmount, 0, user2, block.timestamp + 300
        );

        vm.prank(user2);
        uint256 received2 = personaFactory.swapExactTokensForTokens(
            tokenId2, buyAmount, 0, user2, block.timestamp + 300
        );

        // Different pricing multipliers should result in different amounts
        assertNotEq(
            received1, received2, "Should receive different amounts due to multiplier"
        );
    }

    // ==================== Sequential Token IDs ====================

    function test_CreateMultiplePersonas_SequentialTokenIds() public {
        uint256[] memory tokenIds = new uint256[](5);

        for (uint256 i = 0; i < 5; i++) {
            vm.prank(user1);
            tokenIds[i] = personaFactory.createPersona(
                address(amicaToken),
                string.concat("Persona", vm.toString(i)),
                string.concat("P", vm.toString(i)),
                bytes32(bytes(string.concat("domain", vm.toString(i)))),
                0,
                address(0),
                0
            );
        }

        // Verify sequential IDs
        for (uint256 i = 1; i < 5; i++) {
            assertEq(tokenIds[i], tokenIds[i - 1] + 1, "IDs should be sequential");
        }
    }

    // ==================== Domain Validation Edge Cases ====================

    function test_Domain_SingleCharacter() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken), "Single", "SGL", bytes32("a"), 0, address(0), 0
        );

        assertEq(personaFactory.domains(bytes32("a")), tokenId);
    }

    function test_Domain_MaxLength() public {
        // 32 character domain (all slots filled)
        bytes32 maxDomain = bytes32("abcdefghijklmnopqrstuvwxyzabcdef");

        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Max Domain",
            "MAX",
            maxDomain,
            0,
            address(0),
            0
        );

        assertEq(personaFactory.domains(maxDomain), tokenId);
    }

    function test_Domain_WithNumbers() public {
        bytes32 domain = bytes32("test123");

        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken), "Numbers", "NUM", domain, 0, address(0), 0
        );

        assertEq(personaFactory.domains(domain), tokenId);
    }

    function test_Domain_WithHyphens() public {
        bytes32 domain = bytes32("test-with-hyphens");

        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken), "Hyphens", "HYP", domain, 0, address(0), 0
        );

        assertEq(personaFactory.domains(domain), tokenId);
    }

    function test_Domain_RevertStartsWithNumber() public {
        // Domain can start with number according to the validation function
        // This test verifies the actual behavior
        bytes32 domain = bytes32("1test");

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 13));
        personaFactory.createPersona(
            address(amicaToken), "Num Start", "NUM", domain, 0, address(0), 0
        );
    }

    function test_Domain_RevertEndsWithHyphen() public {
        bytes32 domain = bytes32("test-");

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 13));
        personaFactory.createPersona(
            address(amicaToken), "End Hyphen", "END", domain, 0, address(0), 0
        );
    }

    // ==================== Helper Functions ====================

    function _graduatePersona(uint256 tokenId) internal {
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            (,,, uint256 gradTime,,,) = personaFactory.personas(tokenId);
            if (gradTime > 0) break;

            vm.prank(user2);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 1
            ) {} catch {
                break;
            }
        }
    }
}
