// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

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
 * @notice Main AMICA token with burn-and-claim mechanism for deposited tokens
 * @dev Implements a fair distribution mechanism where burning AMICA gives proportional share of deposited tokens
 */
contract AmicaToken is ERC20Upgradeable, ERC20BurnableUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    // State variables
    address[] private _depositedTokens;
    mapping(address => uint256) public tokenIndex;
    mapping(address => uint256) public depositedBalances;

    // Bridge wrapper contract (can be set post-deployment)
    address public bridgeWrapper;

    // Constants
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 private constant PRECISION = 1e18;

    // Gap for future upgrades
    uint256[50] private __gap;

    // Events
    event TokensWithdrawn(address indexed to, uint256 amount);
    event TokensRecovered(address indexed to, address indexed token, uint256 amount);
    event TokensDeposited(address indexed depositor, address indexed token, uint256 amount);
    event TokensBurnedAndClaimed(address indexed user, uint256 amountBurned, address[] tokens, uint256[] amounts);
    event BridgeWrapperSet(address indexed wrapper);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract (called by proxy)
     * @param initialOwner Address of the initial owner
     */
    function initialize(address initialOwner) external initializer virtual {
        __ERC20_init("Amica", "AMICA");
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();

        // Only mint on Ethereum mainnet
        // On other chains, supply starts at 0 and is minted via bridge wrapper
        if (block.chainid == 1) {
            _mint(address(this), TOTAL_SUPPLY);
        }

        _depositedTokens.push(address(0)); // Reserve index 0
    }

    /**
     * @notice Set the bridge wrapper contract address
     * @param _bridgeWrapper Address of the bridge wrapper contract
     */
    function setBridgeWrapper(address _bridgeWrapper) external onlyOwner {
        if (_bridgeWrapper == address(0)) revert InvalidWrapperAddress();
        bridgeWrapper = _bridgeWrapper;
        emit BridgeWrapperSet(_bridgeWrapper);
    }

    /**
     * @notice Mint tokens (only callable by bridge wrapper on non-mainnet chains)
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external virtual {
        if (msg.sender != bridgeWrapper) revert OnlyBridgeWrapper();
        if (block.chainid == 1) revert CannotMintOnMainnet();
        _mint(to, amount);
    }

    /**
     * @notice Get circulating supply (total minus contract balance)
     */
    function circulatingSupply() public view returns (uint256) {
        return totalSupply() - balanceOf(address(this));
    }

    /**
     * @notice Get all deposited token addresses
     */
    function getDepositedTokens() external view returns (address[] memory) {
        return _depositedTokens;
    }

    /**
     * @notice Withdraw AMICA tokens from contract
     * @param to Recipient address
     * @param amount Amount to withdraw
     */
    function withdraw(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert InvalidRecipient();
        if (amount > balanceOf(address(this))) revert InsufficientBalance();

        _transfer(address(this), to, amount);
        emit TokensWithdrawn(to, amount);
    }

    /**
     * @notice Recover accidentally sent tokens (not deposited ones)
     * @param token Token address to recover
     * @param to Recipient address
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
     * @notice Deposit tokens for distribution
     * @param token Token address to deposit
     * @param amount Amount to deposit
     */
    function deposit(address token, uint256 amount) external nonReentrant {
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
     * @notice Burn AMICA and claim proportional share of specified tokens
     * @param amountToBurn Amount of AMICA to burn
     * @param tokenIndexes Indexes of tokens to claim (must be sorted in ascending order and unique)
     */
    function burnAndClaim(uint256 amountToBurn, uint256[] calldata tokenIndexes)
        external
        nonReentrant
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

        address[] memory claimedTokens = new address[](tokenIndexes.length);
        uint256[] memory claimedAmounts = new uint256[](tokenIndexes.length);
        uint256 validClaims = 0;

        // Process claims
        for (uint256 i = 0; i < tokenIndexes.length; i++) {
            if (tokenIndexes[i] >= _depositedTokens.length) revert InvalidTokenIndex();

            address tokenAddress = _depositedTokens[tokenIndexes[i]];
            if (tokenAddress == address(0)) continue;

            uint256 deposited = depositedBalances[tokenAddress];
            if (deposited == 0) continue;

            uint256 claimAmount = (deposited * sharePercentage) / PRECISION;
            if (claimAmount == 0) continue;

            // Update state before transfer
            depositedBalances[tokenAddress] -= claimAmount;

            // Transfer tokens
            if (!IERC20(tokenAddress).transfer(msg.sender, claimAmount)) revert TransferFailed();

            claimedTokens[validClaims] = tokenAddress;
            claimedAmounts[validClaims] = claimAmount;
            validClaims++;
        }

        if (validClaims == 0) revert NoTokensToClaim();

        // Burn AMICA tokens
        _burn(msg.sender, amountToBurn);

        // Emit event with actual claimed tokens
        assembly {
            mstore(claimedTokens, validClaims)
            mstore(claimedAmounts, validClaims)
        }

        emit TokensBurnedAndClaimed(msg.sender, amountToBurn, claimedTokens, claimedAmounts);
    }
}
