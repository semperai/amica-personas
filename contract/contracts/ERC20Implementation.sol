// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

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
error TokenNotGraduated();
error OnlyFactory();

/**
 * @title ERC20Implementation
 * @notice Implementation contract for cloneable ERC20 tokens with burn-and-claim functionality
 * @dev Burn tokens to receive proportional share of any tokens held by this contract
 */
contract ERC20Implementation is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable
{
    // State variables
    bool public hasGraduated;
    address public factory;

    // Events
    event TokensBurnedAndClaimed(address indexed user, uint256 amountBurned, address[] tokens, uint256[] amounts);
    event GraduationStatusSet(bool graduated);

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
        __Ownable_init(owner_);
        __ReentrancyGuard_init();

        _mint(owner_, initialSupply_);
        factory = msg.sender; // The factory is the deployer
        hasGraduated = false;
    }

    /**
     * @notice Set graduation status (only callable by factory)
     * @param _graduated Whether the token has graduated
     */
    function setGraduationStatus(bool _graduated) external {
        if (msg.sender != factory) revert OnlyFactory();
        hasGraduated = _graduated;
        emit GraduationStatusSet(_graduated);
    }

    /**
     * @notice Get circulating supply (just total supply - contract can hold its own tokens)
     */
    function circulatingSupply() public view returns (uint256) {
        return totalSupply();
    }

    /**
     * @notice Burn tokens and claim proportional share of specified tokens
     * @dev Now checks if token has graduated before allowing claims
     * @param amountToBurn Amount of tokens to burn
     * @param tokens Array of token addresses to claim (must be sorted in ascending order and unique)
     */
    function burnAndClaim(uint256 amountToBurn, address[] calldata tokens)
        external
        nonReentrant
    {
        // Check if token has graduated
        if (!hasGraduated) revert TokenNotGraduated();
        
        if (amountToBurn == 0) revert InvalidBurnAmount();
        if (tokens.length == 0) revert NoTokensSelected();
        
        // Verify tokens array is sorted and contains no duplicates
        for (uint256 i = 1; i < tokens.length; i++) {
            if (uint160(tokens[i]) <= uint160(tokens[i - 1])) revert TokensMustBeSortedAndUnique();
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
     * @notice Calculate how much of each token a user would receive for burning a specific amount
     * @dev Also checks graduation status
     * @param amountToBurn Amount of tokens the user wants to burn
     * @param tokens Array of token addresses to check (should be sorted and unique for consistency)
     * @return amounts Array of amounts the user would receive
     */
    function previewBurnAndClaim(uint256 amountToBurn, address[] calldata tokens)
        external
        view
        returns (uint256[] memory amounts)
    {
        // Return empty array if not graduated
        if (!hasGraduated) {
            return new uint256[](tokens.length);
        }

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
