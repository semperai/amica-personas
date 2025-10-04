// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {AmicaTokenMainnet} from "../src/AmicaTokenMainnet.sol";
import {AmicaTokenMainnetV2} from "../src/AmicaTokenMainnetV2.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";
import {ERC1967Proxy} from
    "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {UUPSUpgradeable} from
    "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @notice Coverage tests for AmicaTokenMainnet without UUPS upgrade validation
 * @dev These tests deploy the contract as a proxy to test functionality
 */
contract AmicaTokenMainnetCoverageTest is Test {
    AmicaTokenMainnet public amica;
    ERC20Mock public mockToken;

    address public owner = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);

    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18;
    uint256 public constant INITIAL_SUPPLY = 900_000_000 * 1e18; // Leave room for deposits

    function setUp() public {
        vm.startPrank(owner);

        // Deploy implementation
        AmicaTokenMainnet implementation = new AmicaTokenMainnet();

        // Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(
                AmicaTokenMainnet.initialize, (owner, INITIAL_SUPPLY)
            )
        );

        amica = AmicaTokenMainnet(address(proxy));

        // Deploy mock token for testing
        mockToken = new ERC20Mock();

        vm.stopPrank();
    }

    // ============ ConfigureToken Tests ============

    function test_ConfigureToken() public {
        vm.prank(owner);
        amica.configureToken(address(mockToken), true, 1e18, 18);

        (bool enabled, uint256 exchangeRate, uint8 decimals) =
            amica.tokenConfigs(address(mockToken));
        assertEq(enabled, true);
        assertEq(exchangeRate, 1e18);
        assertEq(decimals, 18);
    }

    function test_ConfigureToken_USDC() public {
        vm.prank(owner);
        amica.configureToken(address(mockToken), true, 1e18, 6);

        (bool enabled, uint256 exchangeRate, uint8 decimals) =
            amica.tokenConfigs(address(mockToken));
        assertEq(enabled, true);
        assertEq(exchangeRate, 1e18);
        assertEq(decimals, 6);
    }

    function test_ConfigureToken_DifferentExchangeRate() public {
        vm.prank(owner);
        amica.configureToken(address(mockToken), true, 0.5e18, 18);

        (bool enabled, uint256 exchangeRate, uint8 decimals) =
            amica.tokenConfigs(address(mockToken));
        assertEq(enabled, true);
        assertEq(exchangeRate, 0.5e18);
        assertEq(decimals, 18);
    }

    function test_ConfigureToken_RevertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(AmicaTokenMainnet.InvalidAmount.selector);
        amica.configureToken(address(0), true, 1e18, 18);
    }

    function test_ConfigureToken_RevertZeroExchangeRateWhenEnabled() public {
        vm.prank(owner);
        vm.expectRevert(AmicaTokenMainnet.InvalidExchangeRate.selector);
        amica.configureToken(address(mockToken), true, 0, 18);
    }

    function test_ConfigureToken_RevertNotOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        amica.configureToken(address(mockToken), true, 1e18, 18);
    }

    function test_ConfigureToken_Disable() public {
        vm.startPrank(owner);
        amica.configureToken(address(mockToken), true, 1e18, 18);
        amica.configureToken(address(mockToken), false, 0, 18);
        vm.stopPrank();

        (bool enabled,,) = amica.tokenConfigs(address(mockToken));
        assertEq(enabled, false);
    }

    function test_ConfigureToken_AddsToConfiguredTokensList() public {
        vm.prank(owner);
        amica.configureToken(address(mockToken), true, 1e18, 18);

        address[] memory tokens = amica.getConfiguredTokens();
        assertEq(tokens.length, 1);
        assertEq(tokens[0], address(mockToken));
    }

    function test_ConfigureToken_OnlyAddsOnce() public {
        vm.startPrank(owner);
        amica.configureToken(address(mockToken), true, 1e18, 18);
        amica.configureToken(address(mockToken), true, 2e18, 18);
        vm.stopPrank();

        address[] memory tokens = amica.getConfiguredTokens();
        assertEq(tokens.length, 1);
    }

    // ============ DepositAndMint Tests ============

    function test_DepositAndMint_18Decimals() public {
        // Configure token
        vm.prank(owner);
        amica.configureToken(address(mockToken), true, 1e18, 18);

        // Mint tokens to user1
        vm.prank(owner);
        mockToken.mint(user1, 100e18);

        // User1 approves and deposits
        vm.startPrank(user1);
        mockToken.approve(address(amica), 100e18);
        amica.depositAndMint(address(mockToken), 100e18);
        vm.stopPrank();

        // Verify
        assertEq(amica.balanceOf(user1), 100e18);
        assertEq(mockToken.balanceOf(address(amica)), 100e18);
    }

    function test_DepositAndMint_6Decimals() public {
        // Configure USDC-like token
        vm.prank(owner);
        amica.configureToken(address(mockToken), true, 1e18, 6);

        // Mint tokens to user1 (100 USDC = 100 * 10^6)
        vm.prank(owner);
        mockToken.mint(user1, 100e6);

        // User1 deposits
        vm.startPrank(user1);
        mockToken.approve(address(amica), 100e6);
        amica.depositAndMint(address(mockToken), 100e6);
        vm.stopPrank();

        // Should mint 100 AMICA (normalized to 18 decimals)
        assertEq(amica.balanceOf(user1), 100e18);
    }

    function test_DepositAndMint_8Decimals() public {
        // Configure WBTC-like token
        vm.prank(owner);
        amica.configureToken(address(mockToken), true, 1e18, 8);

        // Mint 1 WBTC to user1
        vm.prank(owner);
        mockToken.mint(user1, 1e8);

        // User1 deposits
        vm.startPrank(user1);
        mockToken.approve(address(amica), 1e8);
        amica.depositAndMint(address(mockToken), 1e8);
        vm.stopPrank();

        // Should mint 1 AMICA
        assertEq(amica.balanceOf(user1), 1e18);
    }

    function test_DepositAndMint_HalfExchangeRate() public {
        // Configure token with 0.5:1 rate
        vm.prank(owner);
        amica.configureToken(address(mockToken), true, 0.5e18, 18);

        vm.prank(owner);
        mockToken.mint(user1, 100e18);

        vm.startPrank(user1);
        mockToken.approve(address(amica), 100e18);
        amica.depositAndMint(address(mockToken), 100e18);
        vm.stopPrank();

        // Should mint 50 AMICA (100 * 0.5)
        assertEq(amica.balanceOf(user1), 50e18);
    }

    function test_DepositAndMint_MultipleDeposits() public {
        vm.prank(owner);
        amica.configureToken(address(mockToken), true, 1e18, 18);

        vm.prank(owner);
        mockToken.mint(user1, 200e18);

        vm.startPrank(user1);
        mockToken.approve(address(amica), 200e18);
        amica.depositAndMint(address(mockToken), 100e18);
        amica.depositAndMint(address(mockToken), 100e18);
        vm.stopPrank();

        assertEq(amica.balanceOf(user1), 200e18);
    }

    function test_DepositAndMint_RevertTokenNotEnabled() public {
        vm.prank(owner);
        mockToken.mint(user1, 100e18);

        vm.startPrank(user1);
        mockToken.approve(address(amica), 100e18);
        vm.expectRevert(AmicaTokenMainnet.TokenNotEnabled.selector);
        amica.depositAndMint(address(mockToken), 100e18);
        vm.stopPrank();
    }

    function test_DepositAndMint_RevertZeroAmount() public {
        vm.prank(owner);
        amica.configureToken(address(mockToken), true, 1e18, 18);

        vm.prank(user1);
        vm.expectRevert(AmicaTokenMainnet.InvalidAmount.selector);
        amica.depositAndMint(address(mockToken), 0);
    }

    function test_DepositAndMint_RevertExceedsMaxSupply() public {
        // Create new instance with low initial supply
        vm.prank(owner);
        AmicaTokenMainnet implementation = new AmicaTokenMainnet();
        ERC1967Proxy proxyLow = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(
                AmicaTokenMainnet.initialize, (owner, MAX_SUPPLY - 50e18)
            )
        );
        AmicaTokenMainnet amicaLow = AmicaTokenMainnet(address(proxyLow));

        vm.prank(owner);
        amicaLow.configureToken(address(mockToken), true, 1e18, 18);

        vm.prank(owner);
        mockToken.mint(user1, 100e18);

        vm.startPrank(user1);
        mockToken.approve(address(amicaLow), 100e18);
        vm.expectRevert(AmicaTokenMainnet.ExceedsMaxSupply.selector);
        amicaLow.depositAndMint(address(mockToken), 100e18);
        vm.stopPrank();
    }

    function test_DepositAndMint_RevertWhenPaused() public {
        vm.prank(owner);
        amica.configureToken(address(mockToken), true, 1e18, 18);

        vm.prank(owner);
        amica.pause();

        vm.prank(owner);
        mockToken.mint(user1, 100e18);

        vm.startPrank(user1);
        mockToken.approve(address(amica), 100e18);
        vm.expectRevert();
        amica.depositAndMint(address(mockToken), 100e18);
        vm.stopPrank();
    }

    function test_DepositAndMint_RevertAmountToMintZero() public {
        // Configure with very low exchange rate
        vm.prank(owner);
        amica.configureToken(address(mockToken), true, 1, 18);

        vm.prank(owner);
        mockToken.mint(user1, 1);

        vm.startPrank(user1);
        mockToken.approve(address(amica), 1);
        vm.expectRevert(AmicaTokenMainnet.InvalidAmount.selector);
        amica.depositAndMint(address(mockToken), 1);
        vm.stopPrank();
    }

    // ============ WithdrawToken Tests ============

    function test_WithdrawToken() public {
        // Configure and deposit
        vm.prank(owner);
        amica.configureToken(address(mockToken), true, 1e18, 18);

        vm.prank(owner);
        mockToken.mint(user1, 100e18);

        vm.startPrank(user1);
        mockToken.approve(address(amica), 100e18);
        amica.depositAndMint(address(mockToken), 100e18);
        vm.stopPrank();

        // Owner withdraws
        vm.prank(owner);
        amica.withdrawToken(address(mockToken), user2, 50e18);

        assertEq(mockToken.balanceOf(user2), 50e18);
        assertEq(mockToken.balanceOf(address(amica)), 50e18);
    }

    function test_WithdrawToken_RevertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(AmicaTokenMainnet.InvalidAmount.selector);
        amica.withdrawToken(address(mockToken), address(0), 100e18);
    }

    function test_WithdrawToken_RevertZeroAmount() public {
        vm.prank(owner);
        vm.expectRevert(AmicaTokenMainnet.InvalidAmount.selector);
        amica.withdrawToken(address(mockToken), user1, 0);
    }

    function test_WithdrawToken_RevertNotOwner() public {
        vm.prank(user1);
        vm.expectRevert();
        amica.withdrawToken(address(mockToken), user2, 100e18);
    }

    // ============ View Function Tests ============

    function test_GetConfiguredTokens() public {
        ERC20Mock token1 = new ERC20Mock();
        ERC20Mock token2 = new ERC20Mock();

        vm.startPrank(owner);
        amica.configureToken(address(token1), true, 1e18, 18);
        amica.configureToken(address(token2), true, 1e18, 6);
        vm.stopPrank();

        address[] memory tokens = amica.getConfiguredTokens();
        assertEq(tokens.length, 2);
        assertEq(tokens[0], address(token1));
        assertEq(tokens[1], address(token2));
    }

    function test_PreviewDepositAndMint() public {
        vm.prank(owner);
        amica.configureToken(address(mockToken), true, 1e18, 18);

        uint256 preview =
            amica.previewDepositAndMint(address(mockToken), 100e18);
        assertEq(preview, 100e18);
    }

    function test_PreviewDepositAndMint_6Decimals() public {
        vm.prank(owner);
        amica.configureToken(address(mockToken), true, 1e18, 6);

        uint256 preview = amica.previewDepositAndMint(address(mockToken), 100e6);
        assertEq(preview, 100e18);
    }

    function test_PreviewDepositAndMint_HalfRate() public {
        vm.prank(owner);
        amica.configureToken(address(mockToken), true, 0.5e18, 18);

        uint256 preview =
            amica.previewDepositAndMint(address(mockToken), 100e18);
        assertEq(preview, 50e18);
    }

    function test_PreviewDepositAndMint_DisabledToken() public {
        vm.prank(owner);
        amica.configureToken(address(mockToken), false, 0, 18);

        uint256 preview =
            amica.previewDepositAndMint(address(mockToken), 100e18);
        assertEq(preview, 0);
    }

    function test_PreviewDepositAndMint_ZeroAmount() public {
        vm.prank(owner);
        amica.configureToken(address(mockToken), true, 1e18, 18);

        uint256 preview = amica.previewDepositAndMint(address(mockToken), 0);
        assertEq(preview, 0);
    }

    function test_RemainingSupply() public view {
        uint256 remaining = amica.remainingSupply();
        assertEq(remaining, 100_000_000 * 1e18); // 100M remaining
    }

    function test_RemainingSupply_AfterMinting() public {
        // Create new instance with partial supply
        vm.prank(owner);
        AmicaTokenMainnet implementation = new AmicaTokenMainnet();
        ERC1967Proxy proxyPartial = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(
                AmicaTokenMainnet.initialize, (owner, 500_000_000e18)
            )
        );
        AmicaTokenMainnet amicaPartial =
            AmicaTokenMainnet(address(proxyPartial));

        uint256 remaining = amicaPartial.remainingSupply();
        assertEq(remaining, 500_000_000e18);
    }

    function test_Unpause() public {
        vm.startPrank(owner);
        amica.pause();
        assertTrue(amica.paused());

        amica.unpause();
        assertFalse(amica.paused());
        vm.stopPrank();
    }

    // ============ Initialization Tests ============

    function test_Initialize_RevertExceedsMaxSupply() public {
        vm.prank(owner);
        AmicaTokenMainnet implementation = new AmicaTokenMainnet();

        vm.expectRevert("Exceeds max supply");
        new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(
                AmicaTokenMainnet.initialize,
                (owner, MAX_SUPPLY + 1)
            )
        );
    }

    function test_Initialize_ExactlyMaxSupply() public {
        vm.prank(owner);
        AmicaTokenMainnet implementation = new AmicaTokenMainnet();

        ERC1967Proxy proxy = new ERC1967Proxy(
            address(implementation),
            abi.encodeCall(AmicaTokenMainnet.initialize, (owner, MAX_SUPPLY))
        );

        AmicaTokenMainnet amicaMax = AmicaTokenMainnet(address(proxy));
        assertEq(amicaMax.totalSupply(), MAX_SUPPLY);
        assertEq(amicaMax.remainingSupply(), 0);
    }

    // ============ UUPS Upgrade Tests ============

    function test_UpgradeToV2_Success() public {
        // Deploy V2 implementation
        vm.prank(owner);
        AmicaTokenMainnetV2 v2Implementation = new AmicaTokenMainnetV2();

        // Upgrade to V2
        vm.prank(owner);
        UUPSUpgradeable(address(amica)).upgradeToAndCall(
            address(v2Implementation), ""
        );

        // Cast to V2 and verify upgrade
        AmicaTokenMainnetV2 amicaV2 = AmicaTokenMainnetV2(address(amica));
        assertEq(amicaV2.upgradeTest(), "Upgrade success");
        assertEq(amicaV2.version(), "2.0.0");

        // Verify existing state is preserved
        assertEq(amicaV2.owner(), owner);
        assertEq(amicaV2.totalSupply(), INITIAL_SUPPLY);
    }

    function test_UpgradeToV2_RevertNotOwner() public {
        vm.prank(owner);
        AmicaTokenMainnetV2 v2Implementation = new AmicaTokenMainnetV2();

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
        amica.configureToken(address(mockToken), true, 1e18, 18);

        vm.prank(owner);
        mockToken.mint(user1, 1000e18);

        vm.startPrank(user1);
        mockToken.approve(address(amica), 1000e18);
        amica.depositAndMint(address(mockToken), 1000e18);
        vm.stopPrank();

        uint256 balanceBefore = amica.balanceOf(user1);
        assertEq(balanceBefore, 1000e18);

        // Upgrade to V2
        vm.prank(owner);
        AmicaTokenMainnetV2 v2Implementation = new AmicaTokenMainnetV2();

        vm.prank(owner);
        UUPSUpgradeable(address(amica)).upgradeToAndCall(
            address(v2Implementation), ""
        );

        // Verify balance preserved after upgrade
        AmicaTokenMainnetV2 amicaV2 = AmicaTokenMainnetV2(address(amica));
        assertEq(amicaV2.balanceOf(user1), balanceBefore);
        assertEq(amicaV2.upgradeTest(), "Upgrade success");

        // Verify functionality still works - mint more tokens first
        vm.prank(owner);
        mockToken.mint(user1, 500e18);

        vm.startPrank(user1);
        mockToken.approve(address(amica), 500e18);
        amicaV2.depositAndMint(address(mockToken), 500e18);
        vm.stopPrank();

        assertEq(amicaV2.balanceOf(user1), 1500e18);
    }
}

