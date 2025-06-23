// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

/**
 * @title IPersonaTokenFactory
 * @notice Interface for PersonaTokenFactory to get effective fee percentage
 */
interface IPersonaTokenFactory {
    function getEffectiveFeePercentage(address user) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
}

/**
 * @title AmicaFeeReductionHook
 * @author Amica Protocol
 * @notice Uniswap V4 hook that provides fee reduction based on AMICA token holdings
 * @dev Uses PersonaTokenFactory for fee calculations - automatically sends fees to NFT holder on each swap
 */
contract AmicaFeeReductionHook is BaseHook, Ownable {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using BeforeSwapDeltaLibrary for BeforeSwapDelta;

    // ============================================================================
    // ERRORS
    // ============================================================================
    
    error InvalidFactory();
    error InvalidPoolManager();
    error UnauthorizedPool();
    error InvalidFeeRecipient();
    error TransferFailed();

    // ============================================================================
    // STRUCTS
    // ============================================================================

    /**
     * @notice Pool registration information
     * @param nftTokenId Associated NFT token ID
     * @param isPersonaPool Whether this is a persona pool
     */
    struct PoolInfo {
        uint256 nftTokenId;
        bool isPersonaPool;
    }

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice PersonaTokenFactory contract
    IPersonaTokenFactory public personaFactory;

    /// @notice Mapping from pool ID to pool information
    mapping(PoolId => PoolInfo) public poolInfo;

    /// @notice Mapping from NFT token ID to pool ID
    mapping(uint256 => PoolId) public nftToPoolId;

    /// @notice Fee divisor for Uniswap V4 (1,000,000 = 100%)
    uint256 private constant FEE_DIVISOR = 1_000_000;

    /// @notice Basis points to fee divisor conversion
    uint256 private constant BASIS_TO_FEE_DIVISOR = 100;

    // ============================================================================
    // EVENTS
    // ============================================================================

    event PoolRegistered(PoolId indexed poolId, uint256 indexed nftTokenId);
    
    event FeesDistributed(
        PoolId indexed poolId, 
        address indexed nftHolder,
        Currency indexed currency,
        uint256 amount
    );

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) Ownable(msg.sender) {
        console.log("AmicaFeeReductionHook deployed with PoolManager:", address(_poolManager));
        if (address(_poolManager) == address(0)) revert InvalidPoolManager();
    }

    /// @notice Sets the PersonaTokenFactory address
    /// @param _personaFactory The new PersonaTokenFactory address
    /// @dev Can only be called by the contract owner
    /// @dev Reverts if the address is zero
    function setPersonaFactory(IPersonaTokenFactory _personaFactory) external onlyOwner {
        if (address(_personaFactory) == address(0)) revert InvalidFactory();
        personaFactory = _personaFactory;
    }

    // ============================================================================
    // HOOK PERMISSIONS
    // ============================================================================

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: true,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: true,
            afterSwapReturnDelta: true,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ============================================================================
    // ADMIN FUNCTIONS
    // ============================================================================

    /**
     * @notice Registers a pool with its associated NFT
     * @dev Must be called by PersonaFactory after pool creation
     * @param poolId The pool ID to register
     * @param nftTokenId The NFT token ID associated with the pool
     */
    function registerPool(PoolId poolId, uint256 nftTokenId) external {
        if (msg.sender != address(personaFactory)) revert UnauthorizedPool();
        
        poolInfo[poolId] = PoolInfo({
            nftTokenId: nftTokenId,
            isPersonaPool: true
        });
        
        nftToPoolId[nftTokenId] = poolId;
        
        emit PoolRegistered(poolId, nftTokenId);
    }

    // ============================================================================
    // HOOK CALLBACKS
    // ============================================================================

    /**
     * @notice Called before a swap to calculate dynamic fees
     * @dev Gets fee from PersonaTokenFactory based on user's AMICA holdings
     */
    function _beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata /*params*/,
        bytes calldata
    ) internal override returns (bytes4, BeforeSwapDelta, uint24) {
        PoolId poolId = key.toId();
        PoolInfo storage info = poolInfo[poolId];
        
        // Only apply dynamic fees to registered persona pools
        if (!info.isPersonaPool) {
            return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
        }
        
        // Get effective fee from PersonaTokenFactory (in basis points)
        uint256 feeInBasisPoints = personaFactory.getEffectiveFeePercentage(sender);
        
        // Convert basis points to V4 fee format (per million)
        uint24 dynamicFee = uint24(feeInBasisPoints * BASIS_TO_FEE_DIVISOR);
        
        // Return the selector, no delta, and the dynamic fee
        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, dynamicFee);
    }

    /**
     * @notice Called after a swap to collect and distribute fees
     * @dev Collects fees and immediately sends them to the NFT holder
     */
    function _afterSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta,
        bytes calldata
    ) internal override returns (bytes4, int128) {
        PoolId poolId = key.toId();
        PoolInfo storage info = poolInfo[poolId];
        
        if (info.isPersonaPool) {
            // Get the fee percentage that was applied
            uint256 feeInBasisPoints = personaFactory.getEffectiveFeePercentage(tx.origin);
            uint24 swapFee = uint24(feeInBasisPoints * BASIS_TO_FEE_DIVISOR);
            
            // Calculate fee amount based on swap direction
            uint256 feeAmount;
            Currency feeCurrency;
            
            if (params.zeroForOne) {
                // Fee is taken from the input token (token0)
                uint256 amountIn = params.amountSpecified > 0 
                    ? uint256(params.amountSpecified) 
                    : uint256(-params.amountSpecified);
                feeAmount = (amountIn * swapFee) / FEE_DIVISOR;
                feeCurrency = key.currency0;
            } else {
                // Fee is taken from the input token (token1)
                uint256 amountIn = params.amountSpecified > 0 
                    ? uint256(params.amountSpecified) 
                    : uint256(-params.amountSpecified);
                feeAmount = (amountIn * swapFee) / FEE_DIVISOR;
                feeCurrency = key.currency1;
            }
            
            if (feeAmount > 0) {
                // Get NFT holder address
                address nftHolder = _getNFTHolder(info.nftTokenId);
                
                if (nftHolder != address(0)) {
                    // Transfer fees directly to NFT holder
                    feeCurrency.transfer(nftHolder, feeAmount);
                    
                    emit FeesDistributed(poolId, nftHolder, feeCurrency, feeAmount);
                }
                
                // Return positive delta to collect fees from the pool
                return (BaseHook.afterSwap.selector, int128(uint128(feeAmount)));
            }
        }
        
        return (BaseHook.afterSwap.selector, 0);
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    /**
     * @notice Checks if a pool is a persona pool
     * @param poolId The pool ID
     * @return Whether it's a persona pool
     */
    function isPersonaPool(PoolId poolId) external view returns (bool) {
        return poolInfo[poolId].isPersonaPool;
    }

    /**
     * @notice Gets the NFT token ID associated with a pool
     * @param poolId The pool ID
     * @return The NFT token ID (0 if not a persona pool)
     */
    function getPoolNFT(PoolId poolId) external view returns (uint256) {
        return poolInfo[poolId].nftTokenId;
    }

    /**
     * @notice Gets the pool ID for an NFT token
     * @param nftTokenId The NFT token ID
     * @return The associated pool ID
     */
    function getPoolForNFT(uint256 nftTokenId) external view returns (PoolId) {
        return nftToPoolId[nftTokenId];
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    /**
     * @notice Gets NFT holder address from factory
     * @param nftTokenId The NFT token ID
     * @return holder address
     */
    function _getNFTHolder(uint256 nftTokenId) internal view returns (address) {
        try personaFactory.ownerOf(nftTokenId) returns (address owner) {
            return owner;
        } catch {
            return address(0);
        }
    }

    /**
     * @notice Required for receiving native currency
     */
    receive() external payable {}
    
    /**
     * @notice Fallback function to receive tokens
     */
    fallback() external payable {}
}
