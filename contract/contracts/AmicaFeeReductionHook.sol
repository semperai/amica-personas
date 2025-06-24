// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import "hardhat/console.sol";

/**
 * @title IFeeReductionSystem
 * @notice Interface to get dynamic fee for users
 */
interface IFeeReductionSystem {
    function getFee(address user) external view returns (uint24);
}

/**
 * @title AmicaFeeReductionHook
 * @author Amica Protocol
 * @notice Uniswap V4 hook that provides fee reduction based on AMICA token holdings
 * @dev Uses FeeReductionSystem for fee calculations
 */
contract AmicaFeeReductionHook is BaseHook, Ownable {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using BeforeSwapDeltaLibrary for BeforeSwapDelta;

    error InvalidFeeReductionSystem();
    error InvalidPoolManager();

    /// @notice FeeReductionSystem contract
    IFeeReductionSystem public feeReductionSystem;

    /// @notice Event emitted when the FeeReductionSystem is updated
    /// @param newFeeReductionSystem The new FeeReductionSystem address
    event FeeReductionSystemUpdated(IFeeReductionSystem newFeeReductionSystem);

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) Ownable(msg.sender) {
        console.log("AmicaFeeReductionHook deployed with PoolManager:", address(_poolManager));
        if (address(_poolManager) == address(0)) revert InvalidPoolManager();
    }

    /// @notice Sets the FeeReductionSystem address
    /// @param _feeReductionSystem The new FeeReductionSystem address
    /// @dev Can only be called by the contract owner
    /// @dev Reverts if the address is zero
    function setFeeReductionSystem(IFeeReductionSystem _feeReductionSystem) external onlyOwner {
        if (address(_feeReductionSystem) == address(0)) revert InvalidFeeReductionSystem();
        feeReductionSystem = _feeReductionSystem;
        emit FeeReductionSystemUpdated(_feeReductionSystem);
    }

    /// @notice Gets the hook permissions for this contract
    /// @return The permissions for this hook
    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /// @notice Called before a swap to calculate dynamic fees
    /// @param sender The address initiating the swap
    /// @dev Gets fee from FeeReductionSystem based on user's AMICA holdings
    function _beforeSwap(
        address sender,
        PoolKey calldata,
        SwapParams calldata,
        bytes calldata
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        uint24 dynamicFee = feeReductionSystem.getFee(sender)
            | LPFeeLibrary.OVERRIDE_FEE_FLAG;

        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, dynamicFee);
    }
}
