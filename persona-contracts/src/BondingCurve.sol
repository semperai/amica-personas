// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title Bonding Curve with Virtual Reserves
 * @notice Implements a virtual reserves bonding curve model similar to pump.fun
 * @dev Uses constant product AMM formula with virtual reserves to achieve 133x price multiplier at graduation
 *
 * The virtual reserves model works by:
 * 1. Starting with virtual token and ETH reserves
 * 2. Using x * y = k constant product formula
 * 3. Calibrating initial virtual reserves to achieve exactly 133x price at graduation
 */
contract BondingCurve {
    uint256 private constant PRECISION = 1e18;
    uint256 public constant CURVE_MULTIPLIER = 133;
    uint256 private constant SQRT133_MINUS_1 = 10532; // Approximation of sqrt(133) - 1 * 1000 for precision

    // Fee configuration to prevent rounding exploit
    uint256 public constant SELL_FEE_BPS = 10; // 0.1% fee on sells
    uint256 private constant BPS_DIVISOR = 10000;

    /**
     * @notice Calculates token output for buying using virtual reserves model
     * @param amountIn Input amount of ETH
     * @param reserveSold Tokens already sold from the curve
     * @param reserveTotal Total tokens available in bonding curve
     * @return tokenOut Token output amount
     */
    function calculateAmountOut(
        uint256 amountIn,
        uint256 reserveSold,
        uint256 reserveTotal
    ) public pure returns (uint256 tokenOut) {
        require(amountIn > 0, "Invalid input");
        require(reserveTotal > reserveSold, "Insufficient reserve");

        // Calculate virtual reserves
        (uint256 virtualToken, uint256 virtualETH) =
            getVirtualReserves(reserveSold, reserveTotal);

        // Calculate output using constant product formula
        // When buying tokens: dx = (x * dy) / (y + dy)
        // where x = virtualToken, y = virtualETH, dy = amountIn
        uint256 numerator = virtualToken * amountIn;
        uint256 denominator = virtualETH + amountIn;
        uint256 virtualTokenOut = numerator / denominator;

        // Ensure we don't exceed available tokens
        uint256 tokensRemaining = reserveTotal - reserveSold;
        tokenOut = virtualTokenOut > tokensRemaining
            ? tokensRemaining
            : virtualTokenOut;
    }

    /**
     * @notice Calculates ETH output for selling tokens
     * @param amountIn Tokens to sell
     * @param reserveSold Current tokens sold from the curve
     * @param reserveTotal Total tokens in bonding curve
     * @return pairingTokenOut ETH output amount (after fee)
     */
    function calculateAmountOutForSell(
        uint256 amountIn,
        uint256 reserveSold,
        uint256 reserveTotal
    ) public pure returns (uint256 pairingTokenOut) {
        require(amountIn > 0, "Invalid input");
        require(amountIn <= reserveSold, "Insufficient tokens sold");

        uint256 ethBeforeFee =
            calculateAmountOutForSellNoFee(amountIn, reserveSold, reserveTotal);

        // Apply fee to prevent rounding exploits
        uint256 fee = (ethBeforeFee * SELL_FEE_BPS) / BPS_DIVISOR;
        pairingTokenOut = ethBeforeFee - fee;
    }

    /**
     * @notice Calculates ETH output for selling WITHOUT fee
     * @dev Internal calculation for testing and fee application
     */
    function calculateAmountOutForSellNoFee(
        uint256 amountIn,
        uint256 reserveSold,
        uint256 reserveTotal
    ) public pure returns (uint256 pairingTokenOut) {
        require(amountIn > 0, "Invalid input");
        require(amountIn <= reserveSold, "Insufficient tokens sold");

        // When selling tokens back, we calculate using the AMM formula
        // Current state
        (uint256 virtualToken, uint256 virtualETH) =
            getVirtualReserves(reserveSold, reserveTotal);

        // After selling, virtual token reserve increases
        uint256 newVirtualToken = virtualToken + amountIn;

        // Calculate new virtual ETH to maintain constant k
        uint256 k = virtualToken * virtualETH;
        uint256 newVirtualETH = k / newVirtualToken;

        // ETH output is the difference
        pairingTokenOut = virtualETH - newVirtualETH;
    }

    /**
     * @notice Calculates the exact cost between two points on the curve
     * @param fromTokens Starting point (tokens sold)
     * @param toTokens Ending point (tokens sold)
     * @param totalSupply Total supply available for bonding
     * @return cost The cost in ETH
     */
    function calculateCostBetween(
        uint256 fromTokens,
        uint256 toTokens,
        uint256 totalSupply
    ) public pure returns (uint256 cost) {
        if (fromTokens >= toTokens) return 0;

        // Get virtual ETH at the starting point
        (, uint256 virtualETHStart) =
            getVirtualReserves(fromTokens, totalSupply);

        // Get virtual ETH at the ending point
        (, uint256 virtualETHEnd) = getVirtualReserves(toTokens, totalSupply);

        // The cost is the difference in virtual ETH reserves
        cost = virtualETHEnd - virtualETHStart;
    }

    /**
     * @notice Gets the current price at a given reserve level
     * @param reserveSold Current tokens sold
     * @param reserveTotal Total tokens in bonding curve
     * @return price Current price in ETH per token (with 18 decimals)
     */
    function getCurrentPrice(uint256 reserveSold, uint256 reserveTotal)
        public
        pure
        returns (uint256 price)
    {
        (uint256 virtualToken, uint256 virtualETH) =
            getVirtualReserves(reserveSold, reserveTotal);

        // Price = virtualETH / virtualToken (with 18 decimal precision)
        price = (virtualETH * PRECISION) / virtualToken;
    }

    /**
     * @notice Calculates virtual reserves based on tokens sold
     * @dev Virtual reserves maintain constant k while achieving price targets
     * @param reserveSold Tokens sold from the curve
     * @param reserveTotal Total tokens in the curve
     * @return virtualToken Virtual token reserve
     * @return virtualETH Virtual ETH reserve
     */
    function getVirtualReserves(uint256 reserveSold, uint256 reserveTotal)
        public
        pure
        returns (uint256 virtualToken, uint256 virtualETH)
    {
        // To achieve exactly 1x starting price and 133x ending price:
        // We need virtualETH/virtualToken to go from 1 to 133
        //
        // Math derivation:
        // At start: (T + b) / (T + b) = 1 (where T = reserveTotal, b = virtual buffer)
        // At end: virtualETH_end / b = 133
        // With constant k = (T + b)²
        //
        // Solving: virtualETH_end = k / b = (T + b)² / b = 133 * b
        // Therefore: (T + b)² = 133 * b²
        // T + b = b * sqrt(133)
        // b = T / (sqrt(133) - 1) ≈ T / 4.745

        // Using a precise approximation for sqrt(133) - 1 ≈ 4.745
        // We use b = T * 1000 / 7124 for precision
        uint256 virtualBuffer = (reserveTotal * 1000) / SQRT133_MINUS_1;

        // Virtual token reserve decreases as tokens are sold
        virtualToken = reserveTotal - reserveSold + virtualBuffer;

        // Calculate k from initial state
        uint256 initialReserve = reserveTotal + virtualBuffer;
        uint256 k = initialReserve * initialReserve;

        // Maintain constant k
        virtualETH = k / virtualToken;
    }
}
