// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title IBondingCurve
 * @notice Interface for bonding curve implementations
 * @dev Defines the standard functions for exponential bonding curves
 */
interface IBondingCurve {
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
    ) external pure returns (uint256 tokenOut);

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
    ) external pure returns (uint256 pairingTokenOut);

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
    ) external pure returns (uint256 cost);

    /**
     * @notice Gets the current price at a given reserve level
     * @param reserveSold Current tokens sold
     * @param reserveTotal Total tokens in bonding curve
     * @return price Current price multiplier
     */
    function getCurrentPrice(
        uint256 reserveSold,
        uint256 reserveTotal
    ) external pure returns (uint256 price);
}
