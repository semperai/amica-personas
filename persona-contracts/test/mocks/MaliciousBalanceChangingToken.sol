// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MaliciousBalanceChangingToken
 * @notice Token that changes balances during transfers
 */
contract MaliciousBalanceChangingToken is ERC20 {
    constructor() ERC20("Balance Changer", "CHANGE") {
        _mint(msg.sender, 1000000 ether);
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        // Mint extra tokens during transfer
        _mint(to, amount / 10); // Mint 10% extra
        return super.transferFrom(from, to, amount);
    }

    function balanceOf(address account) public view override returns (uint256) {
        // Return different values on consecutive calls
        if (block.number % 2 == 0) {
            return super.balanceOf(account);
        } else {
            return super.balanceOf(account) * 2;
        }
    }
}
