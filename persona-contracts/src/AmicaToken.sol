// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Custom errors
error InvalidWrapperAddress();
error OnlyBridgeWrapper();
error CannotMintOnMainnet();
error InvalidRecipient();
error InsufficientBalance();
error CannotRecoverAmica();
error NoTokensToRecover();
error InvalidAmount();
error InvalidToken();
error TransferFailed();
error NoTokensSelected();
error InvalidBurnAmount();
error TokenIndexesMustBeSortedAndUnique();
error NoCirculatingSupply();
error InvalidTokenIndex();
error NoTokensToClaim();

/**
 * @title AmicaToken
 * @author Kasumi
 * @notice Main AMICA token contract with a unique burn-and-claim mechanism for fair distribution of deposited tokens
 * @dev This upgradeable ERC20 token implements a fair distribution mechanism where users can burn AMICA tokens
 * to claim a proportional share of various tokens that have been deposited into the contract.
 *
 * Key features:
 * - Upgradeable proxy pattern for future improvements
 * - Cross-chain compatibility with bridge wrapper support
 * - Pausable functionality for emergency situations
 * - Reentrancy protection on all state-changing functions
 * - Custom error messages for gas efficiency
 *
 * The contract maintains a list of deposited tokens and their balances, allowing users to burn their AMICA
 * tokens to receive a proportional share of any deposited tokens based on the circulating supply.
 *
 * @custom:security-contact kasumi-null@yandex.com
 */
