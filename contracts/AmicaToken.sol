pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AmicaToken
 * @notice Main AMICA token with burn-and-claim mechanism for deposited tokens
 * @dev Implements a fair distribution mechanism where burning AMICA gives proportional share of deposited tokens
 */
contract AmicaToken is ERC20, ERC20Burnable, Ownable, ReentrancyGuard {
    // State variables
    address[] private _depositedTokens;
    mapping(address => uint256) public tokenIndex;
    mapping(address => uint256) public depositedBalances;

    // Constants
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 private constant PRECISION = 1e18;

    // Events
    event TokensWithdrawn(address indexed to, uint256 amount);
    event TokensRecovered(address indexed to, address indexed token, uint256 amount);
    event TokensDeposited(address indexed depositor, address indexed token, uint256 amount);
    event TokensBurnedAndClaimed(address indexed user, uint256 amountBurned, address[] tokens, uint256[] amounts);

    constructor(address initialOwner)
        ERC20("Amica", "AMICA")
        Ownable(initialOwner)
    {
        _mint(address(this), TOTAL_SUPPLY);
        _depositedTokens.push(address(0)); // Reserve index 0
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
        require(to != address(0), "Invalid recipient");
        require(amount <= balanceOf(address(this)), "Insufficient balance");

        _transfer(address(this), to, amount);
        emit TokensWithdrawn(to, amount);
    }

    /**
     * @notice Recover accidentally sent tokens (not deposited ones)
     * @param token Token address to recover
     * @param to Recipient address
     */
    function recoverToken(address token, address to) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(token != address(this), "Cannot recover AMICA");

        IERC20 tokenContract = IERC20(token);
        uint256 contractBalance = tokenContract.balanceOf(address(this));
        uint256 recoverable = contractBalance - depositedBalances[token];

        require(recoverable > 0, "No tokens to recover");

        require(tokenContract.transfer(to, recoverable), "Transfer failed");
        emit TokensRecovered(to, token, recoverable);
    }

    /**
     * @notice Deposit tokens for distribution
     * @param token Token address to deposit
     * @param amount Amount to deposit
     */
    function deposit(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "Invalid amount");
        require(token != address(0), "Invalid token");

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
     * @param tokenIndexes Indexes of tokens to claim
     */
    function burnAndClaim(uint256 amountToBurn, uint256[] calldata tokenIndexes)
        external
        nonReentrant
    {
        require(amountToBurn > 0, "Invalid burn amount");
        require(tokenIndexes.length > 0, "No tokens selected");

        uint256 currentCirculating = circulatingSupply();
        require(currentCirculating > 0, "No circulating supply");

        // Calculate share (with precision scaling)
        uint256 sharePercentage = (amountToBurn * PRECISION) / currentCirculating;

        address[] memory claimedTokens = new address[](tokenIndexes.length);
        uint256[] memory claimedAmounts = new uint256[](tokenIndexes.length);
        uint256 validClaims = 0;

        // Process claims
        for (uint256 i = 0; i < tokenIndexes.length; i++) {
            require(tokenIndexes[i] < _depositedTokens.length, "Invalid token index");

            address tokenAddress = _depositedTokens[tokenIndexes[i]];
            if (tokenAddress == address(0)) continue;

            uint256 deposited = depositedBalances[tokenAddress];
            if (deposited == 0) continue;

            uint256 claimAmount = (deposited * sharePercentage) / PRECISION;
            if (claimAmount == 0) continue;

            // Update state before transfer
            depositedBalances[tokenAddress] -= claimAmount;

            // Transfer tokens
            require(IERC20(tokenAddress).transfer(msg.sender, claimAmount), "Transfer failed");

            claimedTokens[validClaims] = tokenAddress;
            claimedAmounts[validClaims] = claimAmount;
            validClaims++;
        }

        require(validClaims > 0, "No tokens to claim");

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
