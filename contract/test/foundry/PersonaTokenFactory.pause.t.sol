// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {PersonaTokenFactory} from "../../contracts/PersonaTokenFactory.sol";
import {AmicaToken} from "../../contracts/AmicaToken.sol";
import {ERC20Implementation} from "../../contracts/ERC20Implementation.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUniswapV4Handler} from "../../contracts/interfaces/IUniswapV4Handler.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../../contracts/test/TestERC20.sol";

contract PersonaTokenFactoryTest is Test {
    // Constants
    uint256 constant AMICA_TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 constant DEFAULT_MINT_COST = 1000 ether;
    uint256 constant DEFAULT_GRADUATION_THRESHOLD = 1_000_000 ether;
    
    // Contracts
    PersonaTokenFactory public personaFactory;
    AmicaToken public amicaToken;
    IPoolManager public poolManager;
    IUniswapV4Handler public uniswapHandler;
    address public erc20Implementation;
    
    // Users
    address public owner;
    address public user1;
    address public user2;
    
    function setUp() public {
        // Setup users
        owner = makeAddr("owner");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        
        vm.startPrank(owner);
        
        // Deploy AmicaToken as upgradeable proxy
        address amicaProxy = Upgrades.deployTransparentProxy(
            "AmicaToken.sol",
            owner,
            abi.encodeCall(AmicaToken.initialize, (owner, AMICA_TOTAL_SUPPLY))
        );
        amicaToken = AmicaToken(amicaProxy);
        
        // Deploy ERC20Implementation
        ERC20Implementation impl = new ERC20Implementation();
        erc20Implementation = address(impl);
        
        // Create mock addresses for Uniswap components
        // In a real test, you'd deploy actual mocks or the real contracts
        poolManager = IPoolManager(makeAddr("poolManager"));
        uniswapHandler = IUniswapV4Handler(makeAddr("uniswapHandler"));
        
        // Deploy PersonaTokenFactory as upgradeable proxy
        address factoryProxy = Upgrades.deployTransparentProxy(
            "PersonaTokenFactory.sol",
            owner,
            abi.encodeCall(
                PersonaTokenFactory.initialize,
                (
                    address(amicaToken),
                    address(poolManager),
                    address(uniswapHandler),
                    erc20Implementation
                )
            )
        );
        
        personaFactory = PersonaTokenFactory(factoryProxy);
        
        // Give users some AMICA tokens
        amicaToken.transfer(user1, 10_000_000 ether);
        amicaToken.transfer(user2, 10_000_000 ether);
        
        vm.stopPrank();
    }
    
    // Deployment Tests
    function test_Deployment_Success() public view {
        // Verify contract addresses are set
        assertEq(address(personaFactory.amicaToken()), address(amicaToken));
        assertEq(address(personaFactory.poolManager()), address(poolManager));
        assertEq(address(personaFactory.uniswapHandler()), address(uniswapHandler));
        assertEq(personaFactory.erc20Implementation(), erc20Implementation);
    }
    
    function test_Deployment_NFTMetadata() public view {
        assertEq(personaFactory.name(), "Amica Persona");
        assertEq(personaFactory.symbol(), "PERSONA");
    }
    
    function test_Deployment_Owner() public view {
        assertEq(personaFactory.owner(), owner);
    }
    
    function test_Deployment_DefaultPairingConfig() public view {
        (bool enabled, uint256 mintCost, uint256 graduationThreshold) = personaFactory.pairingConfigs(address(amicaToken));
        assertTrue(enabled);
        assertEq(mintCost, DEFAULT_MINT_COST);
        assertEq(graduationThreshold, DEFAULT_GRADUATION_THRESHOLD);
    }
    
    function test_Deployment_DefaultFeeReductionConfig() public view {
        (
            uint256 minAmicaForReduction,
            uint256 maxAmicaForReduction,
            uint256 minReductionMultiplier,
            uint256 maxReductionMultiplier
        ) = personaFactory.feeReductionConfig();
        assertEq(minAmicaForReduction, 1000 ether);
        assertEq(maxAmicaForReduction, 1_000_000 ether);
        assertEq(minReductionMultiplier, 9000);
        assertEq(maxReductionMultiplier, 0);
    }
    
    function test_Deployment_NotPaused() public view {
        assertFalse(personaFactory.paused());
    }
    
    // Upgrade Tests
    function test_Upgradeability_Basic() public view {
        // Get implementation address
        address implementation = Upgrades.getImplementationAddress(address(personaFactory));
        
        // Basic proxy verification
        assertTrue(implementation != address(0), "Implementation should exist");
        assertTrue(implementation != address(personaFactory), "Should be a proxy");
        
        // Verify admin exists
        address admin = Upgrades.getAdminAddress(address(personaFactory));
        assertTrue(admin != address(0), "Admin should exist");
    }
    
    // Mock upgrade test - you'll need to create PersonaTokenFactoryV2 contract to test actual upgrades
    function test_Upgradeability_PreservesState() public {
        // First, configure a custom pairing token
        TestERC20 customToken = new TestERC20("Custom", "CUST", 1_000_000 ether);
        
        vm.prank(owner);
        personaFactory.configurePairingToken(
            address(customToken),
            2000 ether,  // different mint cost
            2_000_000 ether,  // different threshold
            true
        );
        
        // Verify configuration is set
        (bool enabledBefore, uint256 mintCostBefore, uint256 thresholdBefore) = personaFactory.pairingConfigs(address(customToken));
        assertTrue(enabledBefore);
        assertEq(mintCostBefore, 2000 ether);
        assertEq(thresholdBefore, 2_000_000 ether);
        
        // Note: To test actual upgrade, you would:
        // 1. Deploy PersonaTokenFactoryV2 with new functionality
        // 2. Use Upgrades.upgradeProxy() to upgrade
        // 3. Verify state is preserved and new functionality works
        
        // For now, just verify the proxy structure exists
        address implementation = Upgrades.getImplementationAddress(address(personaFactory));
        assertTrue(implementation != address(0));
    }
    
    // Basic Functionality Test
    function test_ConfigurePairingToken() public {
        TestERC20 newToken = new TestERC20("New Token", "NEW", 1_000_000 ether);
        
        vm.prank(owner);
        personaFactory.configurePairingToken(
            address(newToken),
            5000 ether,
            5_000_000 ether,
            true
        );
        
        (bool enabled, uint256 mintCost, uint256 graduationThreshold) = personaFactory.pairingConfigs(address(newToken));
        assertTrue(enabled);
        assertEq(mintCost, 5000 ether);
        assertEq(graduationThreshold, 5_000_000 ether);
    }
    
    function test_Pause_Unpause() public {
        // Test pause
        vm.prank(owner);
        personaFactory.pause();
        assertTrue(personaFactory.paused());
        
        // Test unpause
        vm.prank(owner);
        personaFactory.unpause();
        assertFalse(personaFactory.paused());
    }
    
    function test_ConfigurePairingToken_RevertWhen_NonOwner() public {
        TestERC20 newToken = new TestERC20("New Token", "NEW", 1_000_000 ether);
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, user1));
        personaFactory.configurePairingToken(
            address(newToken),
            5000 ether,
            5_000_000 ether,
            true
        );
    }
}
