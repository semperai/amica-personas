// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {UD60x18, ud} from "@prb/math/src/UD60x18.sol";

/**
 * @title Bonding Curve Implementation
 * @notice Exponential bonding curve using PRBMath for precise calculations
 * @dev price = startPrice * e^((tokensSold / totalSupply) * ln(33))
 */
contract BondingCurve {
    // Constants in UD60x18 format
    UD60x18 private constant LN_33 = UD60x18.wrap(3_497066402744502449e18); // ln(33)
    UD60x18 private constant ONE = UD60x18.wrap(1e18);

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

        // Use analytical solution for exponential curve
        // Instead of binary search, we can solve directly

        UD60x18 currentProgress = ud(reserveSold).div(ud(reserveTotal));
        UD60x18 currentExponent = currentProgress.mul(LN_33);
        UD60x18 currentMultiplier = currentExponent.exp();

        // For exponential curve: integral = (totalSupply / ln(33)) * (e^(progress * ln(33)) - 1)
        // We need to find how many tokens we can buy with amountIn

        // Calculate the integral constant
        UD60x18 integralConstant = ud(reserveTotal).div(LN_33);

        // Current cost basis
        UD60x18 currentCostBasis = integralConstant.mul(currentMultiplier.sub(ONE));

        // Target cost basis after purchase
        UD60x18 targetCostBasis = currentCostBasis.add(ud(amountIn));

        // Solve for new progress: (targetCostBasis / integralConstant) + 1 = e^(newProgress * ln(33))
        UD60x18 targetMultiplier = targetCostBasis.div(integralConstant).add(ONE);
        UD60x18 newProgress = targetMultiplier.ln().div(LN_33);

        // Calculate tokens that can be bought
        uint256 newReserveSold = newProgress.mul(ud(reserveTotal)).unwrap();

        // Ensure we don't exceed available supply
        if (newReserveSold > reserveTotal) {
            return reserveTotal - reserveSold;
        }

        return newReserveSold > reserveSold ? newReserveSold - reserveSold : 0;
    }

    /**
     * @notice Calculates pairing token output for selling
     * @param amountIn Persona tokens to sell
     * @param reserveSold Current tokens sold
     * @param reserveTotal Total tokens in bonding curve
     * @return pairingTokenOut Pairing token output amount
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
