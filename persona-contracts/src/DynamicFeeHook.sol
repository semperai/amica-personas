// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {
    BeforeSwapDelta,
    BeforeSwapDeltaLibrary
} from "v4-core/src/types/BeforeSwapDelta.sol";
import {BalanceDelta} from "v4-core/src/types/BalanceDelta.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IFeeReductionSystem
 * @notice Interface to get dynamic fee for users
 */
interface IFeeReductionSystem {
    function getFee(address user) external view returns (uint24);
}

/**
 * @title DynamicFeeHook
 * @author Amica Protocol
 * @notice Uniswap V4 hook that provides fee reduction based on AMICA token holdings
 * @dev Uses FeeReductionSystem for fee calculations
 */
contract DynamicFeeHook is BaseHook, Ownable {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using BeforeSwapDeltaLibrary for BeforeSwapDelta;

    error InvalidFeeReductionSystem();
    error InvalidPoolManager();

    /// @notice FeeReductionSystem contract
    IFeeReductionSystem public feeReductionSystem;

    /// @notice Event emitted when the FeeReductionSystem is updated
    /// @param newFeeReductionSystem The new FeeReductionSystem address
    event FeeReductionSystemUpdated(address newFeeReductionSystem);

    constructor(IPoolManager _poolManager)
        BaseHook(_poolManager)
        Ownable(msg.sender)
    {
        if (address(_poolManager) == address(0)) revert InvalidPoolManager();
    }

    /// @notice Sets the FeeReductionSystem address
    /// @param _feeReductionSystem The new FeeReductionSystem address
    /// @dev Can only be called by the contract owner
    /// @dev Reverts if the address is zero
    function setFeeReductionSystem(address _feeReductionSystem)
        external
        onlyOwner
    {
        if (address(_feeReductionSystem) == address(0)) {
            revert InvalidFeeReductionSystem();
        }
        feeReductionSystem = IFeeReductionSystem(_feeReductionSystem);
        emit FeeReductionSystemUpdated(_feeReductionSystem);
    }

    /// @notice Gets the hook permissions for this contract
    /// @return The permissions for this hook
    function getHookPermissions()
        public
        pure
        override
        returns (Hooks.Permissions memory)
    {
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
    ) internal view override returns (bytes4, BeforeSwapDelta, uint24) {
        uint24 dynamicFee =
            feeReductionSystem.getFee(sender) | LPFeeLibrary.OVERRIDE_FEE_FLAG;

        return (
            BaseHook.beforeSwap.selector,
            BeforeSwapDeltaLibrary.ZERO_DELTA,
            dynamicFee
        );
    }
}
