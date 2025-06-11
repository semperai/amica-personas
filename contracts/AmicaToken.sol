// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AmicaToken is ERC20, ERC20Burnable, Ownable {
    address[] public tokens; // IMPORTANT: read from [1]
    mapping(address => uint256) public tokenToIndexes;
    // this is used as a cache for balances of tokens deposited
    mapping(address => uint256) public tokenToBalances;

    event Withdrawn(address indexed to, uint256 amount);
    event Recovered(address indexed to, address indexed token, uint256 amount);
    event Deposited(address indexed user, address indexed token, uint256 amount);
    event BurnedAndClaimed(address indexed user, uint256 amount, uint256[] indexes);

    constructor(address _initialOwner) ERC20("Amica", "AMICA") Ownable(_initialOwner) {
        _mint(address(this), 1_000_000_000 ether);
        tokens.push(address(0x0)); // skip first index (because 0 is reserved for no token)
    }

    /// @notice Withdraw tokens from the contract
    /// @dev Only the owner can withdraw tokens
    /// @param to The address to withdraw tokens to
    /// @param amount The amount of tokens to withdraw
    /// @dev This function can be used to withdraw any ERC20 tokens held by the contract
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Cannot withdraw to zero address");
        transfer(to, amount);
        emit Withdrawn(to, amount);
    }

    /// @notice Recover tokens from the contract
    /// @dev Only the owner can recover tokens sent by mistake
    /// @param to The address to recover tokens to
    /// @param tokenAddress The address of the token to recover
    function recover(address to, address tokenAddress) external onlyOwner {
        require(to != address(0), "Cannot recover to zero address");
        IERC20 token = IERC20(tokenAddress);
        uint256 amount = token.balanceOf(address(this)) - tokenToBalances[tokenAddress];
        require(amount > 0, "No tokens to recover");
        token.transfer(to, amount);
        emit Recovered(to, tokenAddress, amount);
    }

    /// @notice Get the total circulating supply of AMICA tokens
    /// @dev Circulating supply is total supply minus the balance held by the contract itself
    /// @return The total circulating supply of AMICA tokens
    function circulatingSupply() external view returns (uint256) {
        return totalSupply() - balanceOf(address(this));
    }

    /// @notice Deposit tokens into the contract
    /// @dev These will be distributed when burning AMICA tokens
    /// @param tokenAddress The address of the ERC20 token to deposit
    /// @param amount The amount of tokens to deposit
    function deposit(address tokenAddress, uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");
        // require(address(token) != address(this), "Cannot deposit AMICA tokens");
        IERC20 token = IERC20(tokenAddress);
        token.transferFrom(msg.sender, address(this), amount);
        if (tokenToIndexes[address(token)] == 0) {
            tokens.push(address(token));
            tokenToIndexes[address(token)] = tokens.length - 1;
        }
        tokenToBalances[address(token)] += amount;
        emit Deposited(msg.sender, address(token), amount);
    }

    /// @notice Burn AMICA tokens and claim proportional amounts of deposited tokens
    /// @dev The amount of AMICA tokens burned determines the share of each deposited token claimed
    /// @param amount The amount of AMICA tokens to burn
    /// @param indexes The indexes of the deposited tokens to claim
    function burnAndClaim(uint256 amount, uint256[] calldata indexes) external {
        // convert amount into range 0..1eth for shares
        uint256 shares = (amount * 1 ether) / this.circulatingSupply();

        for (uint256 i = 0; i < indexes.length; i++) {
            address tokenAddress = tokens[indexes[i]];
            uint256 balance = tokenToBalances[tokenAddress];
            if (balance > 0) {
                // convert shares into claim amount based on balance
                uint256 claimAmount = (shares * balance) / 1 ether;
                IERC20(tokenAddress).transfer(msg.sender, claimAmount);
                tokenToBalances[tokenAddress] -= claimAmount;
            }
        }

        _burn(msg.sender, amount);
        emit BurnedAndClaimed(msg.sender, amount, indexes);
    }
}
