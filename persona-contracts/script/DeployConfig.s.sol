// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {AddressConstants} from "hookmate/constants/AddressConstants.sol";
import {DeployAmicaProtocol} from "./DeployAmicaProtocol.s.sol";

/**
 * @title DeployConfig
 * @notice Configuration for different network deployments using AddressConstants
 */
abstract contract DeployConfig is Script {
    struct NetworkConfig {
        address poolManager;
        address positionManager;
        address create2Deployer;
        uint256 amicaTotalSupply;
        uint256 defaultMintCost;
        uint256 defaultGraduationThreshold;
        string networkName;
    }

    // Constants
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    uint256 constant AMICA_TOTAL_SUPPLY = 1_000_000_000 ether;

    function getNetworkConfig() public view returns (NetworkConfig memory) {
        return getNetworkConfig(block.chainid);
    }

    function getNetworkConfig(uint256 chainId) public pure returns (NetworkConfig memory) {
        NetworkConfig memory config;

        // Set common values
        config.create2Deployer = CREATE2_DEPLOYER;
        config.amicaTotalSupply = AMICA_TOTAL_SUPPLY;

        // Set chain-specific configurations
        if (chainId == 1) {
            // Ethereum Mainnet
            config.networkName = "mainnet";
            config.defaultMintCost = 1000 ether;
            config.defaultGraduationThreshold = 1_000_000 ether;
            config.poolManager = AddressConstants.getPoolManagerAddress(chainId);
            config.positionManager = AddressConstants.getPositionManagerAddress(chainId);
        } else if (chainId == 8453) {
            // Base Mainnet
            config.networkName = "base";
            config.defaultMintCost = 1000 ether;
            config.defaultGraduationThreshold = 1_000_000 ether;
            config.poolManager = AddressConstants.getPoolManagerAddress(chainId);
            config.positionManager = AddressConstants.getPositionManagerAddress(chainId);
        } else if (chainId == 84532) {
            // Base Sepolia
            config.networkName = "base-sepolia";
            config.defaultMintCost = 100 ether;
            config.defaultGraduationThreshold = 10_000 ether;
            config.poolManager = AddressConstants.getPoolManagerAddress(chainId);
            config.positionManager = AddressConstants.getPositionManagerAddress(chainId);
        } else if (chainId == 10) {
            // Optimism
            config.networkName = "optimism";
            config.defaultMintCost = 1000 ether;
            config.defaultGraduationThreshold = 1_000_000 ether;
            config.poolManager = AddressConstants.getPoolManagerAddress(chainId);
            config.positionManager = AddressConstants.getPositionManagerAddress(chainId);
        } else if (chainId == 42161) {
            // Arbitrum One
            config.networkName = "arbitrum";
            config.defaultMintCost = 1000 ether;
            config.defaultGraduationThreshold = 1_000_000 ether;
            config.poolManager = AddressConstants.getPoolManagerAddress(chainId);
            config.positionManager = AddressConstants.getPositionManagerAddress(chainId);
        } else if (chainId == 137) {
            // Polygon
            config.networkName = "polygon";
            config.defaultMintCost = 1000 ether;
            config.defaultGraduationThreshold = 1_000_000 ether;
            config.poolManager = AddressConstants.getPoolManagerAddress(chainId);
            config.positionManager = AddressConstants.getPositionManagerAddress(chainId);
        } else if (chainId == 11155111) {
            // Sepolia
            config.networkName = "sepolia";
            config.defaultMintCost = 100 ether;
            config.defaultGraduationThreshold = 10_000 ether;
            config.poolManager = AddressConstants.getPoolManagerAddress(chainId);
            config.positionManager = AddressConstants.getPositionManagerAddress(chainId);
        } else if (chainId == 421614) {
            // Arbitrum Sepolia
            config.networkName = "arbitrum-sepolia";
            config.defaultMintCost = 100 ether;
            config.defaultGraduationThreshold = 10_000 ether;
            config.poolManager = AddressConstants.getPoolManagerAddress(chainId);
            config.positionManager = AddressConstants.getPositionManagerAddress(chainId);
        } else if (chainId == 81457) {
            // Blast
            config.networkName = "blast";
            config.defaultMintCost = 1000 ether;
            config.defaultGraduationThreshold = 1_000_000 ether;
            config.poolManager = AddressConstants.getPoolManagerAddress(chainId);
            config.positionManager = AddressConstants.getPositionManagerAddress(chainId);
        } else if (chainId == 7777777) {
            // Zora
            config.networkName = "zora";
            config.defaultMintCost = 1000 ether;
            config.defaultGraduationThreshold = 1_000_000 ether;
            config.poolManager = AddressConstants.getPoolManagerAddress(chainId);
            config.positionManager = AddressConstants.getPositionManagerAddress(chainId);
        } else if (chainId == 480) {
            // Worldchain
            config.networkName = "worldchain";
            config.defaultMintCost = 1000 ether;
            config.defaultGraduationThreshold = 1_000_000 ether;
            config.poolManager = AddressConstants.getPoolManagerAddress(chainId);
            config.positionManager = AddressConstants.getPositionManagerAddress(chainId);
        } else if (chainId == 56) {
            // BNB Smart Chain
            config.networkName = "bsc";
            config.defaultMintCost = 1000 ether;
            config.defaultGraduationThreshold = 1_000_000 ether;
            config.poolManager = AddressConstants.getPoolManagerAddress(chainId);
            config.positionManager = AddressConstants.getPositionManagerAddress(chainId);
        } else if (chainId == 43114) {
            // Avalanche
            config.networkName = "avalanche";
            config.defaultMintCost = 1000 ether;
            config.defaultGraduationThreshold = 1_000_000 ether;
            config.poolManager = AddressConstants.getPoolManagerAddress(chainId);
            config.positionManager = AddressConstants.getPositionManagerAddress(chainId);
        } else if (chainId == 130) {
            // Unichain
            config.networkName = "unichain";
            config.defaultMintCost = 1000 ether;
            config.defaultGraduationThreshold = 1_000_000 ether;
            config.poolManager = AddressConstants.getPoolManagerAddress(chainId);
            config.positionManager = AddressConstants.getPositionManagerAddress(chainId);
        } else if (chainId == 1301) {
            // Unichain Sepolia
            config.networkName = "unichain-sepolia";
            config.defaultMintCost = 100 ether;
            config.defaultGraduationThreshold = 10_000 ether;
            config.poolManager = AddressConstants.getPoolManagerAddress(chainId);
            config.positionManager = AddressConstants.getPositionManagerAddress(chainId);
        } else if (chainId == 57073) {
            // Ink
            config.networkName = "ink";
            config.defaultMintCost = 1000 ether;
            config.defaultGraduationThreshold = 1_000_000 ether;
            config.poolManager = AddressConstants.getPoolManagerAddress(chainId);
            config.positionManager = AddressConstants.getPositionManagerAddress(chainId);
        } else if (chainId == 1868) {
            // Soneium
            config.networkName = "soneium";
            config.defaultMintCost = 1000 ether;
            config.defaultGraduationThreshold = 1_000_000 ether;
            config.poolManager = AddressConstants.getPoolManagerAddress(chainId);
            config.positionManager = AddressConstants.getPositionManagerAddress(chainId);
        } else if (chainId == 420120000) {
            // interop-alpha-0
            config.networkName = "interop-alpha-0";
            config.defaultMintCost = 100 ether;
            config.defaultGraduationThreshold = 10_000 ether;
            config.poolManager = AddressConstants.getPoolManagerAddress(chainId);
            config.positionManager = AddressConstants.getPositionManagerAddress(chainId);
        } else if (chainId == 420120001) {
            // interop-alpha-1
            config.networkName = "interop-alpha-1";
            config.defaultMintCost = 100 ether;
            config.defaultGraduationThreshold = 10_000 ether;
            config.poolManager = AddressConstants.getPoolManagerAddress(chainId);
            config.positionManager = AddressConstants.getPositionManagerAddress(chainId);
        } else if (chainId == 31337) {
            // Local Anvil
            config.networkName = "anvil";
            config.defaultMintCost = 100 ether;
            config.defaultGraduationThreshold = 1000 ether;
            // For local deployment, V4 contracts will be deployed
            config.poolManager = address(0);
            config.positionManager = address(0);
        } else {
            revert("Unsupported chain ID");
        }

        return config;
    }

    /**
     * @notice Get token addresses for specific chains
     * @dev Add chain-specific token addresses here
     */
    function getTokenAddress(uint256 chainId, string memory tokenSymbol) public pure returns (address) {
        if (chainId == 8453) {
            // Base Mainnet
            if (keccak256(bytes(tokenSymbol)) == keccak256(bytes("USDC"))) {
                return 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
            } else if (keccak256(bytes(tokenSymbol)) == keccak256(bytes("WETH"))) {
                return 0x4200000000000000000000000000000000000006;
            }
        } else if (chainId == 1) {
            // Ethereum Mainnet
            if (keccak256(bytes(tokenSymbol)) == keccak256(bytes("USDC"))) {
                return 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
            } else if (keccak256(bytes(tokenSymbol)) == keccak256(bytes("WETH"))) {
                return 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
            }
        } else if (chainId == 10) {
            // Optimism
            if (keccak256(bytes(tokenSymbol)) == keccak256(bytes("USDC"))) {
                return 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85;
            } else if (keccak256(bytes(tokenSymbol)) == keccak256(bytes("WETH"))) {
                return 0x4200000000000000000000000000000000000006;
            }
        } else if (chainId == 42161) {
            // Arbitrum One
            if (keccak256(bytes(tokenSymbol)) == keccak256(bytes("USDC"))) {
                return 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
            } else if (keccak256(bytes(tokenSymbol)) == keccak256(bytes("WETH"))) {
                return 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
            }
        } else if (chainId == 137) {
            // Polygon
            if (keccak256(bytes(tokenSymbol)) == keccak256(bytes("USDC"))) {
                return 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359; // USDC.e on Polygon
            } else if (keccak256(bytes(tokenSymbol)) == keccak256(bytes("WETH"))) {
                return 0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619;
            }
        } else if (chainId == 56) {
            // BNB Smart Chain
            if (keccak256(bytes(tokenSymbol)) == keccak256(bytes("USDC"))) {
                return 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;
            } else if (keccak256(bytes(tokenSymbol)) == keccak256(bytes("WETH"))) {
                return 0x2170Ed0880ac9A755fd29B2688956BD959F933F8; // ETH on BSC
            }
        } else if (chainId == 43114) {
            // Avalanche
            if (keccak256(bytes(tokenSymbol)) == keccak256(bytes("USDC"))) {
                return 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E;
            } else if (keccak256(bytes(tokenSymbol)) == keccak256(bytes("WETH"))) {
                return 0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB; // WETH.e on Avalanche
            }
        }

        return address(0);
    }
}

