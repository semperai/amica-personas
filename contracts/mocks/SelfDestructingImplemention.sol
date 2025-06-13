// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title SelfDestructingImplementation
 * @notice Implementation that can self-destruct
 */
contract SelfDestructingImplementation {
    bool public initialized;

    function initialize(
        string memory,
        string memory,
        uint256,
        address
    ) external {
        initialized = true;
    }

    function destroy() external {
        selfdestruct(payable(msg.sender));
    }
}