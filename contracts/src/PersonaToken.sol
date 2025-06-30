// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BurnAndClaimBase} from "./BurnAndClaimBase.sol";

// Custom errors for PersonaToken initialization
error InvalidOwner();
error InvalidSupply();

/**
 * @title PersonaToken
 * @author Kasumi
 * @notice Cloneable ERC20 token with burn-and-claim functionality for bonding curve graduates
 * @dev This contract is designed to be used with a minimal proxy pattern (EIP-1167).
 * It provides a gas-efficient way to deploy multiple tokens with identical functionality
 * through a factory pattern.
 *
 * Key features:
 * - Optimized for clone deployment (minimal proxy pattern)
 * - Inherits burn-and-claim mechanism from BurnAndClaimBase
 * - Intended for tokens graduating from bonding curves
 * - No owner or pause functionality (simplified for specific use case)
 * - Supports standard ERC20 functionality plus burn-and-claim
 *
 * Use case:
 * - Bonding curve creates initial token supply
 * - Upon graduation, a PersonaToken clone is deployed
 * - Initial liquidity and supply transferred to the clone
 * - Users can burn tokens to claim accumulated fees/rewards
 *
 * @custom:security-contact kasumi-null@yandex.com
 */
contract PersonaToken is BurnAndClaimBase {
    /**
     * @notice Disables initializers to prevent implementation contract initialization
     * @dev Security measure for contracts used as clone implementations.
     * Prevents the implementation contract from being initialized, which could
     * lead to security vulnerabilities if the implementation is taken over.
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the token with given parameters
     * @dev Called by factory during clone deployment. This function can only be called
     * once per clone due to the initializer modifier.
     *
     * The initialization process:
     * 1. Sets up ERC20 token with name and symbol
     * 2. Initializes reentrancy guard for security
     * 3. Mints entire initial supply to the specified owner
     *
     * @param name_ Token name (e.g., "Persona Token")
     * @param symbol_ Token symbol (e.g., "PERS")
     * @param initialSupply_ Initial supply to mint in wei units (must be > 0)
     * @param owner_ Address that will receive the initial supply
     * @custom:throws InvalidOwner if owner_ is the zero address
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
        __ReentrancyGuard_init();

        _mint(owner_, initialSupply_);
    }
}
