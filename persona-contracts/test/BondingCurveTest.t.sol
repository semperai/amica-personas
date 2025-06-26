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
    uint256 constant CURVE_MULTIPLIER = 33;

    function setUp() public {
        bondingCurve = new BondingCurve();
    }

    // ==================== Price Target Tests ====================

    function test_GetCurrentPrice_AtStart() public {
        uint256 price = bondingCurve.getCurrentPrice(0, TOTAL_SUPPLY);
        // Price should be approximately 1x at start
        assertApproxEqRel(price, PRECISION, 0.01 ether, "Starting price should be approximately 1x");
        console.log("Starting price:", price);
    }

    function test_GetCurrentPrice_AtEnd() public {
        uint256 price = bondingCurve.getCurrentPrice(TOTAL_SUPPLY, TOTAL_SUPPLY);
        // Price should be approximately 33x at the end
        assertApproxEqRel(price, CURVE_MULTIPLIER * PRECISION, 0.05 ether, "End price should be ~33x");
        console.log("End price:", price);
    }

    // ==================== Buy/Sell Symmetry Test ====================

    function test_PerfectSymmetryRequired() public {
        // Without fees, buy-sell must be perfectly symmetric
        
        // Test case 1: Small amount at start
        uint256 amount1 = 1000 ether;
        uint256 tokens1 = bondingCurve.calculateAmountOut(amount1, 0, TOTAL_SUPPLY);
        uint256 refund1 = bondingCurve.calculateAmountOutForSellNoFee(tokens1, tokens1, TOTAL_SUPPLY);
        assertApproxEqRel(refund1, amount1, 0.0001 ether, "Must have near-perfect symmetry without fees");
        
        // Test case 2: Large amount in middle
        uint256 startPoint2 = TOTAL_SUPPLY / 2;
        uint256 amount2 = 50000 ether;
        uint256 tokens2 = bondingCurve.calculateAmountOut(amount2, startPoint2, TOTAL_SUPPLY);
        uint256 refund2 = bondingCurve.calculateAmountOutForSellNoFee(tokens2, startPoint2 + tokens2, TOTAL_SUPPLY);
        assertApproxEqRel(refund2, amount2, 0.0001 ether, "Must have near-perfect symmetry at midpoint");
    }

    // ==================== Basic Calculation Tests ====================

    function test_CalculateAmountOut_FirstPurchase() public {
        // First purchase should get tokens at starting price (~1x)
        uint256 amountIn = 1000 ether;
        uint256 tokensOut = bondingCurve.calculateAmountOut(amountIn, 0, TOTAL_SUPPLY);
        
        // At start, price is ~1x, so we should get approximately amountIn tokens
        assertGt(tokensOut, 0, "Should receive tokens");
        assertApproxEqRel(tokensOut, amountIn, 0.1 ether, "Should receive approximately 1:1 at start");
    }

    function test_CalculateAmountOut_NearEndOfCurve() public {
        // When almost all tokens are sold, price should be near 33x
        uint256 amountIn = 1000 ether;
        uint256 almostAllSold = TOTAL_SUPPLY - 1000 ether; // Only 1000 tokens left
        
        uint256 tokensOut = bondingCurve.calculateAmountOut(amountIn, almostAllSold, TOTAL_SUPPLY);
        
        // At the end, price should be ~33x, so we should get much fewer tokens
        assertLt(tokensOut, amountIn / 20, "Should receive much fewer tokens at end of curve");
        assertGt(tokensOut, 0, "Should still receive some tokens");
    }

    function test_CalculateAmountOutForSell_SellAll() public {
        // If tokens were bought for X amount, selling all back should return X minus fee
        uint256 buyAmount = 10000 ether;
        
        // Buy tokens
        uint256 tokensBought = bondingCurve.calculateAmountOut(buyAmount, 0, TOTAL_SUPPLY);
        
        // Sell all tokens back without fee
        uint256 refundNoFee = bondingCurve.calculateAmountOutForSellNoFee(tokensBought, tokensBought, TOTAL_SUPPLY);
        assertApproxEqRel(refundNoFee, buyAmount, 0.0001 ether, "Without fee should be near perfect");
        
        // Sell with fee
        uint256 refundWithFee = bondingCurve.calculateAmountOutForSell(tokensBought, tokensBought, TOTAL_SUPPLY);
        assertLt(refundWithFee, buyAmount, "With fee, refund should be less");
        
        // Verify fee is correct (0.1%)
        uint256 expectedFee = (refundNoFee * 10) / 10000; // 0.1%
        assertApproxEqAbs(refundNoFee - refundWithFee, expectedFee, 1, "Fee should be exactly 0.1%");
    }

    function test_CalculateCostBetween_FullRange() public {
        // Cost to buy entire supply
        uint256 totalCost = bondingCurve.calculateCostBetween(0, TOTAL_SUPPLY, TOTAL_SUPPLY);
        
        // Should be significant due to 33x multiplier
        assertGt(totalCost, TOTAL_SUPPLY, "Total cost should exceed supply due to curve");
        
        // Average price should be between 1x and 33x
        uint256 avgPrice = (totalCost * PRECISION) / TOTAL_SUPPLY;
        assertGt(avgPrice, PRECISION, "Average price should be > 1x");
        assertLt(avgPrice, CURVE_MULTIPLIER * PRECISION, "Average price should be < 33x");
        
        console.log("Total cost to buy all tokens:", totalCost / 1e18);
        console.log("Average price:", avgPrice / 1e18);
    }

    // ==================== Integration Test ====================

    function test_Integration_FullCycle() public {
        // Simulate buying and selling in chunks
        uint256 totalSpent = 0;
        uint256 totalTokensBought = 0;
        
        // Buy tokens in chunks
        uint256 chunkSize = 10000 ether;
        uint256 targetTokens = TOTAL_SUPPLY / 4; // Buy 25% of supply
        
        while (totalTokensBought < targetTokens) {
            uint256 tokensOut = bondingCurve.calculateAmountOut(chunkSize, totalTokensBought, TOTAL_SUPPLY);
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
        uint256 totalRefund = bondingCurve.calculateAmountOutForSellNoFee(totalTokensBought, totalTokensBought, TOTAL_SUPPLY);
        
        // Should get back approximately what we spent
        assertApproxEqRel(totalRefund, totalSpent, 0.001 ether, "Should refund total spent");
    }

    // ==================== Gas Efficiency Test ====================

    function test_GasEfficiency() public {
        // Measure gas for various operations
        uint256 gasBefore;
        uint256 gasAfter;
        
        // Buy operation
        gasBefore = gasleft();
        bondingCurve.calculateAmountOut(1000 ether, TOTAL_SUPPLY / 2, TOTAL_SUPPLY);
        gasAfter = gasleft();
        console.log("Gas for calculateAmountOut:", gasBefore - gasAfter);
        
        // Sell operation
        gasBefore = gasleft();
        bondingCurve.calculateAmountOutForSell(1000 ether, TOTAL_SUPPLY / 2, TOTAL_SUPPLY);
        gasAfter = gasleft();
        console.log("Gas for calculateAmountOutForSell:", gasBefore - gasAfter);
        
        // Price check
        gasBefore = gasleft();
        bondingCurve.getCurrentPrice(TOTAL_SUPPLY / 2, TOTAL_SUPPLY);
        gasAfter = gasleft();
        console.log("Gas for getCurrentPrice:", gasBefore - gasAfter);
    }

    // ==================== Fee Protection Test ====================

    function test_FeePreventsDrainExploit() public {
        // Test that fee prevents profitable round-trip exploits
        uint256 startAmount = 1000 ether;
        
        // Buy tokens
        uint256 tokensBought = bondingCurve.calculateAmountOut(startAmount, 0, TOTAL_SUPPLY);
        
        // Immediately sell back
        uint256 refund = bondingCurve.calculateAmountOutForSell(tokensBought, tokensBought, TOTAL_SUPPLY);
        
        // Should lose money due to fee
        assertLt(refund, startAmount, "Round trip should lose money due to fee");
        
        // Calculate loss
        uint256 loss = startAmount - refund;
        console.log("Loss from round trip:", loss);
        console.log("Loss percentage:", (loss * 10000) / startAmount); // in basis points
        
        // Loss should be at least the fee amount (minus tiny rounding benefit)
        uint256 minExpectedLoss = (startAmount * 10) / 10000; // 0.1% fee
        assertGt(loss, minExpectedLoss - 100, "Loss should be at least the fee amount");
    }

    // ==================== Fuzzing Test ====================

    function testFuzz_BuySellSymmetry(uint256 buyAmount, uint256 initialSold) public {
        buyAmount = bound(buyAmount, 1 ether, 10000 ether);
        initialSold = bound(initialSold, 0, TOTAL_SUPPLY / 2);
        
        // Buy tokens
        uint256 tokensBought = bondingCurve.calculateAmountOut(buyAmount, initialSold, TOTAL_SUPPLY);
        
        if (tokensBought == 0) return;
        
        uint256 newTotalSold = initialSold + tokensBought;
        if (newTotalSold >= TOTAL_SUPPLY) return;
        
        // Sell back without fee
        uint256 sellProceeds = bondingCurve.calculateAmountOutForSellNoFee(tokensBought, newTotalSold, TOTAL_SUPPLY);
        
        // Should have near-perfect symmetry without fees
        assertApproxEqRel(sellProceeds, buyAmount, 0.0001 ether, "Near-perfect symmetry required");
    }
}
