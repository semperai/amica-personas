// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../AmicaToken.sol";

/**
 * @title AmicaTokenMainnetMock
 * @notice Mock contract for testing mainnet behavior without actually being on mainnet
 * @dev Forces the contract to behave as if chainId == 1
 */
contract AmicaTokenMainnetMock is AmicaToken {
    /**
     * @notice Initialize the mock contract with mainnet behavior
     * @param initialOwner Address of the initial owner
     * @dev Overrides the parent initialize to force mainnet-like behavior
     */
    function initialize(address initialOwner) external override initializer {
        __ERC20_init("Amica", "AMICA");
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();

        // Force mint TOTAL_SUPPLY regardless of actual chainId
        // This simulates mainnet behavior even on test networks
        _mint(address(this), TOTAL_SUPPLY);
    }

    /**
     * @notice Override mint to simulate mainnet behavior
     * @dev Always reverts with mainnet error message
     */
    function mint(address to, uint256 amount) external override {
        require(msg.sender == bridgeWrapper, "Only bridge wrapper can mint");
        revert CannotMintOnMainnet();
    }
}
