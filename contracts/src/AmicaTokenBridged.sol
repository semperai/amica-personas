// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20Upgradeable} from
    "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {OwnableUpgradeable} from
    "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {PausableUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from
    "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AmicaTokenBridged
 * @author Kasumi
 * @notice AMICA token for Arbitrum One and Base - bridged L2 version with deposit-and-mint
 * @dev This upgradeable ERC20 token allows users to deposit configured tokens and mint AMICA.
 *
 * Key features:
 * - Upgradeable proxy pattern (UUPS)
 * - Pausable functionality for emergency situations
 * - Reentrancy protection on all state-changing functions
 * - Owner can configure which tokens are accepted for minting AMICA
 * - Configurable exchange rates per token
 * - Max supply enforcement (1 billion across all chains)
 * - Owner-controlled pause/unpause for emergency response
 *
 * depositAndMint mechanism:
 * - Owner adds supported tokens with their exchange rates
 * - Users deposit supported tokens
 * - Contract mints AMICA based on configured exchange rate
 * - Deposited tokens are held by the contract (can be withdrawn by owner)
 * - Total minted cannot exceed remaining supply (MAX_SUPPLY - totalSupply)
 *
 * Cross-chain architecture:
 * - This is the L2 version (Arbitrum One / Base)
 * - Deployed at the same address as mainnet version using CREATE2
 * - Total supply across all chains cannot exceed 1 billion
 * - No burn-and-claim on L2 (mainnet-only feature)
 *
 * @custom:security-contact kasumi-null@yandex.com
 */
