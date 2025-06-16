// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

interface IAmicaToken {
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
}

// Custom errors
error InvalidBridgedToken();
error InvalidNativeToken();
error TokensMustBeDifferent();
error InvalidOwner();
error InvalidAmount();
error TransferFailed();
error InsufficientBridgedTokens();
error InvalidRecipient();
error NoExcessTokens();
error AmountExceedsExcess();

/**
 * @title AmicaBridgeWrapper
 * @notice Handles conversion between bridged AMICA tokens and native chain AMICA tokens
 * @dev Upgradeable version - allows seamless bridging while maintaining token functionality on each chain
 */
contract AmicaBridgeWrapper is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    // State variables
    IERC20 public bridgedAmicaToken;  // The bridged version from Ethereum
    IAmicaToken public nativeAmicaToken;  // The native AMICA on this chain

    // Track total bridged tokens for security
    uint256 public totalBridgedIn;
    uint256 public totalBridgedOut;

    // Gap for future upgrades
    uint256[50] private __gap;

    // Events
    event TokensWrapped(address indexed user, uint256 amount);
    event TokensUnwrapped(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _bridgedAmicaToken,
        address _nativeAmicaToken,
        address _owner
    ) public initializer {
        if (_bridgedAmicaToken == address(0)) revert InvalidBridgedToken();
        if (_nativeAmicaToken == address(0)) revert InvalidNativeToken();
        if (_bridgedAmicaToken == _nativeAmicaToken) revert TokensMustBeDifferent();
        if (_owner == address(0)) revert InvalidOwner();

        __Ownable_init(_owner);
        __ReentrancyGuard_init();
        __Pausable_init();

        bridgedAmicaToken = IERC20(_bridgedAmicaToken);
        nativeAmicaToken = IAmicaToken(_nativeAmicaToken);
    }

    /**
     * @notice Pause the contract
     * @dev Only callable by owner
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     * @dev Only callable by owner
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Wrap bridged AMICA tokens to get native AMICA tokens
     * @param amount Amount of bridged tokens to wrap
     */
    function wrap(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();

        // Transfer bridged tokens from user to this contract
        if (!bridgedAmicaToken.transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }

        // Mint native tokens to user
        nativeAmicaToken.mint(msg.sender, amount);

        totalBridgedIn += amount;

        emit TokensWrapped(msg.sender, amount);
    }

    /**
     * @notice Unwrap native AMICA tokens to get bridged AMICA tokens back
     * @param amount Amount of native tokens to unwrap
     */
    function unwrap(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();

        if (bridgedAmicaToken.balanceOf(address(this)) < amount) {
            revert InsufficientBridgedTokens();
        }

        // Burn native tokens from user
        nativeAmicaToken.burnFrom(msg.sender, amount);

        // Transfer bridged tokens back to user
        if (!bridgedAmicaToken.transfer(msg.sender, amount)) {
            revert TransferFailed();
        }

        totalBridgedOut += amount;

        emit TokensUnwrapped(msg.sender, amount);
    }

    /**
     * @notice Get the amount of bridged tokens held by this contract
     */
    function bridgedBalance() external view returns (uint256) {
        return bridgedAmicaToken.balanceOf(address(this));
    }

    /**
     * @notice Emergency function to recover tokens (only non-AMICA tokens or excess)
     * @param token Token address to recover
     * @param to Recipient address
     * @param amount Amount to recover
     * @dev Can be called even when paused for emergency recovery
     */
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        if (to == address(0)) revert InvalidRecipient();

        if (token == address(bridgedAmicaToken)) {
            // For bridged AMICA, only allow withdrawal of excess
            uint256 requiredBalance = totalBridgedIn - totalBridgedOut;
            uint256 currentBalance = bridgedAmicaToken.balanceOf(address(this));
            if (currentBalance <= requiredBalance) revert NoExcessTokens();
            uint256 excess = currentBalance - requiredBalance;
            if (amount > excess) revert AmountExceedsExcess();
        }

        if (!IERC20(token).transfer(to, amount)) revert TransferFailed();

        emit EmergencyWithdraw(token, to, amount);
    }

    /**
     * @notice Update bridge tokens (only for emergency migration)
     * @dev This is a sensitive function that should only be used in emergencies
     */
    function updateBridgeTokens(
        address _bridgedAmicaToken,
        address _nativeAmicaToken
    ) external onlyOwner whenPaused {
        if (_bridgedAmicaToken == address(0)) revert InvalidBridgedToken();
        if (_nativeAmicaToken == address(0)) revert InvalidNativeToken();
        if (_bridgedAmicaToken == _nativeAmicaToken) revert TokensMustBeDifferent();

        bridgedAmicaToken = IERC20(_bridgedAmicaToken);
        nativeAmicaToken = IAmicaToken(_nativeAmicaToken);
    }
}
