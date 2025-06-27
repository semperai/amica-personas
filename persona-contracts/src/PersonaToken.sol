// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20Upgradeable} from
    "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20BurnableUpgradeable} from
    "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {OwnableUpgradeable} from
    "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {Initializable} from
    "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Custom errors
/// @notice Thrown when attempting to initialize with zero address as owner
error InvalidOwner();
/// @notice Thrown when attempting to initialize with zero initial supply
error InvalidSupply();
/// @notice Thrown when attempting to burn zero tokens
error InvalidBurnAmount();
/// @notice Thrown when no tokens are selected for claiming
error NoTokensSelected();
/// @notice Thrown when token array is not sorted in ascending order or contains duplicates
error TokensMustBeSortedAndUnique();
/// @notice Thrown when total supply is zero during burn and claim
error NoSupply();
/// @notice Thrown when a token address in the claim array is zero address
error InvalidTokenAddress();
/// @notice Thrown when a token transfer fails during claim
error TransferFailed();
/// @notice Thrown when there are no tokens to claim after calculation
error NoTokensToClaim();

/**
 * @title PersonaToken
 * @author Kasumi
 * @notice Implementation contract for cloneable ERC20 tokens with burn-and-claim functionality
 * @dev This contract is designed to be used with a minimal proxy pattern (EIP-1167).
 * It extends OpenZeppelin's upgradeable contracts to provide:
 * - Standard ERC20 functionality
 * - Burnable tokens
 * - Ownership management
 * - Burn-and-claim mechanism for distributing held tokens proportionally
 *
 * The burn-and-claim mechanism allows token holders to burn their tokens and receive
 * a proportional share of any tokens held by this contract. This is useful for
 * distributing rewards, airdrops, or other tokens collected by the contract.
 */
contract PersonaToken is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    // Events
    /**
     * @notice Emitted when tokens are burned and other tokens are claimed
     * @param user Address of the user who burned tokens and received claims
     * @param amountBurned Amount of tokens burned by the user
     * @param tokens Array of token addresses that were claimed
     * @param amounts Array of amounts claimed for each token
     */
    event TokensBurnedAndClaimed(
        address indexed user,
        uint256 amountBurned,
        address[] tokens,
        uint256[] amounts
    );

    /**
     * @notice Disables initializers to prevent implementation contract initialization
     * @dev This is a security measure for upgradeable contracts used as implementations
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the ERC20 token with given parameters
     * @dev Can only be called once, typically by the factory during clone deployment
     * @param name_ Name of the token
     * @param symbol_ Symbol of the token
     * @param initialSupply_ Initial supply of tokens to mint to owner (must be > 0)
     * @param owner_ Address that will own the token contract and receive initial supply
     * @custom:throws InvalidOwner if owner_ is zero address
     * @custom:throws InvalidSupply if initialSupply_ is zero
     */
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
        __Ownable_init(owner_);
        __ReentrancyGuard_init();

        _mint(owner_, initialSupply_);
    }

    /**
     * @notice Burns tokens and claims proportional share of specified tokens held by this contract
     * @dev This function:
     * - Requires the token to be graduated
     * - Burns the specified amount from msg.sender
     * - Calculates proportional share based on burned amount vs total supply
     * - Transfers the proportional amount of each specified token to msg.sender
     * - Requires tokens array to be sorted in ascending order with no duplicates
     * @param amountToBurn Amount of this token to burn
     * @param tokens Array of token addresses to claim (must be sorted ascending and unique)
     * @custom:throws TokenNotGraduated if token hasn't graduated yet
     * @custom:throws InvalidBurnAmount if amountToBurn is zero
     * @custom:throws NoTokensSelected if tokens array is empty
     * @custom:throws TokensMustBeSortedAndUnique if tokens array is not properly sorted or contains duplicates
     * @custom:throws NoSupply if total supply is zero
     * @custom:throws InvalidTokenAddress if any token address is zero
     * @custom:throws NoTokensToClaim if no tokens have claimable balances
     * @custom:throws TransferFailed if any token transfer fails
     */
    function burnAndClaim(uint256 amountToBurn, address[] calldata tokens)
        external
        nonReentrant
    {
        if (amountToBurn == 0) revert InvalidBurnAmount();
        if (tokens.length == 0) revert NoTokensSelected();

        // Verify tokens array is sorted and contains no duplicates
        for (uint256 i = 1; i < tokens.length; i++) {
            if (uint160(tokens[i]) <= uint160(tokens[i - 1])) {
                revert TokensMustBeSortedAndUnique();
            }
        }

        uint256 currentSupply = totalSupply();
        if (currentSupply == 0) revert NoSupply();

        // Burn tokens first (state change before external calls)
        _burn(msg.sender, amountToBurn);

        uint256[] memory amounts = new uint256[](tokens.length);
        uint256 validClaims = 0;

        // Calculate all claim amounts first
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            if (token == address(0)) revert InvalidTokenAddress();

            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance == 0) continue;

            // Calculate with higher precision to minimize rounding errors
            uint256 claimAmount = (balance * amountToBurn) / currentSupply;

            if (claimAmount == 0) continue;

            amounts[i] = claimAmount;
            validClaims++;
        }

        if (validClaims == 0) revert NoTokensToClaim();

        // Now perform all transfers
        for (uint256 i = 0; i < tokens.length; i++) {
            if (amounts[i] > 0) {
                if (!IERC20(tokens[i]).transfer(msg.sender, amounts[i])) {
                    revert TransferFailed();
                }
            }
        }

        emit TokensBurnedAndClaimed(msg.sender, amountToBurn, tokens, amounts);
    }

    /**
     * @notice Calculates the amounts of tokens that would be received for burning a specific amount
     * @dev This is a view function that simulates burnAndClaim without making any state changes.
     * Returns empty array if token hasn't graduated or if supply/burn amount is zero.
     * @param amountToBurn Amount of tokens to simulate burning
     * @param tokens Array of token addresses to check claimable amounts for
     * @return amounts Array of token amounts that would be received, in same order as tokens parameter
     */
    function previewBurnAndClaim(
        uint256 amountToBurn,
        address[] calldata tokens
    ) external view returns (uint256[] memory amounts) {
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
