// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import {AmicaTokenBridged} from "../src/AmicaTokenBridged.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {Options} from "openzeppelin-foundry-upgrades/Options.sol";

/**
 * @title DeployAmicaBridged
 * @notice Deployment script for AMICA token on Arbitrum One and Base
 * @dev Deploys AmicaTokenBridged using CREATE2 for deterministic address matching mainnet
 */
contract DeployAmicaBridged is Script {
    struct DeploymentResult {
        address proxy;
        address implementation;
        address proxyAdmin;
        uint256 chainId;
        uint256 blockNumber;
        string network;
    }

    function run() external returns (DeploymentResult memory) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        string memory network = _getNetworkName();

        console2.log("========================================");
        console2.log("Deploying AMICA Token (Bridged)");
        console2.log("========================================");
        console2.log("Network:", network);
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance / 1e18, "ETH");
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy using OpenZeppelin Upgrades plugin with CREATE2
        Options memory opts;
        opts.defender.useDefenderDeploy = false;
        opts.unsafeSkipAllChecks = false;

        console2.log("Deploying AmicaTokenBridged...");

        address proxy = Upgrades.deployUUPSProxy(
            "AmicaTokenBridged.sol",
            abi.encodeCall(AmicaTokenBridged.initialize, (deployer)),
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
            blockNumber: block.number,
            network: network
        });

        // Save deployment
        _saveDeployment(result);

        console2.log("========================================");
        console2.log("Deployment Complete!");
        console2.log("========================================");
        console2.log("AMICA Token:", proxy);
        console2.log("");
        console2.log("Next steps:");
        console2.log(
            "1. Configure deposit tokens using configureToken() function"
        );
        console2.log("2. Set appropriate exchange rates for each token");
        console2.log("3. Verify the contract on block explorer");
        console2.log("========================================");

        return result;
    }

    function _getNetworkName() internal view returns (string memory) {
        if (block.chainid == 42161) return "Arbitrum One";
        if (block.chainid == 8453) return "Base";
        if (block.chainid == 421614) return "Arbitrum Sepolia";
        if (block.chainid == 84532) return "Base Sepolia";
        return "Unknown";
    }

    function _saveDeployment(DeploymentResult memory result) internal {
        string memory obj = "deployment";

        vm.serializeString(obj, "network", result.network);
        vm.serializeUint(obj, "chainId", result.chainId);
        vm.serializeUint(obj, "blockNumber", result.blockNumber);
        vm.serializeAddress(obj, "proxy", result.proxy);
        vm.serializeAddress(obj, "implementation", result.implementation);
        string memory finalJson =
            vm.serializeAddress(obj, "proxyAdmin", result.proxyAdmin);

        string memory filename = string.concat(
            "deployments/amica-bridged-", vm.toString(result.chainId), ".json"
        );

        vm.writeJson(finalJson, filename);
        console2.log("Deployment saved to:", filename);
        console2.log("");
    }

    /**
     * @notice Helper function to configure a deposit token after deployment
     * @dev Run this with: forge script script/DeployAmicaBridged.s.sol --sig "configureDepositToken(address,address,bool,uint256,uint8)" <proxy> <token> <enabled> <rate> <decimals>
     */
    function configureDepositToken(
        address amicaProxy,
        address token,
        bool enabled,
        uint256 exchangeRate,
        uint8 decimals
    ) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console2.log("========================================");
        console2.log("Configuring Deposit Token");
        console2.log("========================================");
        console2.log("AMICA Proxy:", amicaProxy);
        console2.log("Token:", token);
        console2.log("Enabled:", enabled);
        console2.log("Exchange Rate:", exchangeRate);
        console2.log("Decimals:", decimals);
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        AmicaTokenBridged(amicaProxy).configureToken(
            token, enabled, exchangeRate, decimals
        );

        vm.stopBroadcast();

        console2.log("Token configured successfully!");
        console2.log("========================================");
    }
}
