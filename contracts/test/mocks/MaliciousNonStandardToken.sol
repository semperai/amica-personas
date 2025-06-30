// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title MaliciousNonStandardToken
 * @notice Token with non-standard return values
 */
contract MaliciousNonStandardToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    string public name = "Non Standard";
    string public symbol = "NONSTD";
    uint8 public decimals = 18;
    uint256 public totalSupply;

    constructor() {
        balanceOf[msg.sender] = 1000000 ether;
        totalSupply = 1000000 ether;
    }

    // Non-standard: doesn't return bool
    function transfer(address to, uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        // No return value!
    }

    // Non-standard: doesn't return bool
    function transferFrom(address from, address to, uint256 amount) external {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");

        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        // No return value!
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}
