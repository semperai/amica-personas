// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {UD60x18, ud} from "@prb/math/src/UD60x18.sol";

/**
 * @title Bonding Curve with Minimal Sell Fee
 * @notice Exponential bonding curve with ultra-minimal sell fee to prevent arbitrage
 * @dev price = startPrice * e^((tokensSold / totalSupply) * ln(33))
 */
contract BondingCurve {
    // Constants in UD60x18 format
    UD60x18 private constant LN_33 = UD60x18.wrap(3.496507561466480235e18); // ln(33)
    UD60x18 private constant ONE = UD60x18.wrap(1e18);
    
    // Ultra-minimal fee configuration
    uint256 public constant SELL_FEE_BPS = 1; // 0.01% fee on sells (1 basis point)
    uint256 private constant BPS_DIVISOR = 10000;

    /**
     * @notice Calculates token output for buying using exponential bonding curve
     * @param amountIn Input amount of pairing tokens
     * @param reserveSold Tokens already sold
     * @param reserveTotal Total tokens in bonding curve
     * @return tokenOut Token output amount
     */
    function calculateAmountOut(
        uint256 amountIn,
        uint256 reserveSold,
        uint256 reserveTotal
    ) public pure returns (uint256 tokenOut) {
        require(amountIn > 0, "Invalid input");
        require(reserveTotal > reserveSold, "Insufficient reserve");

        // Binary search for the correct amount of tokens
        // We need to find X such that calculateCostBetween(reserveSold, reserveSold + X) = amountIn

        uint256 low = 0;
        uint256 high = reserveTotal - reserveSold;

        // First, check if we can buy all remaining tokens
        uint256 maxCost = calculateCostBetween(reserveSold, reserveTotal, reserveTotal);
        if (amountIn >= maxCost) {
            return reserveTotal - reserveSold;
        }

        // Binary search with precision
        while (high - low > 1) {
            uint256 mid = (low + high) / 2;

            // Calculate cost for this amount of tokens
            uint256 cost = calculateCostBetween(reserveSold, reserveSold + mid, reserveTotal);

            if (cost <= amountIn) {
                low = mid;
            } else {
                high = mid;
            }
        }

        // If we have room for one more token, check if we can afford it
        if (low < reserveTotal - reserveSold) {
            uint256 highCost = calculateCostBetween(reserveSold, reserveSold + low + 1, reserveTotal);
            if (highCost <= amountIn) {
                return low + 1;
            }
        }

        return low;
    }

    /**
     * @notice Calculates pairing token output for selling
     * @param amountIn Persona tokens to sell
     * @param reserveSold Current tokens sold
     * @param reserveTotal Total tokens in bonding curve
     * @return pairingTokenOut Pairing token output amount (after fee)
     */
    function calculateAmountOutForSell(
        uint256 amountIn,
        uint256 reserveSold,
        uint256 reserveTotal
    ) public pure returns (uint256 pairingTokenOut) {
        require(amountIn > 0, "Invalid input");
        require(amountIn <= reserveSold, "Insufficient tokens sold");

        // Calculate the refund using exact integral
        uint256 newReserveSold = reserveSold - amountIn;
        uint256 refundBeforeFee = calculateCostBetween(newReserveSold, reserveSold, reserveTotal);
        
        // Apply minimal sell fee (0.01%)
        uint256 fee = (refundBeforeFee * SELL_FEE_BPS) / BPS_DIVISOR;
        pairingTokenOut = refundBeforeFee - fee;
    }

    /**
     * @notice Calculates pairing token output for selling WITHOUT fee
     * @dev Used for testing to verify base calculations are symmetric
     */
    function calculateAmountOutForSellNoFee(
        uint256 amountIn,
        uint256 reserveSold,
        uint256 reserveTotal
    ) public pure returns (uint256 pairingTokenOut) {
        require(amountIn > 0, "Invalid input");
        require(amountIn <= reserveSold, "Insufficient tokens sold");

        uint256 newReserveSold = reserveSold - amountIn;
        return calculateCostBetween(newReserveSold, reserveSold, reserveTotal);
    }

    /**
     * @notice Calculates the exact cost between two points on the curve
     * @param fromTokens Starting point (tokens sold)
     * @param toTokens Ending point (tokens sold)
     * @param totalSupply Total supply available for bonding
     * @return cost The cost in pairing tokens
     */
    function calculateCostBetween(
        uint256 fromTokens,
        uint256 toTokens,
        uint256 totalSupply
    ) public pure returns (uint256 cost) {
        if (fromTokens >= toTokens) return 0;

        UD60x18 progressFrom = ud(fromTokens).div(ud(totalSupply));
        UD60x18 progressTo = ud(toTokens).div(ud(totalSupply));

        // Calculate exponentials
        UD60x18 expFrom = progressFrom.mul(LN_33).exp();
        UD60x18 expTo = progressTo.mul(LN_33).exp();

        // Integral of exponential bonding curve
        // ∫ e^(progress * ln(33)) d(progress) = (1/ln(33)) * e^(progress * ln(33))
        // Cost = totalSupply * (integral at 'to' - integral at 'from')

        UD60x18 integralDiff = expTo.sub(expFrom).div(LN_33);
        UD60x18 costUD = ud(totalSupply).mul(integralDiff);

        return costUD.unwrap();
    }

    /**
     * @notice Gets the current price at a given reserve level
     * @param reserveSold Current tokens sold
     * @param reserveTotal Total tokens in bonding curve
     * @return price Current price multiplier
     */
    function getCurrentPrice(
        uint256 reserveSold,
        uint256 reserveTotal
    ) public pure returns (uint256 price) {
        UD60x18 progress = ud(reserveSold).div(ud(reserveTotal));
        UD60x18 exponent = progress.mul(LN_33);
        UD60x18 multiplier = exponent.exp();

        return multiplier.unwrap();
    }
}
