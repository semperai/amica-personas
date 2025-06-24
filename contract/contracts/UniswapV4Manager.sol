// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PersonaTokenFactory} from "./PersonaTokenFactory.sol";

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
    IPositionManager public immutable positionManager;
    address public immutable feeReductionHook;
    
    // Authorized factory
    PersonaTokenFactory public factory;

    // Errors
    error Unauthorized();
    error InvalidAddress();

    modifier onlyFactory() {
        if (msg.sender != address(factory)) revert Unauthorized();
        _;
    }

    event FeesCollected(
        uint256 indexed nftTokenId,
        PoolId poolId,
        uint256 amount0,
        uint256 amount1
    );

    constructor(
        address _poolManager,
        address _positionManager,
        address _feeReductionHook
    ) Ownable(msg.sender) {
        if (
            _poolManager == address(0) ||
            _positionManager == address(0) ||
            _feeReductionHook == address(0)
        ) revert InvalidAddress();

        poolManager = IPoolManager(_poolManager);
        positionManager = IPositionManager(_positionManager);
        feeReductionHook = _feeReductionHook;
    }

    /**
     * @notice Sets the authorized factory address
     * @param _factory Address of the PersonaTokenFactory
     */
    function setFactory(address _factory) external onlyOwner {
        if (_factory == address(0)) revert InvalidAddress();
        factory = PersonaTokenFactory(_factory);
    }

    /**
     * @notice Initializes a pool and returns the pool key for liquidity operations
     * @param token0 First token address
     * @param token1 Second token address
     * @param initialPrice Initial sqrt price (use SQRT_RATIO_1_1 for 1:1)
     * @param nftTokenId NFT token ID for hook registration
     * @return poolId The pool ID
     * @return poolKey The pool key needed for liquidity operations
     */
    function initializePool(
        address token0,
        address token1,
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
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(feeReductionHook)
        });

        // Initialize pool
        poolManager.initialize(poolKey, initialPrice);
        
        // Get pool ID and register with hook
        poolId = poolKey.toId();

        return (poolId, poolKey);
    }

    function collectFees(uint256 nftTokenId, address to) external returns (uint256 collectedFees) {
        if (factory.ownerOf(nftTokenId) != msg.sender) revert Unauthorized();
        (, , , , , , , , , PoolId poolId, PoolId agentPoolId) = factory.personas(nftTokenId);
        // if (poolId == PoolId.wrap(0)) revert Unauthorized();
        // if (to == address(0)) revert InvalidAddress();

        /*
        uint256 balance0before = IERC20(poolKey.currency0).balanceOf(to);
        uint256 balance1before = IERC20(poolKey.currency1).balanceOf(to);
        
        bytes memory actions = abi.encodePacked(
            uint8(Actions.DECREASE_LIQUIDITY),
            uint8(Actions.TAKE_PAIR)
        );
        bytes memory hookData = abi.encode();

        bytes[] memory params = new bytes[](2);

        // DECREASE_LIQUIDITY action
        // poolId, liquidity, amount0min, amount1min, hookData
        // to take only fees we set liquidity to 0
        // there is no risk of front running so safe for minimums=0
        params[0] = abi.encode(poolId, 0, 0, 0, hookData);


        // TAKE_PAIR action
        // currency0, currency1, recipient
        params[1] = abi.encode(
            poolKey.currency0,
            poolKey.currency1,
            to
        );

        uint256 deadline = block.timestamp + 60; // 1 minute deadline
        uint256 valueToPass = currency0.isAddressZero() ? amount0Max : 0;

        positionManager.modifyLiquidities{value: valueToPass}(
            abi.encode(actions, params),
            deadline
        );

        uint256 balance0after = IERC20(poolKey.currency0).balanceOf(to);
        uint256 balance1after = IERC20(poolKey.currency1).balanceOf(to);

        emit FeesCollected(
            nftTokenId,
            poolId,
            balance0after - balance0before,
            balance1after - balance1before
        );
        */
    }
}
