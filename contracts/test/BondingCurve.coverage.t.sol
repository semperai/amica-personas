// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {BondingCurve} from "../src/BondingCurve.sol";

/**
 * @title BondingCurve Coverage Tests
 * @notice Tests specifically designed to achieve 100% coverage on BondingCurve.sol
 * @dev Focuses on missing edge cases and branches
 */
contract BondingCurveCoverageTest is Test {
    BondingCurve public curve;

    uint256 constant TOTAL_SUPPLY = 222_000_000 ether;

    function setUp() public {
        curve = new BondingCurve();
    }

    // ==================== Edge Case: calculateCostBetween ====================

    function test_CalculateCostBetween_WhenFromEqualsTo() public view {
        // Test the edge case where fromTokens == toTokens
        uint256 cost = curve.calculateCostBetween(
            100 ether, // from
            100 ether, // to (same as from)
            TOTAL_SUPPLY
        );

        // Should return 0 cost when from == to
        assertEq(cost, 0, "Cost should be 0 when from equals to");
    }

    function test_CalculateCostBetween_WhenFromGreaterThanTo() public view {
        // Test the edge case where fromTokens > toTokens
        uint256 cost = curve.calculateCostBetween(
            200 ether, // from (larger)
            100 ether, // to (smaller)
            TOTAL_SUPPLY
        );

        // Should return 0 cost when from > to
        assertEq(cost, 0, "Cost should be 0 when from > to");
    }

    function test_CalculateCostBetween_ValidRange() public view {
        // Test normal case for comparison
        uint256 cost = curve.calculateCostBetween(
            100 ether, // from
            200 ether, // to
            TOTAL_SUPPLY
        );

        // Should return positive cost for valid range
        assertGt(cost, 0, "Cost should be positive for valid range");
    }

    function test_CalculateCostBetween_FullCurve() public view {
        // Test cost from 0 to full supply
        uint256 cost =
            curve.calculateCostBetween(0, TOTAL_SUPPLY, TOTAL_SUPPLY);

        // Should return the total cost of the entire curve
        assertGt(cost, 0, "Full curve cost should be positive");
    }

    function test_CalculateCostBetween_ZeroToZero() public view {
        // Edge case: 0 to 0
        uint256 cost = curve.calculateCostBetween(0, 0, TOTAL_SUPPLY);
        assertEq(cost, 0, "Cost from 0 to 0 should be 0");
    }

    // ==================== Edge Case: getCurrentMultiplier ====================

    function test_GetCurrentMultiplier_AtStart() public view {
        // At the beginning, multiplier should be 1x (1e18)
        uint256 multiplier = curve.getCurrentMultiplier(0, TOTAL_SUPPLY);

        // Should be exactly 1x at the start
        assertEq(
            multiplier, 1 ether, "Multiplier at start should be 1x (1e18)"
        );
    }

    function test_GetCurrentMultiplier_MidCurve() public view {
        // At 50% of curve
        uint256 soldTokens = TOTAL_SUPPLY / 2;
        uint256 multiplier =
            curve.getCurrentMultiplier(soldTokens, TOTAL_SUPPLY);

        // Should be greater than 1x
        assertGt(multiplier, 1 ether, "Multiplier should increase mid-curve");
    }

    function test_GetCurrentMultiplier_NearEnd() public view {
        // At 85% of curve (graduation threshold)
        uint256 soldTokens = (TOTAL_SUPPLY * 85) / 100;
        uint256 multiplier =
            curve.getCurrentMultiplier(soldTokens, TOTAL_SUPPLY);

        // Should be significantly higher than 1x (multiplier is around 23x at 85%)
        assertGt(
            multiplier, 20 ether, "Multiplier should be high near graduation"
        );
    }

    // ==================== Edge Case: getCurveProgress ====================

    function test_GetCurveProgress_ZeroSupply_ShouldRevert() public {
        // This should revert with DivisionByZero
        vm.expectRevert(BondingCurve.DivisionByZero.selector);
        curve.getCurveProgress(0, 0);
    }

    function test_GetCurveProgress_AtStart() public view {
        uint256 progress = curve.getCurveProgress(0, TOTAL_SUPPLY);
        assertEq(progress, 0, "Progress at start should be 0");
    }

    function test_GetCurveProgress_At50Percent() public view {
        uint256 progress =
            curve.getCurveProgress(TOTAL_SUPPLY / 2, TOTAL_SUPPLY);
        assertEq(progress, 5000, "Progress at 50% should be 5000 (50.00%)");
    }

    function test_GetCurveProgress_At85Percent() public view {
        uint256 soldTokens = (TOTAL_SUPPLY * 85) / 100;
        uint256 progress = curve.getCurveProgress(soldTokens, TOTAL_SUPPLY);
        assertEq(progress, 8500, "Progress at 85% should be 8500 (85.00%)");
    }

    function test_GetCurveProgress_At100Percent() public view {
        uint256 progress = curve.getCurveProgress(TOTAL_SUPPLY, TOTAL_SUPPLY);
        assertEq(progress, 10000, "Progress at 100% should be 10000 (100.00%)");
    }

    // ==================== Edge Case: getCurrentPrice ====================

    function test_GetCurrentPrice_AtStart() public view {
        uint256 startPrice = curve.getCurrentPrice(0, TOTAL_SUPPLY);
        assertGt(startPrice, 0, "Start price should be positive");
    }

    function test_GetCurrentPrice_Increases() public view {
        uint256 price1 = curve.getCurrentPrice(0, TOTAL_SUPPLY);
        uint256 price2 =
            curve.getCurrentPrice(TOTAL_SUPPLY / 2, TOTAL_SUPPLY);
        uint256 price3 =
            curve.getCurrentPrice((TOTAL_SUPPLY * 85) / 100, TOTAL_SUPPLY);

        assertLt(price1, price2, "Price should increase as tokens are sold");
        assertLt(price2, price3, "Price should continue increasing");
    }

    // ==================== Edge Case: calculateAmountOut overflow ====================

    function test_CalculateAmountOut_SmallPurchase() public view {
        // Test very small purchase (1 wei rounds to 0, so use larger amount)
        uint256 amountOut = curve.calculateAmountOut(1 ether, 0, TOTAL_SUPPLY);
        assertGt(amountOut, 0, "Should get tokens for small purchase");
    }

    function test_CalculateAmountOut_LargePurchase() public view {
        // Test large purchase
        uint256 largeEth = 1000 ether;
        uint256 amountOut = curve.calculateAmountOut(largeEth, 0, TOTAL_SUPPLY);
        assertGt(amountOut, 0, "Should get tokens for large purchase");
        assertLe(
            amountOut,
            TOTAL_SUPPLY,
            "Can't get more than total supply"
        );
    }

    function test_CalculateAmountOut_CappedAtRemaining() public view {
        // When almost all tokens are sold, purchase should be capped
        uint256 soldTokens = TOTAL_SUPPLY - 100 ether;
        uint256 hugeEth = 1000000 ether;

        uint256 amountOut =
            curve.calculateAmountOut(hugeEth, soldTokens, TOTAL_SUPPLY);

        // Should be capped at remaining tokens
        assertEq(
            amountOut,
            100 ether,
            "Should be capped at remaining tokens"
        );
    }

    function test_CalculateAmountOut_ZeroAmount_ShouldRevert() public {
        vm.expectRevert(abi.encodeWithSelector(BondingCurve.InvalidAmount.selector, 0));
        curve.calculateAmountOut(0, 0, TOTAL_SUPPLY);
    }

    function test_CalculateAmountOut_InsufficientReserve_ShouldRevert() public {
        // Try to buy when reserve is exhausted
        vm.expectRevert();
        curve.calculateAmountOut(1 ether, TOTAL_SUPPLY, TOTAL_SUPPLY);
    }

    // ==================== Edge Case: calculateAmountOutForSell ====================

    function test_CalculateAmountOutForSell_SmallSell() public view {
        // First buy some tokens
        uint256 soldTokens = 1000 ether;

        // Then sell a small amount
        uint256 ethOut = curve.calculateAmountOutForSell(1 ether, soldTokens, TOTAL_SUPPLY);
        assertGt(ethOut, 0, "Should get ETH for small sell");
    }

    function test_CalculateAmountOutForSell_WithFee() public view {
        uint256 soldTokens = 1000 ether;
        uint256 sellAmount = 100 ether;

        uint256 ethWithFee = curve.calculateAmountOutForSell(sellAmount, soldTokens, TOTAL_SUPPLY);
        uint256 ethWithoutFee = curve.calculateAmountOutForSellNoFee(sellAmount, soldTokens, TOTAL_SUPPLY);

        // With fee should be less than without fee
        assertLt(ethWithFee, ethWithoutFee, "ETH with fee should be less");

        // Fee should be 0.1% (10 bps)
        uint256 expectedFee = (ethWithoutFee * 10) / 10000;
        assertEq(ethWithFee, ethWithoutFee - expectedFee, "Fee should be exactly 0.1%");
    }

    function test_CalculateAmountOutForSellNoFee_ZeroAmount_ShouldRevert() public {
        vm.expectRevert(abi.encodeWithSelector(BondingCurve.InvalidAmount.selector, 1));
        curve.calculateAmountOutForSellNoFee(0, 100 ether, TOTAL_SUPPLY);
    }

    function test_CalculateAmountOutForSellNoFee_ExceedsSold_ShouldRevert() public {
        // Try to sell more than what was sold
        uint256 soldTokens = 100 ether;
        uint256 sellAmount = 200 ether;

        vm.expectRevert(
            abi.encodeWithSelector(
                BondingCurve.InsufficientTokensSold.selector,
                sellAmount,
                soldTokens
            )
        );
        curve.calculateAmountOutForSellNoFee(sellAmount, soldTokens, TOTAL_SUPPLY);
    }

    // ==================== Virtual Reserves Tests ====================

    function test_GetVirtualReserves_AtStart() public view {
        (uint256 virtualToken, uint256 virtualETH) =
            curve.getVirtualReserves(0, TOTAL_SUPPLY);

        assertGt(virtualToken, TOTAL_SUPPLY, "Virtual token should include buffer");
        assertGt(virtualETH, 0, "Virtual ETH should be positive");
    }

    function test_GetVirtualReserves_MidCurve() public view {
        uint256 soldTokens = TOTAL_SUPPLY / 2;

        (uint256 virtualToken, uint256 virtualETH) =
            curve.getVirtualReserves(soldTokens, TOTAL_SUPPLY);

        assertGt(virtualToken, 0, "Virtual token should be positive");
        assertGt(virtualETH, 0, "Virtual ETH should be positive");
    }

    function test_GetVirtualReserves_NearEnd() public view {
        uint256 soldTokens = (TOTAL_SUPPLY * 99) / 100;

        (uint256 virtualToken, uint256 virtualETH) =
            curve.getVirtualReserves(soldTokens, TOTAL_SUPPLY);

        assertGt(virtualToken, 0, "Virtual token should still be positive");
        assertGt(virtualETH, 0, "Virtual ETH should still be positive");
    }

    function test_GetVirtualReserves_ConstantK() public view {
        // Verify that k = virtualToken * virtualETH is constant
        (uint256 vToken1, uint256 vETH1) =
            curve.getVirtualReserves(0, TOTAL_SUPPLY);
        uint256 k1 = vToken1 * vETH1;

        (uint256 vToken2, uint256 vETH2) =
            curve.getVirtualReserves(TOTAL_SUPPLY / 2, TOTAL_SUPPLY);
        uint256 k2 = vToken2 * vETH2;

        // k should remain constant (within rounding)
        assertApproxEqRel(k1, k2, 0.0001e18, "Constant k should be maintained");
    }

    // ==================== getCurveMultiplier ====================

    function test_GetCurveMultiplier() public view {
        uint256 multiplier = curve.getCurveMultiplier();
        assertEq(multiplier, 14264, "Curve multiplier should be 14264");
    }

    // ==================== Comprehensive Integration Tests ====================

    function test_BuyAndSell_RoundTrip() public view {
        // Buy tokens
        uint256 ethIn = 10 ether;
        uint256 tokensBought = curve.calculateAmountOut(ethIn, 0, TOTAL_SUPPLY);

        // Sell them back
        uint256 ethOut = curve.calculateAmountOutForSell(
            tokensBought, tokensBought, TOTAL_SUPPLY
        );

        // Due to fee, should get less ETH back
        assertLt(ethOut, ethIn, "Should get less ETH back due to fee");

        // But should be close (within fee amount)
        assertApproxEqRel(ethOut, ethIn, 0.01e18, "Should be within 1%");
    }

    function test_MultipleSmallPurchases_VsOneLarge() public view {
        // One large purchase
        uint256 largeEth = 100 ether;
        uint256 tokensLarge = curve.calculateAmountOut(largeEth, 0, TOTAL_SUPPLY);

        // Multiple small purchases
        uint256 smallEth = 10 ether;
        uint256 tokensAccumulated = 0;
        uint256 soldSoFar = 0;

        for (uint256 i = 0; i < 10; i++) {
            uint256 tokens =
                curve.calculateAmountOut(smallEth, soldSoFar, TOTAL_SUPPLY);
            tokensAccumulated += tokens;
            soldSoFar += tokens;
        }

        // Large purchase should give more tokens (better price at start)
        assertGt(
            tokensLarge,
            tokensAccumulated,
            "Large purchase should be more efficient"
        );
    }

    function test_PriceIncreasesMonotonically() public view {
        uint256 increment = TOTAL_SUPPLY / 10;
        uint256 lastPrice = 0;

        for (uint256 sold = 0; sold < TOTAL_SUPPLY; sold += increment) {
            uint256 currentPrice = curve.getCurrentPrice(sold, TOTAL_SUPPLY);

            if (sold > 0) {
                assertGt(
                    currentPrice,
                    lastPrice,
                    "Price should increase monotonically"
                );
            }

            lastPrice = currentPrice;
        }
    }

    // ==================== Boundary Tests ====================

    function test_MaximumSinglePurchase() public view {
        // Try to buy all tokens in one purchase
        uint256 cost = curve.calculateCostBetween(0, TOTAL_SUPPLY, TOTAL_SUPPLY);

        // Use that cost to verify we can buy all tokens
        uint256 tokensBought = curve.calculateAmountOut(cost, 0, TOTAL_SUPPLY);

        // Should get all tokens (or very close due to rounding)
        assertApproxEqAbs(
            tokensBought,
            TOTAL_SUPPLY,
            1000,
            "Should be able to buy entire supply"
        );
    }

    function test_VerySmallAmounts() public view {
        // Test with 1 wei (may round to 0) - test that it doesn't revert
        // Small amounts might round to 0 due to integer division
        uint256 tokensOut = curve.calculateAmountOut(1000, 0, TOTAL_SUPPLY);
        // Just verify it doesn't revert and returns something
        assertGe(tokensOut, 0, "Should handle small wei purchase without reverting");
    }

    function test_ProgressCalculation_Precision() public view {
        // Test that progress calculation maintains precision
        uint256 sold = (TOTAL_SUPPLY * 8500) / 10000; // Exactly 85%
        uint256 progress = curve.getCurveProgress(sold, TOTAL_SUPPLY);

        assertEq(progress, 8500, "Should maintain precision for 85%");
    }

    // ==================== Error Condition Tests ====================

    function test_InvalidAmount_Buy() public {
        vm.expectRevert(abi.encodeWithSelector(BondingCurve.InvalidAmount.selector, 0));
        curve.calculateAmountOut(0, 0, TOTAL_SUPPLY);
    }

    function test_InvalidAmount_Sell() public {
        vm.expectRevert(abi.encodeWithSelector(BondingCurve.InvalidAmount.selector, 1));
        curve.calculateAmountOutForSellNoFee(0, 100 ether, TOTAL_SUPPLY);
    }

    function test_InsufficientReserve() public {
        // When all tokens are sold, can't buy more
        vm.expectRevert();
        curve.calculateAmountOut(1 ether, TOTAL_SUPPLY, TOTAL_SUPPLY);
    }

    function test_InsufficientTokensSold() public {
        // Can't sell more than was sold
        vm.expectRevert();
        curve.calculateAmountOutForSellNoFee(
            100 ether, 50 ether, TOTAL_SUPPLY
        );
    }

    function test_DivisionByZero_CurveProgress() public {
        vm.expectRevert(BondingCurve.DivisionByZero.selector);
        curve.getCurveProgress(0, 0);
    }
}
