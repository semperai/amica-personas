// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {AmicaTokenMainnet} from "../src/AmicaTokenMainnet.sol";
import {AmicaTokenMainnetV2} from "../src/AmicaTokenMainnetV2.sol";
import {AmicaTokenBridged} from "../src/AmicaTokenBridged.sol";
import {AmicaTokenBridgedV2} from "../src/AmicaTokenBridgedV2.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeploymentUpgradeTest
 * @notice Tests the full deployment and upgrade workflow
 * @dev Simulates what the deploy scripts do in production
 */
contract DeploymentUpgradeTest is Test {
    uint256 constant MAX_SUPPLY = 1_000_000_000 * 1e18;

    address public owner;
    address public user;

    function setUp() public {
        owner = makeAddr("owner");
        user = makeAddr("user");
    }

    /**
     * @notice Test full mainnet deployment workflow
     */
    function test_DeployAmicaMainnet() public {
        vm.startPrank(owner);

        // Step 1: Deploy implementation
        AmicaTokenMainnet implementation = new AmicaTokenMainnet();
        console.log("Implementation deployed:", address(implementation));

        // Step 2: Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(AmicaTokenMainnet.initialize, (owner, MAX_SUPPLY))
        );
        console.log("Proxy deployed:", address(proxy));

        // Step 3: Cast to interface
        AmicaTokenMainnet amica = AmicaTokenMainnet(address(proxy));

        // Step 4: Verify deployment
        assertEq(amica.owner(), owner, "Owner should be set");
        assertEq(amica.totalSupply(), MAX_SUPPLY, "Total supply should be MAX_SUPPLY");
        assertEq(amica.balanceOf(owner), MAX_SUPPLY, "Owner should have all tokens");
        assertEq(amica.name(), "Amica", "Name should be Amica");
        assertEq(amica.symbol(), "AMICA", "Symbol should be AMICA");

        console.log("Deployment verified successfully");

        vm.stopPrank();
    }

    /**
     * @notice Test mainnet deployment then upgrade to V2
     */
    function test_DeployAndUpgradeMainnet() public {
        vm.startPrank(owner);

        // === DEPLOYMENT ===
        AmicaTokenMainnet implementation = new AmicaTokenMainnet();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(AmicaTokenMainnet.initialize, (owner, MAX_SUPPLY))
        );
        AmicaTokenMainnet amica = AmicaTokenMainnet(address(proxy));

        console.log("=== Initial Deployment ===");
        console.log("Proxy:", address(proxy));
        console.log("Implementation:", address(implementation));
        console.log("Total Supply:", amica.totalSupply() / 1e18, "AMICA");

        // === UPGRADE TO V2 ===
        console.log("\n=== Upgrading to V2 ===");

        // Deploy V2 implementation
        AmicaTokenMainnetV2 implementationV2 = new AmicaTokenMainnetV2();
        console.log("V2 Implementation deployed:", address(implementationV2));

        // Upgrade proxy
        UUPSUpgradeable(address(amica)).upgradeToAndCall(
            address(implementationV2),
            ""
        );

        // Cast to V2
        AmicaTokenMainnetV2 amicaV2 = AmicaTokenMainnetV2(address(proxy));

        // === VERIFICATION ===
        console.log("\n=== Verifying Upgrade ===");

        // Check V2 specific functions
        assertEq(amicaV2.version(), "2.0.0", "Version should be 2.0.0");
        assertEq(amicaV2.upgradeTest(), "Upgrade success", "Upgrade test should pass");

        // Check state preservation
        assertEq(amicaV2.owner(), owner, "Owner should be preserved");
        assertEq(amicaV2.totalSupply(), MAX_SUPPLY, "Total supply should be preserved");
        assertEq(amicaV2.balanceOf(owner), MAX_SUPPLY, "Owner balance should be preserved");

        console.log("Version:", amicaV2.version());
        console.log("Upgrade Test:", amicaV2.upgradeTest());
        console.log("Owner:", amicaV2.owner());
        console.log("Total Supply:", amicaV2.totalSupply() / 1e18, "AMICA");

        vm.stopPrank();
    }

    /**
     * @notice Test upgrade preserves functionality
     */
    function test_UpgradePreservesFunctionality() public {
        vm.startPrank(owner);

        // Deploy V1
        AmicaTokenMainnet implementation = new AmicaTokenMainnet();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(AmicaTokenMainnet.initialize, (owner, MAX_SUPPLY))
        );
        AmicaTokenMainnet amica = AmicaTokenMainnet(address(proxy));

        // Configure a token for deposits
        address mockToken = makeAddr("mockToken");
        amica.configureToken(mockToken, true, 1e18, 18);

        // Check remaining supply before upgrade
        uint256 remainingBefore = amica.remainingSupply();
        assertEq(remainingBefore, 0, "No remaining supply (minted max)");

        // Get configured tokens before upgrade
        address[] memory tokensBefore = amica.getConfiguredTokens();
        assertEq(tokensBefore.length, 1, "Should have 1 configured token");
        assertEq(tokensBefore[0], mockToken, "Token should be configured");

        // Upgrade to V2
        AmicaTokenMainnetV2 implementationV2 = new AmicaTokenMainnetV2();
        UUPSUpgradeable(address(amica)).upgradeToAndCall(
            address(implementationV2),
            ""
        );
        AmicaTokenMainnetV2 amicaV2 = AmicaTokenMainnetV2(address(proxy));

        // Verify all functionality still works
        uint256 remainingAfter = amicaV2.remainingSupply();
        assertEq(remainingAfter, remainingBefore, "Remaining supply should be same");

        address[] memory tokensAfter = amicaV2.getConfiguredTokens();
        assertEq(tokensAfter.length, 1, "Should still have 1 configured token");
        assertEq(tokensAfter[0], mockToken, "Token should still be configured");

        // Check token config preserved
        (bool enabled, uint256 rate, uint8 decimals) = amicaV2.tokenConfigs(mockToken);
        assertTrue(enabled, "Token should still be enabled");
        assertEq(rate, 1e18, "Rate should be preserved");
        assertEq(decimals, 18, "Decimals should be preserved");

        // Test configuring another token still works
        address mockToken2 = makeAddr("mockToken2");
        amicaV2.configureToken(mockToken2, true, 0.5e18, 6);

        address[] memory tokensAfter2 = amicaV2.getConfiguredTokens();
        assertEq(tokensAfter2.length, 2, "Should have 2 configured tokens");

        vm.stopPrank();
    }

    /**
     * @notice Test bridged deployment workflow
     */
    function test_DeployAmicaBridged() public {
        vm.startPrank(owner);

        // Deploy implementation
        AmicaTokenBridged implementation = new AmicaTokenBridged();
        console.log("Bridged Implementation deployed:", address(implementation));

        // Deploy proxy (no initial supply for bridged version)
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(AmicaTokenBridged.initialize, (owner))
        );
        console.log("Bridged Proxy deployed:", address(proxy));

        // Cast to interface
        AmicaTokenBridged amica = AmicaTokenBridged(address(proxy));

        // Verify deployment
        assertEq(amica.owner(), owner, "Owner should be set");
        assertEq(amica.totalSupply(), 0, "Total supply should be 0 for bridged");
        assertEq(amica.name(), "Amica", "Name should be Amica");
        assertEq(amica.symbol(), "AMICA", "Symbol should be AMICA");

        console.log("Bridged deployment verified successfully");

        vm.stopPrank();
    }

    /**
     * @notice Test bridged deployment then upgrade to V2
     */
    function test_DeployAndUpgradeBridged() public {
        vm.startPrank(owner);

        // === DEPLOYMENT ===
        AmicaTokenBridged implementation = new AmicaTokenBridged();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(AmicaTokenBridged.initialize, (owner))
        );
        AmicaTokenBridged amica = AmicaTokenBridged(address(proxy));

        console.log("=== Initial Bridged Deployment ===");
        console.log("Proxy:", address(proxy));
        console.log("Implementation:", address(implementation));
        console.log("Total Supply:", amica.totalSupply());

        // === UPGRADE TO V2 ===
        console.log("\n=== Upgrading Bridged to V2 ===");

        AmicaTokenBridgedV2 implementationV2 = new AmicaTokenBridgedV2();
        console.log("V2 Implementation deployed:", address(implementationV2));

        UUPSUpgradeable(address(amica)).upgradeToAndCall(
            address(implementationV2),
            ""
        );

        AmicaTokenBridgedV2 amicaV2 = AmicaTokenBridgedV2(address(proxy));

        // === VERIFICATION ===
        console.log("\n=== Verifying Bridged Upgrade ===");

        assertEq(amicaV2.version(), "2.0.0", "Version should be 2.0.0");
        assertEq(amicaV2.upgradeTest(), "Upgrade success", "Upgrade test should pass");
        assertEq(amicaV2.owner(), owner, "Owner should be preserved");
        assertEq(amicaV2.totalSupply(), 0, "Total supply should be 0");

        console.log("Version:", amicaV2.version());
        console.log("Upgrade Test:", amicaV2.upgradeTest());

        vm.stopPrank();
    }

    /**
     * @notice Test upgrade with deposits and state
     */
    function test_UpgradeMainnetWithDeposits() public {
        vm.startPrank(owner);

        // Deploy V1 with reduced initial supply
        AmicaTokenMainnet implementation = new AmicaTokenMainnet();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(AmicaTokenMainnet.initialize, (owner, 900_000_000 * 1e18))
        );
        AmicaTokenMainnet amica = AmicaTokenMainnet(address(proxy));

        // Configure multiple tokens
        address usdc = makeAddr("usdc");
        address usdt = makeAddr("usdt");
        address dai = makeAddr("dai");

        amica.configureToken(usdc, true, 1e18, 6);
        amica.configureToken(usdt, true, 0.9e18, 6);
        amica.configureToken(dai, true, 1e18, 18);

        // Verify state
        address[] memory tokens = amica.getConfiguredTokens();
        assertEq(tokens.length, 3, "Should have 3 tokens configured");

        // Upgrade to V2
        AmicaTokenMainnetV2 implementationV2 = new AmicaTokenMainnetV2();
        UUPSUpgradeable(address(amica)).upgradeToAndCall(
            address(implementationV2),
            ""
        );
        AmicaTokenMainnetV2 amicaV2 = AmicaTokenMainnetV2(address(proxy));

        // Verify all configurations preserved
        address[] memory tokensAfter = amicaV2.getConfiguredTokens();
        assertEq(tokensAfter.length, 3, "Should still have 3 tokens");
        assertEq(tokensAfter[0], usdc, "USDC should be first");
        assertEq(tokensAfter[1], usdt, "USDT should be second");
        assertEq(tokensAfter[2], dai, "DAI should be third");

        // Verify each config
        (bool enabled1, uint256 rate1, uint8 decimals1) = amicaV2.tokenConfigs(usdc);
        assertTrue(enabled1);
        assertEq(rate1, 1e18);
        assertEq(decimals1, 6);

        (bool enabled2, uint256 rate2, uint8 decimals2) = amicaV2.tokenConfigs(usdt);
        assertTrue(enabled2);
        assertEq(rate2, 0.9e18);
        assertEq(decimals2, 6);

        (bool enabled3, uint256 rate3, uint8 decimals3) = amicaV2.tokenConfigs(dai);
        assertTrue(enabled3);
        assertEq(rate3, 1e18);
        assertEq(decimals3, 18);

        // Test new functionality works
        assertEq(amicaV2.version(), "2.0.0");
        assertEq(amicaV2.upgradeTest(), "Upgrade success");

        vm.stopPrank();
    }

    /**
     * @notice Test upgrade access control
     */
    function test_UpgradeOnlyOwner() public {
        vm.startPrank(owner);

        // Deploy V1
        AmicaTokenMainnet implementation = new AmicaTokenMainnet();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(AmicaTokenMainnet.initialize, (owner, MAX_SUPPLY))
        );
        AmicaTokenMainnet amica = AmicaTokenMainnet(address(proxy));

        vm.stopPrank();

        // Try to upgrade as non-owner
        vm.startPrank(user);
        AmicaTokenMainnetV2 implementationV2 = new AmicaTokenMainnetV2();

        vm.expectRevert();
        UUPSUpgradeable(address(amica)).upgradeToAndCall(
            address(implementationV2),
            ""
        );

        vm.stopPrank();

        // Verify owner can still upgrade
        vm.prank(owner);
        UUPSUpgradeable(address(amica)).upgradeToAndCall(
            address(implementationV2),
            ""
        );

        AmicaTokenMainnetV2 amicaV2 = AmicaTokenMainnetV2(address(proxy));
        assertEq(amicaV2.version(), "2.0.0");
    }

    /**
     * @notice Test storage layout compatibility
     */
    function test_StorageLayoutCompatibility() public {
        vm.startPrank(owner);

        // Deploy V1 and set various state
        AmicaTokenMainnet implementation = new AmicaTokenMainnet();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(AmicaTokenMainnet.initialize, (owner, 900_000_000 * 1e18))
        );
        AmicaTokenMainnet amica = AmicaTokenMainnet(address(proxy));

        // Set state
        address token1 = makeAddr("token1");
        amica.configureToken(token1, true, 2e18, 18);

        // Transfer some tokens
        amica.transfer(user, 1000 ether);

        // Pause after transfers
        amica.pause();
        assertTrue(amica.paused(), "Should be paused");

        // Record state before upgrade
        bool pausedBefore = amica.paused();
        uint256 balanceOwnerBefore = amica.balanceOf(owner);
        uint256 balanceUserBefore = amica.balanceOf(user);
        address[] memory tokensBefore = amica.getConfiguredTokens();

        // Upgrade
        AmicaTokenMainnetV2 implementationV2 = new AmicaTokenMainnetV2();
        UUPSUpgradeable(address(amica)).upgradeToAndCall(
            address(implementationV2),
            ""
        );
        AmicaTokenMainnetV2 amicaV2 = AmicaTokenMainnetV2(address(proxy));

        // Verify all state preserved
        assertEq(amicaV2.paused(), pausedBefore, "Paused state should be preserved");
        assertEq(amicaV2.balanceOf(owner), balanceOwnerBefore, "Owner balance preserved");
        assertEq(amicaV2.balanceOf(user), balanceUserBefore, "User balance preserved");

        address[] memory tokensAfter = amicaV2.getConfiguredTokens();
        assertEq(tokensAfter.length, tokensBefore.length, "Tokens list preserved");

        (bool enabled, uint256 rate, uint8 decimals) = amicaV2.tokenConfigs(token1);
        assertTrue(enabled, "Token still enabled");
        assertEq(rate, 2e18, "Rate preserved");
        assertEq(decimals, 18, "Decimals preserved");

        vm.stopPrank();
    }
}