/**
 * @title DeployAmicaWithConfig
 * @notice Enhanced deployment script using network configuration
 */
contract DeployAmicaWithConfig is DeployConfig {
    // Import the main deployment script
    DeployAmicaProtocol deployScript;

    function run() public {
        NetworkConfig memory config = getNetworkConfig();

        console2.log("========================================");
        console2.log("Deploying to network:", config.networkName);
        console2.log("Chain ID:", block.chainid);
        console2.log("Pool Manager:", config.poolManager);
        console2.log("Position Manager:", config.positionManager);
        console2.log("========================================");

        // For local networks, deploy Uniswap V4 first
        if (block.chainid == 31337) {
            _deployLocalUniswapV4(config);
        }

        // Validate configuration
        require(config.poolManager != address(0), "PoolManager not configured for this chain");
        require(config.positionManager != address(0), "PositionManager not configured for this chain");

        // Deploy Amica Protocol
        deployScript = new DeployAmicaProtocol();
        deployScript.run();
    }

    function _deployLocalUniswapV4(NetworkConfig memory config) internal {
        console2.log("Deploying Uniswap V4 for local testing...");

        // Deploy PoolManager and PositionManager for local testing
        // This is a placeholder - you would need to import and deploy the actual V4 contracts
        // or use a fork of a network that already has them deployed

        console2.log("WARNING: Local V4 deployment not implemented");
        console2.log("Consider using a fork instead:");
        console2.log("  anvil --fork-url <RPC_URL>");

        revert("Local V4 deployment not implemented. Use a fork instead.");
    }
}
