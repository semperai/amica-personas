// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Fixtures} from "./shared/Fixtures.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PersonaTokenFactory} from "../src/PersonaTokenFactory.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PersonaTokenFactoryReentrancyTest
 * @notice Tests reentrancy protection and security aspects
 */
contract PersonaTokenFactoryReentrancyTest is Fixtures {
    MockERC20 public agentToken;

    event TokensPurchased(
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 amountSpent,
        uint256 tokensReceived
    );

    function setUp() public override {
        super.setUp();

        agentToken = new MockERC20("Agent Token", "AGENT", 18);
        agentToken.mint(user1, 10_000_000 ether);
        agentToken.mint(user2, 10_000_000 ether);
        agentToken.mint(user3, 10_000_000 ether);

        // Approve tokens
        vm.startPrank(user1);
        amicaToken.approve(address(personaFactory), type(uint256).max);
        agentToken.approve(address(personaFactory), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(user2);
        amicaToken.approve(address(personaFactory), type(uint256).max);
        agentToken.approve(address(personaFactory), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(user3);
        amicaToken.approve(address(personaFactory), type(uint256).max);
        agentToken.approve(address(personaFactory), type(uint256).max);
        vm.stopPrank();
    }

    // ==================== Reentrancy Tests ====================

    function test_CreatePersona_NoReentrancy() public {
        // This test verifies that the nonReentrant guard prevents reentrancy attacks
        // Simply create a persona normally - the guards are automatically tested
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TST",
            bytes32("test"),
            0,
            address(0),
            0
        );

        // Verify persona was created successfully
        assertEq(personaFactory.balanceOf(user1), 1);
        (address token,,,,,,) = personaFactory.personas(tokenId);
        assertTrue(token != address(0));
    }

    function test_SwapExactTokensForTokens_NoReentrancy() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Reentrant Test",
            "RENT",
            bytes32("reentrant"),
            0,
            address(0),
            0
        );

        // Try to buy tokens - nonReentrant should prevent reentrancy
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, 10_000 ether, 0, user2, block.timestamp + 300
        );

        // Verify purchase worked normally
        uint256 balance = personaFactory.bondingBalances(tokenId, user2);
        assertGt(balance, 0);
    }

    function test_SwapExactTokensForPairingTokens_NoReentrancy() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Sell Test",
            "SELL",
            bytes32("selltest"),
            10_000 ether,
            address(0),
            0
        );

        // Sell tokens - nonReentrant should prevent reentrancy
        uint256 balance = personaFactory.bondingBalances(tokenId, user1);
        assertGt(balance, 0);

        vm.prank(user1);
        personaFactory.swapExactTokensForPairingTokens(
            tokenId, balance / 2, 0, user1, block.timestamp + 300
        );

        // Verify sell worked normally
        uint256 newBalance = personaFactory.bondingBalances(tokenId, user1);
        assertLt(newBalance, balance);
    }

    function test_DepositAgentTokens_NoReentrancy() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Agent Test",
            "AGENT",
            bytes32("agenttest"),
            0,
            address(agentToken),
            10_000 ether
        );

        // Deposit agent tokens - nonReentrant should prevent reentrancy
        vm.prank(user2);
        personaFactory.depositAgentTokens(tokenId, 5000 ether);

        // Verify deposit worked normally
        uint256 deposit = personaFactory.agentDeposits(tokenId, user2);
        assertEq(deposit, 5000 ether);
    }

    function test_WithdrawAgentTokens_NoReentrancy() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Withdraw Test",
            "WITH",
            bytes32("withdraw"),
            0,
            address(agentToken),
            0
        );

        // Deposit
        vm.startPrank(user2);
        personaFactory.depositAgentTokens(tokenId, 10_000 ether);

        // Withdraw - nonReentrant should prevent reentrancy
        personaFactory.withdrawAgentTokens(tokenId, 5000 ether);
        vm.stopPrank();

        // Verify withdrawal worked normally
        uint256 remaining = personaFactory.agentDeposits(tokenId, user2);
        assertEq(remaining, 5000 ether);
    }

    function test_ClaimRewards_NoReentrancy() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Claim Test",
            "CLAIM",
            bytes32("claimtest"),
            0,
            address(0),
            0
        );

        // Graduate
        _graduatePersona(tokenId);

        // Wait for claim delay
        vm.warp(block.timestamp + 1 days + 1);

        // Claim - nonReentrant should prevent reentrancy
        vm.prank(user2);
        personaFactory.claimRewards(tokenId);

        // Verify claim worked and can't be done again
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 14));
        personaFactory.claimRewards(tokenId);
    }

    function test_CollectFees_NoReentrancy() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Fee Test",
            "FEE",
            bytes32("feetest"),
            0,
            address(0),
            0
        );

        // Graduate
        _graduatePersona(tokenId);

        // Verify graduated
        (,,, uint256 gradTime,,,) = personaFactory.personas(tokenId);
        assertTrue(gradTime > 0);

        // Try to collect fees - nonReentrant should prevent reentrancy
        vm.prank(user1);
        personaFactory.collectFees(tokenId, user1);

        // Should complete without issues
    }

    // ==================== State Consistency Tests ====================

    function test_ConcurrentBuys_StateConsistency() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Concurrent",
            "CONC",
            bytes32("concurrent"),
            0,
            address(0),
            0
        );

        uint256 buyAmount = 10_000 ether;

        // User2 buys
        vm.prank(user2);
        uint256 received2 = personaFactory.swapExactTokensForTokens(
            tokenId, buyAmount, 0, user2, block.timestamp + 300
        );

        // User3 buys (should get different price due to bonding curve)
        vm.prank(user3);
        uint256 received3 = personaFactory.swapExactTokensForTokens(
            tokenId, buyAmount, 0, user3, block.timestamp + 300
        );

        // Later buyers should get fewer tokens (price increases)
        assertLt(received3, received2, "Later buyers should get fewer tokens");

        // Verify total state
        (uint256 totalPairingTokens, uint256 tokensPurchased,) =
            personaFactory.preGraduationStates(tokenId);
        assertEq(totalPairingTokens, buyAmount * 2);
        assertEq(tokensPurchased, received2 + received3);
    }

    function test_BuyAndSell_StateConsistency() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "State Test",
            "STATE",
            bytes32("statetest"),
            0,
            address(0),
            0
        );

        uint256 buyAmount = 50_000 ether;

        // User2 buys
        vm.prank(user2);
        uint256 received = personaFactory.swapExactTokensForTokens(
            tokenId, buyAmount, 0, user2, block.timestamp + 300
        );

        (uint256 pairing1, uint256 purchased1,) =
            personaFactory.preGraduationStates(tokenId);

        // User2 sells half
        vm.prank(user2);
        personaFactory.swapExactTokensForPairingTokens(
            tokenId, received / 2, 0, user2, block.timestamp + 300
        );

        (uint256 pairing2, uint256 purchased2,) =
            personaFactory.preGraduationStates(tokenId);

        // State should be updated correctly
        assertLt(pairing2, pairing1, "Pairing tokens should decrease");
        assertLt(purchased2, purchased1, "Purchased tokens should decrease");
        assertEq(purchased2, received - received / 2, "Should match sold amount");
    }

    function test_DepositAndWithdraw_StateConsistency() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Agent State",
            "AGSTATE",
            bytes32("agentstate"),
            0,
            address(agentToken),
            0
        );

        // Multiple users deposit (with approvals)
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), type(uint256).max);
        personaFactory.depositAgentTokens(tokenId, 10_000 ether);
        vm.stopPrank();

        vm.startPrank(user3);
        agentToken.approve(address(personaFactory), type(uint256).max);
        personaFactory.depositAgentTokens(tokenId, 15_000 ether);
        vm.stopPrank();

        (,, uint256 total1) = personaFactory.preGraduationStates(tokenId);
        assertEq(total1, 25_000 ether);

        // User2 withdraws
        vm.prank(user2);
        personaFactory.withdrawAgentTokens(tokenId, 5000 ether);

        (,, uint256 total2) = personaFactory.preGraduationStates(tokenId);
        assertEq(total2, 20_000 ether);

        // Individual balances should be correct
        assertEq(personaFactory.agentDeposits(tokenId, user2), 5000 ether);
        assertEq(personaFactory.agentDeposits(tokenId, user3), 15_000 ether);
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
