// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20Upgradeable} from
    "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {OwnableUpgradeable} from
    "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Custom errors
error InvalidRecipient();
error InsufficientBalance();
error InvalidAmount();
error NoTokensSelected();
error InvalidBurnAmount();
error TokensMustBeSortedAndUnique();
error NoCirculatingSupply();
error InvalidTokenAddress();
error CannotClaimAmica();
error NoTokensToClaim();
error TransferFailed();

/**
 * @title AmicaToken
 * @author Kasumi
 * @notice Main AMICA token contract with a unique burn-and-claim mechanism for fair distribution
 * @dev This upgradeable ERC20 token implements a fair distribution mechanism where users can burn AMICA tokens
 * to claim a proportional share of any tokens held by this contract.
 *
 * Key features:
 * - Upgradeable proxy pattern for future improvements
 * - Cross-chain compatibility with bridge wrapper support
 * - Pausable functionality for emergency situations
 * - Reentrancy protection on all state-changing functions
 * - Custom error messages for gas efficiency
 *
 * Users can send any ERC20 tokens to this contract, and token holders can burn their AMICA
 * to receive a proportional share based on the circulating supply.
 *
 * @custom:security-contact kasumi-null@yandex.com
 */
contract AmicaToken is
    ERC20Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    /// @notice Reserved storage gap for future upgrades
    /// @dev Ensures storage layout compatibility when adding new state variables
    uint256[50] private __gap;

    /// @notice Emitted when AMICA tokens are withdrawn from the contract
    /// @param to Recipient address
    /// @param amount Amount of AMICA tokens withdrawn
    event TokensWithdrawn(address indexed to, uint256 amount);

    /// @notice Emitted when a user burns AMICA and claims tokens
    /// @param user Address of the user who burned and claimed
    /// @param amountBurned Amount of AMICA tokens burned
    /// @param tokens Array of token addresses that were claimed
    /// @param amounts Array of amounts claimed for each token
    event TokensBurnedAndClaimed(
        address indexed user,
        uint256 amountBurned,
        address[] tokens,
        uint256[] amounts
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the AMICA token contract
     * @dev Called once during proxy deployment. Mints total supply to the initial owner.
     * @param initialOwner Address that will become the owner of the contract
     * @param initialSupply Total supply to mint to the initial owner
     * @custom:requirement initialOwner must not be the zero address
     * @custom:requirement Can only be called once due to initializer modifier
     */
    function initialize(address initialOwner, uint256 initialSupply)
        external
        virtual
        initializer
    {
        __ERC20_init("Amica", "AMICA");
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __Pausable_init();

        _mint(initialOwner, initialSupply);
    }

    /**
     * @notice Pauses all token transfers and critical functions
     * @dev Can only be called by the contract owner. Affects transfer, burn, and claim functions.
     * @custom:access Restricted to contract owner
     * @custom:emits Paused event from PausableUpgradeable
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resumes all token transfers and critical functions
     * @dev Can only be called by the contract owner after the contract has been paused.
     * @custom:access Restricted to contract owner
     * @custom:emits Unpaused event from PausableUpgradeable
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Returns the circulating supply of AMICA tokens
     * @dev Calculated as total supply minus the contract's own balance
     * @return The amount of AMICA tokens in circulation
     */
    function circulatingSupply() public view returns (uint256) {
        return totalSupply() - balanceOf(address(this));
    }

    /**
     * @notice Withdraws AMICA tokens held by the contract
     * @dev Used by owner to distribute AMICA tokens from the contract's balance
     * @param to Address to receive the tokens
     * @param amount Amount of AMICA tokens to withdraw
     * @custom:access Restricted to contract owner
     * @custom:requirement Contract must not be paused
     * @custom:requirement 'to' cannot be the zero address
     * @custom:requirement Contract must have sufficient balance
     * @custom:emits TokensWithdrawn
     */
    function withdraw(address to, uint256 amount)
        external
        onlyOwner
        whenNotPaused
    {
        if (to == address(0)) revert InvalidRecipient();
        if (amount > balanceOf(address(this))) revert InsufficientBalance();

        _transfer(address(this), to, amount);
        emit TokensWithdrawn(to, amount);
    }

    /**
     * @notice Burns AMICA tokens and claims a proportional share of specified tokens held by this contract
     * @dev This is the core distribution mechanism. Users burn AMICA to receive a proportional
     * share of any tokens held by the contract based on the circulating supply.
     *
     * @param amountToBurn Amount of AMICA tokens to burn from the caller's balance
     * @param tokens Array of token addresses to claim (must be sorted ascending and unique)
     *
     * @custom:requirement Contract must not be paused
     * @custom:requirement amountToBurn must be greater than 0
     * @custom:requirement tokens array must not be empty
     * @custom:requirement tokens must be sorted in ascending order with no duplicates
     * @custom:requirement Cannot claim AMICA tokens themselves
     * @custom:requirement There must be circulating supply to calculate shares
     * @custom:requirement At least one token must have a claimable balance
     *
     * @custom:security All state updates complete before any external token transfers
     * @custom:security Protected by nonReentrant modifier
     *
     * @custom:emits TokensBurnedAndClaimed with the burned amount and claimed tokens/amounts
     */
    function burnAndClaim(uint256 amountToBurn, address[] calldata tokens)
        external
        nonReentrant
        whenNotPaused
    {
        if (amountToBurn == 0) revert InvalidBurnAmount();
        if (tokens.length == 0) revert NoTokensSelected();

        // Verify tokens array is sorted and unique
        for (uint256 i = 1; i < tokens.length; i++) {
            if (uint160(tokens[i]) <= uint160(tokens[i - 1])) {
                revert TokensMustBeSortedAndUnique();
            }
        }

        uint256 currentCirculating = circulatingSupply();
        if (currentCirculating == 0) revert NoCirculatingSupply();

        // Burn tokens first (state change before external calls)
        _burn(msg.sender, amountToBurn);

        address[] memory claimedTokens = new address[](tokens.length);
        uint256[] memory claimedAmounts = new uint256[](tokens.length);
        uint256 validClaims = 0;

        // Calculate all claim amounts
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];

            if (token == address(0)) revert InvalidTokenAddress();
            if (token == address(this)) revert CannotClaimAmica();

            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance == 0) continue;

            // Calculate proportional share
            uint256 claimAmount = (balance * amountToBurn) / currentCirculating;
            if (claimAmount == 0) continue;

            claimedTokens[validClaims] = token;
            claimedAmounts[validClaims] = claimAmount;
            validClaims++;
        }

        if (validClaims == 0) revert NoTokensToClaim();

        // Resize arrays to actual size
        assembly {
            mstore(claimedTokens, validClaims)
            mstore(claimedAmounts, validClaims)
        }

        // Emit event before transfers
        emit TokensBurnedAndClaimed(
            msg.sender, amountToBurn, claimedTokens, claimedAmounts
        );

        // Now perform all transfers
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
     * @dev This is a view function that simulates burnAndClaim without making any state changes
     * @param amountToBurn Amount of tokens to simulate burning
     * @param tokens Array of token addresses to check claimable amounts for
     * @return amounts Array of token amounts that would be received, in same order as tokens parameter
     */
    function previewBurnAndClaim(
        uint256 amountToBurn,
        address[] calldata tokens
    ) external view returns (uint256[] memory amounts) {
        uint256 currentCirculating = circulatingSupply();
        if (currentCirculating == 0 || amountToBurn == 0) {
            return new uint256[](tokens.length);
        }

        amounts = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] != address(0) && tokens[i] != address(this)) {
                uint256 balance = IERC20(tokens[i]).balanceOf(address(this));
                amounts[i] = (balance * amountToBurn) / currentCirculating;
            }
        }
    }

    /**
     * @notice Transfers tokens from caller to another address
     * @dev Overrides ERC20 transfer to add pause functionality
     * @param to Recipient address
     * @param amount Amount of tokens to transfer
     * @return success True if the transfer succeeded
     * @custom:requirement Contract must not be paused
     */
    function transfer(address to, uint256 amount)
        public
        virtual
        override
        whenNotPaused
        returns (bool)
    {
        return super.transfer(to, amount);
    }

    /**
     * @notice Transfers tokens from one address to another using allowance
     * @dev Overrides ERC20 transferFrom to add pause functionality
     * @param from Address to transfer tokens from
     * @param to Address to transfer tokens to
     * @param amount Amount of tokens to transfer
     * @return success True if the transfer succeeded
     * @custom:requirement Contract must not be paused
     * @custom:requirement Caller must have sufficient allowance from 'from' address
     */
    function transferFrom(address from, address to, uint256 amount)
        public
        virtual
        override
        whenNotPaused
        returns (bool)
    {
        return super.transferFrom(from, to, amount);
    }
}
