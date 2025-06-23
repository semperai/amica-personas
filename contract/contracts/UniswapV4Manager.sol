// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IAmicaFeeReductionHook {
    function registerPool(PoolId poolId, uint256 nftTokenId) external;
}

/**
 * @title UniswapV4Helper
 * @notice Helper contract for Uniswap V4 pool initialization
 * @dev Stateless contract that only handles pool setup
 */
contract UniswapV4Manager is Ownable {
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;

    // Constants
    int24 public constant TICK_SPACING = 60;
    uint160 public constant SQRT_RATIO_1_1 = 79228162514264337593543950336;

    // Immutable addresses
    IPoolManager public immutable poolManager;
    address public immutable feeReductionHook;
    
    // Authorized factory
    address public factory;

    // Errors
    error Unauthorized();
    error InvalidAddress();

    modifier onlyFactory() {
        if (msg.sender != factory) revert Unauthorized();
        _;
    }

    constructor(address _poolManager, address _feeReductionHook) Ownable(msg.sender) {
        if (_poolManager == address(0) || _feeReductionHook == address(0)) {
            revert InvalidAddress();
        }
        poolManager = IPoolManager(_poolManager);
        feeReductionHook = _feeReductionHook;
    }

    /**
     * @notice Sets the authorized factory address
     * @param _factory Address of the PersonaTokenFactory
     */
    function setFactory(address _factory) external onlyOwner {
        if (_factory == address(0)) revert InvalidAddress();
        factory = _factory;
    }

    /**
     * @notice Initializes a pool and returns the pool key for liquidity operations
     * @param token0 First token address
     * @param token1 Second token address
     * @param fee Fee tier
     * @param initialPrice Initial sqrt price (use SQRT_RATIO_1_1 for 1:1)
     * @param nftTokenId NFT token ID for hook registration
     * @return poolId The pool ID
     * @return poolKey The pool key needed for liquidity operations
     */
    function initializePool(
        address token0,
        address token1,
        uint24 fee,
        uint160 initialPrice,
        uint256 nftTokenId
    ) external onlyFactory returns (PoolId poolId, PoolKey memory poolKey) {
        // Sort tokens
        Currency currency0;
        Currency currency1;

        if (uint160(token0) < uint160(token1)) {
            currency0 = Currency.wrap(token0);
            currency1 = Currency.wrap(token1);
        } else {
            currency0 = Currency.wrap(token1);
            currency1 = Currency.wrap(token0);
        }

        // Create pool key
        poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: fee,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(feeReductionHook)
        });

        // Initialize pool
        poolManager.initialize(poolKey, initialPrice);
        
        // Get pool ID and register with hook
        poolId = poolKey.toId();
        IAmicaFeeReductionHook(feeReductionHook).registerPool(poolId, nftTokenId);

        return (poolId, poolKey);
    }

    /**
     * @notice Calculates tick range for single-sided liquidity
     * @param sqrtPriceX96 Current pool price
     * @param personaIsToken0 Whether persona token is token0
     * @return tickLower Lower tick
     * @return tickUpper Upper tick
     */
    function getTickRangeForSingleSided(
        uint160 sqrtPriceX96,
        bool personaIsToken0
    ) external pure returns (int24 tickLower, int24 tickUpper) {
        int24 currentTick = TickMath.getTickAtSqrtPrice(sqrtPriceX96);

        if (personaIsToken0) {
            tickLower = -887200;
            tickUpper = currentTick - TICK_SPACING;
        } else {
            tickLower = currentTick + TICK_SPACING;
            tickUpper = 887200;
        }

        // Round to tick spacing
        tickLower = (tickLower / TICK_SPACING) * TICK_SPACING;
        tickUpper = (tickUpper / TICK_SPACING) * TICK_SPACING;

        return (tickLower, tickUpper);
    }

    /**
     * @notice Gets the initial sqrt price for agent pools (1:4 ratio)
     * @param personaIsToken0 Whether persona token is token0
     * @return sqrtPriceX96 The sqrt price
     */
    function getAgentPoolInitialPrice(bool personaIsToken0) external pure returns (uint160) {
        if (personaIsToken0) {
            return uint160(2 << 96); // 1 agent = 4 persona
        } else {
            return uint160(1 << 95); // 4 agent = 1 persona
        }
    }
}
