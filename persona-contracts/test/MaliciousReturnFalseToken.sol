// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MaliciousReturnFalseToken
 * @notice ERC20 that returns false instead of reverting
 */
contract MaliciousReturnFalseToken is ERC20 {
    constructor() ERC20("False Token", "FALSE") {
        _mint(msg.sender, 1000000 ether);
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public override returns (bool) {
        // Simulate insufficient balance by returning false
        if (amount > balanceOf(from)) {
            return false; // Should revert, but returns false instead
        }
        return super.transferFrom(from, to, amount);
    }
}
