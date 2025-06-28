// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title BondingCurve
 * @author Kasumi
 * @notice Implements a virtual reserves bonding curve with a 133x price multiplier at graduation
 * @dev Uses a constant product AMM (x * y = k) formula with virtual reserves
 *
 * ## Overview
 * This contract implements a bonding curve mechanism similar to pump.fun, where:
 * - Tokens are bought and sold along a mathematical curve
 * - Price increases as more tokens are sold
 * - Virtual reserves ensure smooth price progression
 *
 * ## Key Features
 * - Constant product formula (x * y = k) for price discovery
 * - Virtual reserves to achieve exact price targets
 * - Anti-manipulation sell fee (0.1%)
 * - No external dependencies or oracles required
 *
 * ## Mathematical Model
 * The curve uses virtual reserves to maintain the relationship:
 * - Virtual buffer: totalSupply / (√c - 1)
 *
 * ## Security Considerations
 * - All calculations use integer math to avoid precision issues
 * - Sell fee prevents rounding exploit attacks
 * - No reentrancy risks (pure functions only)
 */
contract BondingCurve {
    // ============ Constants ============

    /// @notice Precision multiplier for price calculations (1e18)
    uint256 private constant PRECISION = 1e18;

    /// @notice Sell fee in basis points (10 = 0.1%)
    uint256 public constant SELL_FEE_BPS = 10;

    /// @notice Basis points divisor for percentage calculations
    uint256 private constant BPS_DIVISOR = 10000;

    // ============ Virtual Constants (can be overridden) ============

    /// @notice Approximation of (√233 - 1) * 1000 for integer math precision
    /// @dev Virtual function to allow overriding in test contracts
    function getCurveMultiplier() public view virtual returns (uint256) {
        return 14264;
    }

    // ============ Custom Errors ============

    /// @notice Thrown when input amount is zero
    /// @param operation The operation that failed (0: buy, 1: sell)
    error InvalidAmount(uint8 operation);

    /// @notice Thrown when there are insufficient tokens in the reserve
    /// @param requested Amount of tokens requested
    /// @param available Amount of tokens available
    error InsufficientReserve(uint256 requested, uint256 available);

    /// @notice Thrown when trying to sell more tokens than have been sold
    /// @param sellAmount Amount trying to sell
    /// @param totalSold Total amount sold from curve
    error InsufficientTokensSold(uint256 sellAmount, uint256 totalSold);

    /// @notice Thrown when calculation would result in division by zero
    error DivisionByZero();

    /// @notice Thrown when calculation would overflow
    error Overflow();

    // ============ Buy Functions ============

    /**
     * @notice Calculates token output for a given ETH input when buying
     * @dev Uses constant product formula: dx = (x * dy) / (y + dy)
     * @param amountIn Amount of ETH to spend
     * @param reserveSold Current amount of tokens sold from the curve
     * @param reserveTotal Total amount of tokens available in the curve
     * @return tokenOut Amount of tokens that will be received
     */
    function calculateAmountOut(
        uint256 amountIn,
        uint256 reserveSold,
        uint256 reserveTotal
    ) public view returns (uint256 tokenOut) {
        // Validate inputs
        if (amountIn == 0) revert InvalidAmount(0);
        if (reserveTotal <= reserveSold) {
            revert InsufficientReserve(1, reserveTotal - reserveSold);
        }

        // Get current virtual reserves
        (uint256 virtualToken, uint256 virtualETH) =
            getVirtualReserves(reserveSold, reserveTotal);

        // Apply constant product formula for token swap
        // dx = (x * dy) / (y + dy)
        // where: x = virtualToken, y = virtualETH, dy = amountIn
        uint256 numerator = virtualToken * amountIn;
        uint256 denominator = virtualETH + amountIn;

        // Check for overflow in multiplication
        if (numerator / virtualToken != amountIn) revert Overflow();

        uint256 virtualTokenOut = numerator / denominator;

        // Cap output at available tokens
        uint256 tokensRemaining = reserveTotal - reserveSold;
        tokenOut = virtualTokenOut > tokensRemaining
            ? tokensRemaining
            : virtualTokenOut;
    }

    // ============ Sell Functions ============

    /**
     * @notice Calculates ETH output for selling tokens (with fee applied)
     * @dev Applies a 0.1% fee to prevent rounding exploit attacks
     * @param amountIn Amount of tokens to sell
     * @param reserveSold Current amount of tokens sold from the curve
     * @param reserveTotal Total amount of tokens in the curve
     * @return pairingTokenOut Amount of ETH received after fee
     */
    function calculateAmountOutForSell(
        uint256 amountIn,
        uint256 reserveSold,
        uint256 reserveTotal
    ) public view returns (uint256 pairingTokenOut) {
        // Calculate ETH output before fee
        uint256 ethBeforeFee =
            calculateAmountOutForSellNoFee(amountIn, reserveSold, reserveTotal);

        // Apply sell fee to prevent exploitation
        uint256 fee = (ethBeforeFee * SELL_FEE_BPS) / BPS_DIVISOR;
        pairingTokenOut = ethBeforeFee - fee;
    }

    /**
     * @notice Calculates ETH output for selling tokens WITHOUT fee
     * @dev Internal calculation used for testing and fee computation
     * @param amountIn Amount of tokens to sell
     * @param reserveSold Current amount of tokens sold from the curve
     * @param reserveTotal Total amount of tokens in the curve
     * @return pairingTokenOut Amount of ETH received (no fee)
     */
    function calculateAmountOutForSellNoFee(
        uint256 amountIn,
        uint256 reserveSold,
        uint256 reserveTotal
    ) public view returns (uint256 pairingTokenOut) {
        // Validate inputs
        if (amountIn == 0) revert InvalidAmount(1);
        if (amountIn > reserveSold) {
            revert InsufficientTokensSold(amountIn, reserveSold);
        }

        // Get current virtual reserves
        (uint256 virtualToken, uint256 virtualETH) =
            getVirtualReserves(reserveSold, reserveTotal);

        // After selling, virtual token reserve increases
        uint256 newVirtualToken = virtualToken + amountIn;

        // Maintain constant k by calculating new ETH reserve
        uint256 k = virtualToken * virtualETH;

        // Check for potential division by zero
        if (newVirtualToken == 0) revert DivisionByZero();

        uint256 newVirtualETH = k / newVirtualToken;

        // ETH output is the difference in reserves
        pairingTokenOut = virtualETH - newVirtualETH;
    }

    // ============ Price Query Functions ============

    /**
     * @notice Calculates the exact ETH cost to buy tokens between two points
     * @dev Useful for calculating slippage and exact costs for large purchases
     * @param fromTokens Starting point (tokens already sold)
     * @param toTokens Ending point (tokens to be sold)
     * @param totalSupply Total supply available in the curve
     * @return cost Total ETH cost to buy from fromTokens to toTokens
     *
     * @custom:example Cost to buy tokens 100-200 when totalSupply=1000
     */
    function calculateCostBetween(
        uint256 fromTokens,
        uint256 toTokens,
        uint256 totalSupply
    ) public view returns (uint256 cost) {
        // No cost if range is invalid
        if (fromTokens >= toTokens) return 0;

        // Get virtual ETH reserves at both points
        (, uint256 virtualETHStart) =
            getVirtualReserves(fromTokens, totalSupply);
        (, uint256 virtualETHEnd) = getVirtualReserves(toTokens, totalSupply);

        // Cost is the difference in virtual ETH reserves
        cost = virtualETHEnd - virtualETHStart;
    }

    /**
     * @notice Gets the current spot price per token
     * @dev Returns price with 18 decimal precision
     * @param reserveSold Current amount of tokens sold
     * @param reserveTotal Total tokens in the curve
     * @return price Current price in ETH per token (18 decimals)
     */
    function getCurrentPrice(uint256 reserveSold, uint256 reserveTotal)
        public
        view
        returns (uint256 price)
    {
        (uint256 virtualToken, uint256 virtualETH) =
            getVirtualReserves(reserveSold, reserveTotal);

        // Price = virtualETH / virtualToken (with precision)
        price = (virtualETH * PRECISION) / virtualToken;
    }

    // ============ Virtual Reserve Calculations ============

    /**
     * @notice Calculates virtual reserves at any point on the curve
     * @dev Core mathematical function that enables the price curve behavior
     *
     * Virtual reserves ensure mmooth price progression
     * via constant product formula
     *
     * @param reserveSold Amount of tokens sold from the curve
     * @param reserveTotal Total tokens available in the curve
     * @return virtualToken Current virtual token reserve
     * @return virtualETH Current virtual ETH reserve
     *
     * @custom:math Virtual buffer b = totalSupply / (√c - 1)
     * @custom:math Initial k = (totalSupply + b)²
     * @custom:math virtualToken = (totalSupply - sold) + b
     * @custom:math virtualETH = k / virtualToken
     */
    function getVirtualReserves(uint256 reserveSold, uint256 reserveTotal)
        public
        view
        virtual
        returns (uint256 virtualToken, uint256 virtualETH)
    {
        // Calculate virtual buffer using high precision integer math
        // b = reserveTotal / (√c - 1)
        // Using integer approximation: b = reserveTotal * 1000 / curveMultiplier
        uint256 curveMultiplier = getCurveMultiplier();
        uint256 virtualBuffer = (reserveTotal * 1000) / curveMultiplier;

        // Virtual token reserve = unsold tokens + buffer
        virtualToken = reserveTotal - reserveSold + virtualBuffer;

        // Calculate constant k from initial state
        // k = (totalSupply + buffer)²
        uint256 initialReserve = reserveTotal + virtualBuffer;
        uint256 k = initialReserve * initialReserve;

        // Maintain constant k: virtualETH = k / virtualToken
        virtualETH = k / virtualToken;
    }

    // ============ View Functions for Analysis ============

    /**
     * @notice Calculates the price multiplier at current state
     * @dev Useful for monitoring curve progression
     * @param reserveSold Current tokens sold
     * @param reserveTotal Total tokens in curve
     * @return multiplier Current price relative to starting price (18 decimals)
     */
    function getCurrentMultiplier(uint256 reserveSold, uint256 reserveTotal)
        public
        view
        returns (uint256 multiplier)
    {
        uint256 currentPrice = getCurrentPrice(reserveSold, reserveTotal);
        uint256 startPrice = getCurrentPrice(0, reserveTotal);

        if (startPrice == 0) revert DivisionByZero();

        multiplier = (currentPrice * PRECISION) / startPrice;
    }

    /**
     * @notice Calculates percentage of curve completed
     * @param reserveSold Current tokens sold
     * @param reserveTotal Total tokens in curve
     * @return percentage Completion percentage (0-100 with 2 decimals)
     */
    function getCurveProgress(uint256 reserveSold, uint256 reserveTotal)
        public
        pure
        returns (uint256 percentage)
    {
        if (reserveTotal == 0) revert DivisionByZero();

        percentage = (reserveSold * 10000) / reserveTotal;
    }
}
