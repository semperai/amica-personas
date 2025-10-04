// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

// Import all contracts
import {AmicaTokenMainnet} from "../src/AmicaTokenMainnet.sol";
import {PersonaToken} from "../src/PersonaToken.sol";
import {PersonaTokenFactory} from "../src/PersonaTokenFactory.sol";
import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";
import {FeeReductionSystem} from "../src/FeeReductionSystem.sol";
import {PersonaFactoryViewer} from "../src/PersonaFactoryViewer.sol";
import {BondingCurve} from "../src/BondingCurve.sol";

// Import OpenZeppelin upgrades
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {Options} from "openzeppelin-foundry-upgrades/Options.sol";

// Import Uniswap V4 interfaces
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from
    "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";

// For hook deployment
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

// Import configuration
import {DeployConfig} from "./DeployConfig.s.sol";

/**
 * @title DeployAmicaProtocol
 * @notice Main deployment script for the Amica Protocol
 * @dev Handles upgradeable proxy deployments and all contract configurations
 */
contract DeployAmicaProtocol is DeployConfig {
    // ============ Deployed Contracts ============

    AmicaTokenMainnet public amicaToken;
    PersonaToken public personaTokenImpl;
    PersonaTokenFactory public personaFactory;
    DynamicFeeHook public dynamicFeeHook;
    FeeReductionSystem public feeReductionSystem;
    PersonaFactoryViewer public personaFactoryViewer;
    BondingCurve public bondingCurve;

    // ============ Deployment Addresses ============

    struct DeploymentAddresses {
        address amicaToken;
        address amicaTokenImpl;
        address personaFactory;
        address personaFactoryImpl;
        address personaFactoryViewer;
        address proxyAdmin;
        address personaToken;
        address feeReductionSystem;
        address dynamicFeeHook;
        address bondingCurve;
    }

    DeploymentAddresses public addresses;

    // ============ Events ============

    event DeploymentCompleted(
        uint256 chainId,
        address deployer,
        DeploymentAddresses addresses,
        uint256 blockNumber
    );

    // ============ Main Deployment Function ============

    function run() public returns (DeploymentAddresses memory) {
        // Get network configuration
        NetworkConfig memory config = getNetworkConfig();

        // Get deployer from private key
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console2.log("========================================");
        console2.log("Deploying Amica Protocol");
        console2.log("========================================");
        console2.log("Network:", config.networkName);
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Balance:", deployer.balance / 1e18, "ETH");
        console2.log("");
        console2.log("Using Configuration:");
        console2.log("  Pool Manager:", config.poolManager);
        console2.log("  Position Manager:", config.positionManager);
        console2.log("  Mint Cost:", config.defaultMintCost / 1e18, "AMICA");
        console2.log(
            "  Graduation Threshold:",
            config.defaultGraduationThreshold / 1e18,
            "AMICA"
        );
        console2.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy in correct order
        _deployAmicaToken(deployer, config);
        _deployPersonaTokenImplementation();
        _deployBondingCurve();
        _deployDynamicFeeHook(config);
        _deployPersonaFactory(deployer, config);
        _deployFeeReductionSystem();
        _linkFeeReductionSystem();
        _deployPersonaFactoryViewer();

        vm.stopBroadcast();

        // Log deployment summary
        _logDeploymentSummary();

        // Emit deployment event
        emit DeploymentCompleted(
            block.chainid, deployer, addresses, block.number
        );

        // Save deployment JSON
        _saveDeploymentJson(deployer, config);

        return addresses;
    }

    // ============ Individual Deployment Functions ============

    function _deployAmicaToken(address deployer, NetworkConfig memory config)
        internal
    {
        console2.log("Deploying AmicaToken...");

        // Deploy using OpenZeppelin Upgrades plugin
        Options memory opts;
        opts.defender.useDefenderDeploy = false; // Set to true if using Defender

        address proxy = Upgrades.deployUUPSProxy(
            "AmicaTokenMainnet.sol",
            abi.encodeCall(
                AmicaTokenMainnet.initialize,
                (deployer, config.amicaTotalSupply)
            ),
            opts
        );

        amicaToken = AmicaTokenMainnet(proxy);
        addresses.amicaToken = proxy;
        addresses.amicaTokenImpl = Upgrades.getImplementationAddress(proxy);
        addresses.proxyAdmin = Upgrades.getAdminAddress(proxy);

        console2.log("  AmicaToken proxy:", proxy);
        console2.log("  Implementation:", addresses.amicaTokenImpl);
        console2.log("  ProxyAdmin:", addresses.proxyAdmin);
        console2.log("");
    }

    function _deployPersonaTokenImplementation() internal {
        console2.log("Deploying PersonaToken implementation...");

        personaTokenImpl = new PersonaToken();
        addresses.personaToken = address(personaTokenImpl);

        console2.log("  PersonaToken impl:", address(personaTokenImpl));
        console2.log("");
    }

    function _deployBondingCurve() internal {
        console2.log("Deploying BondingCurve...");

        bondingCurve = new BondingCurve();
        addresses.bondingCurve = address(bondingCurve);

        console2.log("  BondingCurve:", address(bondingCurve));
        console2.log("");
    }

    function _deployDynamicFeeHook(NetworkConfig memory config) internal {
        console2.log("Deploying DynamicFeeHook...");

        // Mine and deploy the hook
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG);
        bytes memory constructorArgs = abi.encode(config.poolManager);

        (address hookAddress, bytes32 salt) = HookMiner.find(
            config.create2Deployer,
            flags,
            type(DynamicFeeHook).creationCode,
            constructorArgs
        );

        // Check if already deployed
        if (hookAddress.code.length > 0) {
            console2.log("  Hook already deployed at:", hookAddress);
            dynamicFeeHook = DynamicFeeHook(hookAddress);
            addresses.dynamicFeeHook = hookAddress;
            return;
        }

        // Deploy the hook using CREATE2
        dynamicFeeHook =
            new DynamicFeeHook{salt: salt}(IPoolManager(config.poolManager));

        require(address(dynamicFeeHook) == hookAddress, "Hook address mismatch");
        addresses.dynamicFeeHook = hookAddress;

        console2.log("  DynamicFeeHook:", hookAddress);
        console2.log("  Salt:", uint256(salt));
        console2.log("");
    }

    function _deployPersonaFactory(
        address, /* deployer */
        NetworkConfig memory config
    ) internal {
        console2.log("Deploying PersonaTokenFactory...");

        Options memory opts;
        opts.defender.useDefenderDeploy = false;

        address proxy = Upgrades.deployUUPSProxy(
            "PersonaTokenFactory.sol",
            abi.encodeCall(
                PersonaTokenFactory.initialize,
                (
                    address(amicaToken),
                    config.poolManager,
                    config.positionManager,
                    config.permit2,
                    address(dynamicFeeHook),
                    address(personaTokenImpl),
                    address(bondingCurve)
                )
            ),
            opts
        );

        personaFactory = PersonaTokenFactory(proxy);
        addresses.personaFactory = proxy;
        addresses.personaFactoryImpl = Upgrades.getImplementationAddress(proxy);

        console2.log("  PersonaFactory proxy:", proxy);
        console2.log("  Implementation:", addresses.personaFactoryImpl);
        console2.log("");
    }

    function _deployFeeReductionSystem() internal {
        console2.log("Deploying FeeReductionSystem...");

        feeReductionSystem = new FeeReductionSystem(amicaToken, personaFactory);
        addresses.feeReductionSystem = address(feeReductionSystem);

        console2.log("  FeeReductionSystem:", address(feeReductionSystem));
        console2.log("");
    }

    function _linkFeeReductionSystem() internal {
        console2.log("Linking FeeReductionSystem to DynamicFeeHook...");

        dynamicFeeHook.setFeeReductionSystem(address(feeReductionSystem));

        console2.log("  FeeReductionSystem set on hook");
        console2.log("");
    }

    function _deployPersonaFactoryViewer() internal {
        console2.log("Deploying PersonaFactoryViewer...");

        personaFactoryViewer = new PersonaFactoryViewer(address(personaFactory));
        addresses.personaFactoryViewer = address(personaFactoryViewer);

        console2.log("  PersonaFactoryViewer:", address(personaFactoryViewer));
        console2.log("");
    }

    // ============ Helper Functions ============

    function _logDeploymentSummary() internal view {
        console2.log("");
        console2.log("========================================");
        console2.log("Deployment Summary");
        console2.log("========================================");
        console2.log("AmicaToken:", addresses.amicaToken);
        console2.log("PersonaFactory:", addresses.personaFactory);
        console2.log("BondingCurve:", addresses.bondingCurve);
        console2.log("FeeReductionSystem:", addresses.feeReductionSystem);
        console2.log("DynamicFeeHook:", addresses.dynamicFeeHook);
        console2.log("PersonaFactoryViewer:", addresses.personaFactoryViewer);
        console2.log("ProxyAdmin:", addresses.proxyAdmin);
        console2.log("========================================");
    }

    function _saveDeploymentJson(address deployer, NetworkConfig memory config)
        internal
    {
        string memory json = _buildDeploymentJson(deployer, config);

        string memory filename = string.concat(
            "deployments/",
            config.networkName,
            "-",
            vm.toString(block.chainid),
            "-latest.json"
        );

        vm.writeJson(json, filename);
        console2.log("");
        console2.log("Deployment saved to:", filename);
    }

    function _buildDeploymentJson(address deployer, NetworkConfig memory config)
        internal
        returns (string memory)
    {
        string memory obj = "deployment";

        // Metadata
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeString(obj, "network", config.networkName);
        vm.serializeAddress(obj, "deployer", deployer);
        vm.serializeUint(obj, "blockNumber", block.number);
        vm.serializeUint(obj, "timestamp", block.timestamp);

        // Configuration used
        string memory configObj = "config";
        vm.serializeAddress(configObj, "poolManager", config.poolManager);
        vm.serializeAddress(
            configObj, "positionManager", config.positionManager
        );
        vm.serializeUint(configObj, "defaultMintCost", config.defaultMintCost);
        string memory finalConfigObj = vm.serializeUint(
            configObj,
            "defaultGraduationThreshold",
            config.defaultGraduationThreshold
        );

        // Serialize addresses
        string memory addressObj = "addresses";
        vm.serializeAddress(addressObj, "amicaToken", addresses.amicaToken);
        vm.serializeAddress(
            addressObj, "amicaTokenImpl", addresses.amicaTokenImpl
        );
        vm.serializeAddress(
            addressObj, "personaFactory", addresses.personaFactory
        );
        vm.serializeAddress(
            addressObj, "personaFactoryImpl", addresses.personaFactoryImpl
        );
        vm.serializeAddress(
            addressObj, "personaFactoryViewer", addresses.personaFactoryViewer
        );
        vm.serializeAddress(addressObj, "proxyAdmin", addresses.proxyAdmin);
        vm.serializeAddress(addressObj, "personaToken", addresses.personaToken);
        vm.serializeAddress(
            addressObj, "feeReductionSystem", addresses.feeReductionSystem
        );
        vm.serializeAddress(
            addressObj, "dynamicFeeHook", addresses.dynamicFeeHook
        );
        string memory finalAddressObj = vm.serializeAddress(
            addressObj, "bondingCurve", addresses.bondingCurve
        );

        // Combine all objects
        vm.serializeString(obj, "config", finalConfigObj);
        string memory finalJson =
            vm.serializeString(obj, "addresses", finalAddressObj);

        return finalJson;
    }
}
