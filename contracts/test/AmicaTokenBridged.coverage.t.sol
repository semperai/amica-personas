// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {AmicaTokenBridged} from "../src/AmicaTokenBridged.sol";
import {AmicaTokenBridgedV2} from "../src/AmicaTokenBridgedV2.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";
import {ERC1967Proxy} from
    "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {UUPSUpgradeable} from
    "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @notice Coverage tests for AmicaTokenBridged without UUPS upgrade validation
 * @dev These tests deploy the contract as a proxy to test functionality
 */
contract AmicaTokenBridgedCoverageTest is Test {
    AmicaTokenBridged public amica;
    ERC20Mock public usdc;

    address public owner = address(0x1);
    address public user1 = address(0x2);

    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;

    function setUp() public {
        vm.startPrank(owner);

        // Deploy implementation
        AmicaTokenBridged implementation = new AmicaTokenBridged();

        // Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(AmicaTokenBridged.initialize, (owner))
        );

        amica = AmicaTokenBridged(address(proxy));

        // Deploy mock token
        usdc = new ERC20Mock();

        vm.stopPrank();
    }

    function test_Unpause() public {
        vm.startPrank(owner);
        amica.pause();
        assertTrue(amica.paused());

        amica.unpause();
        assertFalse(amica.paused());
        vm.stopPrank();
    }

    function test_Unpause_RevertNotOwner() public {
        vm.prank(owner);
        amica.pause();

        vm.prank(user1);
        vm.expectRevert();
        amica.unpause();
    }

    function test_PauseUnpauseFlow() public {
        // Configure token
        vm.prank(owner);
        amica.configureToken(address(usdc), true, 1e18, 6);

        // Mint USDC to user
        vm.prank(owner);
        usdc.mint(user1, 1000e6);

        // User can deposit when not paused
        vm.startPrank(user1);
        usdc.approve(address(amica), 100e6);
        amica.depositAndMint(address(usdc), 100e6);
        assertEq(amica.balanceOf(user1), 100e18);
        vm.stopPrank();

        // Pause
        vm.prank(owner);
        amica.pause();

        // Cannot deposit when paused
        vm.startPrank(user1);
        usdc.approve(address(amica), 100e6);
        vm.expectRevert();
        amica.depositAndMint(address(usdc), 100e6);
        vm.stopPrank();

        // Unpause
        vm.prank(owner);
        amica.unpause();

        // Can deposit again after unpause
        vm.startPrank(user1);
        usdc.approve(address(amica), 100e6);
        amica.depositAndMint(address(usdc), 100e6);
        assertEq(amica.balanceOf(user1), 200e18);
        vm.stopPrank();
    }

    // Edge case tests for better branch coverage
    function test_ConfigureToken_RevertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(AmicaTokenBridged.InvalidAmount.selector);
        amica.configureToken(address(0), true, 1e18, 6);
    }

    function test_ConfigureToken_RevertZeroExchangeRateWhenEnabled() public {
        vm.prank(owner);
        vm.expectRevert(AmicaTokenBridged.InvalidExchangeRate.selector);
        amica.configureToken(address(usdc), true, 0, 6);
    }

    function test_DepositAndMint_RevertZeroAmountToMint() public {
        // Configure with very low exchange rate
        vm.prank(owner);
        amica.configureToken(address(usdc), true, 1, 6);

        vm.prank(owner);
        usdc.mint(user1, 1);

        vm.startPrank(user1);
        usdc.approve(address(amica), 1);
        vm.expectRevert(AmicaTokenBridged.InvalidAmount.selector);
        amica.depositAndMint(address(usdc), 1);
        vm.stopPrank();
    }

    function test_WithdrawToken_RevertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(AmicaTokenBridged.InvalidAmount.selector);
        amica.withdrawToken(address(usdc), address(0), 100e6);
    }

    function test_WithdrawToken_RevertZeroAmount() public {
        vm.prank(owner);
        vm.expectRevert(AmicaTokenBridged.InvalidAmount.selector);
        amica.withdrawToken(address(usdc), user1, 0);
    }

    // ============ UUPS Upgrade Tests ============

    function test_UpgradeToV2_Success() public {
        // Deploy V2 implementation
        vm.prank(owner);
        AmicaTokenBridgedV2 v2Implementation = new AmicaTokenBridgedV2();

        // Upgrade to V2
        vm.prank(owner);
        UUPSUpgradeable(address(amica)).upgradeToAndCall(
            address(v2Implementation), ""
        );

        // Cast to V2 and verify upgrade
        AmicaTokenBridgedV2 amicaV2 = AmicaTokenBridgedV2(address(amica));
        assertEq(amicaV2.upgradeTest(), "Upgrade success");
        assertEq(amicaV2.version(), "2.0.0");

        // Verify existing state is preserved
        assertEq(amicaV2.owner(), owner);
        assertEq(amicaV2.totalSupply(), 0);
    }

    function test_UpgradeToV2_RevertNotOwner() public {
        vm.prank(owner);
        AmicaTokenBridgedV2 v2Implementation = new AmicaTokenBridgedV2();

        // Try to upgrade as non-owner
        vm.prank(user1);
        vm.expectRevert();
        UUPSUpgradeable(address(amica)).upgradeToAndCall(
            address(v2Implementation), ""
        );
    }

    function test_UpgradeToV2_PreservesDeposits() public {
        // Configure token and make a deposit
        vm.prank(owner);
        amica.configureToken(address(usdc), true, 1e18, 6);

        vm.prank(owner);
        usdc.mint(user1, 1000e6);

        vm.startPrank(user1);
        usdc.approve(address(amica), 1000e6);
        amica.depositAndMint(address(usdc), 1000e6);
        vm.stopPrank();

        uint256 balanceBefore = amica.balanceOf(user1);
        assertEq(balanceBefore, 1000e18);

        // Upgrade to V2
        vm.prank(owner);
        AmicaTokenBridgedV2 v2Implementation = new AmicaTokenBridgedV2();

        vm.prank(owner);
        UUPSUpgradeable(address(amica)).upgradeToAndCall(
            address(v2Implementation), ""
        );

        // Verify balance preserved after upgrade
        AmicaTokenBridgedV2 amicaV2 = AmicaTokenBridgedV2(address(amica));
        assertEq(amicaV2.balanceOf(user1), balanceBefore);
        assertEq(amicaV2.upgradeTest(), "Upgrade success");

        // Verify functionality still works - mint more tokens first
        vm.prank(owner);
        usdc.mint(user1, 500e6);

        vm.startPrank(user1);
        usdc.approve(address(amica), 500e6);
        amicaV2.depositAndMint(address(usdc), 500e6);
        vm.stopPrank();

        assertEq(amicaV2.balanceOf(user1), 1500e18);
    }
}


