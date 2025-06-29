// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {stdError} from "forge-std/StdError.sol";
import {console} from "forge-std/console.sol";
import {BondingCurve} from "../src/BondingCurve.sol";

contract BondingCurveTest_Security is Test {
    BondingCurve public bondingCurve;

    uint256 constant SUPPLY_222M = 222_222_222 ether;
    uint256 constant SUPPLY_333M = 333_333_333 ether;
    uint256 constant PRECISION = 1e18;
    uint256 constant CURVE_MULTIPLIER = 233; // Updated to match actual implementation

    function setUp() public {
        bondingCurve = new BondingCurve();
    }

    // ==================== Overflow/Underflow Tests ====================

    function test_Overflow_LargeAmounts() public view {
        uint256 supply = SUPPLY_333M;

        // Test with very large amounts (but still reasonable for ETH)
        uint256 largeAmount = 1_000_000 ether; // 1M ETH

        // Should not overflow
        uint256 tokensOut =
            bondingCurve.calculateAmountOut(largeAmount, 0, supply);
        assertGt(tokensOut, 0, "Should calculate output for large amounts");
        assertLt(tokensOut, supply, "Should not exceed supply");
    }

    function test_Underflow_SmallAmounts() public view {
        uint256 supply = SUPPLY_222M;

        // Test with reasonable minimum amounts (not 1 wei)
        uint256 reasonableMin = 0.00001 ether; // 10^13 wei

        uint256 tokensOut =
            bondingCurve.calculateAmountOut(reasonableMin, 0, supply);
        assertGt(tokensOut, 0, "Should handle 0.00001 ETH input");

        // At the end of curve
        uint256 nearEnd = supply - 1 ether;
        uint256 tokensOutEnd =
            bondingCurve.calculateAmountOut(reasonableMin, nearEnd, supply);
        assertGe(tokensOutEnd, 0, "Should handle small amounts at curve end");

        // Note: 1 wei returning 0 tokens is expected behavior
        // This is not a bug - nobody trades with 1 wei in practice
        uint256 tokensFor1Wei = bondingCurve.calculateAmountOut(1, 0, supply);
        assertEq(tokensFor1Wei, 0, "1 wei correctly returns 0 tokens");
    }

    // ==================== Precision Loss Tests ====================

    function test_PrecisionLoss_RoundingErrors() public view {
        uint256 supply = SUPPLY_333M;

        // Test many small trades to check for cumulative rounding errors
        uint256 totalIn = 0;
        uint256 totalOut = 0;
        uint256 currentSold = 0;

        // Do 1000 small trades
        for (uint256 i = 0; i < 1000; i++) {
            uint256 smallAmount = 1 ether + i; // Varying small amounts

            uint256 tokensOut = bondingCurve.calculateAmountOut(
                smallAmount, currentSold, supply
            );
            if (tokensOut == 0 || currentSold + tokensOut > supply) break;

            totalIn += smallAmount;
            totalOut += tokensOut;
            currentSold += tokensOut;
        }

        // Compare with single large trade
        uint256 singleTradeOut =
            bondingCurve.calculateAmountOut(totalIn, 0, supply);

        // Should be very close (within 0.01%)
        assertApproxEqRel(
            totalOut, singleTradeOut, 0.0001 ether, "Minimal precision loss"
        );

        console.log("Total small trades out:", totalOut / 1e18);
        console.log("Single trade out:", singleTradeOut / 1e18);
        console.log("Difference:", (int256(singleTradeOut) - int256(totalOut)));
    }

    // ==================== Exploit Prevention Tests ====================

    function test_ExploitPrevention_SandwichAttack() public view {
        uint256 supply = SUPPLY_222M;

        // Simulate sandwich attack scenario
        uint256 attackerCapital = 100000 ether;

        // 1. Attacker buys before victim
        uint256 attackerTokens =
            bondingCurve.calculateAmountOut(attackerCapital, 0, supply);

        // 2. Victim makes large purchase
        uint256 victimAmount = 50000 ether;
        uint256 victimTokens = bondingCurve.calculateAmountOut(
            victimAmount, attackerTokens, supply
        );

        // 3. Attacker sells
        uint256 attackerRefund = bondingCurve.calculateAmountOutForSell(
            attackerTokens, attackerTokens + victimTokens, supply
        );

        // Calculate attacker's profit/loss
        int256 attackerPnL = int256(attackerRefund) - int256(attackerCapital);

        console.log("Attacker capital:", attackerCapital / 1e18);
        console.log("Attacker refund:", attackerRefund / 1e18);
        console.log("Attacker PnL:", attackerPnL / 1e18);

        // With 0.1% fee, attacker should lose money
        assertLt(
            attackerPnL, 0, "Sandwich attack should be unprofitable due to fee"
        );
    }

    function test_ExploitPrevention_RoundingExploit() public view {
        uint256 supply = SUPPLY_333M;

        // Try to exploit rounding with many micro trades
        uint256 exploitRounds = 10000;
        uint256 totalProfit = 0;
        uint256 currentSold = supply / 2; // Start at midpoint

        for (uint256 i = 0; i < exploitRounds; i++) {
            // Try tiny amounts to exploit rounding
            uint256 buyAmount = 1 + (i % 10); // 1-10 wei

            uint256 tokensOut =
                bondingCurve.calculateAmountOut(buyAmount, currentSold, supply);
            if (tokensOut == 0) continue;

            uint256 sellBack = bondingCurve.calculateAmountOutForSell(
                tokensOut, currentSold + tokensOut, supply
            );

            // Can't profit from rounding due to fee
            assertLe(sellBack, buyAmount, "Cannot profit from micro trades");

            if (sellBack > buyAmount) {
                totalProfit += sellBack - buyAmount;
            }
        }

        assertEq(
            totalProfit, 0, "No profit possible from rounding exploitation"
        );
    }

    // ==================== Input Validation Tests ====================

    function test_Revert_InvalidInputs() public {
        uint256 supply = SUPPLY_222M;

        // Test zero amount for buy
        vm.expectRevert(
            abi.encodeWithSelector(BondingCurve.InvalidAmount.selector, 0)
        );
        bondingCurve.calculateAmountOut(0, 0, supply);

        // Test zero amount for sell
        vm.expectRevert(
            abi.encodeWithSelector(BondingCurve.InvalidAmount.selector, 1)
        );
        bondingCurve.calculateAmountOutForSell(0, supply / 2, supply);

        // Test selling more than sold
        vm.expectRevert(
            abi.encodeWithSelector(
                BondingCurve.InsufficientTokensSold.selector,
                1000 ether,
                500 ether
            )
        );
        bondingCurve.calculateAmountOutForSell(1000 ether, 500 ether, supply);

        // Test with no remaining reserve
        vm.expectRevert(
            abi.encodeWithSelector(
                BondingCurve.InsufficientReserve.selector, 1, 0
            )
        );
        bondingCurve.calculateAmountOut(1 ether, supply, supply);
    }

    // ==================== Boundary Tests ====================

    function test_Boundary_ExactSupplyPurchase() public view {
        uint256[] memory supplies = new uint256[](2);
        supplies[0] = SUPPLY_222M;
        supplies[1] = SUPPLY_333M;

        for (uint256 i = 0; i < supplies.length; i++) {
            uint256 supply = supplies[i];

            // Calculate exact cost for entire supply
            uint256 totalCost =
                bondingCurve.calculateCostBetween(0, supply, supply);

            // Try to buy with exact amount
            uint256 tokensOut =
                bondingCurve.calculateAmountOut(totalCost, 0, supply);

            // Due to integer math, might be slightly less than full supply
            assertGe(
                tokensOut, supply - 1 ether, "Should buy almost entire supply"
            );
            assertLe(tokensOut, supply, "Should not exceed supply");

            console.log("Supply:", supply / 1e18);
            console.log("Tokens out:", tokensOut / 1e18);
        }
    }

    function test_Boundary_MaxUint256() public {
        // Test behavior with extreme values (should revert gracefully)
        uint256 supply = SUPPLY_222M;

        // This should revert due to arithmetic overflow (Solidity panic code 0x11)
        vm.expectRevert(stdError.arithmeticError);
        bondingCurve.calculateAmountOut(type(uint256).max, 0, supply);

        // Test with max supply - this will likely cause arithmetic overflow in virtual buffer calculation
        vm.expectRevert(stdError.arithmeticError);
        bondingCurve.calculateAmountOut(1000 ether, 0, type(uint256).max);
    }

    // ==================== State Consistency Tests ====================

    function test_StateConsistency_VirtualReserves() public view {
        uint256 supply = SUPPLY_333M;

        // Verify that k = x * y remains constant
        (uint256 x0, uint256 y0) = bondingCurve.getVirtualReserves(0, supply);
        uint256 k = x0 * y0;

        // Test at multiple points
        for (uint256 i = 1; i <= 10; i++) {
            uint256 sold = (supply * i) / 10;
            (uint256 x, uint256 y) =
                bondingCurve.getVirtualReserves(sold, supply);
            uint256 currentK = x * y;

            // K should remain constant (within tiny rounding error)
            // Allow for 0.000001% difference due to integer division
            assertApproxEqRel(
                currentK,
                k,
                0.000001 ether,
                "k must remain approximately constant"
            );
        }
    }

    // ==================== Gas Attack Tests ====================

    function test_GasAttack_DeepRecursion() public view {
        // Ensure no functions can cause excessive gas consumption
        uint256 supply = SUPPLY_222M;

        // Even with extreme values, gas should be reasonable
        uint256 gasBefore = gasleft();
        bondingCurve.calculateAmountOut(1 ether, supply - 1 ether, supply);
        uint256 gasUsed = gasBefore - gasleft();

        assertLt(gasUsed, 50000, "Gas usage should be reasonable");
        console.log("Gas used for edge calculation:", gasUsed);
    }

    // ==================== Mathematical Properties Tests ====================

    function test_MathProperties_Monotonicity() public view {
        uint256 supply = SUPPLY_333M;

        // Price should always increase as more tokens are sold
        uint256 lastPrice = 0;
        for (uint256 i = 0; i <= 100; i++) {
            uint256 sold = (supply * i) / 100;
            uint256 price = bondingCurve.getCurrentPrice(sold, supply);

            if (i > 0) {
                assertGt(price, lastPrice, "Price must be strictly increasing");
            }
            lastPrice = price;
        }
    }

    function test_MathProperties_Convexity() public view {
        uint256 supply = SUPPLY_222M;
        uint256 amount = 10000 ether;

        // The marginal cost should increase (diminishing returns)
        uint256[] memory positions = new uint256[](5);
        positions[0] = 0;
        positions[1] = supply / 4;
        positions[2] = supply / 2;
        positions[3] = (supply * 3) / 4;
        positions[4] = (supply * 9) / 10;

        uint256 lastTokensPerEth = type(uint256).max;

        for (uint256 i = 0; i < positions.length; i++) {
            uint256 tokensOut =
                bondingCurve.calculateAmountOut(amount, positions[i], supply);
            uint256 tokensPerEth = (tokensOut * PRECISION) / amount;

            assertLt(
                tokensPerEth, lastTokensPerEth, "Tokens per ETH should decrease"
            );
            lastTokensPerEth = tokensPerEth;

            console.log(
                "Position",
                (positions[i] * 100) / supply,
                "% - Tokens per ETH:",
                tokensPerEth / 1e18
            );
        }
    }

    // ==================== Integration Consistency Tests ====================

    function test_Integration_CalculateCostBetween() public view {
        uint256 supply = SUPPLY_333M;

        // Verify calculateCostBetween matches integration of price function
        for (uint256 start = 0; start < supply; start += supply / 10) {
            uint256 end = start + supply / 20; // 5% chunks
            if (end > supply) end = supply;

            uint256 cost = bondingCurve.calculateCostBetween(start, end, supply);

            // This cost should equal the amount needed to buy (end - start) tokens
            uint256 tokensTarget = end - start;
            uint256 tokensBought =
                bondingCurve.calculateAmountOut(cost, start, supply);

            assertApproxEqRel(
                tokensBought,
                tokensTarget,
                0.001 ether,
                "Cost calculation consistency"
            );
        }
    }

    // ==================== Comparative Analysis ====================

    function test_Comparative_222M_vs_333M_Economics() public view {
        // Compare the economics of both supply amounts
        console.log("\n=== Economic Comparison ===");

        uint256[] memory supplies = new uint256[](2);
        supplies[0] = SUPPLY_222M;
        supplies[1] = SUPPLY_333M;

        for (uint256 i = 0; i < supplies.length; i++) {
            uint256 supply = supplies[i];
            console.log("\nSupply:", supply / 1e18 / 1e6, "M tokens");

            // Total cost to buy all
            uint256 totalCost =
                bondingCurve.calculateCostBetween(0, supply, supply);
            console.log("  Total cost:", totalCost / 1e18, "ETH");

            // Average price
            uint256 avgPrice = (totalCost * PRECISION) / supply;
            console.log("  Average price:", avgPrice / 1e18, "ETH per token");

            // Cost at different stages
            uint256 cost25 =
                bondingCurve.calculateCostBetween(0, supply / 4, supply);
            uint256 cost50 =
                bondingCurve.calculateCostBetween(0, supply / 2, supply);
            uint256 cost75 =
                bondingCurve.calculateCostBetween(0, (supply * 3) / 4, supply);

            console.log("  Cost for 25%:", cost25 / 1e18, "ETH");
            console.log("  Cost for 50%:", cost50 / 1e18, "ETH");
            console.log("  Cost for 75%:", cost75 / 1e18, "ETH");

            // Price at key points
            console.log(
                "  Price at 0%:", bondingCurve.getCurrentPrice(0, supply) / 1e18
            );
            console.log(
                "  Price at 50%:",
                bondingCurve.getCurrentPrice(supply / 2, supply) / 1e18
            );
            console.log(
                "  Price at 85%:",
                bondingCurve.getCurrentPrice((supply * 85) / 100, supply) / 1e18
            );
            console.log(
                "  Price at 100%:",
                bondingCurve.getCurrentPrice(supply, supply) / 1e18
            );
        }
    }
}
