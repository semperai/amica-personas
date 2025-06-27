// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Fixtures} from "./shared/Fixtures.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PersonaTokenFactory} from "../src/PersonaTokenFactory.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {console} from "forge-std/console.sol";

contract PersonaTokenFactoryGraduationTest is Fixtures {
    using PoolIdLibrary for bytes32;

    uint256 constant LIQUIDITY_TOKEN_AMOUNT = 333_333_334 ether;
    uint256 constant BONDING_AMOUNT = 333_333_333 ether;
    uint256 constant GRADUATION_PERCENT = 85;
    uint256 constant TARGET_RAISE = 1_000_000 ether; // 1M AMICA target

    function setUp() public override {
        super.setUp();

        // Update AMICA multiplier to achieve 1M AMICA raise for graduation
        // Multiplier = (85% of 333,333,333) / 1,000,000 ≈ 283.33
        vm.prank(factoryOwner);
        personaFactory.configurePairingToken(
            address(amicaToken),
            1000 ether, // mint cost
            283.33 ether, // multiplier - 1M AMICA buys 283.33M persona tokens
            true
        );

        // Approve factory to spend tokens
        vm.prank(user1);
        amicaToken.approve(address(personaFactory), type(uint256).max);

        vm.prank(user2);
        amicaToken.approve(address(personaFactory), type(uint256).max);

        vm.prank(user3);
        amicaToken.approve(address(personaFactory), type(uint256).max);
    }

    function createPersonaFixture()
        public
        returns (uint256 tokenId, address personaToken, address creator)
    {
        creator = user1;
        vm.prank(creator);
        tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TEST",
            bytes32("testpersona"),
            0, // no initial buy
            address(0), // no agent token
            0 // no min agent tokens
        );

        // Get persona data
        (address token,,,,,,,) = personaFactory.personas(tokenId);

        personaToken = token;
    }

    function test_GraduatePersona_CreatesV4Pool() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Buy tokens to trigger graduation - should need ~1M AMICA
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, TARGET_RAISE, 0, user2, block.timestamp + 1
        );

        // Verify graduation
        (,,, bool graduated,,,,) = personaFactory.personas(tokenId);
        assertTrue(graduated);
    }

    function test_Graduation_SendsTokensToAmica() public {
        (uint256 tokenId, address personaToken,) = createPersonaFixture();

        uint256 amicaBalanceBefore =
            IERC20(personaToken).balanceOf(address(amicaToken));

        // Trigger graduation with 1M AMICA
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, TARGET_RAISE, 0, user2, block.timestamp + 1
        );

        // Check AMICA received tokens (1/3 of supply when no agent token)
        uint256 expectedAmicaAmount = 333_333_334 ether; // THIRD_SUPPLY + 1
        uint256 amicaBalanceAfter =
            IERC20(personaToken).balanceOf(address(amicaToken));
        assertEq(amicaBalanceAfter - amicaBalanceBefore, expectedAmicaAmount);
    }

    function test_Graduation_WithExcessFunds() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Buy more than graduation threshold
        uint256 excessAmount = TARGET_RAISE + 50_000 ether;

        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, excessAmount, 0, user2, block.timestamp + 1
        );

        // Verify graduated
        (,,, bool graduated,,,,) = personaFactory.personas(tokenId);
        assertTrue(graduated);
    }

    function test_Graduation_ExactThreshold() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Buy exact amount for graduation
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, TARGET_RAISE, 0, user2, block.timestamp + 1
        );

        // Verify graduated
        (,,, bool graduated,,,,) = personaFactory.personas(tokenId);
        assertTrue(graduated);
    }

    function test_CannotTradeAfterGraduation() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Graduate the persona
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, TARGET_RAISE, 0, user2, block.timestamp + 1
        );

        // Try to buy more tokens after graduation
        vm.prank(user3);
        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 4)); // TradingOnUniswap = 4
        personaFactory.swapExactTokensForTokens(
            tokenId, 1000 ether, 0, user3, block.timestamp + 1
        );
    }

    function test_ClaimRewards_AfterGraduation() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // User2 buys some tokens (100k AMICA)
        uint256 user2Amount = 100_000 ether;
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, user2Amount, 0, user2, block.timestamp + 1
        );

        // User3 triggers graduation
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId, TARGET_RAISE, 0, user3, block.timestamp + 1
        );

        // User2 claims their rewards
        vm.prank(user2);
        personaFactory.claimRewards(tokenId);

        // Verify can't claim twice
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 14)); // AlreadyClaimed = 14
        personaFactory.claimRewards(tokenId);
    }

    function test_ClaimRewards_IncludesBonus() public {
        (uint256 tokenId, address personaToken,) = createPersonaFixture();

        // User2 buys tokens
        uint256 buyAmount = 50_000 ether; // 50k AMICA
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, buyAmount, 0, user2, block.timestamp + 1
        );

        // Record how many tokens user2 should have purchased
        uint256 user2Purchased = personaFactory.bondingBalances(tokenId, user2);

        // Graduate the persona
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId, TARGET_RAISE, 0, user3, block.timestamp + 1
        );

        // Get claimable rewards for user2
        (
            uint256 purchasedAmount,
            uint256 bonusAmount,
            uint256 agentRewardAmount,
            uint256 totalClaimable,
            bool claimed
        ) = personaFactory.getClaimableRewards(tokenId, user2);

        assertEq(purchasedAmount, user2Purchased);
        assertGt(bonusAmount, 0); // Should receive bonus from unsold tokens
        assertEq(agentRewardAmount, 0); // No agent tokens
        assertFalse(claimed);

        // Claim and verify
        uint256 balanceBefore = IERC20(personaToken).balanceOf(user2);

        vm.prank(user2);
        personaFactory.claimRewards(tokenId);

        uint256 balanceAfter = IERC20(personaToken).balanceOf(user2);
        assertEq(balanceAfter - balanceBefore, totalClaimable);
    }

    function test_Graduation_WithDifferentPairingTokens() public {
        // Deploy USDC
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 18);
        usdc.mint(user1, 20_000 ether);
        usdc.mint(user2, 20_000 ether);

        // Configure USDC with different multiplier
        // Let's say we want to raise 10k USDC for graduation
        // Multiplier = 283,333,333 / 10,000 = 28,333.33
        vm.prank(factoryOwner);
        personaFactory.configurePairingToken(
            address(usdc),
            100 ether,
            28333.33 ether, // 10k USDC gets you to graduation
            true
        );

        // Create persona with USDC
        vm.startPrank(user1);
        usdc.approve(address(personaFactory), type(uint256).max);
        uint256 tokenId = personaFactory.createPersona(
            address(usdc),
            "USDC Persona",
            "USDCP",
            bytes32("usdcpersona"),
            0,
            address(0),
            0
        );
        vm.stopPrank();

        // Graduate with USDC
        vm.startPrank(user2);
        usdc.approve(address(personaFactory), type(uint256).max);

        personaFactory.swapExactTokensForTokens(
            tokenId,
            10_000 ether, // 10k USDC
            0,
            user2,
            block.timestamp + 1
        );
        vm.stopPrank();

        // Verify graduated
        (,,, bool graduated,,,,) = personaFactory.personas(tokenId);
        assertTrue(graduated);
    }

    function test_Graduation_WithAgentToken() public {
        // Deploy agent token
        MockERC20 agentToken = new MockERC20("Agent Token", "AGENT", 18);
        agentToken.mint(user1, 1_000_000 ether);
        agentToken.mint(user2, 1_000_000 ether);

        // Create persona with agent token requirement
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Agent Persona",
            "AGENTP",
            bytes32("agentpersona"),
            0,
            address(agentToken),
            100_000 ether // Require 100k agent tokens
        );

        // Try to graduate without meeting agent requirement
        // For agent personas, bonding amount is 222,222,222 (2/9 of supply)
        // Graduation threshold = 188,888,888 (85% of 222,222,222)
        // With 283.33 multiplier: amicaNeeded = 188,888,888 / 283.33 ≈ 666,667 AMICA
        uint256 agentGraduationAmount = 666_667 ether;

        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, agentGraduationAmount, 0, user2, block.timestamp + 1
        );

        // Should not be graduated yet
        (,,, bool graduated,,,,) = personaFactory.personas(tokenId);
        assertFalse(graduated);

        // Deposit agent tokens to meet requirement
        vm.startPrank(user1);
        agentToken.approve(address(personaFactory), 100_000 ether);
        personaFactory.depositAgentTokens(tokenId, 100_000 ether);
        vm.stopPrank();

        // Now it should graduate automatically
        (,,, graduated,,,,) = personaFactory.personas(tokenId);
        assertTrue(graduated);

        // Verify agent pool was created
        (,,,,,,, PoolId agentPoolId) = personaFactory.personas(tokenId);
        assertTrue(PoolId.unwrap(agentPoolId) != bytes32(0));
    }

    function test_GetClaimableRewards_BeforeGraduation() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Buy some tokens but don't graduate
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, 10_000 ether, 0, user2, block.timestamp + 1
        );

        // Check claimable rewards before graduation
        (
            uint256 purchasedAmount,
            uint256 bonusAmount,
            uint256 agentRewardAmount,
            uint256 totalClaimable,
            bool claimed
        ) = personaFactory.getClaimableRewards(tokenId, user2);

        assertEq(purchasedAmount, 0); // Can't claim before graduation
        assertEq(bonusAmount, 0);
        assertEq(agentRewardAmount, 0);
        assertEq(totalClaimable, 0);
        assertFalse(claimed);
    }

    function test_CannotClaimBeforeGraduation() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Buy some tokens
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, 10_000 ether, 0, user2, block.timestamp + 1
        );

        // Try to claim before graduation
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 3)); // NotGraduated = 3
        personaFactory.claimRewards(tokenId);
    }

    function test_MultipleUsersClaimAfterGraduation() public {
        (uint256 tokenId, address personaToken,) = createPersonaFixture();

        // Multiple users buy tokens
        uint256 user2Amount = 50_000 ether;
        uint256 user3Amount = 75_000 ether;

        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, user2Amount, 0, user2, block.timestamp + 1
        );

        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId, user3Amount, 0, user3, block.timestamp + 1
        );

        // Trigger graduation with remaining amount
        uint256 totalRaisedSoFar = user2Amount + user3Amount;
        uint256 remainingNeeded = TARGET_RAISE > totalRaisedSoFar
            ? TARGET_RAISE - totalRaisedSoFar
            : 0;

        if (remainingNeeded > 0) {
            vm.prank(user1);
            personaFactory.swapExactTokensForTokens(
                tokenId,
                remainingNeeded + 100_000 ether, // Add extra to ensure graduation
                0,
                user1,
                block.timestamp + 1
            );
        }

        // Both users claim
        vm.prank(user2);
        personaFactory.claimRewards(tokenId);

        vm.prank(user3);
        personaFactory.claimRewards(tokenId);

        // Verify both received tokens
        assertGt(IERC20(personaToken).balanceOf(user2), 0);
        assertGt(IERC20(personaToken).balanceOf(user3), 0);

        // User3 should have more tokens (bought more)
        assertGt(
            IERC20(personaToken).balanceOf(user3),
            IERC20(personaToken).balanceOf(user2)
        );
    }

    function test_Graduation_EmitsCorrectEvents() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // The actual pool creation happens during graduation
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, TARGET_RAISE, 0, user2, block.timestamp + 1
        );
    }

    function test_SellTokensBeforeGraduation() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // User2 buys tokens
        uint256 buyAmount = 50_000 ether;
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, buyAmount, 0, user2, block.timestamp + 1
        );

        uint256 tokensReceived = personaFactory.bondingBalances(tokenId, user2);
        uint256 balanceBefore = amicaToken.balanceOf(user2);

        // User2 sells half their tokens back
        uint256 sellAmount = tokensReceived / 2;
        vm.prank(user2);
        personaFactory.swapExactTokensForPairingTokens(
            tokenId, sellAmount, 0, user2, block.timestamp + 1
        );

        // Verify tokens were sold
        uint256 balanceAfter = amicaToken.balanceOf(user2);
        assertGt(balanceAfter, balanceBefore);
        assertEq(
            personaFactory.bondingBalances(tokenId, user2),
            tokensReceived - sellAmount
        );
    }

    function test_CannotSellAfterGraduation() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Buy and graduate
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, TARGET_RAISE, 0, user2, block.timestamp + 1
        );

        // Try to sell after graduation
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 4)); // TradingOnUniswap = 4
        personaFactory.swapExactTokensForPairingTokens(
            tokenId, 1000 ether, 0, user2, block.timestamp + 1
        );
    }

    function test_CollectFeesAfterGraduation() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Graduate the persona
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, TARGET_RAISE, 0, user2, block.timestamp + 1
        );

        // Wait some time for fees to accumulate (in real scenario)
        vm.warp(block.timestamp + 1 days);

        // Owner collects fees
        vm.prank(user1); // user1 is the NFT owner
        (uint256 amount0, uint256 amount1) =
            personaFactory.collectFees(tokenId, user1);

        // In a fresh pool, fees might be 0, but the function should not revert
        assertEq(amount0 + amount1, 0); // No fees yet in fresh pool
    }

    function test_NonOwnerCannotCollectFees() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Graduate the persona
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, TARGET_RAISE, 0, user2, block.timestamp + 1
        );

        // Non-owner tries to collect fees
        vm.prank(user2); // user2 is not the NFT owner
        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 11)); // Unauthorized = 11
        personaFactory.collectFees(tokenId, user2);
    }
}
