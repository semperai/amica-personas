// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title IAmicaToken
 * @notice Interface for the native AMICA token with minting and burning capabilities
 */
interface IAmicaToken {
    /**
     * @notice Mints new tokens to a specified address
     * @param to The address that will receive the minted tokens
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) external;

    /**
     * @notice Burns tokens from the caller's balance
     * @param amount The amount of tokens to burn
     */
    function burn(uint256 amount) external;

    /**
     * @notice Burns tokens from a specified account (requires approval)
     * @param account The address from which tokens will be burned
     * @param amount The amount of tokens to burn
     */
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
 * @author Kasumi
 * @notice Facilitates seamless conversion between bridged AMICA tokens from Ethereum and native AMICA tokens on the destination chain
 * @dev Implements upgradeable pattern using OpenZeppelin's upgradeable contracts
 *
 * This contract serves as a bridge wrapper that:
 * - Accepts bridged AMICA tokens and mints equivalent native AMICA tokens (wrap)
 * - Burns native AMICA tokens and returns equivalent bridged AMICA tokens (unwrap)
 * - Maintains security through reentrancy guards and pausability
 * - Tracks total inflows and outflows for accounting and security purposes
 *
 * @custom:security-contact kasumi-null@yandex.com
 */
contract AmicaBridgeWrapper is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    /// @notice The ERC20 token representing bridged AMICA from Ethereum
    IERC20 public bridgedAmicaToken;

    /// @notice The native AMICA token contract on this chain with mint/burn capabilities
    IAmicaToken public nativeAmicaToken;

    /// @notice Total amount of bridged tokens that have been wrapped
    uint256 public totalBridgedIn;

    /// @notice Total amount of bridged tokens that have been unwrapped
    uint256 public totalBridgedOut;

    /**
     * @dev Reserved storage space to allow for layout changes in the future.
     * This is a best practice for upgradeable contracts to prevent storage collision.
     */
    uint256[50] private __gap;

    /**
     * @notice Emitted when bridged tokens are wrapped for native tokens
     * @param user The address that wrapped tokens
     * @param amount The amount of tokens wrapped
     */
    event TokensWrapped(address indexed user, uint256 amount);

    /**
     * @notice Emitted when native tokens are unwrapped for bridged tokens
     * @param user The address that unwrapped tokens
     * @param amount The amount of tokens unwrapped
     */
    event TokensUnwrapped(address indexed user, uint256 amount);

    /**
     * @notice Emitted when tokens are withdrawn in an emergency
     * @param token The address of the token withdrawn
     * @param to The recipient of the withdrawn tokens
     * @param amount The amount of tokens withdrawn
     */
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);

    /**
     * @notice Emitted when bridge token addresses are updated
     * @param oldBridgedToken The previous bridged token address
     * @param newBridgedToken The new bridged token address
     * @param newNativeToken The new native token address
     */
    event BridgeTokensUpdated(address indexed oldBridgedToken, address indexed newBridgedToken, address indexed newNativeToken);

    /**
     * @dev Prevents implementation contract from being initialized.
     * @custom:oz-upgrades-unsafe-allow constructor
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the bridge wrapper contract
     * @dev Can only be called once during deployment via proxy
     * @param _bridgedAmicaToken Address of the bridged AMICA token from Ethereum
     * @param _nativeAmicaToken Address of the native AMICA token on this chain
     * @param _owner Address that will own this contract
     * @custom:requirement _bridgedAmicaToken must be a valid ERC20 token contract
     * @custom:requirement _nativeAmicaToken must implement IAmicaToken interface
     * @custom:requirement Both token addresses must be different
     */
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
     * @notice Pauses all wrap and unwrap operations
     * @dev Only callable by contract owner. Emergency function to halt operations.
     * Does not affect emergency withdrawal functionality.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resumes all wrap and unwrap operations
     * @dev Only callable by contract owner after operations have been paused
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Wraps bridged AMICA tokens to receive native AMICA tokens
     * @dev User must approve this contract to spend their bridged tokens before calling
     * @param amount The amount of bridged tokens to wrap (must be greater than 0)
     *
     * Process:
     * 1. Transfers bridged tokens from user to this contract
     * 2. Mints equivalent amount of native tokens to user
     * 3. Updates total bridged in counter
     *
     * @custom:requirement User must have sufficient bridged token balance
     * @custom:requirement User must have approved this contract for the amount
     * @custom:emits TokensWrapped
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
     * @notice Unwraps native AMICA tokens to receive bridged AMICA tokens
     * @dev User must approve the native token contract to burn their tokens
     * @param amount The amount of native tokens to unwrap (must be greater than 0)
     *
     * Process:
     * 1. Burns native tokens from user's balance
     * 2. Transfers equivalent bridged tokens from contract to user
     * 3. Updates total bridged out counter
     *
     * @custom:requirement User must have sufficient native token balance
     * @custom:requirement User must have approved native token for burning
     * @custom:requirement Contract must have sufficient bridged tokens
     * @custom:emits TokensUnwrapped
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
     * @notice Returns the current balance of bridged tokens held by this contract
     * @return The amount of bridged AMICA tokens in the contract
     */
    function bridgedBalance() external view returns (uint256) {
        return bridgedAmicaToken.balanceOf(address(this));
    }

    /**
     * @notice Emergency function to recover tokens from the contract
     * @dev Can only withdraw non-AMICA tokens or excess AMICA tokens beyond what's owed to users
     * @param token The address of the token to withdraw
     * @param to The address to receive the withdrawn tokens
     * @param amount The amount of tokens to withdraw
     *
     * For bridged AMICA tokens:
     * - Can only withdraw excess beyond (totalBridgedIn - totalBridgedOut)
     * - This ensures user funds remain protected
     *
     * For other tokens:
     * - Can withdraw any amount (useful for recovering accidentally sent tokens)
     *
     * @custom:requirement `to` cannot be zero address
     * @custom:requirement For bridged AMICA, amount cannot exceed excess balance
     * @custom:callable-when-paused Emergency function remains accessible when paused
     * @custom:emits EmergencyWithdraw
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
     * @notice Updates the bridge token addresses (emergency migration function)
     * @dev Extremely sensitive function that should only be used in emergency scenarios
     * such as token contract migrations or critical security updates
     * @param _bridgedAmicaToken New address for the bridged AMICA token
     * @param _nativeAmicaToken New address for the native AMICA token
     *
     * @custom:requirement Contract must be paused before calling
     * @custom:requirement New addresses must be non-zero and different from each other
     * @custom:security Critical function - ensure proper governance/timelock controls
     * @custom:emits BridgeTokensUpdated
     */
    function updateBridgeTokens(
        address _bridgedAmicaToken,
        address _nativeAmicaToken
    ) external onlyOwner whenPaused {
        if (_bridgedAmicaToken == address(0)) revert InvalidBridgedToken();
        if (_nativeAmicaToken == address(0)) revert InvalidNativeToken();
        if (_bridgedAmicaToken == _nativeAmicaToken) revert TokensMustBeDifferent();

        address oldBridgedToken = address(bridgedAmicaToken);

        bridgedAmicaToken = IERC20(_bridgedAmicaToken);
        nativeAmicaToken = IAmicaToken(_nativeAmicaToken);

        emit BridgeTokensUpdated(oldBridgedToken, _bridgedAmicaToken, _nativeAmicaToken);
    }
}
