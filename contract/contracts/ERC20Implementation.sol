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
    // Constants
    uint256 private constant PRECISION = 1e18;

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
        require(owner_ != address(0), "Invalid owner");
        require(initialSupply_ > 0, "Invalid supply");

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
     * @param tokens Array of token addresses to claim
     */
    function burnAndClaim(uint256 amountToBurn, address[] calldata tokens)
        external
        nonReentrant
    {
        require(amountToBurn > 0, "Invalid burn amount");
        require(tokens.length > 0, "No tokens selected");

        uint256 currentSupply = totalSupply();
        require(currentSupply > 0, "No supply");

        // Calculate share (with precision scaling)
        uint256 sharePercentage = (amountToBurn * PRECISION) / currentSupply;

        uint256[] memory amounts = new uint256[](tokens.length);
        uint256 validClaims = 0;

        // Process claims
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            require(token != address(0), "Invalid token address");
            // No restriction on claiming self - contract can hold and distribute its own tokens

            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance == 0) continue;

            uint256 claimAmount = (balance * sharePercentage) / PRECISION;
            if (claimAmount == 0) continue;

            // Transfer tokens
            require(IERC20(token).transfer(msg.sender, claimAmount), "Transfer failed");

            amounts[i] = claimAmount;
            validClaims++;
        }

        require(validClaims > 0, "No tokens to claim");

        // Burn tokens
        _burn(msg.sender, amountToBurn);

        emit TokensBurnedAndClaimed(msg.sender, amountToBurn, tokens, amounts);
    }

    /**
     * @notice Calculate how much of each token a user would receive for burning a specific amount
     * @param amountToBurn Amount of tokens the user wants to burn
     * @param tokens Array of token addresses to check
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

        uint256 sharePercentage = (amountToBurn * PRECISION) / currentSupply;
        amounts = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] != address(0)) {
                uint256 balance = IERC20(tokens[i]).balanceOf(address(this));
                amounts[i] = (balance * sharePercentage) / PRECISION;
            }
        }
    }
}
