// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title ERC20Implementation
 * @notice Implementation contract for cloneable ERC20 tokens with burn-and-claim functionality
 * @dev Burn tokens to receive proportional share of any tokens held by this contract
 */
contract ERC20Implementation is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    // Custom errors
    error InvalidOwner();
    error InvalidSupply();
    error InvalidBurnAmount();
    error NoTokensSelected();
    error TokensMustBeSortedAndUnique();
    error NoSupply();
    error InvalidTokenAddress();
    error TransferFailed();
    error NoTokensToClaim();

    // Events
    event TokensBurnedAndClaimed(address indexed user, uint256 amountBurned, address[] tokens, uint256[] amounts);

    constructor() {
        _disableInitializers();
    }

    function initialize(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply_,
        address owner_
    ) external initializer {
        if (owner_ == address(0)) revert InvalidOwner();
        if (initialSupply_ == 0) revert InvalidSupply();

        __ERC20_init(name_, symbol_);
        __ERC20Burnable_init();
        __ReentrancyGuard_init();

        _mint(owner_, initialSupply_);
    }

    /**
     * @notice Get circulating supply (just total supply - contract can hold its own tokens)
     */
    function circulatingSupply() public view returns (uint256) {
        return totalSupply();
    }

    /**
     * @notice Burn tokens and claim proportional share of specified tokens
     * @param amountToBurn Amount of tokens to burn
     * @param tokens Array of token addresses to claim (must be sorted in ascending order and unique)
     */
    function burnAndClaim(uint256 amountToBurn, address[] calldata tokens)
        external
        nonReentrant
    {
        if (amountToBurn == 0) revert InvalidBurnAmount();
        if (tokens.length == 0) revert NoTokensSelected();
        
        // Verify tokens array is sorted and contains no duplicates
        for (uint256 i = 1; i < tokens.length; i++) {
            if (uint160(tokens[i]) <= uint160(tokens[i - 1])) revert TokensMustBeSortedAndUnique();
        }

        uint256 currentSupply = totalSupply();
        if (currentSupply == 0) revert NoSupply();

        uint256[] memory amounts = new uint256[](tokens.length);
        uint256 validClaims = 0;

        // Process claims with improved precision
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            if (token == address(0)) revert InvalidTokenAddress();

            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance == 0) continue;

            // Improved calculation to handle very small amounts
            // Instead of: claimAmount = (balance * sharePercentage) / PRECISION
            // We do: claimAmount = (balance * amountToBurn) / currentSupply
            // This avoids the intermediate sharePercentage calculation that can round to 0
            uint256 claimAmount = (balance * amountToBurn) / currentSupply;
            
            if (claimAmount == 0) continue;

            // Transfer tokens
            if (!IERC20(token).transfer(msg.sender, claimAmount)) revert TransferFailed();

            amounts[i] = claimAmount;
            validClaims++;
        }

        if (validClaims == 0) revert NoTokensToClaim();

        // Burn tokens
        _burn(msg.sender, amountToBurn);

        emit TokensBurnedAndClaimed(msg.sender, amountToBurn, tokens, amounts);
    }

    /**
     * @notice Calculate how much of each token a user would receive for burning a specific amount
     * @param amountToBurn Amount of tokens the user wants to burn
     * @param tokens Array of token addresses to check (should be sorted and unique for consistency)
     * @return amounts Array of amounts the user would receive
     */
    function previewBurnAndClaim(uint256 amountToBurn, address[] calldata tokens)
        external
        view
        returns (uint256[] memory amounts)
    {
        uint256 currentSupply = totalSupply();
        if (currentSupply == 0 || amountToBurn == 0) {
            return new uint256[](tokens.length);
        }

        amounts = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] != address(0)) {
                uint256 balance = IERC20(tokens[i]).balanceOf(address(this));
                // Direct calculation without intermediate precision scaling
                amounts[i] = (balance * amountToBurn) / currentSupply;
            }
        }
    }
}
