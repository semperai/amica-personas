// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import {AmicaToken} from "../src/AmicaToken.sol";
import {PersonaTokenFactory} from "../src/PersonaTokenFactory.sol";

import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {Options} from "openzeppelin-foundry-upgrades/Options.sol";

/**
 * @title UpgradeAmicaProtocol
 * @notice Script for upgrading Amica Protocol contracts
 * @dev Handles UUPS proxy upgrades for AmicaToken and PersonaTokenFactory
 */
contract UpgradeAmicaProtocol is Script {
    enum ContractType {
        AmicaToken,
        PersonaFactory
    }

    function run() public {
        // Example: Upgrade AmicaToken
        upgradeContract(ContractType.AmicaToken);
    }

    function upgradeContract(ContractType contractType) public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        // address deployer = vm.addr(deployerPrivateKey); // Unused for now

        // Load deployment addresses
        string memory json = vm.readFile("deployments/8453-latest.json");

        vm.startBroadcast(deployerPrivateKey);

        if (contractType == ContractType.AmicaToken) {
            _upgradeAmicaToken(json);
        } else if (contractType == ContractType.PersonaFactory) {
            _upgradePersonaFactory(json);
        }

        vm.stopBroadcast();
    }

    function _upgradeAmicaToken(string memory deploymentJson) internal {
        address proxyAddress = vm.parseJsonAddress(deploymentJson, ".addresses.amicaToken");

        console2.log("Upgrading AmicaToken at:", proxyAddress);
        console2.log("Current implementation:", Upgrades.getImplementationAddress(proxyAddress));

        Options memory opts;
        opts.defender.useDefenderDeploy = false;

        // Upgrade to new implementation
        Upgrades.upgradeProxy(
            proxyAddress,
            "AmicaToken.sol",
            "", // No reinitializer call needed
            opts
        );

        console2.log("New implementation:", Upgrades.getImplementationAddress(proxyAddress));
        console2.log("Upgrade complete!");

        // Update deployment JSON with new implementation address
        _updateDeploymentJson(deploymentJson, "amicaTokenImpl", Upgrades.getImplementationAddress(proxyAddress));
    }

    function _upgradePersonaFactory(string memory deploymentJson) internal {
        address proxyAddress = vm.parseJsonAddress(deploymentJson, ".addresses.personaFactory");

        console2.log("Upgrading PersonaTokenFactory at:", proxyAddress);
        console2.log("Current implementation:", Upgrades.getImplementationAddress(proxyAddress));

        Options memory opts;
        opts.defender.useDefenderDeploy = false;

        // Upgrade to new implementation
        Upgrades.upgradeProxy(
            proxyAddress,
            "PersonaTokenFactory.sol",
            "", // No reinitializer call needed
            opts
        );

        console2.log("New implementation:", Upgrades.getImplementationAddress(proxyAddress));
        console2.log("Upgrade complete!");

        // Update deployment JSON with new implementation address
        _updateDeploymentJson(deploymentJson, "personaFactoryImpl", Upgrades.getImplementationAddress(proxyAddress));
    }

    function _updateDeploymentJson(string memory, /* deploymentJson */ string memory key, address newValue)
        internal
        pure
    {
        // This is a simplified version - you might want to implement full JSON update
        console2.log("Updated", key, "to", newValue);
        // In practice, you'd read the full JSON, update the value, and write it back
    }
}
