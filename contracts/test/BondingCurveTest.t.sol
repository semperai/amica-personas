// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {BondingCurve} from "../src/BondingCurve.sol";

contract BondingCurveTest is Test {
    BondingCurve public bondingCurve;

    // Constants for testing
    uint256 constant TOTAL_SUPPLY = 222_222_222 ether; // 2/9 of 1B tokens (bonding allocation)
    uint256 constant PRECISION = 1e18;
    uint256 constant CURVE_MULTIPLIER = 233; // Updated to match actual implementation

    function setUp() public {
        bondingCurve = new BondingCurve();
    }

    // ==================== Price Target Tests ====================

    function test_GetCurrentPrice_AtStart() public view {
        uint256 price = bondingCurve.getCurrentPrice(0, TOTAL_SUPPLY);
        // Price should be approximately 1x at start
        assertApproxEqRel(
            price,
            PRECISION,
            0.01 ether,
            "Starting price should be approximately 1x"
        );
        console.log("Starting price:", price);
    }

    function test_GetCurrentPrice_AtEnd() public view {
        uint256 price = bondingCurve.getCurrentPrice(TOTAL_SUPPLY, TOTAL_SUPPLY);
        // Price should be approximately 233x at the end (based on curve multiplier 14264)
        assertApproxEqRel(
            price,
            CURVE_MULTIPLIER * PRECISION,
            0.05 ether,
            "End price should be ~233x"
        );
        console.log("End price:", price);
    }

    // ==================== Buy/Sell Symmetry Test ====================

    function test_PerfectSymmetryRequired() public view {
        // Without fees, buy-sell must be perfectly symmetric

        // Test case 1: Small amount at start
        uint256 amount1 = 1000 ether;
        uint256 tokens1 =
            bondingCurve.calculateAmountOut(amount1, 0, TOTAL_SUPPLY);
        uint256 refund1 = bondingCurve.calculateAmountOutForSellNoFee(
            tokens1, tokens1, TOTAL_SUPPLY
        );
        assertApproxEqRel(
            refund1,
            amount1,
            0.0001 ether,
            "Must have near-perfect symmetry without fees"
        );

        // Test case 2: Large amount in middle
        uint256 startPoint2 = TOTAL_SUPPLY / 2;
        uint256 amount2 = 50000 ether;
        uint256 tokens2 =
            bondingCurve.calculateAmountOut(amount2, startPoint2, TOTAL_SUPPLY);
        uint256 refund2 = bondingCurve.calculateAmountOutForSellNoFee(
            tokens2, startPoint2 + tokens2, TOTAL_SUPPLY
        );
        assertApproxEqRel(
            refund2,
            amount2,
            0.0001 ether,
            "Must have near-perfect symmetry at midpoint"
        );
    }

    // ==================== Basic Calculation Tests ====================

    function test_CalculateAmountOut_FirstPurchase() public view {
        // First purchase should get tokens at starting price (~1x)
        uint256 amountIn = 1000 ether;
        uint256 tokensOut =
            bondingCurve.calculateAmountOut(amountIn, 0, TOTAL_SUPPLY);

        // At start, price is ~1x, so we should get approximately amountIn tokens
        assertGt(tokensOut, 0, "Should receive tokens");
        assertApproxEqRel(
            tokensOut,
            amountIn,
            0.1 ether,
            "Should receive approximately 1:1 at start"
        );
    }

    function test_CalculateAmountOut_NearEndOfCurve() public view {
        // When almost all tokens are sold, price should be near 233x
        uint256 amountIn = 1000 ether;
        uint256 almostAllSold = TOTAL_SUPPLY - 1000 ether; // Only 1000 tokens left

        uint256 tokensOut = bondingCurve.calculateAmountOut(
            amountIn, almostAllSold, TOTAL_SUPPLY
        );

        // At the end, price should be ~233x, so we should get much fewer tokens
        assertLt(
            tokensOut,
            amountIn / 150, // Changed from /40 to /150 to account for 233x instead of 66x
            "Should receive much fewer tokens at end of curve"
        );
        assertGt(tokensOut, 0, "Should still receive some tokens");
    }

    function test_CalculateAmountOutForSell_SellAll() public view {
        // If tokens were bought for X amount, selling all back should return X minus fee
        uint256 buyAmount = 10000 ether;

        // Buy tokens
        uint256 tokensBought =
            bondingCurve.calculateAmountOut(buyAmount, 0, TOTAL_SUPPLY);

        // Sell all tokens back without fee
        uint256 refundNoFee = bondingCurve.calculateAmountOutForSellNoFee(
            tokensBought, tokensBought, TOTAL_SUPPLY
        );
        assertApproxEqRel(
            refundNoFee,
            buyAmount,
            0.0001 ether,
            "Without fee should be near perfect"
        );

        // Sell with fee
        uint256 refundWithFee = bondingCurve.calculateAmountOutForSell(
            tokensBought, tokensBought, TOTAL_SUPPLY
        );
        assertLt(refundWithFee, buyAmount, "With fee, refund should be less");

        // Verify fee is correct (0.1%)
        uint256 expectedFee = (refundNoFee * 10) / 10000; // 0.1%
        assertApproxEqAbs(
            refundNoFee - refundWithFee,
            expectedFee,
            1,
            "Fee should be exactly 0.1%"
        );
    }

    function test_CalculateCostBetween_FullRange() public view {
        // Cost to buy entire supply
        uint256 totalCost =
            bondingCurve.calculateCostBetween(0, TOTAL_SUPPLY, TOTAL_SUPPLY);

        // Should be significant due to 233x multiplier
        assertGt(
            totalCost,
            TOTAL_SUPPLY,
            "Total cost should exceed supply due to curve"
        );

        // Average price should be between 1x and 233x
        uint256 avgPrice = (totalCost * PRECISION) / TOTAL_SUPPLY;
        assertGt(avgPrice, PRECISION, "Average price should be > 1x");
        assertLt(
            avgPrice,
            CURVE_MULTIPLIER * PRECISION,
            "Average price should be < 233x"
        );

        console.log("Total cost to buy all tokens:", totalCost / 1e18);
        console.log("Average price:", avgPrice / 1e18);
    }

    // ==================== Integration Test ====================

    function test_Integration_FullCycle() public view {
        // Simulate buying and selling in chunks
        uint256 totalSpent = 0;
        uint256 totalTokensBought = 0;

        // Buy tokens in chunks
        uint256 chunkSize = 10000 ether;
        uint256 targetTokens = TOTAL_SUPPLY / 4; // Buy 25% of supply

        while (totalTokensBought < targetTokens) {
            uint256 tokensOut = bondingCurve.calculateAmountOut(
                chunkSize, totalTokensBought, TOTAL_SUPPLY
            );
            if (tokensOut == 0) break;

            totalSpent += chunkSize;
            totalTokensBought += tokensOut;

            if (totalTokensBought > targetTokens) {
                // Adjust last purchase
                totalTokensBought = targetTokens;
                break;
            }
        }

        console.log("Total spent:", totalSpent / 1e18);
        console.log("Total tokens bought:", totalTokensBought / 1e18);

        // Sell everything back (without fee for symmetry test)
        uint256 totalRefund = bondingCurve.calculateAmountOutForSellNoFee(
            totalTokensBought, totalTokensBought, TOTAL_SUPPLY
        );

        // Should get back approximately what we spent
        assertApproxEqRel(
            totalRefund, totalSpent, 0.001 ether, "Should refund total spent"
        );
    }

    // ==================== Gas Efficiency Test ====================

    function test_GasEfficiency() public view {
        // Measure gas for various operations
        uint256 gasBefore;
        uint256 gasAfter;

        // Buy operation
        gasBefore = gasleft();
        bondingCurve.calculateAmountOut(
            1000 ether, TOTAL_SUPPLY / 2, TOTAL_SUPPLY
        );
        gasAfter = gasleft();
        console.log("Gas for calculateAmountOut:", gasBefore - gasAfter);

        // Sell operation
        gasBefore = gasleft();
        bondingCurve.calculateAmountOutForSell(
            1000 ether, TOTAL_SUPPLY / 2, TOTAL_SUPPLY
        );
        gasAfter = gasleft();
        console.log("Gas for calculateAmountOutForSell:", gasBefore - gasAfter);

        // Price check
        gasBefore = gasleft();
        bondingCurve.getCurrentPrice(TOTAL_SUPPLY / 2, TOTAL_SUPPLY);
        gasAfter = gasleft();
        console.log("Gas for getCurrentPrice:", gasBefore - gasAfter);
    }

    // ==================== Fee Protection Test ====================

    function test_FeePreventsDrainExploit() public view {
        // Test that fee prevents profitable round-trip exploits
        uint256 startAmount = 1000 ether;

        // Buy tokens
        uint256 tokensBought =
            bondingCurve.calculateAmountOut(startAmount, 0, TOTAL_SUPPLY);

        // Immediately sell back
        uint256 refund = bondingCurve.calculateAmountOutForSell(
            tokensBought, tokensBought, TOTAL_SUPPLY
        );

        // Should lose money due to fee
        assertLt(refund, startAmount, "Round trip should lose money due to fee");

        // Calculate loss
        uint256 loss = startAmount - refund;
        console.log("Loss from round trip:", loss);
        console.log("Loss percentage:", (loss * 10000) / startAmount); // in basis points

        // Loss should be at least the fee amount (minus tiny rounding benefit)
        uint256 minExpectedLoss = (startAmount * 10) / 10000; // 0.1% fee
        assertGt(
            loss,
            minExpectedLoss - 100,
            "Loss should be at least the fee amount"
        );
    }

    // ==================== View Functions Tests ====================

    function test_GetCurrentMultiplier_AtStart() public view {
        uint256 multiplier = bondingCurve.getCurrentMultiplier(0, TOTAL_SUPPLY);
        // At start, multiplier should be 1x
        assertApproxEqRel(
            multiplier,
            PRECISION,
            0.01 ether,
            "Multiplier at start should be ~1x"
        );
        console.log("Multiplier at start:", multiplier);
    }

    function test_GetCurrentMultiplier_AtHalfway() public view {
        uint256 multiplier =
            bondingCurve.getCurrentMultiplier(TOTAL_SUPPLY / 2, TOTAL_SUPPLY);
        // At halfway, multiplier should be between 1x and 233x
        assertGt(multiplier, PRECISION, "Multiplier should be > 1x");
        assertLt(
            multiplier,
            CURVE_MULTIPLIER * PRECISION,
            "Multiplier should be < 233x"
        );
        console.log("Multiplier at halfway:", multiplier);
    }

    function test_GetCurrentMultiplier_AtEnd() public view {
        uint256 multiplier =
            bondingCurve.getCurrentMultiplier(TOTAL_SUPPLY, TOTAL_SUPPLY);
        // At end, multiplier should be ~233x
        assertApproxEqRel(
            multiplier,
            CURVE_MULTIPLIER * PRECISION,
            0.05 ether,
            "Multiplier at end should be ~233x"
        );
        console.log("Multiplier at end:", multiplier);
    }

    function test_GetCurrentMultiplier_Progression() public view {
        // Test that multiplier increases monotonically
        uint256 prev = bondingCurve.getCurrentMultiplier(0, TOTAL_SUPPLY);

        for (uint256 i = 1; i <= 10; i++) {
            uint256 current = bondingCurve.getCurrentMultiplier(
                (TOTAL_SUPPLY * i) / 10, TOTAL_SUPPLY
            );
            assertGt(current, prev, "Multiplier should increase");
            prev = current;
        }
    }

    function test_GetCurveProgress_AtZero() public view {
        uint256 progress = bondingCurve.getCurveProgress(0, TOTAL_SUPPLY);
        assertEq(progress, 0, "Progress should be 0 at start");
    }

    function test_GetCurveProgress_AtHalfway() public view {
        uint256 progress =
            bondingCurve.getCurveProgress(TOTAL_SUPPLY / 2, TOTAL_SUPPLY);
        assertEq(progress, 5000, "Progress should be 5000 (50%)");
    }

    function test_GetCurveProgress_AtEnd() public view {
        uint256 progress =
            bondingCurve.getCurveProgress(TOTAL_SUPPLY, TOTAL_SUPPLY);
        assertEq(progress, 10000, "Progress should be 10000 (100%)");
    }

    function test_GetCurveProgress_QuarterPoints() public view {
        uint256 progress25 =
            bondingCurve.getCurveProgress(TOTAL_SUPPLY / 4, TOTAL_SUPPLY);
        assertEq(progress25, 2500, "Progress should be 2500 (25%)");

        uint256 progress75 =
            bondingCurve.getCurveProgress(TOTAL_SUPPLY * 3 / 4, TOTAL_SUPPLY);
        assertEq(progress75, 7500, "Progress should be 7500 (75%)");
    }

    function test_GetCurveProgress_Precision() public view {
        // Test with various precise values
        uint256 progress1 =
            bondingCurve.getCurveProgress(TOTAL_SUPPLY / 3, TOTAL_SUPPLY);
        assertApproxEqAbs(
            progress1, 3333, 1, "Progress should be ~3333 (33.33%)"
        );

        uint256 progress2 =
            bondingCurve.getCurveProgress(TOTAL_SUPPLY / 7, TOTAL_SUPPLY);
        assertApproxEqAbs(
            progress2, 1428, 2, "Progress should be ~1428 (14.28%)"
        );
    }

    // ==================== Error Condition Tests ====================

    function test_GetCurrentMultiplier_ZeroReserveTotal() public {
        // Attempt to get multiplier with zero reserveTotal
        // This hits Solidity's division by zero panic before custom check
        vm.expectRevert();
        bondingCurve.getCurrentMultiplier(0, 0);
    }

    function test_GetCurveProgress_ZeroReserveTotal() public {
        // Attempt to get progress with zero reserveTotal
        // This should revert with DivisionByZero
        vm.expectRevert(BondingCurve.DivisionByZero.selector);
        bondingCurve.getCurveProgress(100 ether, 0);
    }

    // ==================== Fuzzing Test ====================

    function testFuzz_BuySellSymmetry(uint256 buyAmount, uint256 initialSold)
        public
        view
    {
        buyAmount = bound(buyAmount, 1 ether, 10000 ether);
        initialSold = bound(initialSold, 0, TOTAL_SUPPLY / 2);

        // Buy tokens
        uint256 tokensBought = bondingCurve.calculateAmountOut(
            buyAmount, initialSold, TOTAL_SUPPLY
        );

        if (tokensBought == 0) return;

        uint256 newTotalSold = initialSold + tokensBought;
        if (newTotalSold >= TOTAL_SUPPLY) return;

        // Sell back without fee
        uint256 sellProceeds = bondingCurve.calculateAmountOutForSellNoFee(
            tokensBought, newTotalSold, TOTAL_SUPPLY
        );

        // Should have near-perfect symmetry without fees
        assertApproxEqRel(
            sellProceeds,
            buyAmount,
            0.0001 ether,
            "Near-perfect symmetry required"
        );
    }
}
