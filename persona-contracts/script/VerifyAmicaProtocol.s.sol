// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console2.sol";
import {DeployConfig} from "./DeployConfig.s.sol";

/**
 * @title VerifyAmicaProtocol
 * @notice Separate script for verifying deployed contracts
 */
contract VerifyAmicaProtocol is Script, DeployConfig {
    function run() public view {
        // Get network name from config
        NetworkConfig memory config = getNetworkConfig();
        string memory networkName = config.networkName;

        // Load deployment from JSON
        string memory filename =
            string.concat("deployments/", networkName, "-", vm.toString(block.chainid), "-latest.json");
        string memory json = vm.readFile(filename);

        address amicaToken = vm.parseJsonAddress(json, ".addresses.amicaToken");
        address personaFactory = vm.parseJsonAddress(json, ".addresses.personaFactory");
        address feeReductionSystem = vm.parseJsonAddress(json, ".addresses.feeReductionSystem");
        address dynamicFeeHook = vm.parseJsonAddress(json, ".addresses.dynamicFeeHook");
        address personaFactoryViewer = vm.parseJsonAddress(json, ".addresses.personaFactoryViewer");

        console2.log("Verifying contracts on", networkName, "...");
        console2.log("AmicaToken:", amicaToken);
        console2.log("PersonaFactory:", personaFactory);
        console2.log("FeeReductionSystem:", feeReductionSystem);
        console2.log("DynamicFeeHook:", dynamicFeeHook);
        console2.log("PersonaFactoryViewer:", personaFactoryViewer);

        // Add verification logic here
        // You can use forge verify-contract commands or Etherscan API
    }
}
