// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import {PersonaTokenFactory} from "../src/PersonaTokenFactory.sol";
import {AmicaToken} from "../src/AmicaToken.sol";
import {FeeReductionSystem} from "../src/FeeReductionSystem.sol";
import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";
import {BondingCurve} from "../src/BondingCurve.sol";
import {IBondingCurve} from "../src/interfaces/IBondingCurve.sol";
import {DeployConfig} from "./DeployConfig.s.sol";

/**
 * @title DeployUtils
 * @notice Utility scripts for post-deployment configuration and management
 */
contract DeployUtils is DeployConfig {
    /**
     * @notice Configure pairing tokens after deployment
     */
    function configurePairingTokens() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        NetworkConfig memory config = getNetworkConfig();

        // Load deployment
        string memory filename = string.concat(
            "deployments/",
            config.networkName,
            "-",
            vm.toString(block.chainid),
            "-latest.json"
        );
        string memory json = vm.readFile(filename);
        address factoryAddress =
            vm.parseJsonAddress(json, ".addresses.personaFactory");
        PersonaTokenFactory factory = PersonaTokenFactory(factoryAddress);

        vm.startBroadcast(deployerPrivateKey);

        // Configure USDC as pairing token
        address USDC = getTokenAddress(block.chainid, "USDC");
        if (USDC != address(0)) {
            factory.configurePairingToken(
                USDC,
                100e6, // 100 USDC mint cost (6 decimals)
                100_000e6, // 100k USDC graduation threshold
                true
            );
            console2.log("Configured USDC as pairing token:", USDC);
        } else {
            console2.log("USDC not configured for this chain");
        }

        // Configure WETH as pairing token
        address WETH = getTokenAddress(block.chainid, "WETH");
        if (WETH != address(0)) {
            factory.configurePairingToken(
                WETH,
                0.05 ether, // 0.05 ETH mint cost
                5 ether, // 5 ETH graduation threshold
                true
            );
            console2.log("Configured WETH as pairing token:", WETH);
        } else {
            console2.log("WETH not configured for this chain");
        }

        vm.stopBroadcast();
    }

    /**
     * @notice Update fee reduction configuration
     */
    function updateFeeReduction() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        NetworkConfig memory config = getNetworkConfig();

        // Load deployment
        string memory filename = string.concat(
            "deployments/",
            config.networkName,
            "-",
            vm.toString(block.chainid),
            "-latest.json"
        );
        string memory json = vm.readFile(filename);
        address feeSystemAddress =
            vm.parseJsonAddress(json, ".addresses.feeReductionSystem");
        FeeReductionSystem feeSystem = FeeReductionSystem(feeSystemAddress);

        vm.startBroadcast(deployerPrivateKey);

        feeSystem.configureFeeReduction(
            1000 ether, // Min AMICA: 1,000
            1_000_000 ether, // Max AMICA: 1,000,000
            10000, // Base fee: 1%
            1000 // Max discount fee: 0.1%
        );

        console2.log("Updated fee reduction configuration");

        vm.stopBroadcast();
    }

    /**
     * @notice Distribute initial AMICA tokens
     */
    function distributeTokens() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        NetworkConfig memory config = getNetworkConfig();

        // Load deployment
        string memory filename = string.concat(
            "deployments/",
            config.networkName,
            "-",
            vm.toString(block.chainid),
            "-latest.json"
        );
        string memory json = vm.readFile(filename);
        address amicaAddress =
            vm.parseJsonAddress(json, ".addresses.amicaToken");
        AmicaToken amica = AmicaToken(amicaAddress);

        // Define distribution
        address[] memory recipients = new address[](4);
        uint256[] memory amounts = new uint256[](4);

        recipients[0] = 0x1234567890123456789012345678901234567890; // Treasury
        amounts[0] = 300_000_000 ether; // 30%

        recipients[1] = 0x2345678901234567890123456789012345678901; // Team
        amounts[1] = 200_000_000 ether; // 20%

        recipients[2] = 0x3456789012345678901234567890123456789012; // Community
        amounts[2] = 400_000_000 ether; // 40%

        recipients[3] = 0x4567890123456789012345678901234567890123; // Liquidity
        amounts[3] = 100_000_000 ether; // 10%

        vm.startBroadcast(deployerPrivateKey);

        for (uint256 i = 0; i < recipients.length; i++) {
            amica.transfer(recipients[i], amounts[i]);
            console2.log(
                "Transferred", amounts[i] / 1e18, "AMICA to", recipients[i]
            );
        }

        vm.stopBroadcast();
    }

    /**
     * @notice Helper function to load deployment JSON
     */
    function _loadDeploymentJson() internal view returns (string memory) {
        NetworkConfig memory config = getNetworkConfig();
        string memory filename = string.concat(
            "deployments/",
            config.networkName,
            "-",
            vm.toString(block.chainid),
            "-latest.json"
        );
        return vm.readFile(filename);
    }

    /**
     * @notice Pause/Unpause contracts in emergency
     */
    function pauseContracts(bool pause) public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Load deployment
        string memory json = _loadDeploymentJson();
        address amicaAddress =
            vm.parseJsonAddress(json, ".addresses.amicaToken");
        address factoryAddress =
            vm.parseJsonAddress(json, ".addresses.personaFactory");

        AmicaToken amica = AmicaToken(amicaAddress);
        PersonaTokenFactory factory = PersonaTokenFactory(factoryAddress);

        vm.startBroadcast(deployerPrivateKey);

        if (pause) {
            amica.pause();
            factory.pause();
            console2.log("Contracts paused");
        } else {
            amica.unpause();
            factory.unpause();
            console2.log("Contracts unpaused");
        }

        vm.stopBroadcast();
    }

    /**
     * @notice Transfer ownership of contracts
     */
    function transferOwnership(address newOwner) public {
        require(newOwner != address(0), "Invalid owner");

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Load deployment
        string memory json = _loadDeploymentJson();
        address amicaAddress =
            vm.parseJsonAddress(json, ".addresses.amicaToken");
        address factoryAddress =
            vm.parseJsonAddress(json, ".addresses.personaFactory");
        address feeSystemAddress =
            vm.parseJsonAddress(json, ".addresses.feeReductionSystem");
        address hookAddress =
            vm.parseJsonAddress(json, ".addresses.dynamicFeeHook");

        vm.startBroadcast(deployerPrivateKey);

        AmicaToken(amicaAddress).transferOwnership(newOwner);
        console2.log("AmicaToken ownership transferred");

        PersonaTokenFactory(factoryAddress).transferOwnership(newOwner);
        console2.log("PersonaFactory ownership transferred");

        FeeReductionSystem(feeSystemAddress).transferOwnership(newOwner);
        console2.log("FeeReductionSystem ownership transferred");

        DynamicFeeHook(hookAddress).transferOwnership(newOwner);
        console2.log("DynamicFeeHook ownership transferred");

        vm.stopBroadcast();

        console2.log("All ownerships transferred to:", newOwner);
    }

    /**
     * @notice Check deployment health
     */
    function checkDeployment() public view {
        // Load deployment
        string memory json = _loadDeploymentJson();

        address amicaAddress =
            vm.parseJsonAddress(json, ".addresses.amicaToken");
        address factoryAddress =
            vm.parseJsonAddress(json, ".addresses.personaFactory");
        address feeSystemAddress =
            vm.parseJsonAddress(json, ".addresses.feeReductionSystem");
        address hookAddress =
            vm.parseJsonAddress(json, ".addresses.dynamicFeeHook");
        address bondingCurveAddress =
            vm.parseJsonAddress(json, ".addresses.bondingCurve");

        console2.log("=== Deployment Health Check ===");
        console2.log("");

        // Check contract sizes
        console2.log("Contract sizes:");
        console2.log("  AmicaToken:", amicaAddress.code.length, "bytes");
        console2.log("  PersonaFactory:", factoryAddress.code.length, "bytes");
        console2.log(
            "  FeeReductionSystem:", feeSystemAddress.code.length, "bytes"
        );
        console2.log("  DynamicFeeHook:", hookAddress.code.length, "bytes");
        console2.log(
            "  BondingCurve:", bondingCurveAddress.code.length, "bytes"
        );
        console2.log("");

        // Check key configurations
        AmicaToken amica = AmicaToken(amicaAddress);
        PersonaTokenFactory factory = PersonaTokenFactory(factoryAddress);
        FeeReductionSystem feeSystem = FeeReductionSystem(feeSystemAddress);

        console2.log("Key configurations:");
        console2.log("  AMICA total supply:", amica.totalSupply() / 1e18);
        console2.log("  Factory owner:", factory.owner());
        console2.log("  Factory paused:", factory.paused());
        console2.log("  Bonding curve:", address(factory.bondingCurve()));

        (uint256 minAmica, uint256 maxAmica, uint24 baseFee, uint24 discountFee)
        = feeSystem.feeReductionConfig();
        console2.log("  Fee reduction:");
        console2.log("    Min AMICA:", minAmica / 1e18);
        console2.log("    Max AMICA:", maxAmica / 1e18);
        console2.log("    Base fee:", baseFee, "/ 1M");
        console2.log("    Discount fee:", discountFee, "/ 1M");
    }
}