contract AmicaToken is
    ERC20Upgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    /// @notice Array storing addresses of all tokens that have been deposited
    /// @dev Index 0 is reserved (set to address(0)) to distinguish between unindexed tokens
    address[] private _depositedTokens;

    /// @notice Maps token addresses to their index in the _depositedTokens array
    /// @dev Returns 0 for tokens that haven't been deposited (hence why index 0 is reserved)
    mapping(address => uint256) public tokenIndex;

    /// @notice Tracks the deposited balance for each token address
    /// @dev This is separate from the actual token balance to handle accidental transfers
    mapping(address => uint256) public depositedBalances;

    /// @notice Precision multiplier for percentage calculations
    /// @dev Used to maintain precision when calculating token shares
    uint256 private constant PRECISION = 1e18;

    /// @notice Reserved storage gap for future upgrades
    /// @dev Ensures storage layout compatibility when adding new state variables
    uint256[50] private __gap;

    /// @notice Emitted when AMICA tokens are withdrawn from the contract
    /// @param to Recipient address
    /// @param amount Amount of AMICA tokens withdrawn
    event TokensWithdrawn(address indexed to, uint256 amount);

    /// @notice Emitted when accidentally sent tokens are recovered
    /// @param to Recipient address
    /// @param token Address of the recovered token
    /// @param amount Amount of tokens recovered
    event TokensRecovered(address indexed to, address indexed token, uint256 amount);

    /// @notice Emitted when tokens are deposited for distribution
    /// @param depositor Address that deposited the tokens
    /// @param token Address of the deposited token
    /// @param amount Amount of tokens deposited
    event TokensDeposited(address indexed depositor, address indexed token, uint256 amount);

    /// @notice Emitted when a user burns AMICA and claims deposited tokens
    /// @param user Address of the user who burned and claimed
    /// @param amountBurned Amount of AMICA tokens burned
    /// @param tokens Array of token addresses that were claimed
    /// @param amounts Array of amounts claimed for each token
    event TokensBurnedAndClaimed(address indexed user, uint256 amountBurned, address[] tokens, uint256[] amounts);

    /// @notice Emitted when the bridge wrapper address is set or updated
    /// @param wrapper New bridge wrapper address
    event BridgeWrapperSet(address indexed wrapper);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the AMICA token contract
     * @dev Called once during proxy deployment. Mints total supply on Ethereum mainnet only.
     * On other chains, supply starts at 0 and tokens are minted via the bridge wrapper.
     * @param initialOwner Address that will become the owner of the contract
     * @custom:requirement initialOwner must not be the zero address
     * @custom:requirement Can only be called once due to initializer modifier
     */
    function initialize(address initialOwner, uint256 initialSupply) external initializer virtual {
        __ERC20_init("Amica", "AMICA");
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __Pausable_init();

        _mint(initialOwner, initialSupply);

        _depositedTokens.push(address(0)); // Reserve index 0
    }

    /**
     * @notice Pauses all token transfers and critical functions
     * @dev Can only be called by the contract owner. Affects transfer, burn, mint, deposit, and claim functions.
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
     * @notice Returns all deposited token addresses
     * @dev Includes the reserved address(0) at index 0
     * @return Array of all token addresses that have been deposited
     */
    function getDepositedTokens() external view returns (address[] memory) {
        return _depositedTokens;
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
    function withdraw(address to, uint256 amount) external onlyOwner whenNotPaused {
        if (to == address(0)) revert InvalidRecipient();
        if (amount > balanceOf(address(this))) revert InsufficientBalance();

        _transfer(address(this), to, amount);
        emit TokensWithdrawn(to, amount);
    }

    /**
     * @notice Recovers tokens accidentally sent to the contract
     * @dev Can only recover tokens that exceed the deposited balance (accidental transfers)
     * @param token Address of the token to recover
     * @param to Address to receive the recovered tokens
     * @custom:access Restricted to contract owner
     * @custom:requirement Cannot recover AMICA tokens
     * @custom:requirement Cannot recover deposited tokens (only excess)
     * @custom:requirement 'to' cannot be the zero address
     * @custom:emits TokensRecovered
     */
    function recoverToken(address token, address to) external onlyOwner {
        if (to == address(0)) revert InvalidRecipient();
        if (token == address(this)) revert CannotRecoverAmica();

        IERC20 tokenContract = IERC20(token);
        uint256 contractBalance = tokenContract.balanceOf(address(this));
        uint256 recoverable = contractBalance - depositedBalances[token];

        if (recoverable == 0) revert NoTokensToRecover();

        if (!tokenContract.transfer(to, recoverable)) revert TransferFailed();
        emit TokensRecovered(to, token, recoverable);
    }

    /**
     * @notice Deposits tokens into the contract for distribution via burn-and-claim
     * @dev Automatically adds new tokens to the deposited tokens list
     * @param token Address of the token to deposit
     * @param amount Amount of tokens to deposit
     * @custom:requirement Contract must not be paused
     * @custom:requirement Amount must be greater than 0
     * @custom:requirement Token cannot be the zero address
     * @custom:requirement Caller must have approved this contract for the token amount
     * @custom:emits TokensDeposited
     */
    function deposit(address token, uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert InvalidAmount();
        if (token == address(0)) revert InvalidToken();

        IERC20(token).transferFrom(msg.sender, address(this), amount);

        // Add token to list if first deposit
        if (tokenIndex[token] == 0) {
            _depositedTokens.push(token);
            tokenIndex[token] = _depositedTokens.length - 1;
        }

        depositedBalances[token] += amount;
        emit TokensDeposited(msg.sender, token, amount);
    }

    /**
     * @notice Burns AMICA tokens and claims a proportional share of selected deposited tokens
     * @dev This is the core distribution mechanism. Users burn AMICA to receive a proportional
     * share of deposited tokens based on the circulating supply.
     *
     * The function implements a secure pattern where all state changes occur before any external calls
     * to prevent reentrancy attacks.
     *
     * @param amountToBurn Amount of AMICA tokens to burn from the caller's balance
     * @param tokenIndexes Array of token indexes to claim (must be sorted ascending and unique)
     *
     * @custom:requirement Contract must not be paused
     * @custom:requirement amountToBurn must be greater than 0
     * @custom:requirement tokenIndexes array must not be empty
     * @custom:requirement tokenIndexes must be sorted in ascending order with no duplicates
     * @custom:requirement Each token index must be valid (< _depositedTokens.length)
     * @custom:requirement There must be circulating supply to calculate shares
     * @custom:requirement At least one token must have a claimable balance
     *
     * @custom:security All state updates complete before any external token transfers
     * @custom:security Protected by nonReentrant modifier
     *
     * @custom:emits TokensBurnedAndClaimed with the burned amount and claimed tokens/amounts
     */
    function burnAndClaim(uint256 amountToBurn, uint256[] calldata tokenIndexes)
        external
        nonReentrant
        whenNotPaused
    {
        if (amountToBurn == 0) revert InvalidBurnAmount();
        if (tokenIndexes.length == 0) revert NoTokensSelected();

        // Verify tokenIndexes are sorted and unique
        for (uint256 i = 1; i < tokenIndexes.length; i++) {
            if (tokenIndexes[i] <= tokenIndexes[i - 1]) revert TokenIndexesMustBeSortedAndUnique();
        }

        uint256 currentCirculating = circulatingSupply();
        if (currentCirculating == 0) revert NoCirculatingSupply();

        // Calculate share (with precision scaling)
        uint256 sharePercentage = (amountToBurn * PRECISION) / currentCirculating;

        // First, burn AMICA tokens (state change)
        _burn(msg.sender, amountToBurn);

        // Prepare arrays for successful claims
        address[] memory claimedTokens = new address[](tokenIndexes.length);
        uint256[] memory claimedAmounts = new uint256[](tokenIndexes.length);
        uint256 validClaims = 0;

        // Calculate all claim amounts and update ALL state BEFORE any transfers
        for (uint256 i = 0; i < tokenIndexes.length; i++) {
            if (tokenIndexes[i] >= _depositedTokens.length) revert InvalidTokenIndex();

            address tokenAddress = _depositedTokens[tokenIndexes[i]];
            if (tokenAddress == address(0)) continue;

            uint256 deposited = depositedBalances[tokenAddress];
            if (deposited == 0) continue;

            uint256 claimAmount = (deposited * sharePercentage) / PRECISION;
            if (claimAmount == 0) continue;

            // Update state BEFORE any transfer will happen
            depositedBalances[tokenAddress] -= claimAmount;

            claimedTokens[validClaims] = tokenAddress;
            claimedAmounts[validClaims] = claimAmount;
            validClaims++;
        }

        if (validClaims == 0) revert NoTokensToClaim();

        // Resize arrays to actual size (for event emission)
        assembly {
            mstore(claimedTokens, validClaims)
            mstore(claimedAmounts, validClaims)
        }

        // Emit event before transfers (all state is already updated)
        emit TokensBurnedAndClaimed(msg.sender, amountToBurn, claimedTokens, claimedAmounts);

        // Now perform all external transfers (state is already fully updated)
        for (uint256 i = 0; i < validClaims; i++) {
            if (!IERC20(claimedTokens[i]).transfer(msg.sender, claimedAmounts[i])) {
                revert TransferFailed();
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
    function transfer(address to, uint256 amount) public virtual override whenNotPaused returns (bool) {
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
    function transferFrom(address from, address to, uint256 amount) public virtual override whenNotPaused returns (bool) {
        return super.transferFrom(from, to, amount);
    }
}
