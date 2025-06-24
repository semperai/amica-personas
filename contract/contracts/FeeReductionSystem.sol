// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PersonaTokenFactory} from "./PersonaTokenFactory.sol";

contract UniswapFeeReductionSystem is Ownable {
    /**
     * @notice Fee reduction based on AMICA holdings
     * @param minAmicaForReduction Minimum AMICA to qualify for reduction
     * @param maxAmicaForReduction AMICA amount for maximum reduction
     * @param minReductionMultiplier Fee multiplier at minimum threshold
     * @param maxReductionMultiplier Fee multiplier at maximum threshold
     */
    struct FeeReductionConfig {
        uint256 minAmicaForReduction;
        uint256 maxAmicaForReduction;
        uint256 minReductionMultiplier;
        uint256 maxReductionMultiplier;
    }

    /**
     * @notice User's AMICA balance snapshot for fee reduction
     * @param currentBalance Active snapshot balance
     * @param currentBlock Block number of active snapshot
     * @param pendingBalance Pending snapshot balance
     * @param pendingBlock Block number of pending snapshot
     */
    struct UserSnapshot {
        uint256 currentBalance;
        uint256 currentBlock;
        uint256 pendingBalance;
        uint256 pendingBlock;
    }

    /// @notice Custom errors for the contract
    error NotAllowed(uint256 code);
    error Invalid(uint256 code);

    /// @notice Number of blocks to wait before snapshot becomes active
    uint256 public constant SNAPSHOT_DELAY = 100;

    /// @notice Trading fee percentage for uniswap pools
    uint256 public constant TRADING_FEE_PERCENTAGE = 100; 

    /// @notice Basis points constant for percentage calculations
    uint256 private constant BASIS_POINTS = 10000;

    /// @notice Amica token for fee reduction
    IERC20 public amicaToken;

    /// @notice Reference to the main factory contract
    PersonaTokenFactory public factory;

    /// @notice User snapshots for fee reduction
    mapping(address => UserSnapshot) public userSnapshots;

    /// @notice Global fee reduction configuration
    FeeReductionConfig public feeReductionConfig;

    /// @dev Storage gap for upgradeable contracts
    uint256[50] private __gap; // Reserved for future upgrades


    /**
     * @notice Emitted when user's AMICA snapshot is updated
     * @param user User address
     * @param snapshotBalance Balance being snapshotted
     * @param blockNumber Block number of snapshot
     */
    event SnapshotUpdated(address indexed user, uint256 snapshotBalance, uint256 blockNumber);

    /**
     * @notice Emitted when fee reduction configuration is updated
     */
    event FeeReductionConfigUpdated(
        uint256 minAmicaForReduction,
        uint256 maxAmicaForReduction,
        uint256 minReductionMultiplier,
        uint256 maxReductionMultiplier
    );

    constructor(IERC20 _amicaToken, PersonaTokenFactory _factory) Ownable(msg.sender) {
        amicaToken = _amicaToken;
        factory = _factory;

        feeReductionConfig = FeeReductionConfig({
            minAmicaForReduction: 1000 ether,
            maxAmicaForReduction: 1_000_000 ether,
            minReductionMultiplier: 9000,
            maxReductionMultiplier: 0
        });
    }

    /**
     * @notice Calculates effective fee percentage for a user
     * @param user Address to check
     * @return Effective fee percentage in basis points
     */
    function getEffectiveFeePercentage(address user) public view returns (uint256) {
        UserSnapshot memory snapshot = userSnapshots[user];

        uint256 activeBalance;
        uint256 activeBlock;

        if (snapshot.pendingBlock > 0 && block.number >= snapshot.pendingBlock + SNAPSHOT_DELAY) {
            activeBalance = snapshot.pendingBalance;
            activeBlock = snapshot.pendingBlock;
        } else if (snapshot.currentBlock > 0 && block.number >= snapshot.currentBlock + SNAPSHOT_DELAY) {
            activeBalance = snapshot.currentBalance;
            activeBlock = snapshot.currentBlock;
        } else {
            return 0;
        }

        uint256 realBalance = amicaToken.balanceOf(user);
        uint256 effectiveBalance = realBalance < activeBalance ? realBalance : activeBalance;

        if (effectiveBalance < feeReductionConfig.minAmicaForReduction) {
            return TRADING_FEE_PERCENTAGE;
        }

        if (effectiveBalance >= feeReductionConfig.maxAmicaForReduction) {
            return (TRADING_FEE_PERCENTAGE * feeReductionConfig.maxReductionMultiplier) / BASIS_POINTS;
        }

        uint256 range = feeReductionConfig.maxAmicaForReduction - feeReductionConfig.minAmicaForReduction;
        uint256 userPosition = effectiveBalance - feeReductionConfig.minAmicaForReduction;
        uint256 progress = (userPosition * 1e18) / range;
        uint256 exponentialProgress = (progress * progress) / 1e18;
        uint256 multiplierRange = feeReductionConfig.minReductionMultiplier - feeReductionConfig.maxReductionMultiplier;
        uint256 reduction = (multiplierRange * exponentialProgress) / 1e18;
        uint256 effectiveMultiplier = feeReductionConfig.minReductionMultiplier - reduction;

        return (TRADING_FEE_PERCENTAGE * effectiveMultiplier) / BASIS_POINTS;
    }

    /**
     * @notice Updates user's AMICA balance snapshot for fee reduction
     * @dev Should be called periodically by user to update their snapshot
     * @dev Snapshot becomes active after SNAPSHOT_DELAY blocks
     */
    function updateAmicaSnapshot() external {
        uint256 currentBalance = amicaToken.balanceOf(msg.sender);
        if (currentBalance < feeReductionConfig.minAmicaForReduction) {
            // If below minimum, reset snapshot
            userSnapshots[msg.sender] = UserSnapshot({
                currentBalance: 0,
                currentBlock: block.number,
                pendingBalance: 0,
                pendingBlock: 0
            });
            return;
        }

        UserSnapshot storage snapshot = userSnapshots[msg.sender];

        if (snapshot.pendingBlock > 0 && block.number >= snapshot.pendingBlock + SNAPSHOT_DELAY) {
            snapshot.currentBalance = snapshot.pendingBalance;
            snapshot.currentBlock = snapshot.pendingBlock;
            snapshot.pendingBalance = 0;
            snapshot.pendingBlock = 0;
        }

        snapshot.pendingBalance = currentBalance;
        snapshot.pendingBlock = block.number;

        emit SnapshotUpdated(msg.sender, currentBalance, block.number);
    }

    /**
     * @notice Configures fee reduction based on AMICA holdings
     * @param minAmicaForReduction Minimum AMICA for fee reduction
     * @param maxAmicaForReduction AMICA for maximum fee reduction
     * @param minReductionMultiplier Fee multiplier at minimum (in basis points)
     * @param maxReductionMultiplier Fee multiplier at maximum (in basis points)
     * @dev Only callable by owner
     */
    function configureFeeReduction(
        uint256 minAmicaForReduction,
        uint256 maxAmicaForReduction,
        uint256 minReductionMultiplier,
        uint256 maxReductionMultiplier
    ) external onlyOwner {
        if (minAmicaForReduction >= maxAmicaForReduction) revert NotAllowed(10);
        if (minReductionMultiplier > BASIS_POINTS) revert Invalid(9);
        if (maxReductionMultiplier > minReductionMultiplier) revert Invalid(9);

        feeReductionConfig = FeeReductionConfig({
            minAmicaForReduction: minAmicaForReduction,
            maxAmicaForReduction: maxAmicaForReduction,
            minReductionMultiplier: minReductionMultiplier,
            maxReductionMultiplier: maxReductionMultiplier
        });

        emit FeeReductionConfigUpdated(
            minAmicaForReduction,
            maxAmicaForReduction,
            minReductionMultiplier,
            maxReductionMultiplier
        );
    }

}
