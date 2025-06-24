// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {Deployers} from "v4-core/test/utils/Deployers.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {PersonaTokenFactory} from "../src/PersonaTokenFactory.sol";
import {AmicaToken} from "../src/AmicaToken.sol";
import {PersonaToken} from "../src/PersonaToken.sol";
import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";
import {FeeReductionSystem} from "../src/FeeReductionSystem.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolManager} from "v4-core/src/PoolManager.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {PositionManager} from "@uniswap/v4-periphery/src/PositionManager.sol";
import {IPositionDescriptor} from "@uniswap/v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {DeployPermit2} from "permit2/test/utils/DeployPermit2.sol";
import {IWETH9} from "@uniswap/v4-periphery/src/interfaces/external/IWETH9.sol";
import {Currency} from "v4-core/src/types/Currency.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {MockWETH9} from "./MockWETH9.sol";
import {MockPositionDescriptor} from "./MockPositionDescriptor.sol";

/**
 * @title Fixtures
 * @notice Base test fixture providing common setup and utilities for Amica protocol tests
 * @dev Inherits from Test, Deployers, and DeployPermit2 for comprehensive test infrastructure
 */
abstract contract Fixtures is Test, Deployers, DeployPermit2 {
    // ==================== Constants ====================
    
    uint256 constant AMICA_TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 constant DEFAULT_MINT_COST = 1000 ether;
    uint256 constant DEFAULT_GRADUATION_THRESHOLD = 1_000_000 ether;
    uint256 constant UNSUBSCRIBE_GAS_LIMIT = 300_000;
    
    // For hook deployment
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    
    // ==================== Contracts ====================
    
    PersonaTokenFactory public personaFactory;
    AmicaToken public amicaToken;
    PositionManager public positionManager;
    PersonaToken public personaToken;
    DynamicFeeHook public dynamicFeeHook;
    FeeReductionSystem public feeReductionSystem;
    IAllowanceTransfer public permit2;
    IWETH9 public weth9;
    IPositionDescriptor public positionDescriptor;
    
    // ==================== Test Users ====================
    
    address public factoryOwner;
    address public user1;
    address public user2;
    address public user3;
    
    // ==================== Setup ====================
    
    function setUp() public virtual {
        // Deploy Permit2 first using the helper
        deployPermit2();
        permit2 = IAllowanceTransfer(deployPermit2());
        
        // Deploy PoolManager and routers using Deployers helper
        deployFreshManagerAndRouters();
        
        // Setup users
        factoryOwner = makeAddr("factoryOwner");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        
        // Start deployment as factory owner
        vm.startPrank(factoryOwner);
        
        // Deploy all contracts in order
        _deployCore();
        _deployUniswapV4();
        _deployHook();
        _deployFactory();
        _deployFeeReductionSystem();
        _distributeTokens();
        
        vm.stopPrank();
    }
    
    // ==================== Internal Deployment Functions ====================
    
    function _deployCore() internal {
        // Deploy AmicaToken as upgradeable proxy
        address amicaProxy = Upgrades.deployTransparentProxy(
            "AmicaToken.sol",
            factoryOwner,
            abi.encodeCall(AmicaToken.initialize, (factoryOwner, AMICA_TOTAL_SUPPLY))
        );
        amicaToken = AmicaToken(amicaProxy);
        
        // Deploy PersonaToken implementation
        personaToken = new PersonaToken();
    }
    
    function _deployUniswapV4() internal {
        // Deploy WETH9 mock
        weth9 = new MockWETH9();
        
        // Deploy position descriptor mock
        positionDescriptor = new MockPositionDescriptor(manager, address(weth9));
        
        // Deploy PositionManager with the actual PoolManager from Deployers
        positionManager = new PositionManager(
            manager, // This is the actual PoolManager from Deployers
            permit2,
            UNSUBSCRIBE_GAS_LIMIT,
            positionDescriptor,
            weth9
        );
    }
    
    function _deployHook() internal {
        // Deploy hook with proper address pattern for V4
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG);
        
        // Calculate target address with correct flags
        address targetHookAddress = address(uint160(0x4444444444444444444444444444444444440000) | flags);
        
        // First deploy to a temporary address to get the bytecode
        DynamicFeeHook tempHook = new DynamicFeeHook(manager);
        bytes memory hookBytecode = address(tempHook).code;
        
        // Use vm.etch to place the contract at the target address
        vm.etch(targetHookAddress, hookBytecode);
        
        // Cast to our hook interface
        dynamicFeeHook = DynamicFeeHook(targetHookAddress);
        
        // Initialize storage at the new address
        // Slot 0 is typically where the poolManager address is stored
        vm.store(
            targetHookAddress,
            bytes32(uint256(0)),
            bytes32(uint256(uint160(address(manager))))
        );
    }
    
    function _deployFactory() internal {
        // Deploy PersonaTokenFactory as upgradeable proxy
        address factoryProxy = Upgrades.deployTransparentProxy(
            "PersonaTokenFactory.sol",
            factoryOwner,
            abi.encodeCall(
                PersonaTokenFactory.initialize,
                (
                    address(amicaToken),
                    address(manager), // Use the actual PoolManager
                    address(positionManager),
                    address(dynamicFeeHook),
                    address(personaToken)
                )
            )
        );
        
        personaFactory = PersonaTokenFactory(factoryProxy);
    }
    
    function _deployFeeReductionSystem() internal {
        // Deploy FeeReductionSystem
        feeReductionSystem = new FeeReductionSystem(
            amicaToken,
            personaFactory
        );
        
        // Set the fee reduction system in the dynamic fee hook
        dynamicFeeHook.setFeeReductionSystem(address(feeReductionSystem));
    }
    
    function _distributeTokens() internal {
        // Give users some AMICA tokens
        amicaToken.transfer(user1, 10_000_000 ether);
        amicaToken.transfer(user2, 10_000_000 ether);
        amicaToken.transfer(user3, 5_000_000 ether);
        
        // Give users some ETH for gas
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(user3, 100 ether);
    }
    
    // ==================== Helper Functions ====================
    
    /**
     * @notice Approves AMICA tokens for the factory
     * @param user User address to approve from
     * @param amount Amount to approve
     */
    function approveAmicaForFactory(address user, uint256 amount) internal {
        vm.prank(user);
        amicaToken.approve(address(personaFactory), amount);
    }
    
    /**
     * @notice Creates a persona token with default settings
     * @param creator Address that will own the persona
     * @param name Name of the persona
     * @param symbol Symbol of the persona token
     * @param domain Unique domain identifier
     * @return tokenId The ID of the created persona NFT
     */
    function createPersona(
        address creator,
        string memory name,
        string memory symbol,
        bytes32 domain
    ) internal returns (uint256) {
        approveAmicaForFactory(creator, DEFAULT_MINT_COST);
        
        vm.prank(creator);
        return personaFactory.createPersona(
            address(amicaToken),
            name,
            symbol,
            domain,
            0, // no initial buy
            address(0), // no agent token
            0 // no min agent tokens
        );
    }
    
    /**
     * @notice Creates a persona token with initial buy
     * @param creator Address that will own the persona
     * @param name Name of the persona
     * @param symbol Symbol of the persona token
     * @param domain Unique domain identifier
     * @param initialBuyAmount Amount to spend on initial token purchase
     * @return tokenId The ID of the created persona NFT
     */
    function createPersonaWithInitialBuy(
        address creator,
        string memory name,
        string memory symbol,
        bytes32 domain,
        uint256 initialBuyAmount
    ) internal returns (uint256) {
        uint256 totalRequired = DEFAULT_MINT_COST + initialBuyAmount;
        approveAmicaForFactory(creator, totalRequired);
        
        vm.prank(creator);
        return personaFactory.createPersona(
            address(amicaToken),
            name,
            symbol,
            domain,
            initialBuyAmount,
            address(0),
            0
        );
    }
    
    /**
     * @notice Creates a persona token with agent token
     * @param creator Address that will own the persona
     * @param name Name of the persona
     * @param symbol Symbol of the persona token
     * @param domain Unique domain identifier
     * @param agentToken Address of the agent token
     * @param minAgentTokens Minimum agent tokens required for graduation
     * @return tokenId The ID of the created persona NFT
     */
    function createPersonaWithAgent(
        address creator,
        string memory name,
        string memory symbol,
        bytes32 domain,
        address agentToken,
        uint256 minAgentTokens
    ) internal returns (uint256) {
        approveAmicaForFactory(creator, DEFAULT_MINT_COST);
        
        vm.prank(creator);
        return personaFactory.createPersona(
            address(amicaToken),
            name,
            symbol,
            domain,
            0,
            agentToken,
            minAgentTokens
        );
    }
    
    /**
     * @notice Creates a mock ERC20 token for testing
     * @param name Token name
     * @param symbol Token symbol
     * @param initialSupply Initial supply to mint
     * @return token The created mock token
     */
    function createMockToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) internal returns (MockERC20) {
        MockERC20 token = new MockERC20(name, symbol, 18);
        token.mint(address(this), initialSupply);
        return token;
    }
    
    /**
     * @notice Generates a unique domain from a string
     * @param domainString The domain string
     * @return domain The hashed domain
     */
    function generateDomain(string memory domainString) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(domainString));
    }
    
    /**
     * @notice Setup currencies for V4 pools
     * @dev Uses the Deployers helper to set up test currencies
     */
    function setupCurrencies() internal {
        // This uses the Deployers helper to set up test currencies
        deployMintAndApprove2Currencies();
        
        // Also approve for our contracts
        vm.startPrank(factoryOwner);
        MockERC20(Currency.unwrap(currency0)).approve(address(personaFactory), type(uint256).max);
        MockERC20(Currency.unwrap(currency1)).approve(address(personaFactory), type(uint256).max);
        vm.stopPrank();
        
        // Approve for users
        vm.startPrank(user1);
        MockERC20(Currency.unwrap(currency0)).approve(address(positionManager), type(uint256).max);
        MockERC20(Currency.unwrap(currency1)).approve(address(positionManager), type(uint256).max);
        MockERC20(Currency.unwrap(currency0)).approve(address(permit2), type(uint256).max);
        MockERC20(Currency.unwrap(currency1)).approve(address(permit2), type(uint256).max);
        vm.stopPrank();
        
        vm.startPrank(user2);
        MockERC20(Currency.unwrap(currency0)).approve(address(positionManager), type(uint256).max);
        MockERC20(Currency.unwrap(currency1)).approve(address(positionManager), type(uint256).max);
        MockERC20(Currency.unwrap(currency0)).approve(address(permit2), type(uint256).max);
        MockERC20(Currency.unwrap(currency1)).approve(address(permit2), type(uint256).max);
        vm.stopPrank();
    }
    
    // ==================== Common Assertions ====================
    
    /**
     * @notice Asserts that a persona was created correctly
     * @param tokenId The persona token ID
     * @param expectedName Expected name
     * @param expectedSymbol Expected symbol
     * @param expectedOwner Expected NFT owner
     */
    function assertPersonaCreated(
        uint256 tokenId,
        string memory expectedName,
        string memory expectedSymbol,
        address expectedOwner
    ) internal {
        (
            string memory name,
            string memory symbol,
            address token,
            address pairToken,
            ,
            bool pairCreated,
            uint256 createdAt,
            ,
            ,
            ,
        ) = personaFactory.personas(tokenId);
        
        assertEq(name, expectedName, "Persona name mismatch");
        assertEq(symbol, expectedSymbol, "Persona symbol mismatch");
        assertTrue(token != address(0), "Persona token not deployed");
        assertEq(pairToken, address(amicaToken), "Pair token mismatch");
        assertFalse(pairCreated, "Pair should not be created yet");
        assertGt(createdAt, 0, "Created timestamp not set");
        assertEq(personaFactory.ownerOf(tokenId), expectedOwner, "NFT owner mismatch");
    }
    
    /**
     * @notice Asserts that a persona has graduated to Uniswap
     * @param tokenId The persona token ID
     */
    function assertPersonaGraduated(uint256 tokenId) internal {
        (, , , , , bool pairCreated, , , , , ) = personaFactory.personas(tokenId);
        assertTrue(pairCreated, "Persona should be graduated");
    }
}
