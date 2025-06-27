// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20Upgradeable} from
    "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    IBurnAndClaim,
    InvalidBurnAmount,
    NoTokensSelected,
    TokensMustBeSortedAndUnique,
    NoSupply,
    InvalidTokenAddress,
    NoTokensToClaim,
    TransferFailed
} from "./interfaces/IBurnAndClaim.sol";

/**
 * @title BurnAndClaimBase
 * @author Kasumi
 * @notice Abstract base contract implementing burn-and-claim functionality
 * @dev This contract provides the core burn-and-claim mechanism that can be inherited
 * by different token implementations. It handles the proportional distribution of tokens
 * held by the contract to users who burn their tokens.
 *
 * The mechanism works by:
 * 1. User burns X tokens (reducing total supply)
 * 2. User receives (X / totalSupply) * contractBalance of each specified token
 * 3. This creates a fair, proportional distribution system
 *
 * Security considerations:
 * - Uses reentrancy guard to prevent reentrancy attacks
 * - Burns tokens before transfers (checks-effects-interactions pattern)
 * - Validates all inputs thoroughly
 * - Supports claiming multiple tokens in one transaction for gas efficiency
 *
 * Inheriting contracts must:
 * - Be ERC20Upgradeable tokens
 * - Call appropriate initializers (__ERC20_init, __ReentrancyGuard_init)
 * - Implement any additional functionality needed
 */
abstract contract BurnAndClaimBase is
    IBurnAndClaim,
    ERC20Upgradeable,
    ReentrancyGuardUpgradeable
{
    /**
     * @notice Burns tokens and claims a proportional share of specified tokens
     * @dev Core implementation of the burn-and-claim mechanism.
     *
     * Process flow:
     * 1. Validates inputs (amount > 0, tokens array valid)
     * 2. Verifies tokens array is sorted and unique (gas optimization for duplicate checking)
     * 3. Burns the specified amount from caller
     * 4. Calculates proportional shares for each token
     * 5. Transfers all claimable amounts to the caller
     *
     * @param amountToBurn Amount of tokens to burn from the caller
     * @param tokens Array of token addresses to claim (must be sorted ascending and unique)
     * @custom:security nonReentrant modifier prevents reentrancy attacks
     * @custom:gas-optimization Sorted array requirement enables O(n) duplicate checking
     */
    function burnAndClaim(uint256 amountToBurn, address[] calldata tokens)
        external
        virtual
        override
        nonReentrant
    {
        _burnAndClaim(amountToBurn, tokens);
    }

    /**
     * @dev Internal implementation of burn and claim logic
     * @param amountToBurn Amount of tokens to burn from the caller
     * @param tokens Array of token addresses to claim
     */
    function _burnAndClaim(uint256 amountToBurn, address[] calldata tokens)
        internal
    {
        if (amountToBurn == 0) revert InvalidBurnAmount();
        if (tokens.length == 0) revert NoTokensSelected();

        // Verify tokens array is sorted and unique (single pass validation)
        for (uint256 i = 1; i < tokens.length; i++) {
            if (uint160(tokens[i]) <= uint160(tokens[i - 1])) {
                revert TokensMustBeSortedAndUnique();
            }
        }

        uint256 currentSupply = totalSupply();
        if (currentSupply == 0) revert NoSupply();

        // Burn tokens first (CEI pattern - state change before external calls)
        _burn(msg.sender, amountToBurn);

        // Arrays to track successful claims
        address[] memory claimedTokens = new address[](tokens.length);
        uint256[] memory claimedAmounts = new uint256[](tokens.length);
        uint256 validClaims = 0;

        // Calculate proportional claims
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            if (token == address(0)) revert InvalidTokenAddress();

            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance == 0) continue;

            // Calculate proportional share: (burned / total) * balance
            uint256 claimAmount = (balance * amountToBurn) / currentSupply;
            if (claimAmount == 0) continue;

            claimedTokens[validClaims] = token;
            claimedAmounts[validClaims] = claimAmount;
            validClaims++;
        }

        if (validClaims == 0) revert NoTokensToClaim();

        // Resize arrays to actual size (gas optimization)
        assembly {
            mstore(claimedTokens, validClaims)
            mstore(claimedAmounts, validClaims)
        }

        // Emit event before transfers (CEI pattern)
        emit TokensBurnedAndClaimed(
            msg.sender, amountToBurn, claimedTokens, claimedAmounts
        );

        // Perform all transfers
        for (uint256 i = 0; i < validClaims; i++) {
            if (
                !IERC20(claimedTokens[i]).transfer(msg.sender, claimedAmounts[i])
            ) {
                revert TransferFailed();
            }
        }
    }

    /**
     * @notice Calculates the amounts of tokens that would be received for burning a specific amount
     * @dev This is a view function that simulates burnAndClaim without making any state changes.
     *
     * Useful for:
     * - UI/UX: Showing users expected returns before they commit
     * - Integration: Allowing other contracts to calculate expected outputs
     * - Testing: Verifying calculations without spending gas on transfers
     *
     * @param amountToBurn Amount of tokens to simulate burning
     * @param tokens Array of token addresses to check claimable amounts for
     * @return amounts Array of token amounts that would be received, in same order as tokens parameter.
     *                 Returns 0 for tokens with no balance or if calculation results in 0.
     */
    function previewBurnAndClaim(
        uint256 amountToBurn,
        address[] calldata tokens
    ) external view virtual override returns (uint256[] memory amounts) {
        uint256 currentSupply = totalSupply();
        if (currentSupply == 0 || amountToBurn == 0) {
            return new uint256[](tokens.length);
        }

        amounts = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] != address(0)) {
                uint256 balance = IERC20(tokens[i]).balanceOf(address(this));
                amounts[i] = (balance * amountToBurn) / currentSupply;
            }
        }
    }
}
