// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "forge-std/console.sol";

import {Deployers} from "./Deployers.sol";

import {PersonaTokenFactory} from "../../src/PersonaTokenFactory.sol";
import {AmicaToken} from "../../src/AmicaToken.sol";
import {PersonaToken} from "../../src/PersonaToken.sol";
import {DynamicFeeHook} from "../../src/DynamicFeeHook.sol";
import {FeeReductionSystem} from "../../src/FeeReductionSystem.sol";
import {BondingCurve} from "../../src/BondingCurve.sol";

import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {Currency} from "v4-core/src/types/Currency.sol";

import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {IPositionManager} from
    "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {PositionManager} from "@uniswap/v4-periphery/src/PositionManager.sol";
import {IPositionDescriptor} from
    "@uniswap/v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {PosmTestSetup} from
    "@uniswap/v4-periphery/test/shared/PosmTestSetup.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";

import {UnsafeUpgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";

/**
 * @title Fixtures
 * @notice Base test fixture providing common setup and utilities for Amica protocol tests
 * @dev Inherits from Test, Deployers, and DeployPermit2 for comprehensive test infrastructure
 */
abstract contract Fixtures is Test, Deployers {
    uint256 constant AMICA_TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 constant DEFAULT_MINT_COST = 1000 ether;
    uint256 constant DEFAULT_GRADUATION_THRESHOLD = 1_000_000 ether;
    uint256 constant UNSUBSCRIBE_GAS_LIMIT = 300_000;

    // For hook deployment
    address constant CREATE2_DEPLOYER =
        0x4e59b44847b379578588920cA78FbF26c0B4956C;

    PersonaTokenFactory public personaFactory;
    AmicaToken public amicaToken;
    PersonaToken public personaToken;
    DynamicFeeHook public dynamicFeeHook;
    FeeReductionSystem public feeReductionSystem;
    BondingCurve public bondingCurve;

    address public factoryOwner;
    address public user1;
    address public user2;
    address public user3;

    function setUp() public virtual {
        deployArtifacts();
        deployAmicaContracts();
    }

    function deployAmicaContracts() public {
        // Setup users
        factoryOwner = makeAddr("factoryOwner");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");

        // Start deployment as factory owner
        vm.startPrank(factoryOwner);

        // Deploy all contracts in order
        _deployCore();
        _deployBondingCurve();
        _deployHook();
        _deployFactory();
        _deployFeeReductionSystem();
        _distributeTokens();

        vm.stopPrank();
    }

    // ==================== Internal Deployment Functions ====================

    function _deployCore() internal {
        // Deploy AmicaToken as upgradeable proxy
        address amicaImpl = address(new AmicaToken());
        address amicaProxy = UnsafeUpgrades.deployUUPSProxy(
            amicaImpl,
            abi.encodeCall(
                AmicaToken.initialize, (factoryOwner, AMICA_TOTAL_SUPPLY)
            )
        );
        amicaToken = AmicaToken(amicaProxy);

        // Deploy PersonaToken implementation
        personaToken = new PersonaToken();
    }

    function _deployBondingCurve() internal {
        // Deploy the bonding curve contract
        bondingCurve = new BondingCurve();
    }

    function _deployHook() internal {
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG);
        address addr = address(flags ^ (0x4444 << 144));

        bytes memory constructorArgs = abi.encode(poolManager);
        deployCodeTo("DynamicFeeHook.sol:DynamicFeeHook", constructorArgs, addr);

        // Cast to our hook interface
        dynamicFeeHook = DynamicFeeHook(addr);
    }

    function _deployFactory() internal {
        // Deploy PersonaTokenFactory as upgradeable proxy
        address factoryImpl = address(new PersonaTokenFactory());
        address factoryProxy = UnsafeUpgrades.deployUUPSProxy(
            factoryImpl,
            abi.encodeCall(
                PersonaTokenFactory.initialize,
                (
                    address(amicaToken),
                    address(poolManager), // Use the actual PoolManager
                    address(positionManager),
                    address(permit2),
                    address(dynamicFeeHook),
                    address(personaToken),
                    address(bondingCurve) // Add bonding curve address
                )
            )
        );

        personaFactory = PersonaTokenFactory(factoryProxy);
    }

    function _deployFeeReductionSystem() internal {
        feeReductionSystem = new FeeReductionSystem(amicaToken, personaFactory);

        // Set the fee reduction system in the dynamic fee hook
        dynamicFeeHook.setFeeReductionSystem(address(feeReductionSystem));
    }

    function _distributeTokens() internal {
        // Give users much more AMICA tokens to handle graduation threshold
        amicaToken.transfer(user1, 10_000_000 ether); // 10M tokens
        amicaToken.transfer(user2, 10_000_000 ether); // 10M tokens
        amicaToken.transfer(user3, 10_000_000 ether); // 10M tokens

        // IMPORTANT: Also give the test contract some tokens for when it acts as msg.sender
        amicaToken.transfer(address(this), 10_000_000 ether); // 10M tokens for test contract

        // Give users some ETH for gas
        vm.deal(factoryOwner, 100 ether);
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(user3, 100 ether);
    }
}
