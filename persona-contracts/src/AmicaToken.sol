// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BurnAndClaimBase} from "./BurnAndClaimBase.sol";
import {OwnableUpgradeable} from
    "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

/**
 * @title AmicaToken
 * @author Kasumi
 * @notice Main AMICA token contract with burn-and-claim mechanism for fair distribution
 * @dev This upgradeable ERC20 token implements a fair distribution mechanism where users can burn AMICA tokens
 * to claim a proportional share of any tokens held by this contract.
 *
 * Key features:
 * - Upgradeable proxy pattern for future improvements without migration
 * - Pausable functionality for emergency situations
 * - Reentrancy protection on all state-changing functions
 * - Inherits burn-and-claim functionality from BurnAndClaimBase
 * - Owner-controlled pause/unpause for emergency response
 *
 * Token distribution mechanism:
 * - Users can send any ERC20 tokens to this contract
 * - AMICA holders can burn their tokens to receive proportional shares
 * - Share calculation: (burned amount / total supply) * contract token balance
 * - Supports claiming multiple tokens in a single transaction
 *
 * @custom:security-contact kasumi-null@yandex.com
 */
contract AmicaToken is
    BurnAndClaimBase,
    OwnableUpgradeable,
    PausableUpgradeable
{
    /// @notice Reserved storage gap for future upgrades
    /// @dev Ensures storage layout compatibility when adding new state variables
    uint256[50] private __gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the AMICA token contract
     * @dev Called once during proxy deployment. Sets up the token with initial parameters.
     *
     * Initialization includes:
     * - ERC20 token setup (name, symbol)
     * - Owner assignment
     * - Reentrancy guard initialization
     * - Pause state initialization (starts unpaused)
     * - Initial supply minting to owner
     *
     * @param initialOwner Address that will become the owner of the contract and receive initial supply
     * @param initialSupply Total supply to mint to the initial owner (in wei units)
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
     * @dev Emergency function to halt contract operations.
     *
     * When paused:
     * - Token transfers are blocked
     * - burnAndClaim function is disabled
     * - Other view functions remain operational
     *
     * @custom:access Restricted to contract owner only
     * @custom:emits Paused event from PausableUpgradeable
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resumes all token transfers and critical functions
     * @dev Re-enables contract operations after a pause.
     *
     * @custom:access Restricted to contract owner only
     * @custom:emits Unpaused event from PausableUpgradeable
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Burns tokens and claims proportional share with pause check
     * @dev Overrides base implementation to add pausable functionality.
     * Ensures burn-and-claim operations can be halted in emergencies.
     *
     * @inheritdoc BurnAndClaimBase
     * @custom:security whenNotPaused modifier ensures function is disabled during pause
     */
    function burnAndClaim(uint256 amountToBurn, address[] calldata tokens)
        external
        override
        whenNotPaused
        nonReentrant
    {
        _burnAndClaim(amountToBurn, tokens);
    }
}
