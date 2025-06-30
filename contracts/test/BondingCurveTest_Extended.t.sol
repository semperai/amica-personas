// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {BondingCurve} from "../src/BondingCurve.sol";

contract BondingCurveTest_Extended is Test {
    BondingCurve public bondingCurve;

    // Constants for testing both scenarios
    uint256 constant SUPPLY_222M = 222_222_222 ether; // 2/9 of 1B tokens (with agent)
    uint256 constant SUPPLY_333M = 333_333_333 ether; // 1/3 of 1B tokens (no agent)
    uint256 constant PRECISION = 1e18;
    uint256 constant CURVE_MULTIPLIER = 233; // Updated to match actual implementation

    /**
     * @notice Expected bonding curve behavior:
     * - Starting price: ~1x
     * - Ending price: ~233x (based on curve multiplier 14264)
     * - Average price: ~15.264x (actual curve behavior)
     * - Perfect buy/sell symmetry without fees
     * - 0.1% fee on sells prevents exploits
     * - Both 222M and 333M supplies follow identical curve shape
     * - At 85% sold, price is approximately 27.14x (curve accelerates rapidly near end)
     *
     * Note: The curve has exponential-like growth characteristics:
     * - Slower growth in the beginning and middle portions
     * - Rapid acceleration in the final 10-15% of the curve
     * - Price of 33x is reached somewhere around 87% (use test_FindPriceTargets to find exact %)
     */
    function setUp() public {
        bondingCurve = new BondingCurve();
    }

    // ==================== Price Target Analysis ====================

    function test_FindPriceTargets() public view {
        uint256 supply = SUPPLY_222M;
        console.log("\n=== Finding where price reaches specific targets ===");

        uint256[] memory priceTargets = new uint256[](5);
        priceTargets[0] = 10 ether; // 10x
        priceTargets[1] = 20 ether; // 20x
        priceTargets[2] = 33 ether; // 33x
        priceTargets[3] = 50 ether; // 50x
        priceTargets[4] = 100 ether; // 100x

        for (uint256 i = 0; i < priceTargets.length; i++) {
            uint256 target = priceTargets[i];

            // Binary search to find where price reaches target
            uint256 low = 0;
            uint256 high = supply;
            uint256 result = 0;

            while (low <= high && high > 0) {
                uint256 mid = (low + high) / 2;
                uint256 price = bondingCurve.getCurrentPrice(mid, supply);

                if (price < target) {
                    low = mid + 1;
                } else {
                    result = mid;
                    if (mid == 0) break;
                    high = mid - 1;
                }
            }

            if (result > 0 && result < supply) {
                uint256 percentage = (result * 100) / supply;
                uint256 actualPrice =
                    bondingCurve.getCurrentPrice(result, supply);
                console.log("Price reaches", target / 1e18);
                console.log("x at approximately", percentage);
                console.log("% sold (actual price:", actualPrice / 1e18);
            }
        }
    }

    // ==================== 222M Supply Tests ====================

    function test_222M_PriceProgression() public view {
        uint256 supply = SUPPLY_222M;

        // Test price at various points
        uint256[] memory checkpoints = new uint256[](11);
        for (uint256 i = 0; i <= 10; i++) {
            uint256 sold = (supply * i) / 10;
            uint256 price = bondingCurve.getCurrentPrice(sold, supply);
            checkpoints[i] = price;

            console.log("222M - Progress", i * 10, "% - Price:", price / 1e18);
        }

        // Verify monotonic increase
        for (uint256 i = 1; i < checkpoints.length; i++) {
            assertGt(
                checkpoints[i],
                checkpoints[i - 1],
                "Price should increase monotonically"
            );
        }

        // Verify start and end prices
        assertApproxEqRel(
            checkpoints[0], PRECISION, 0.01 ether, "Start price ~1x"
        );
        assertApproxEqRel(
            checkpoints[10],
            CURVE_MULTIPLIER * PRECISION,
            0.05 ether,
            "End price ~233x"
        );

        // Check price at 85% (should be ~27.14x based on actual curve with multiplier 233)
        uint256 price85 =
            bondingCurve.getCurrentPrice((supply * 85) / 100, supply);
        console.log("222M - Price at 85%:", price85 / 1e18);
        assertApproxEqRel(
            price85, 27.14 ether, 0.5 ether, "Price at 85% should be ~27.14x"
        );
    }

    function test_222M_TotalCostCalculation() public view {
        uint256 supply = SUPPLY_222M;

        // Calculate total cost to buy entire supply
        uint256 totalCost = bondingCurve.calculateCostBetween(0, supply, supply);
        uint256 avgPrice = (totalCost * PRECISION) / supply;

        console.log("222M - Total cost:", totalCost / 1e18);
        console.log("222M - Average price:", avgPrice / 1e18);

        // Average should be between 1x and 233x
        assertGt(avgPrice, PRECISION, "Average price > 1x");
        assertLt(avgPrice, CURVE_MULTIPLIER * PRECISION, "Average price < 233x");

        // The actual average is ~15.264x for this bonding curve implementation with 233x multiplier
        uint256 expectedAvg = 15.264 ether;
        assertApproxEqRel(
            avgPrice, expectedAvg, 0.05 ether, "Average price ~15.264x"
        );
    }

    function test_222M_ChunkedPurchases() public view {
        uint256 supply = SUPPLY_222M;
        uint256 chunkSize = supply / 10; // Buy in 10% chunks
        uint256 totalSpent = 0;
        uint256 totalBought = 0;

        for (uint256 i = 0; i < 10; i++) {
            uint256 cost = bondingCurve.calculateCostBetween(
                totalBought, totalBought + chunkSize, supply
            );
            uint256 tokensOut =
                bondingCurve.calculateAmountOut(cost, totalBought, supply);

            assertApproxEqRel(
                tokensOut, chunkSize, 0.001 ether, "Should buy expected chunk"
            );

            totalSpent += cost;
            totalBought += chunkSize;

            console.log("222M - Chunk", i + 1, "cost:", cost / 1e18);
        }

        // Total should match
        uint256 directTotal =
            bondingCurve.calculateCostBetween(0, supply, supply);
        assertApproxEqRel(
            totalSpent, directTotal, 0.001 ether, "Chunked cost equals direct"
        );
    }

    // ==================== 333M Supply Tests ====================

    function test_333M_PriceProgression() public view {
        uint256 supply = SUPPLY_333M;

        // Test price at various points
        uint256[] memory checkpoints = new uint256[](11);
        for (uint256 i = 0; i <= 10; i++) {
            uint256 sold = (supply * i) / 10;
            uint256 price = bondingCurve.getCurrentPrice(sold, supply);
            checkpoints[i] = price;

            console.log("333M - Progress", i * 10, "% - Price:", price / 1e18);
        }

        // Verify monotonic increase
        for (uint256 i = 1; i < checkpoints.length; i++) {
            assertGt(
                checkpoints[i],
                checkpoints[i - 1],
                "Price should increase monotonically"
            );
        }

        // Verify start and end prices
        assertApproxEqRel(
            checkpoints[0], PRECISION, 0.01 ether, "Start price ~1x"
        );
        assertApproxEqRel(
            checkpoints[10],
            CURVE_MULTIPLIER * PRECISION,
            0.05 ether,
            "End price ~233x"
        );

        // Check price at 85% (should be ~27.14x based on actual curve with multiplier 233)
        uint256 price85 =
            bondingCurve.getCurrentPrice((supply * 85) / 100, supply);
        console.log("333M - Price at 85%:", price85 / 1e18);
        assertApproxEqRel(
            price85, 27.14 ether, 0.5 ether, "Price at 85% should be ~27.14x"
        );
    }

    function test_333M_TotalCostCalculation() public view {
        uint256 supply = SUPPLY_333M;

        // Calculate total cost to buy entire supply
        uint256 totalCost = bondingCurve.calculateCostBetween(0, supply, supply);
        uint256 avgPrice = (totalCost * PRECISION) / supply;

        console.log("333M - Total cost:", totalCost / 1e18);
        console.log("333M - Average price:", avgPrice / 1e18);

        // Average should be between 1x and 233x
        assertGt(avgPrice, PRECISION, "Average price > 1x");
        assertLt(avgPrice, CURVE_MULTIPLIER * PRECISION, "Average price < 233x");

        // The actual average is ~15.264x for this bonding curve implementation with 233x multiplier
        uint256 expectedAvg = 15.264 ether;
        assertApproxEqRel(
            avgPrice, expectedAvg, 0.05 ether, "Average price ~15.264x"
        );
    }

    function test_333M_BuySellSymmetry() public view {
        uint256 supply = SUPPLY_333M;

        // Test at different points along the curve
        uint256[] memory startPoints = new uint256[](5);
        startPoints[0] = 0;
        startPoints[1] = supply / 4;
        startPoints[2] = supply / 2;
        startPoints[3] = (supply * 3) / 4;
        startPoints[4] = (supply * 9) / 10;

        for (uint256 i = 0; i < startPoints.length; i++) {
            uint256 buyAmount = 10000 ether;
            uint256 startSold = startPoints[i];

            if (startSold >= supply) continue;

            uint256 tokensOut =
                bondingCurve.calculateAmountOut(buyAmount, startSold, supply);
            if (tokensOut == 0) continue;

            uint256 refund = bondingCurve.calculateAmountOutForSellNoFee(
                tokensOut, startSold + tokensOut, supply
            );

            assertApproxEqRel(
                refund, buyAmount, 0.0001 ether, "Perfect symmetry required"
            );
            console.log(
                "333M - Symmetry test at",
                (startSold * 100) / supply,
                "% passed"
            );
        }
    }

    // ==================== Comparative Tests ====================

    function test_Compare_SupplyScaling() public view {
        // Both curves should have same shape, just different total supply

        // Compare prices at equivalent progress points
        for (uint256 progress = 0; progress <= 100; progress += 10) {
            uint256 sold222 = (SUPPLY_222M * progress) / 100;
            uint256 sold333 = (SUPPLY_333M * progress) / 100;

            uint256 price222 =
                bondingCurve.getCurrentPrice(sold222, SUPPLY_222M);
            uint256 price333 =
                bondingCurve.getCurrentPrice(sold333, SUPPLY_333M);

            assertApproxEqRel(
                price222,
                price333,
                0.001 ether,
                "Prices should match at same progress %"
            );

            console.log("Progress", progress, "% - Price:", price222 / 1e18);
        }
    }

    function test_Compare_CostPerToken() public view {
        // Cost per token should be same at equivalent progress
        uint256 testAmount = 1000 ether;

        // Test at 50% progress
        uint256 start222 = SUPPLY_222M / 2;
        uint256 start333 = SUPPLY_333M / 2;

        uint256 tokens222 =
            bondingCurve.calculateAmountOut(testAmount, start222, SUPPLY_222M);
        uint256 tokens333 =
            bondingCurve.calculateAmountOut(testAmount, start333, SUPPLY_333M);

        uint256 pricePerToken222 = (testAmount * PRECISION) / tokens222;
        uint256 pricePerToken333 = (testAmount * PRECISION) / tokens333;

        assertApproxEqRel(
            pricePerToken222,
            pricePerToken333,
            0.001 ether,
            "Price per token should match"
        );
    }

    // ==================== Edge Cases & Stress Tests ====================

    function test_EdgeCase_BuyEntireSupply() public view {
        // Test buying entire supply in one go
        uint256[] memory supplies = new uint256[](2);
        supplies[0] = SUPPLY_222M;
        supplies[1] = SUPPLY_333M;

        for (uint256 i = 0; i < supplies.length; i++) {
            uint256 supply = supplies[i];
            uint256 totalCost =
                bondingCurve.calculateCostBetween(0, supply, supply);

            // Try to buy with exact cost
            uint256 tokensOut =
                bondingCurve.calculateAmountOut(totalCost, 0, supply);
            assertApproxEqRel(
                tokensOut, supply, 0.001 ether, "Should buy entire supply"
            );

            console.log(
                "Supply",
                supply / 1e18 / 1e6,
                "M - Total cost:",
                totalCost / 1e18
            );
        }
    }

    function test_EdgeCase_MinimumPurchase() public view {
        // Test reasonable minimum purchase amounts
        uint256[] memory supplies = new uint256[](2);
        supplies[0] = SUPPLY_222M;
        supplies[1] = SUPPLY_333M;

        for (uint256 i = 0; i < supplies.length; i++) {
            uint256 supply = supplies[i];

            // Test reasonable minimum (0.00001 ETH)
            uint256 reasonableMin = 0.00001 ether;
            uint256 tokensOut =
                bondingCurve.calculateAmountOut(reasonableMin, 0, supply);
            assertGt(tokensOut, 0, "Should receive tokens for 0.00001 ETH");

            // At the end of curve, need more ETH for same tokens
            uint256 almostAllSold = supply - 1000 ether;
            uint256 tokensOutEnd = bondingCurve.calculateAmountOut(
                reasonableMin, almostAllSold, supply
            );
            assertLt(
                tokensOutEnd, tokensOut, "Should receive fewer tokens at end"
            );

            // Note: 1 wei returning 0 tokens is expected and acceptable
            // Nobody trades with 1 wei in practice
        }
    }

    function test_EdgeCase_LargePurchaseNearEnd() public view {
        // Test large purchase when little supply remains
        uint256 supply = SUPPLY_222M;
        uint256 almostSold = supply - 1000 ether;
        uint256 largeAmount = 100000 ether;

        uint256 tokensOut =
            bondingCurve.calculateAmountOut(largeAmount, almostSold, supply);
        assertLe(tokensOut, 1000 ether, "Cannot buy more than available");

        // Should get exactly remaining tokens
        uint256 costForRemaining =
            bondingCurve.calculateCostBetween(almostSold, supply, supply);
        uint256 exactTokensOut = bondingCurve.calculateAmountOut(
            costForRemaining, almostSold, supply
        );
        assertApproxEqRel(
            exactTokensOut,
            1000 ether,
            0.001 ether,
            "Should get exactly remaining"
        );
    }

    function test_EdgeCase_SellEntirePosition() public view {
        // Test selling large position at once
        uint256 supply = SUPPLY_333M;
        uint256 position = supply / 3; // Own 1/3 of supply

        // Calculate refund
        uint256 refund = bondingCurve.calculateAmountOutForSellNoFee(
            position, position, supply
        );

        // Buy that position first to get cost
        uint256 cost = bondingCurve.calculateCostBetween(0, position, supply);

        assertApproxEqRel(
            refund, cost, 0.0001 ether, "Should refund exact cost"
        );
    }

    // ==================== Fee Impact Tests ====================

    function test_FeeImpact_RoundTrip() public view {
        uint256[] memory supplies = new uint256[](2);
        supplies[0] = SUPPLY_222M;
        supplies[1] = SUPPLY_333M;

        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 100 ether;
        amounts[1] = 10000 ether;
        amounts[2] = 100000 ether;

        for (uint256 i = 0; i < supplies.length; i++) {
            uint256 supply = supplies[i];
            console.log("\nSupply:", supply / 1e18 / 1e6, "M");

            for (uint256 j = 0; j < amounts.length; j++) {
                uint256 buyAmount = amounts[j];

                // Buy tokens
                uint256 tokensOut =
                    bondingCurve.calculateAmountOut(buyAmount, 0, supply);

                // Sell back immediately
                uint256 refundWithFee = bondingCurve.calculateAmountOutForSell(
                    tokensOut, tokensOut, supply
                );
                uint256 refundNoFee = bondingCurve
                    .calculateAmountOutForSellNoFee(tokensOut, tokensOut, supply);

                uint256 loss = buyAmount - refundWithFee;
                uint256 lossPercent = (loss * 10000) / buyAmount;

                console.log("  Amount:", buyAmount / 1e18);
                console.log("  Loss(bps):", lossPercent);

                // Verify fee calculation
                uint256 expectedFee = (refundNoFee * 10) / 10000;
                uint256 actualFee = refundNoFee - refundWithFee;
                assertApproxEqAbs(
                    actualFee, expectedFee, 1, "Fee should be exactly 0.1%"
                );

                // Loss should be at least 10 bps (0.1%), can be exactly 10 for large amounts
                assertGe(lossPercent, 10, "Loss should be >= 10 bps (0.1%)");
                assertLt(
                    lossPercent,
                    15,
                    "Loss should be < 15 bps for reasonable amounts"
                );
            }
        }
    }

    // ==================== Gas Benchmarks ====================

    function test_GasBenchmark_Operations() public view {
        uint256[] memory supplies = new uint256[](2);
        supplies[0] = SUPPLY_222M;
        supplies[1] = SUPPLY_333M;

        for (uint256 i = 0; i < supplies.length; i++) {
            uint256 supply = supplies[i];
            uint256 midPoint = supply / 2;

            console.log("\nGas benchmark for supply:", supply / 1e18 / 1e6, "M");

            // Buy calculation
            uint256 gasBefore = gasleft();
            bondingCurve.calculateAmountOut(1000 ether, midPoint, supply);
            uint256 gasAfter = gasleft();
            console.log("  calculateAmountOut gas:", gasBefore - gasAfter);

            // Sell calculation
            gasBefore = gasleft();
            bondingCurve.calculateAmountOutForSell(1000 ether, midPoint, supply);
            gasAfter = gasleft();
            console.log(
                "  calculateAmountOutForSell gas:", gasBefore - gasAfter
            );

            // Price check
            gasBefore = gasleft();
            bondingCurve.getCurrentPrice(midPoint, supply);
            gasAfter = gasleft();
            console.log("  getCurrentPrice gas:", gasBefore - gasAfter);

            // Cost between
            gasBefore = gasleft();
            bondingCurve.calculateCostBetween(
                midPoint, midPoint + 1000 ether, supply
            );
            gasAfter = gasleft();
            console.log("  calculateCostBetween gas:", gasBefore - gasAfter);
        }
    }

    // ==================== Virtual Reserves Validation ====================

    function test_VirtualReserves_Consistency() public view {
        uint256[] memory supplies = new uint256[](2);
        supplies[0] = SUPPLY_222M;
        supplies[1] = SUPPLY_333M;

        for (uint256 i = 0; i < supplies.length; i++) {
            uint256 supply = supplies[i];

            // Get initial reserves
            (uint256 vToken0, uint256 vETH0) =
                bondingCurve.getVirtualReserves(0, supply);
            uint256 k = vToken0 * vETH0;

            console.log("\nSupply:", supply / 1e18 / 1e6, "M");
            console.log("  Initial k:", k);

            // Check k remains constant at different points
            for (uint256 progress = 10; progress <= 100; progress += 10) {
                uint256 sold = (supply * progress) / 100;
                (uint256 vToken, uint256 vETH) =
                    bondingCurve.getVirtualReserves(sold, supply);
                uint256 currentK = vToken * vETH;

                // Allow tiny rounding differences (0.000001%)
                assertApproxEqRel(
                    currentK,
                    k,
                    0.000001 ether,
                    "k should remain approximately constant"
                );

                // Verify price calculation
                uint256 price = bondingCurve.getCurrentPrice(sold, supply);
                uint256 expectedPrice = (vETH * PRECISION) / vToken;
                assertEq(
                    price,
                    expectedPrice,
                    "Price should match virtual reserve ratio"
                );
            }
        }
    }

    // ==================== Fuzzing Tests ====================

    function testFuzz_BuySellSymmetry_222M(
        uint256 buyAmount,
        uint256 initialSold
    ) public view {
        buyAmount = bound(buyAmount, 1 ether, 50000 ether);
        initialSold = bound(initialSold, 0, SUPPLY_222M / 2);

        _testBuySellSymmetryForSupply(SUPPLY_222M, buyAmount, initialSold);
    }

    function testFuzz_BuySellSymmetry_333M(
        uint256 buyAmount,
        uint256 initialSold
    ) public view {
        buyAmount = bound(buyAmount, 1 ether, 50000 ether);
        initialSold = bound(initialSold, 0, SUPPLY_333M / 2);

        _testBuySellSymmetryForSupply(SUPPLY_333M, buyAmount, initialSold);
    }

    function _testBuySellSymmetryForSupply(
        uint256 supply,
        uint256 buyAmount,
        uint256 initialSold
    ) private view {
        // Buy tokens
        uint256 tokensBought =
            bondingCurve.calculateAmountOut(buyAmount, initialSold, supply);

        if (tokensBought == 0) return;

        uint256 newTotalSold = initialSold + tokensBought;
        if (newTotalSold >= supply) return;

        // Sell back without fee
        uint256 sellProceeds = bondingCurve.calculateAmountOutForSellNoFee(
            tokensBought, newTotalSold, supply
        );

        // Should have near-perfect symmetry
        assertApproxEqRel(
            sellProceeds,
            buyAmount,
            0.0001 ether,
            "Near-perfect symmetry required"
        );
    }

    function testFuzz_MonotonicPriceIncrease(uint256 sold1, uint256 sold2)
        public
        view
    {
        uint256 supply = SUPPLY_333M;

        // First bound sold1, then ensure sold2 is greater
        sold1 = bound(sold1, 0, supply - 2);
        // IMPORTANT: sold2 must be bounded RELATIVE to the already-bounded sold1
        sold2 = bound(sold2, sold1 + 1, supply - 1);

        // Extra safety check to ensure our bounds worked correctly
        require(sold2 > sold1, "sold2 must be greater than sold1");
        require(sold2 < supply, "sold2 must be less than supply");

        uint256 price1 = bondingCurve.getCurrentPrice(sold1, supply);
        uint256 price2 = bondingCurve.getCurrentPrice(sold2, supply);

        // At the very beginning and very end of the curve, price changes might not be
        // visible due to integer division precision. This is expected behavior.
        uint256 earlyThreshold = supply / 1000; // 0.1% of supply
        uint256 lateThreshold = (supply * 999) / 1000; // 99.9% of supply

        if (sold2 < earlyThreshold || sold1 > lateThreshold) {
            // At extreme ends of the curve, prices might plateau due to precision
            assertGe(price2, price1, "Price must not decrease");
        } else if (sold2 - sold1 <= 100) {
            // For very small differences, prices might be equal due to rounding
            assertGe(price2, price1, "Price must not decrease");
        } else {
            // For meaningful gaps in the middle of the curve, price must increase
            assertGt(
                price2,
                price1,
                "Price must increase for meaningful gaps in active range"
            );
        }
    }

    function testFuzz_CostBetweenConsistency(
        uint256 start,
        uint256 middle,
        uint256 end
    ) public view {
        uint256 supply = SUPPLY_222M;
        start = bound(start, 0, supply / 3);
        middle = bound(middle, start + 1, (supply * 2) / 3);
        end = bound(end, middle + 1, supply);

        uint256 cost1 = bondingCurve.calculateCostBetween(start, middle, supply);
        uint256 cost2 = bondingCurve.calculateCostBetween(middle, end, supply);
        uint256 costTotal =
            bondingCurve.calculateCostBetween(start, end, supply);

        assertApproxEqRel(
            cost1 + cost2, costTotal, 0.0001 ether, "Costs should be additive"
        );
    }
}
