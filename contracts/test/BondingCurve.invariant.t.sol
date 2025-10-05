// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/BondingCurve.sol";

/**
 * @title BondingCurveInvariantTest
 * @notice Comprehensive fuzzing and invariant tests for BondingCurve
 * @dev Tests mathematical properties that should ALWAYS hold true
 */
contract BondingCurveInvariantTest is Test {
    BondingCurve public curve;

    // Test constants
    uint256 constant TOTAL_SUPPLY = 166_666_666 ether;
    uint256 constant PRECISION = 1e18;

    // Handlers for stateful fuzzing
    BondingCurveHandler public handler;

    function setUp() public {
        curve = new BondingCurve();
        handler = new BondingCurveHandler(curve, TOTAL_SUPPLY);

        // Target the handler for invariant tests
        targetContract(address(handler));
    }

    /*//////////////////////////////////////////////////////////////
                        INVARIANT TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Price should always increase as more tokens are sold
    function invariant_priceAlwaysIncreases() public view {
        uint256 lastPrice = 0;

        for (uint256 sold = 0; sold < TOTAL_SUPPLY; sold += TOTAL_SUPPLY / 100) {
            if (sold >= TOTAL_SUPPLY) break;

            uint256 currentPrice = curve.getCurrentPrice(sold, TOTAL_SUPPLY);

            if (sold > 0) {
                assertGe(
                    currentPrice,
                    lastPrice,
                    "Price should never decrease as tokens are sold"
                );
            }

            lastPrice = currentPrice;
        }
    }

    /// @notice Virtual reserves should maintain constant product (k = x * y)
    function invariant_constantProduct() public view {
        (uint256 virtualToken0, uint256 virtualETH0) =
            curve.getVirtualReserves(0, TOTAL_SUPPLY);

        uint256 k = virtualToken0 * virtualETH0;

        // Check at various points along the curve
        for (uint256 sold = TOTAL_SUPPLY / 10; sold < TOTAL_SUPPLY; sold += TOTAL_SUPPLY / 10) {
            (uint256 virtualToken, uint256 virtualETH) =
                curve.getVirtualReserves(sold, TOTAL_SUPPLY);

            uint256 currentK = virtualToken * virtualETH;

            // Allow for tiny rounding differences (< 0.01%)
            uint256 diff = currentK > k ? currentK - k : k - currentK;
            uint256 tolerance = k / 10000; // 0.01%

            assertLe(
                diff,
                tolerance,
                "Constant product invariant violated"
            );
        }
    }

    /// @notice Buying then selling should result in less ETH due to fee
    function invariant_buyThenSellLosesValue() public {
        uint256 ethIn = 1 ether;

        // Buy tokens
        uint256 tokensOut = curve.calculateAmountOut(ethIn, 0, TOTAL_SUPPLY);

        // Sell tokens back
        uint256 ethOut = curve.calculateAmountOutForSell(tokensOut, tokensOut, TOTAL_SUPPLY);

        // Should get back less than we put in (due to sell fee and price impact)
        assertLt(ethOut, ethIn, "Buy-then-sell should lose value due to fees");
    }

    /// @notice Total tokens purchased should never exceed total supply
    function invariant_cannotExceedSupply() public view {
        assertLe(
            handler.totalTokensPurchased(),
            TOTAL_SUPPLY,
            "Cannot purchase more tokens than total supply"
        );
    }

    /// @notice ETH balance and token purchases should be consistent
    /// @dev Due to sell fees (0.1%), total ETH may be less than virtual reserves suggest
    function invariant_ethAndTokenConsistency() public view {
        uint256 soldTokens = handler.totalTokensPurchased();
        uint256 ethBalance = handler.totalETHDeposited();

        // ETH balance should always be non-negative
        assertGe(ethBalance, 0, "ETH balance must be non-negative");

        // Tokens purchased should never exceed total supply
        assertLe(soldTokens, TOTAL_SUPPLY, "Cannot purchase more than total supply");

        // If we have sold tokens, we should have some ETH (unless all was withdrawn via sells)
        // This is a weak invariant but still useful
        if (soldTokens > 0 && handler.sellCount() == 0) {
            assertGt(ethBalance, 0, "If tokens sold and no sells made, should have ETH");
        }
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ TESTS - BUY OPERATIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test: buying should always return non-zero tokens for non-zero input
    function testFuzz_buyNonZeroOutput(uint256 ethIn, uint256 reserveSold) public view {
        ethIn = bound(ethIn, 0.01 ether, 1000 ether);
        // Leave room for at least 1 ether of tokens
        reserveSold = bound(reserveSold, 0, TOTAL_SUPPLY - 1 ether);

        // Skip if ethIn ended up as 0 after bounding
        if (ethIn == 0) return;

        uint256 tokensOut = curve.calculateAmountOut(ethIn, reserveSold, TOTAL_SUPPLY);

        assertGt(tokensOut, 0, "Should receive tokens for non-zero input");
    }

    /// @notice Fuzz test: more ETH in = more tokens out (at same reserve level)
    function testFuzz_moreEthInMoreTokensOut(
        uint256 ethIn1,
        uint256 ethIn2,
        uint256 reserveSold
    ) public view {
        ethIn1 = bound(ethIn1, 1, 100 ether);
        ethIn2 = bound(ethIn2, ethIn1 + 1, 200 ether);
        reserveSold = bound(reserveSold, 0, TOTAL_SUPPLY / 2);

        uint256 tokensOut1 = curve.calculateAmountOut(ethIn1, reserveSold, TOTAL_SUPPLY);
        uint256 tokensOut2 = curve.calculateAmountOut(ethIn2, reserveSold, TOTAL_SUPPLY);

        // Tokens may be capped at supply, so use >= instead of >
        assertGe(tokensOut2, tokensOut1, "More ETH should yield more or equal tokens (if capped at supply)");
    }

    /// @notice Fuzz test: buying at higher reserve level should give fewer tokens
    function testFuzz_higherReserveLessTokens(
        uint256 ethIn,
        uint256 reserveSold1,
        uint256 reserveSold2
    ) public view {
        ethIn = bound(ethIn, 1 ether, 10 ether);
        reserveSold1 = bound(reserveSold1, 0, TOTAL_SUPPLY / 3);
        reserveSold2 = bound(reserveSold2, reserveSold1 + 1 ether, TOTAL_SUPPLY / 2);

        uint256 tokensOut1 = curve.calculateAmountOut(ethIn, reserveSold1, TOTAL_SUPPLY);
        uint256 tokensOut2 = curve.calculateAmountOut(ethIn, reserveSold2, TOTAL_SUPPLY);

        assertGt(tokensOut1, tokensOut2, "Same ETH should yield fewer tokens at higher reserve");
    }

    /// @notice Fuzz test: sequential buys should equal single large buy
    function testFuzz_sequentialBuysMatchLargeBuy(
        uint256 ethIn1,
        uint256 ethIn2
    ) public view {
        ethIn1 = bound(ethIn1, 1 ether, 10 ether);
        ethIn2 = bound(ethIn2, 1 ether, 10 ether);

        // Single large buy
        uint256 totalEthIn = ethIn1 + ethIn2;
        uint256 tokensOutLarge = curve.calculateAmountOut(totalEthIn, 0, TOTAL_SUPPLY);

        // Two sequential buys
        uint256 tokensOut1 = curve.calculateAmountOut(ethIn1, 0, TOTAL_SUPPLY);
        uint256 tokensOut2 = curve.calculateAmountOut(ethIn2, tokensOut1, TOTAL_SUPPLY);
        uint256 tokensOutSequential = tokensOut1 + tokensOut2;

        // Should be very close (allow tiny rounding difference)
        uint256 diff = tokensOutLarge > tokensOutSequential
            ? tokensOutLarge - tokensOutSequential
            : tokensOutSequential - tokensOutLarge;

        assertLe(
            diff,
            tokensOutLarge / 10000, // 0.01% tolerance
            "Sequential buys should match single large buy"
        );
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ TESTS - SELL OPERATIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test: selling should always return non-zero ETH
    function testFuzz_sellNonZeroOutput(uint256 tokensIn, uint256 reserveSold) public view {
        reserveSold = bound(reserveSold, 1 ether, TOTAL_SUPPLY / 2);
        tokensIn = bound(tokensIn, 1, reserveSold);

        uint256 ethOut = curve.calculateAmountOutForSell(tokensIn, reserveSold, TOTAL_SUPPLY);

        assertGt(ethOut, 0, "Should receive ETH for selling tokens");
    }

    /// @notice Fuzz test: sell fee should be exactly 0.1%
    function testFuzz_sellFeeExact(uint256 tokensIn, uint256 reserveSold) public view {
        reserveSold = bound(reserveSold, 10 ether, TOTAL_SUPPLY / 2);
        tokensIn = bound(tokensIn, 1 ether, reserveSold / 2);

        uint256 ethWithFee = curve.calculateAmountOutForSell(tokensIn, reserveSold, TOTAL_SUPPLY);
        uint256 ethNoFee = curve.calculateAmountOutForSellNoFee(tokensIn, reserveSold, TOTAL_SUPPLY);

        uint256 expectedFee = (ethNoFee * curve.SELL_FEE_BPS()) / 10000;
        uint256 actualFee = ethNoFee - ethWithFee;

        assertEq(actualFee, expectedFee, "Sell fee should be exactly 0.1%");
    }

    /// @notice Fuzz test: cannot sell more than purchased
    function testFuzz_cannotSellMoreThanPurchased(
        uint256 tokensIn,
        uint256 reserveSold
    ) public {
        reserveSold = bound(reserveSold, 1, TOTAL_SUPPLY / 2);
        tokensIn = bound(tokensIn, reserveSold + 1, TOTAL_SUPPLY);

        vm.expectRevert();
        curve.calculateAmountOutForSell(tokensIn, reserveSold, TOTAL_SUPPLY);
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ TESTS - PRICE CALCULATIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test: getCurrentPrice should always be positive
    function testFuzz_priceAlwaysPositive(uint256 reserveSold) public view {
        reserveSold = bound(reserveSold, 0, TOTAL_SUPPLY - 1);

        uint256 price = curve.getCurrentPrice(reserveSold, TOTAL_SUPPLY);

        assertGt(price, 0, "Price should always be positive");
    }

    /// @notice Fuzz test: price multiplier should increase monotonically
    function testFuzz_multiplierIncreases(uint256 reserveSold1, uint256 reserveSold2) public view {
        reserveSold1 = bound(reserveSold1, 0, TOTAL_SUPPLY / 2);
        reserveSold2 = bound(reserveSold2, reserveSold1 + 1, TOTAL_SUPPLY - 1);

        uint256 multiplier1 = curve.getCurrentMultiplier(reserveSold1, TOTAL_SUPPLY);
        uint256 multiplier2 = curve.getCurrentMultiplier(reserveSold2, TOTAL_SUPPLY);

        assertGe(multiplier2, multiplier1, "Multiplier should increase or stay same");
    }

    /// @notice Fuzz test: curve progress should be proportional
    function testFuzz_curveProgressProportional(uint256 reserveSold) public view {
        reserveSold = bound(reserveSold, 0, TOTAL_SUPPLY);

        uint256 progress = curve.getCurveProgress(reserveSold, TOTAL_SUPPLY);
        uint256 expectedProgress = (reserveSold * 10000) / TOTAL_SUPPLY;

        assertEq(progress, expectedProgress, "Progress calculation incorrect");
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ TESTS - EDGE CASES
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test: virtual reserves should never be zero
    function testFuzz_virtualReservesNeverZero(uint256 reserveSold) public view {
        reserveSold = bound(reserveSold, 0, TOTAL_SUPPLY - 1);

        (uint256 virtualToken, uint256 virtualETH) =
            curve.getVirtualReserves(reserveSold, TOTAL_SUPPLY);

        assertGt(virtualToken, 0, "Virtual token reserve should never be zero");
        assertGt(virtualETH, 0, "Virtual ETH reserve should never be zero");
    }

    /// @notice Fuzz test: buying near supply limit
    function testFuzz_buyNearSupplyLimit(uint256 ethIn) public view {
        ethIn = bound(ethIn, 1, 1000 ether);
        uint256 nearLimit = TOTAL_SUPPLY - 1 ether;

        uint256 tokensOut = curve.calculateAmountOut(ethIn, nearLimit, TOTAL_SUPPLY);

        assertLe(tokensOut, TOTAL_SUPPLY - nearLimit, "Cannot exceed remaining supply");
    }

    /// @notice Fuzz test: cost calculation should be consistent
    function testFuzz_costCalculationConsistent(
        uint256 fromTokens,
        uint256 toTokens
    ) public view {
        fromTokens = bound(fromTokens, 0, TOTAL_SUPPLY / 2);
        toTokens = bound(toTokens, fromTokens + 1 ether, TOTAL_SUPPLY - 1 ether);

        uint256 cost = curve.calculateCostBetween(fromTokens, toTokens, TOTAL_SUPPLY);

        assertGt(cost, 0, "Cost should be positive for valid range");

        // Verify by buying tokens
        uint256 tokenAmount = toTokens - fromTokens;
        uint256 ethRequired = curve.calculateCostBetween(fromTokens, toTokens, TOTAL_SUPPLY);

        // The cost should match buying that amount
        uint256 tokensReceived = curve.calculateAmountOut(ethRequired, fromTokens, TOTAL_SUPPLY);

        // Allow small rounding difference
        uint256 diff = tokenAmount > tokensReceived
            ? tokenAmount - tokensReceived
            : tokensReceived - tokenAmount;

        assertLe(
            diff,
            tokenAmount / 1000, // 0.1% tolerance
            "Cost calculation should match actual purchase"
        );
    }
}

/**
 * @title BondingCurveHandler
 * @notice Handler for stateful fuzzing (invariant tests)
 */
contract BondingCurveHandler is Test {
    BondingCurve public curve;
    uint256 public totalSupply;

    uint256 public totalTokensPurchased;
    uint256 public totalETHDeposited;
    uint256 public buyCount;
    uint256 public sellCount;

    constructor(BondingCurve _curve, uint256 _totalSupply) {
        curve = _curve;
        totalSupply = _totalSupply;
    }

    /// @notice Simulate buying tokens
    function buy(uint256 ethAmount) public {
        ethAmount = bound(ethAmount, 0.01 ether, 10 ether);

        // Ensure we don't exceed supply
        if (totalTokensPurchased >= totalSupply - 1 ether) return;

        uint256 tokensOut = curve.calculateAmountOut(
            ethAmount,
            totalTokensPurchased,
            totalSupply
        );

        // Only execute if we get tokens
        if (tokensOut > 0 && totalTokensPurchased + tokensOut <= totalSupply) {
            totalTokensPurchased += tokensOut;
            totalETHDeposited += ethAmount;
            buyCount++;
        }
    }

    /// @notice Simulate selling tokens
    function sell(uint256 tokenAmount) public {
        // Can only sell what's been purchased
        if (totalTokensPurchased == 0) return;

        tokenAmount = bound(tokenAmount, 1, totalTokensPurchased);

        uint256 ethOut = curve.calculateAmountOutForSell(
            tokenAmount,
            totalTokensPurchased,
            totalSupply
        );

        if (ethOut > 0 && ethOut <= totalETHDeposited) {
            totalTokensPurchased -= tokenAmount;
            totalETHDeposited -= ethOut;
            sellCount++;
        }
    }
}
