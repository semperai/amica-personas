// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import {AmicaTokenMainnetV2} from "../src/AmicaTokenMainnetV2.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {Options} from "openzeppelin-foundry-upgrades/Options.sol";

/**
 * @title UpgradeAmicaMainnet
 * @notice Upgrade script for AMICA token on Ethereum mainnet to V2
 * @dev Upgrades existing AmicaTokenMainnet proxy to V2 implementation
 */
contract UpgradeAmicaMainnet is Script {
    struct UpgradeResult {
        address proxy;
        address oldImplementation;
        address newImplementation;
        uint256 chainId;
        uint256 blockNumber;
        string version;
    }

    function run() external returns (UpgradeResult memory) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address proxyAddress = vm.envAddress("AMICA_MAINNET_PROXY");

        console2.log("========================================");
        console2.log("Upgrading AMICA Token to V2 (Ethereum Mainnet)");
        console2.log("========================================");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance / 1e18, "ETH");
        console2.log("Proxy Address:", proxyAddress);
        console2.log("");

        // Get old implementation before upgrade
        address oldImplementation = Upgrades.getImplementationAddress(proxyAddress);
        console2.log("Old Implementation:", oldImplementation);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy using OpenZeppelin Upgrades plugin
        Options memory opts;
        opts.defender.useDefenderDeploy = false;
        opts.unsafeSkipAllChecks = false;

        console2.log("Upgrading to AmicaTokenMainnetV2...");

        Upgrades.upgradeProxy(
            proxyAddress,
            "AmicaTokenMainnetV2.sol",
            "",
            opts
        );

        address newImplementation = Upgrades.getImplementationAddress(proxyAddress);

        console2.log("  New Implementation:", newImplementation);
        console2.log("");

        // Verify upgrade worked
        AmicaTokenMainnetV2 upgraded = AmicaTokenMainnetV2(proxyAddress);
        string memory version = upgraded.version();
        string memory upgradeTest = upgraded.upgradeTest();

        console2.log("Upgrade verification:");
        console2.log("  Version:", version);
        console2.log("  Upgrade test:", upgradeTest);
        console2.log("");

        vm.stopBroadcast();

        UpgradeResult memory result = UpgradeResult({
            proxy: proxyAddress,
            oldImplementation: oldImplementation,
            newImplementation: newImplementation,
            chainId: block.chainid,
            blockNumber: block.number,
            version: version
        });

        // Save upgrade info
        _saveUpgrade(result);

        console2.log("========================================");
        console2.log("Upgrade Complete!");
        console2.log("========================================");
        console2.log("AMICA Token:", proxyAddress);
        console2.log("Version:", version);
        console2.log("========================================");

        return result;
    }

    function _saveUpgrade(UpgradeResult memory result) internal {
        string memory obj = "upgrade";

        vm.serializeUint(obj, "chainId", result.chainId);
        vm.serializeUint(obj, "blockNumber", result.blockNumber);
        vm.serializeAddress(obj, "proxy", result.proxy);
        vm.serializeAddress(obj, "oldImplementation", result.oldImplementation);
        vm.serializeAddress(obj, "newImplementation", result.newImplementation);
        string memory finalJson = vm.serializeString(obj, "version", result.version);

        string memory filename = string.concat(
            "deployments/amica-mainnet-upgrade-",
            vm.toString(result.chainId),
            "-",
            vm.toString(block.timestamp),
            ".json"
        );

        vm.writeJson(finalJson, filename);
        console2.log("Upgrade saved to:", filename);
        console2.log("");
    }
}
