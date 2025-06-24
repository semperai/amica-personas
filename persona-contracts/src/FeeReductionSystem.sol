// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PersonaTokenFactory} from "./PersonaTokenFactory.sol";

/**
 * @title FeeReductionSystem
 * @notice Manages fee reduction for Uniswap V4 pools based on AMICA token holdings
 * @dev Uses Uniswap V4's fee units (per million) throughout
 */
contract FeeReductionSystem is Ownable {
    /**
     * @notice Fee reduction based on AMICA holdings
     * @param minAmicaForReduction Minimum AMICA to qualify for reduction
     * @param maxAmicaForReduction AMICA amount for maximum reduction
     * @param baseFee Base fee without any reduction (per million)
     * @param maxDiscountedFee Fee at maximum reduction (per million)
     */
    struct FeeReductionConfig {
        uint256 minAmicaForReduction;
        uint256 maxAmicaForReduction;
        uint24 baseFee;
        uint24 maxDiscountedFee;
    }

    /**
     * @notice User's AMICA balance snapshot for fee reduction
     * @param activeBalance Currently active balance for fee calculation
     * @param activeBlock Block when active balance was set
     * @param pendingBalance Balance waiting to become active
     * @param pendingBlock Block when pending balance was set
     */
    struct UserSnapshot {
        uint256 activeBalance;
        uint256 activeBlock;
        uint256 pendingBalance;
        uint256 pendingBlock;
    }

    /// @notice Custom errors
    error InvalidConfiguration();
    error SnapshotTooEarly();
    error BelowMinimumThreshold();

    /// @notice Number of blocks to wait before snapshot becomes active
    uint256 public constant SNAPSHOT_DELAY = 100;

    /// @notice Maximum fee value in Uniswap V4 (100%)
    uint256 private constant MAX_FEE = 1_000_000;

    /// @notice Precision for calculations
    uint256 private constant PRECISION = 1e18;

    /// @notice Amica token for fee reduction
    IERC20 public immutable amicaToken;

    /// @notice Reference to the main factory contract
    PersonaTokenFactory public immutable factory;

    /// @notice User snapshots for fee reduction
    mapping(address => UserSnapshot) public userSnapshots;

    /// @notice Global fee reduction configuration
    FeeReductionConfig public feeReductionConfig;

    /// @dev Storage gap for upgradeable contracts
    uint256[50] private __gap;

    /**
     * @notice Emitted when user's AMICA snapshot is updated
     * @param user User address
     * @param balance Balance being snapshotted
     * @param blockNumber Block number of snapshot
     */
    event SnapshotUpdated(address indexed user, uint256 balance, uint256 blockNumber);

    /**
     * @notice Emitted when fee reduction configuration is updated
     */
    event FeeReductionConfigUpdated(
        uint256 minAmicaForReduction,
        uint256 maxAmicaForReduction,
        uint24 baseFee,
        uint24 maxDiscountedFee
    );

    constructor(
        IERC20 _amicaToken,
        PersonaTokenFactory _factory
    ) Ownable(msg.sender) {
        amicaToken = _amicaToken;
        factory = _factory;

        feeReductionConfig = FeeReductionConfig({
            minAmicaForReduction: 1000 ether,
            maxAmicaForReduction: 1_000_000 ether,
            baseFee: 10000, // 1%
            maxDiscountedFee: 0 // 0%
        });
    }

    /**
     * @notice Gets the dynamic fee for a user based on their AMICA holdings
     * @param user Address to check
     * @return fee The fee in Uniswap V4 format (per million)
     */
    function getFee(address user) external view returns (uint24) {
        uint256 effectiveBalance = _getEffectiveBalance(user);
        
        // If below minimum threshold, return base fee
        if (effectiveBalance < feeReductionConfig.minAmicaForReduction) {
            return feeReductionConfig.baseFee;
        }

        // If at or above maximum threshold, return max discounted fee
        if (effectiveBalance >= feeReductionConfig.maxAmicaForReduction) {
            return feeReductionConfig.maxDiscountedFee;
        }

        // Calculate fee reduction using quadratic curve
        uint256 range = feeReductionConfig.maxAmicaForReduction - feeReductionConfig.minAmicaForReduction;
        uint256 userPosition = effectiveBalance - feeReductionConfig.minAmicaForReduction;
        
        // Calculate progress (0 to 1e18)
        uint256 progress = (userPosition * PRECISION) / range;
        
        // Apply quadratic curve for smoother reduction
        uint256 quadraticProgress = (progress * progress) / PRECISION;
        
        // Calculate fee interpolation
        uint256 feeRange = uint256(feeReductionConfig.baseFee) - uint256(feeReductionConfig.maxDiscountedFee);
        uint256 feeReduction = (feeRange * quadraticProgress) / PRECISION;
        
        return uint24(uint256(feeReductionConfig.baseFee) - feeReduction);
    }

    /**
     * @notice Updates user's AMICA balance snapshot for fee reduction
     * @dev Snapshot becomes active after SNAPSHOT_DELAY blocks
     */
    function updateSnapshot() external {
        uint256 currentBalance = amicaToken.balanceOf(msg.sender);
        
        // Clear snapshot if below minimum
        if (currentBalance < feeReductionConfig.minAmicaForReduction) {
            delete userSnapshots[msg.sender];
            emit SnapshotUpdated(msg.sender, 0, block.number);
            return;
        }

        UserSnapshot storage snapshot = userSnapshots[msg.sender];

        // Promote pending to active if delay has passed
        if (snapshot.pendingBlock > 0 && block.number >= snapshot.pendingBlock + SNAPSHOT_DELAY) {
            snapshot.activeBalance = snapshot.pendingBalance;
            snapshot.activeBlock = snapshot.pendingBlock;
            snapshot.pendingBalance = 0;
            snapshot.pendingBlock = 0;
        }

        // Set new pending snapshot
        snapshot.pendingBalance = currentBalance;
        snapshot.pendingBlock = block.number;

        emit SnapshotUpdated(msg.sender, currentBalance, block.number);
    }

    /**
     * @notice Configures fee reduction parameters
     * @param minAmicaForReduction Minimum AMICA for fee reduction
     * @param maxAmicaForReduction AMICA for maximum fee reduction
     * @param baseFee Fee without reduction (per million)
     * @param maxDiscountedFee Fee at maximum reduction (per million)
     * @dev Only callable by owner
     */
    function configureFeeReduction(
        uint256 minAmicaForReduction,
        uint256 maxAmicaForReduction,
        uint24 baseFee,
        uint24 maxDiscountedFee
    ) external onlyOwner {
        if (minAmicaForReduction >= maxAmicaForReduction) revert InvalidConfiguration();
        if (baseFee > MAX_FEE) revert InvalidConfiguration();
        if (maxDiscountedFee > baseFee) revert InvalidConfiguration();

        feeReductionConfig = FeeReductionConfig({
            minAmicaForReduction: minAmicaForReduction,
            maxAmicaForReduction: maxAmicaForReduction,
            baseFee: baseFee,
            maxDiscountedFee: maxDiscountedFee
        });

        emit FeeReductionConfigUpdated(
            minAmicaForReduction,
            maxAmicaForReduction,
            baseFee,
            maxDiscountedFee
        );
    }

    /**
     * @notice Gets the effective balance for fee calculation
     * @param user Address to check
     * @return effectiveBalance The balance used for fee calculation
     */
    function _getEffectiveBalance(address user) private view returns (uint256) {
        UserSnapshot memory snapshot = userSnapshots[user];
        
        // Determine which balance is active
        uint256 snapshotBalance;
        if (snapshot.pendingBlock > 0 && block.number >= snapshot.pendingBlock + SNAPSHOT_DELAY) {
            snapshotBalance = snapshot.pendingBalance;
        } else if (snapshot.activeBlock > 0 && block.number >= snapshot.activeBlock + SNAPSHOT_DELAY) {
            snapshotBalance = snapshot.activeBalance;
        } else {
            return 0; // No active snapshot
        }

        // Use minimum of snapshot and current balance (prevents gaming)
        uint256 currentBalance = amicaToken.balanceOf(user);
        return currentBalance < snapshotBalance ? currentBalance : snapshotBalance;
    }

    /**
     * @notice View function to check when a user's snapshot will become active
     * @param user Address to check
     * @return blocksRemaining Blocks until snapshot is active (0 if already active)
     */
    function getBlocksUntilActive(address user) external view returns (uint256) {
        UserSnapshot memory snapshot = userSnapshots[user];
        
        if (snapshot.pendingBlock > 0) {
            uint256 activationBlock = snapshot.pendingBlock + SNAPSHOT_DELAY;
            if (block.number < activationBlock) {
                return activationBlock - block.number;
            }
        }
        
        return 0;
    }

    /**
     * @notice View function to get user's current effective balance
     * @param user Address to check
     * @return balance The effective balance for fee calculation
     */
    function getEffectiveBalance(address user) external view returns (uint256) {
        return _getEffectiveBalance(user);
    }
}
