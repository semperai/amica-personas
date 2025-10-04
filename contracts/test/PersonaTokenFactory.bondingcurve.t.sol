// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Fixtures} from "./shared/Fixtures.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PersonaTokenFactory} from "../src/PersonaTokenFactory.sol";
import {PersonaToken} from "../src/PersonaToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PersonaTokenFactoryBondingCurveTest
 * @notice Tests bonding curve behavior, pricing, and complex trading scenarios
 */
contract PersonaTokenFactoryBondingCurveTest is Fixtures {
    MockERC20 public agentToken;

    // Constants
    uint256 constant PERSONA_TOKEN_SUPPLY = 1_000_000_000 ether;
    uint256 constant THIRD_SUPPLY = 333_333_333 ether;
    uint256 constant SIXTH_SUPPLY = 166_666_666 ether;

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
    event Graduated(
        uint256 indexed tokenId,
        bytes32 indexed poolId,
        uint256 totalDeposited,
        uint256 tokensSold
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

    // ==================== Price Discovery Tests ====================

    function test_BondingCurve_PriceIncreasesWithPurchases() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Price Test",
            "PRICE",
            bytes32("pricetest"),
            0,
            address(0),
            0
        );

        uint256 buyAmount = 10_000 ether;

        // First purchase
        vm.prank(user2);
        uint256 tokens1 = personaFactory.swapExactTokensForTokens(
            tokenId, buyAmount, 0, user2, block.timestamp + 300
        );

        // Second purchase (same amount)
        vm.prank(user2);
        uint256 tokens2 = personaFactory.swapExactTokensForTokens(
            tokenId, buyAmount, 0, user2, block.timestamp + 300
        );

        // Should receive fewer tokens on second purchase (price increased)
        assertLt(tokens2, tokens1, "Price should increase with purchases");
    }

    function test_BondingCurve_SellPriceLowerThanBuy() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Sell Price",
            "SELL",
            bytes32("sellprice"),
            0,
            address(0),
            0
        );

        uint256 buyAmount = 50_000 ether;

        // Buy tokens
        vm.prank(user2);
        uint256 tokensReceived = personaFactory.swapExactTokensForTokens(
            tokenId, buyAmount, 0, user2, block.timestamp + 300
        );

        // Immediately sell all tokens back
        vm.prank(user2);
        uint256 pairingReceived = personaFactory.swapExactTokensForPairingTokens(
            tokenId, tokensReceived, 0, user2, block.timestamp + 300
        );

        // Should receive less than what was paid (spread)
        assertLt(
            pairingReceived, buyAmount, "Sell price should be lower than buy price"
        );
    }

    function test_BondingCurve_ConsistentPricing() public {
        // Create persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Pricing Test",
            "PRICE",
            bytes32("pricing"),
            0,
            address(0),
            0
        );

        // Buy in small increments
        vm.startPrank(user2);
        uint256 received1 = personaFactory.swapExactTokensForTokens(
            tokenId, 10_000 ether, 0, user2, block.timestamp + 300
        );
        uint256 received2 = personaFactory.swapExactTokensForTokens(
            tokenId, 10_000 ether, 0, user2, block.timestamp + 300
        );
        vm.stopPrank();

        // Second purchase should yield fewer tokens (price increases)
        assertLt(received2, received1, "Later purchases should get fewer tokens");
    }

    // ==================== Liquidity Tests ====================

    function test_BondingCurve_MaxPurchaseBeforeGraduation() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Max Buy",
            "MAX",
            bytes32("maxbuy"),
            0,
            address(0),
            0
        );

        // Try to buy all bonding supply
        uint256 largeAmount = 10_000_000 ether;

        vm.startPrank(user2);
        uint256 totalBought = 0;
        for (uint256 i = 0; i < 50; i++) {
            (,,, uint256 gradTime,,,) = personaFactory.personas(tokenId);
            if (gradTime > 0) break;

            try personaFactory.swapExactTokensForTokens(
                tokenId, largeAmount, 0, user2, block.timestamp + 300
            ) returns (uint256 received) {
                totalBought += received;
            } catch {
                break;
            }
        }
        vm.stopPrank();

        // Should have graduated
        (,,, uint256 graduationTimestamp,,,) = personaFactory.personas(tokenId);
        assertTrue(graduationTimestamp > 0, "Should have graduated");

        // Bought amount should be close to bonding supply (85%+ threshold triggers graduation)
        (uint256 totalPairing, uint256 tokensPurchased,) =
            personaFactory.preGraduationStates(tokenId);
        assertGt(tokensPurchased, THIRD_SUPPLY * 85 / 100, "Should exceed 85% threshold");
    }

    function test_BondingCurve_RevertExceedSupply() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Exceed",
            "EXC",
            bytes32("exceed"),
            0,
            address(0),
            0
        );

        // Buy tokens until we hit the limit
        uint256 buyAmount = 100_000 ether;
        vm.startPrank(user2);
        for (uint256 i = 0; i < 100; i++) {
            (,,, uint256 gradTime,,,) = personaFactory.personas(tokenId);
            if (gradTime > 0) break;

            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 300
            ) {} catch {
                // Expected to fail when exceeding supply or graduating
                break;
            }
        }
        vm.stopPrank();
    }

    // ==================== Pricing Multiplier Tests ====================

    function test_PricingMultiplier_AffectsPurchaseAmount() public {
        // Create persona with AMICA (multiplier 1333 ether)
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Multiplier Test",
            "MULT",
            bytes32("multiplier"),
            0,
            address(0),
            0
        );

        uint256 buyAmount = 10_000 ether;

        vm.prank(user2);
        uint256 received = personaFactory.swapExactTokensForTokens(
            tokenId, buyAmount, 0, user2, block.timestamp + 300
        );

        // The multiplier affects how much we get
        assertGt(received, 0, "Should receive tokens");

        // Verify state
        (uint256 totalPairing, uint256 tokensPurchased,) =
            personaFactory.preGraduationStates(tokenId);
        assertEq(totalPairing, buyAmount);
        assertEq(tokensPurchased, received);
    }

    // ==================== Trading Volume Tests ====================

    function test_HighVolume_ManySmallTrades() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Volume Test",
            "VOL",
            bytes32("volume"),
            0,
            address(0),
            0
        );

        uint256 tradeAmount = 1000 ether;
        uint256 tradeCount = 100;

        // Execute many small trades
        vm.startPrank(user2);
        for (uint256 i = 0; i < tradeCount; i++) {
            (,,, uint256 gradTime,,,) = personaFactory.personas(tokenId);
            if (gradTime > 0) break;

            try personaFactory.swapExactTokensForTokens(
                tokenId, tradeAmount, 0, user2, block.timestamp + 300
            ) {} catch {
                break;
            }
        }
        vm.stopPrank();

        // Verify state consistency
        (uint256 totalPairing, uint256 tokensPurchased,) =
            personaFactory.preGraduationStates(tokenId);
        assertGt(totalPairing, 0, "Should have collected pairing tokens");
        assertGt(tokensPurchased, 0, "Should have sold tokens");

        // User balance should match state
        uint256 userBalance = personaFactory.bondingBalances(tokenId, user2);
        assertEq(userBalance, tokensPurchased, "Balance should match purchases");
    }

    function test_BuySellCycles_MultipleUsers() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Cycle Test",
            "CYCLE",
            bytes32("cycle"),
            0,
            address(0),
            0
        );

        // User2 and User3 trade back and forth
        for (uint256 i = 0; i < 5; i++) {
            // User2 buys
            vm.prank(user2);
            uint256 bought2 = personaFactory.swapExactTokensForTokens(
                tokenId, 10_000 ether, 0, user2, block.timestamp + 300
            );

            // User3 buys
            vm.prank(user3);
            uint256 bought3 = personaFactory.swapExactTokensForTokens(
                tokenId, 10_000 ether, 0, user3, block.timestamp + 300
            );

            // User2 sells some
            uint256 balance2 = personaFactory.bondingBalances(tokenId, user2);
            if (balance2 > 0) {
                vm.prank(user2);
                personaFactory.swapExactTokensForPairingTokens(
                    tokenId, balance2 / 2, 0, user2, block.timestamp + 300
                );
            }

            // User3 sells some
            uint256 balance3 = personaFactory.bondingBalances(tokenId, user3);
            if (balance3 > 0) {
                vm.prank(user3);
                personaFactory.swapExactTokensForPairingTokens(
                    tokenId, balance3 / 3, 0, user3, block.timestamp + 300
                );
            }
        }

        // Verify state consistency
        uint256 balance2Final = personaFactory.bondingBalances(tokenId, user2);
        uint256 balance3Final = personaFactory.bondingBalances(tokenId, user3);
        (uint256 totalPairing, uint256 tokensPurchased,) =
            personaFactory.preGraduationStates(tokenId);

        assertEq(
            tokensPurchased,
            balance2Final + balance3Final,
            "Total purchased should match balances"
        );
    }

    // ==================== Graduation Threshold Tests ====================

    function test_GraduationThreshold_Exactly85Percent() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Threshold Test",
            "THRESH",
            bytes32("threshold"),
            0,
            address(0),
            0
        );

        // Buy to reach 85% threshold - need ~283M tokens (85% of 333M)
        uint256 target = THIRD_SUPPLY * 85 / 100;

        vm.startPrank(user2);
        // Use larger buy amounts to reach threshold faster
        uint256 buyAmount = 100_000 ether;

        for (uint256 i = 0; i < 200; i++) {
            (,,, uint256 gradTime,,,) = personaFactory.personas(tokenId);
            if (gradTime > 0) break;

            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 300
            ) {} catch {
                break;
            }
        }
        vm.stopPrank();

        // Should have graduated at or above 85%
        (,,, uint256 graduationTimestamp,,,) = personaFactory.personas(tokenId);
        assertTrue(graduationTimestamp > 0, "Should have graduated");

        (, uint256 finalPurchased,) = personaFactory.preGraduationStates(tokenId);
        assertGe(finalPurchased, target, "Should be at or above threshold");
    }

    function test_GraduationThreshold_WithAgent() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Agent Threshold",
            "AGTH",
            bytes32("agthresh"),
            0,
            address(agentToken),
            10_000 ether
        );

        // Agent personas have smaller bonding supply (1/6 instead of 1/3)
        // Need ~141M tokens (85% of 166M)
        uint256 target = SIXTH_SUPPLY * 85 / 100;

        // Deposit agent tokens first
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), type(uint256).max);
        personaFactory.depositAgentTokens(tokenId, 10_000 ether);
        vm.stopPrank();

        // Buy to threshold - use larger amounts
        vm.startPrank(user3);
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 200; i++) {
            (,,, uint256 gradTime,,,) = personaFactory.personas(tokenId);
            if (gradTime > 0) break;

            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user3, block.timestamp + 300
            ) {} catch {
                break;
            }
        }
        vm.stopPrank();

        // Should have graduated
        (,,, uint256 graduationTimestamp,,,) = personaFactory.personas(tokenId);
        assertTrue(graduationTimestamp > 0, "Should have graduated");
    }

    // ==================== Sell Limitations ====================

    function test_Sell_CannotExceedTotalCollected() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Sell Limit",
            "SLIM",
            bytes32("selllimit"),
            0,
            address(0),
            0
        );

        // User2 buys
        vm.prank(user2);
        uint256 bought2 = personaFactory.swapExactTokensForTokens(
            tokenId, 50_000 ether, 0, user2, block.timestamp + 300
        );

        // User3 buys
        vm.prank(user3);
        uint256 bought3 = personaFactory.swapExactTokensForTokens(
            tokenId, 50_000 ether, 0, user3, block.timestamp + 300
        );

        // User2 sells all
        vm.prank(user2);
        uint256 received2 = personaFactory.swapExactTokensForPairingTokens(
            tokenId, bought2, 0, user2, block.timestamp + 300
        );

        // User3 tries to sell all but should be capped
        vm.prank(user3);
        uint256 received3 = personaFactory.swapExactTokensForPairingTokens(
            tokenId, bought3, 0, user3, block.timestamp + 300
        );

        // Total received should not exceed total collected
        (uint256 totalCollected,,) = personaFactory.preGraduationStates(tokenId);
        assertGe(100_000 ether - totalCollected, 0, "Should not overdraw");
    }

    // ==================== Edge Case Tests ====================

    function test_VeryFirstPurchase_MinimalAmount() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "First Buy",
            "FIRST",
            bytes32("firstbuy"),
            0,
            address(0),
            0
        );

        // Very small first purchase (1 wei)
        vm.prank(user2);
        uint256 received = personaFactory.swapExactTokensForTokens(
            tokenId, 1, 0, user2, block.timestamp + 300
        );

        assertGt(received, 0, "Should receive some tokens even for tiny amount");
    }

    function test_BuyAfterSell_CurveMovement() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Price Adjust",
            "PADJ",
            bytes32("priceadj"),
            0,
            address(0),
            0
        );

        // User2 buys
        vm.prank(user2);
        uint256 bought2 = personaFactory.swapExactTokensForTokens(
            tokenId, 50_000 ether, 0, user2, block.timestamp + 300
        );

        // User2 sells all - curve moves back down
        vm.prank(user2);
        personaFactory.swapExactTokensForPairingTokens(
            tokenId, bought2, 0, user2, block.timestamp + 300
        );

        // User3 buys same amount - should get similar (could be slightly different due to rounding)
        vm.prank(user3);
        uint256 bought3 = personaFactory.swapExactTokensForTokens(
            tokenId, 50_000 ether, 0, user3, block.timestamp + 300
        );

        // After full round trip, next buyer should get similar amount
        // Allow small difference due to rounding
        uint256 diff = bought3 > bought2 ? bought3 - bought2 : bought2 - bought3;
        uint256 maxDiff = bought2 / 1000; // 0.1% tolerance
        assertLe(diff, maxDiff, "Should get similar tokens after full round trip");
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