contract AmicaTokenBridged is
    ERC20Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    /// @notice Maximum supply across all chains (1 billion tokens)
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;

    /// @notice Configuration for each supported deposit token
    struct TokenConfig {
        bool enabled; // Whether this token is accepted for deposits
        uint256 exchangeRate; // How much AMICA per 1 deposit token (18 decimals)
        uint8 decimals; // Decimals of the deposit token
    }

    /// @notice Mapping of token address => configuration
    mapping(address => TokenConfig) public tokenConfigs;

    /// @notice List of all configured tokens (for enumeration)
    address[] public configuredTokens;

    /// @notice Reserved storage gap for future upgrades
    uint256[47] private __gap;

    // ============ Events ============

    event TokenConfigured(
        address indexed token,
        bool enabled,
        uint256 exchangeRate,
        uint8 decimals
    );
    event TokenDeposited(
        address indexed user,
        address indexed token,
        uint256 amountDeposited,
        uint256 amountMinted
    );
    event TokenWithdrawn(
        address indexed token, address indexed to, uint256 amount
    );

    // ============ Errors ============

    error TokenNotEnabled();
    error InvalidExchangeRate();
    error ExceedsMaxSupply();
    error InvalidAmount();
    error TokenAlreadyConfigured();
    error TransferFailed();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the AMICA bridged token contract
     * @dev Called once during proxy deployment. Sets up the token with initial parameters.
     *
     * Initialization includes:
     * - ERC20 token setup (name, symbol)
     * - Owner assignment
     * - Reentrancy guard initialization
     * - Pause state initialization (starts unpaused)
     * - No initial supply minted (supply created through depositAndMint)
     *
     * @param initialOwner Address that will become the owner of the contract
     * @custom:requirement initialOwner must not be the zero address
     * @custom:requirement Can only be called once due to initializer modifier
     */
    function initialize(address initialOwner) external virtual initializer {
        __ERC20_init("Amica", "AMICA");
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __Pausable_init();
    }

    /**
     * @notice Configures a token for deposit-and-mint functionality
     * @dev Only owner can configure tokens. Sets exchange rate and enables/disables token.
     *
     * @param token Address of the ERC20 token to configure
     * @param enabled Whether to enable or disable this token
     * @param exchangeRate Amount of AMICA (18 decimals) to mint per 1 unit of deposit token
     * @param decimals Decimals of the deposit token (for proper calculation)
     *
     * @custom:access Restricted to contract owner only
     * @custom:emits TokenConfigured
     *
     * Example:
     * - To mint 1 AMICA per 1 USDC (6 decimals):
     *   configureToken(USDC_ADDRESS, true, 1e18, 6)
     * - To mint 0.5 AMICA per 1 USDC:
     *   configureToken(USDC_ADDRESS, true, 0.5e18, 6)
     */
    function configureToken(
        address token,
        bool enabled,
        uint256 exchangeRate,
        uint8 decimals
    ) external onlyOwner {
        if (token == address(0)) revert InvalidAmount();
        if (enabled && exchangeRate == 0) revert InvalidExchangeRate();

        // Add to list if not already configured
        if (
            !tokenConfigs[token].enabled
                && tokenConfigs[token].exchangeRate == 0
        ) {
            configuredTokens.push(token);
        }

        tokenConfigs[token] = TokenConfig({
            enabled: enabled,
            exchangeRate: exchangeRate,
            decimals: decimals
        });

        emit TokenConfigured(token, enabled, exchangeRate, decimals);
    }

    /**
     * @notice Deposits a supported token and mints AMICA based on exchange rate
     * @dev User must approve this contract to spend their tokens first.
     *
     * Process:
     * 1. Validates token is enabled
     * 2. Calculates AMICA to mint based on exchange rate
     * 3. Checks that minting won't exceed MAX_SUPPLY
     * 4. Transfers deposit token from user to this contract
     * 5. Mints AMICA to user
     *
     * @param token Address of the token to deposit
     * @param amount Amount of tokens to deposit (in token's native decimals)
     *
     * @custom:security whenNotPaused modifier ensures function is disabled during pause
     * @custom:security nonReentrant prevents reentrancy attacks
     * @custom:emits TokenDeposited
     *
     * Example:
     * - User deposits 100 USDC (6 decimals)
     * - Exchange rate is 1e18 (1:1)
     * - User receives 100 AMICA (18 decimals)
     */
    function depositAndMint(address token, uint256 amount)
        external
        whenNotPaused
        nonReentrant
    {
        if (amount == 0) revert InvalidAmount();

        TokenConfig memory config = tokenConfigs[token];
        if (!config.enabled) revert TokenNotEnabled();

        // Calculate AMICA to mint based on exchange rate
        // Formula: (amount * exchangeRate) / (10 ** tokenDecimals)
        // This normalizes the deposit amount to 18 decimals and applies the rate
        uint256 amountToMint =
            (amount * config.exchangeRate) / (10 ** config.decimals);

        if (amountToMint == 0) revert InvalidAmount();

        // Check max supply constraint
        if (totalSupply() + amountToMint > MAX_SUPPLY) {
            revert ExceedsMaxSupply();
        }

        // Transfer deposit token from user to this contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Mint AMICA to user
        _mint(msg.sender, amountToMint);

        emit TokenDeposited(msg.sender, token, amount, amountToMint);
    }

    /**
     * @notice Withdraws accumulated deposit tokens from the contract
     * @dev Only owner can withdraw. Useful for managing accumulated deposits.
     *
     * @param token Address of the token to withdraw
     * @param to Address to send the tokens to
     * @param amount Amount to withdraw
     *
     * @custom:access Restricted to contract owner only
     * @custom:emits TokenWithdrawn
     */
    function withdrawToken(address token, address to, uint256 amount)
        external
        onlyOwner
    {
        if (to == address(0)) revert InvalidAmount();
        if (amount == 0) revert InvalidAmount();

        IERC20(token).safeTransfer(to, amount);

        emit TokenWithdrawn(token, to, amount);
    }

    /**
     * @notice Returns the list of all configured tokens
     * @dev Useful for frontends to display supported tokens
     * @return Array of token addresses that have been configured
     */
    function getConfiguredTokens() external view returns (address[] memory) {
        return configuredTokens;
    }

    /**
     * @notice Calculates how much AMICA would be minted for a given deposit
     * @dev Preview function - does not make any state changes
     *
     * @param token Address of the deposit token
     * @param amount Amount of tokens to deposit
     * @return amountToMint Amount of AMICA that would be minted
     */
    function previewDepositAndMint(address token, uint256 amount)
        external
        view
        returns (uint256 amountToMint)
    {
        TokenConfig memory config = tokenConfigs[token];
        if (!config.enabled || amount == 0) return 0;

        amountToMint = (amount * config.exchangeRate) / (10 ** config.decimals);
    }

    /**
     * @notice Returns remaining supply available for minting
     * @return remaining Number of AMICA tokens that can still be minted
     */
    function remainingSupply() external view returns (uint256 remaining) {
        return MAX_SUPPLY - totalSupply();
    }

    /**
     * @notice Pauses all token transfers and critical functions
     * @dev Emergency function to halt contract operations.
     *
     * When paused:
     * - Token transfers are blocked
     * - depositAndMint function is disabled
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
}
