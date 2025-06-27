// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// Common errors for burn-and-claim functionality
error InvalidBurnAmount();
error NoTokensSelected();
error TokensMustBeSortedAndUnique();
error NoSupply();
error InvalidTokenAddress();
error NoTokensToClaim();
error TransferFailed();

/**
 * @title IBurnAndClaim
 * @author Kasumi
 * @notice Interface for tokens with burn-and-claim distribution mechanism
 * @dev This interface defines the core functionality for tokens that allow holders to burn
 * their tokens in exchange for a proportional share of other tokens held by the contract.
 *
 * The burn-and-claim mechanism enables fair distribution of accumulated tokens to holders
 * proportional to their burned token amount relative to the total supply.
 */
interface IBurnAndClaim {
    /**
     * @notice Emitted for each token claimed when burning
     * @param user Address that burned tokens and received claims
     * @param claimedToken Address of the token being claimed
     * @param amountBurned Amount of tokens burned for this claim
     * @param amountClaimed Amount of claimedToken received
     */
    event TokenClaimed(
        address indexed user,
        address indexed claimedToken,
        uint256 amountBurned,
        uint256 amountClaimed
    );

    /**
     * @notice Burns tokens and claims proportional share of specified tokens held by this contract
     * @dev Burns the caller's tokens and transfers a proportional share of the specified tokens.
     * The proportion is calculated as: (amountToBurn / totalSupply) * tokenBalance
     * @param amountToBurn Amount of this token to burn from the caller's balance
     * @param tokens Array of token addresses to claim (must be sorted ascending by address and contain no duplicates)
     * @custom:throws InvalidBurnAmount if amountToBurn is 0
     * @custom:throws NoTokensSelected if tokens array is empty
     * @custom:throws TokensMustBeSortedAndUnique if tokens are not sorted or contain duplicates
     * @custom:throws NoSupply if total supply is 0
     * @custom:throws InvalidTokenAddress if any token address is zero
     * @custom:throws NoTokensToClaim if no tokens have claimable balances
     * @custom:throws TransferFailed if any token transfer fails
     */
    function burnAndClaim(uint256 amountToBurn, address[] calldata tokens)
        external;

    /**
     * @notice Calculates the amounts of tokens that would be received for burning a specific amount
     * @dev This is a view function that simulates burnAndClaim without making any state changes.
     * Useful for UI integration to show users expected returns before executing.
     * @param amountToBurn Amount of tokens to simulate burning
     * @param tokens Array of token addresses to check claimable amounts for
     * @return amounts Array of token amounts that would be received, in same order as tokens parameter
     */
    function previewBurnAndClaim(
        uint256 amountToBurn,
        address[] calldata tokens
    ) external view returns (uint256[] memory amounts);
}
