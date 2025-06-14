// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../AmicaToken.sol";

/**
 * @title AmicaTokenMainnetMock
 * @notice Mock contract for testing mainnet behavior without actually being on mainnet
 * @dev Forces the contract to behave as if chainId == 1
 */
contract AmicaTokenMainnetMock is AmicaToken {
    constructor(address initialOwner) AmicaToken(initialOwner) {
        // Force mint as if on mainnet regardless of actual chainId
        if (totalSupply() == 0) {
            _mint(address(this), TOTAL_SUPPLY);
        }
    }
    
    /**
     * @notice Override mint to simulate mainnet behavior
     * @dev Always reverts with mainnet error message
     */
    function mint(address to, uint256 amount) external override {
        require(msg.sender == bridgeWrapper, "Only bridge wrapper can mint");
        revert("Cannot mint on mainnet");
    }
}
