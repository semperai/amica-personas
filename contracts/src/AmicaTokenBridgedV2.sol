// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AmicaTokenBridged} from "./AmicaTokenBridged.sol";

/**
 * @title AmicaTokenBridgedV2
 * @author Kasumi
 * @notice V2 upgrade of AmicaTokenBridged for testing upgrade mechanism
 * @dev Inherits all V1 functionality and adds upgradeTest() for verification
 */
contract AmicaTokenBridgedV2 is AmicaTokenBridged {
    /**
     * @notice Returns a confirmation string to verify successful upgrade to V2
     * @return A string confirming the upgrade was successful
     */
    function upgradeTest() external pure returns (string memory) {
        return "Upgrade success";
    }

    /**
     * @notice Returns the version of this contract
     * @return The version number as a string
     */
    function version() external pure returns (string memory) {
        return "2.0.0";
    }
}
