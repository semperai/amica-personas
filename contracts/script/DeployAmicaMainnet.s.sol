// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import {AmicaTokenMainnet} from "../src/AmicaTokenMainnet.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {Options} from "openzeppelin-foundry-upgrades/Options.sol";

/**
 * @title DeployAmicaMainnet
 * @notice Deployment script for AMICA token on Ethereum mainnet
 * @dev Deploys AmicaTokenMainnet using CREATE2 for deterministic address
 */
contract DeployAmicaMainnet is Script {
    // Max supply: 1 billion tokens
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;

    struct DeploymentResult {
        address proxy;
        address implementation;
        address proxyAdmin;
        uint256 chainId;
        uint256 blockNumber;
    }

    function run() external returns (DeploymentResult memory) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("========================================");
        console2.log("Deploying AMICA Token (Ethereum Mainnet)");
        console2.log("========================================");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance / 1e18, "ETH");
        console2.log("Max Supply:", MAX_SUPPLY / 1e18, "AMICA");
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy using OpenZeppelin Upgrades plugin with CREATE2
        Options memory opts;
        opts.defender.useDefenderDeploy = false;
        opts.unsafeSkipAllChecks = false;

        console2.log("Deploying AmicaTokenMainnet...");

        address proxy = Upgrades.deployUUPSProxy(
            "AmicaTokenMainnet.sol",
            abi.encodeCall(AmicaTokenMainnet.initialize, (deployer, MAX_SUPPLY)),
            opts
        );

        address implementation = Upgrades.getImplementationAddress(proxy);
        address proxyAdmin = Upgrades.getAdminAddress(proxy);

        console2.log("  Proxy:", proxy);
        console2.log("  Implementation:", implementation);
        console2.log("  ProxyAdmin:", proxyAdmin);
        console2.log("");

        vm.stopBroadcast();

        DeploymentResult memory result = DeploymentResult({
            proxy: proxy,
            implementation: implementation,
            proxyAdmin: proxyAdmin,
            chainId: block.chainid,
            blockNumber: block.number
        });

        // Save deployment
        _saveDeployment(result);

        console2.log("========================================");
        console2.log("Deployment Complete!");
        console2.log("========================================");
        console2.log("AMICA Token:", proxy);
        console2.log("========================================");

        return result;
    }

    function _saveDeployment(DeploymentResult memory result) internal {
        string memory obj = "deployment";

        vm.serializeUint(obj, "chainId", result.chainId);
        vm.serializeUint(obj, "blockNumber", result.blockNumber);
        vm.serializeAddress(obj, "proxy", result.proxy);
        vm.serializeAddress(obj, "implementation", result.implementation);
        string memory finalJson =
            vm.serializeAddress(obj, "proxyAdmin", result.proxyAdmin);

        string memory filename = string.concat(
            "deployments/amica-mainnet-", vm.toString(result.chainId), ".json"
        );

        vm.writeJson(finalJson, filename);
        console2.log("Deployment saved to:", filename);
        console2.log("");
    }
}
