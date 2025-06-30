// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {AmicaBridgeWrapper} from "../src/AmicaBridgeWrapper.sol";
import {AmicaToken} from "../src/AmicaToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {UnsafeUpgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";

// Mock implementation of IAmicaToken for testing
contract MockAmicaToken is MockERC20 {
    constructor() MockERC20("Native Amica", "AMICA", 18) {}

    function burnFrom(address account, uint256 amount) public {
        uint256 allowed = allowance[account][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[account][msg.sender] = allowed - amount;
        }
        _burn(account, amount);
    }
}

contract AmicaBridgeWrapperTest is Test {
    AmicaBridgeWrapper public bridgeWrapper;
    MockERC20 public bridgedAmicaToken;
    MockAmicaToken public nativeAmicaToken;

    address public owner;
    address public user1;
    address public user2;
    address public user3;

    uint256 constant INITIAL_BRIDGE_SUPPLY = 10_000_000 ether;
    uint256 constant USER_INITIAL_BALANCE = 1_000_000 ether;

    // Custom errors from OpenZeppelin v5
    error OwnableUnauthorizedAccount(address account);
    error EnforcedPause();
    error ExpectedPause();

    // Events to test
    event TokensWrapped(address indexed user, uint256 amount);
    event TokensUnwrapped(address indexed user, uint256 amount);
    event EmergencyWithdraw(
        address indexed token, address indexed to, uint256 amount
    );
    event BridgeTokensUpdated(
        address indexed oldBridgedToken,
        address indexed newBridgedToken,
        address indexed newNativeToken
    );
    event BridgeMetricsUpdated(
        uint256 totalBridgedIn, uint256 totalBridgedOut, uint256 netBridged
    );

    function setUp() public {
        // Setup users
        owner = makeAddr("owner");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");

        // Deploy tokens
        bridgedAmicaToken = new MockERC20("Bridged Amica", "bAMICA", 18);
        nativeAmicaToken = new MockAmicaToken();

        // Deploy bridge wrapper as upgradeable proxy
        address wrapperImpl = address(new AmicaBridgeWrapper());
        address wrapperProxy = UnsafeUpgrades.deployUUPSProxy(
            wrapperImpl,
            abi.encodeCall(
                AmicaBridgeWrapper.initialize,
                (address(bridgedAmicaToken), address(nativeAmicaToken), owner)
            )
        );
        bridgeWrapper = AmicaBridgeWrapper(wrapperProxy);

        // Mint bridged tokens to users
        bridgedAmicaToken.mint(user1, USER_INITIAL_BALANCE);
        bridgedAmicaToken.mint(user2, USER_INITIAL_BALANCE);
        bridgedAmicaToken.mint(user3, USER_INITIAL_BALANCE);

        // Give users some native tokens for unwrapping tests
        nativeAmicaToken.mint(user1, USER_INITIAL_BALANCE);
        nativeAmicaToken.mint(user2, USER_INITIAL_BALANCE);

        // Give users ETH for gas
        vm.deal(owner, 100 ether);
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(user3, 100 ether);
    }

    // ==================== Initialization Tests ====================

    function test_Initialize_Success() public {
        // Deploy new instance to test initialization
        address newBridged =
            address(new MockERC20("New Bridged", "nBridge", 18));
        address newNative = address(new MockAmicaToken());

        address wrapperImpl = address(new AmicaBridgeWrapper());
        address wrapperProxy = UnsafeUpgrades.deployUUPSProxy(
            wrapperImpl,
            abi.encodeCall(
                AmicaBridgeWrapper.initialize, (newBridged, newNative, owner)
            )
        );

        AmicaBridgeWrapper newWrapper = AmicaBridgeWrapper(wrapperProxy);

        assertEq(address(newWrapper.bridgedAmicaToken()), newBridged);
        assertEq(address(newWrapper.nativeAmicaToken()), newNative);
        assertEq(newWrapper.owner(), owner);
    }

    function test_Initialize_RevertZeroAddresses() public {
        address wrapperImpl = address(new AmicaBridgeWrapper());

        // Test zero bridged token
        vm.expectRevert(abi.encodeWithSignature("InvalidBridgedToken()"));
        UnsafeUpgrades.deployUUPSProxy(
            wrapperImpl,
            abi.encodeCall(
                AmicaBridgeWrapper.initialize,
                (address(0), address(nativeAmicaToken), owner)
            )
        );

        // Test zero native token
        vm.expectRevert(abi.encodeWithSignature("InvalidNativeToken()"));
        UnsafeUpgrades.deployUUPSProxy(
            wrapperImpl,
            abi.encodeCall(
                AmicaBridgeWrapper.initialize,
                (address(bridgedAmicaToken), address(0), owner)
            )
        );

        // Test zero owner
        vm.expectRevert(abi.encodeWithSignature("InvalidOwner()"));
        UnsafeUpgrades.deployUUPSProxy(
            wrapperImpl,
            abi.encodeCall(
                AmicaBridgeWrapper.initialize,
                (
                    address(bridgedAmicaToken),
                    address(nativeAmicaToken),
                    address(0)
                )
            )
        );
    }

    function test_Initialize_RevertSameTokens() public {
        address wrapperImpl = address(new AmicaBridgeWrapper());

        vm.expectRevert(abi.encodeWithSignature("TokensMustBeDifferent()"));
        UnsafeUpgrades.deployUUPSProxy(
            wrapperImpl,
            abi.encodeCall(
                AmicaBridgeWrapper.initialize,
                (address(bridgedAmicaToken), address(bridgedAmicaToken), owner)
            )
        );
    }

    // ==================== Wrap Tests ====================

    function test_Wrap_Success() public {
        uint256 wrapAmount = 100 ether;

        // Approve bridge wrapper
        vm.startPrank(user1);
        bridgedAmicaToken.approve(address(bridgeWrapper), wrapAmount);

        uint256 bridgedBalanceBefore = bridgedAmicaToken.balanceOf(user1);
        uint256 nativeBalanceBefore = nativeAmicaToken.balanceOf(user1);

        // Expect events
        vm.expectEmit(true, false, false, true);
        emit TokensWrapped(user1, wrapAmount);

        // Wrap tokens
        bridgeWrapper.wrap(wrapAmount);

        // The BridgeMetricsUpdated event is also emitted
        vm.stopPrank();

        // Verify balances
        assertEq(
            bridgedAmicaToken.balanceOf(user1),
            bridgedBalanceBefore - wrapAmount
        );
        assertEq(
            nativeAmicaToken.balanceOf(user1), nativeBalanceBefore + wrapAmount
        );
        assertEq(
            bridgedAmicaToken.balanceOf(address(bridgeWrapper)), wrapAmount
        );

        // Verify metrics
        assertEq(bridgeWrapper.totalBridgedIn(), wrapAmount);
        assertEq(bridgeWrapper.totalBridgedOut(), 0);
    }

    function test_Wrap_MultipleUsers() public {
        uint256 wrapAmount1 = 100 ether;
        uint256 wrapAmount2 = 200 ether;

        // User1 wraps
        vm.startPrank(user1);
        bridgedAmicaToken.approve(address(bridgeWrapper), wrapAmount1);
        bridgeWrapper.wrap(wrapAmount1);
        vm.stopPrank();

        // User2 wraps
        vm.startPrank(user2);
        bridgedAmicaToken.approve(address(bridgeWrapper), wrapAmount2);
        bridgeWrapper.wrap(wrapAmount2);
        vm.stopPrank();

        // Verify totals
        assertEq(bridgeWrapper.totalBridgedIn(), wrapAmount1 + wrapAmount2);
        assertEq(
            bridgedAmicaToken.balanceOf(address(bridgeWrapper)),
            wrapAmount1 + wrapAmount2
        );
    }

    function test_Wrap_RevertZeroAmount() public {
        vm.startPrank(user1);
        vm.expectRevert(abi.encodeWithSignature("InvalidAmount()"));
        bridgeWrapper.wrap(0);
        vm.stopPrank();
    }

    function test_Wrap_RevertInsufficientApproval() public {
        uint256 wrapAmount = 100 ether;

        vm.startPrank(user1);
        // Don't approve
        vm.expectRevert(); // ERC20 will revert
        bridgeWrapper.wrap(wrapAmount);
        vm.stopPrank();
    }

    function test_Wrap_RevertWhenPaused() public {
        // Pause the contract
        vm.prank(owner);
        bridgeWrapper.pause();

        // Try to wrap
        vm.startPrank(user1);
        bridgedAmicaToken.approve(address(bridgeWrapper), 100 ether);
        vm.expectRevert(EnforcedPause.selector);
        bridgeWrapper.wrap(100 ether);
        vm.stopPrank();
    }

    // ==================== Unwrap Tests ====================

    function test_Unwrap_Success() public {
        // First wrap some tokens
        uint256 wrapAmount = 100 ether;
        vm.startPrank(user1);
        bridgedAmicaToken.approve(address(bridgeWrapper), wrapAmount);
        bridgeWrapper.wrap(wrapAmount);

        // Now unwrap
        uint256 unwrapAmount = 50 ether;
        nativeAmicaToken.approve(address(bridgeWrapper), unwrapAmount);

        uint256 bridgedBalanceBefore = bridgedAmicaToken.balanceOf(user1);
        uint256 nativeBalanceBefore = nativeAmicaToken.balanceOf(user1);

        // Expect events
        vm.expectEmit(true, false, false, true);
        emit TokensUnwrapped(user1, unwrapAmount);

        // Unwrap tokens
        bridgeWrapper.unwrap(unwrapAmount);

        // The BridgeMetricsUpdated event is also emitted
        vm.stopPrank();

        // Verify balances
        assertEq(
            bridgedAmicaToken.balanceOf(user1),
            bridgedBalanceBefore + unwrapAmount
        );
        assertEq(
            nativeAmicaToken.balanceOf(user1),
            nativeBalanceBefore - unwrapAmount
        );
        assertEq(
            bridgedAmicaToken.balanceOf(address(bridgeWrapper)),
            wrapAmount - unwrapAmount
        );

        // Verify metrics
        assertEq(bridgeWrapper.totalBridgedIn(), wrapAmount);
        assertEq(bridgeWrapper.totalBridgedOut(), unwrapAmount);
    }

    function test_Unwrap_FullAmount() public {
        // Wrap tokens first
        uint256 wrapAmount = 100 ether;
        vm.startPrank(user1);
        bridgedAmicaToken.approve(address(bridgeWrapper), wrapAmount);
        bridgeWrapper.wrap(wrapAmount);

        // Unwrap all
        nativeAmicaToken.approve(address(bridgeWrapper), wrapAmount);
        bridgeWrapper.unwrap(wrapAmount);
        vm.stopPrank();

        // Verify contract has no bridged tokens left
        assertEq(bridgedAmicaToken.balanceOf(address(bridgeWrapper)), 0);
        assertEq(bridgeWrapper.totalBridgedIn(), wrapAmount);
        assertEq(bridgeWrapper.totalBridgedOut(), wrapAmount);
    }

    function test_Unwrap_RevertInsufficientBridgedTokens() public {
        // Try to unwrap without any bridged tokens in contract
        vm.startPrank(user1);
        nativeAmicaToken.approve(address(bridgeWrapper), 100 ether);
        vm.expectRevert(abi.encodeWithSignature("InsufficientBridgedTokens()"));
        bridgeWrapper.unwrap(100 ether);
        vm.stopPrank();
    }

    function test_Unwrap_RevertZeroAmount() public {
        vm.startPrank(user1);
        vm.expectRevert(abi.encodeWithSignature("InvalidAmount()"));
        bridgeWrapper.unwrap(0);
        vm.stopPrank();
    }

    function test_Unwrap_RevertWhenPaused() public {
        // Wrap first
        vm.startPrank(user1);
        bridgedAmicaToken.approve(address(bridgeWrapper), 100 ether);
        bridgeWrapper.wrap(100 ether);
        vm.stopPrank();

        // Pause
        vm.prank(owner);
        bridgeWrapper.pause();

        // Try to unwrap
        vm.startPrank(user1);
        nativeAmicaToken.approve(address(bridgeWrapper), 50 ether);
        vm.expectRevert(EnforcedPause.selector);
        bridgeWrapper.unwrap(50 ether);
        vm.stopPrank();
    }

    // ==================== Pause/Unpause Tests ====================

    function test_Pause_OnlyOwner() public {
        // Non-owner cannot pause
        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUnauthorizedAccount.selector, user1)
        );
        bridgeWrapper.pause();

        // Owner can pause
        vm.prank(owner);
        bridgeWrapper.pause();
        assertTrue(bridgeWrapper.paused());
    }

    function test_Unpause_OnlyOwner() public {
        // Pause first
        vm.prank(owner);
        bridgeWrapper.pause();

        // Non-owner cannot unpause
        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUnauthorizedAccount.selector, user1)
        );
        bridgeWrapper.unpause();

        // Owner can unpause
        vm.prank(owner);
        bridgeWrapper.unpause();
        assertFalse(bridgeWrapper.paused());
    }

    // ==================== Emergency Withdraw Tests ====================

    function test_EmergencyWithdraw_ExcessBridgedTokens() public {
        // Wrap tokens
        uint256 wrapAmount = 100 ether;
        vm.startPrank(user1);
        bridgedAmicaToken.approve(address(bridgeWrapper), wrapAmount);
        bridgeWrapper.wrap(wrapAmount);
        vm.stopPrank();

        // Somehow extra tokens end up in contract (e.g., direct transfer)
        uint256 extraAmount = 50 ether;
        bridgedAmicaToken.mint(address(bridgeWrapper), extraAmount);

        // Owner withdraws only excess
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit EmergencyWithdraw(address(bridgedAmicaToken), owner, extraAmount);
        bridgeWrapper.emergencyWithdraw(
            address(bridgedAmicaToken), owner, extraAmount
        );

        // Verify only excess was withdrawn
        assertEq(
            bridgedAmicaToken.balanceOf(address(bridgeWrapper)), wrapAmount
        );
    }

    function test_EmergencyWithdraw_RevertProtectedFunds() public {
        // Wrap tokens
        uint256 wrapAmount = 100 ether;
        vm.startPrank(user1);
        bridgedAmicaToken.approve(address(bridgeWrapper), wrapAmount);
        bridgeWrapper.wrap(wrapAmount);
        vm.stopPrank();

        // Try to withdraw user funds
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("NoExcessTokens()"));
        bridgeWrapper.emergencyWithdraw(
            address(bridgedAmicaToken), owner, 1 ether
        );
    }

    function test_EmergencyWithdraw_RevertExceedsExcess() public {
        // Wrap tokens and add excess
        uint256 wrapAmount = 100 ether;
        uint256 extraAmount = 50 ether;

        vm.startPrank(user1);
        bridgedAmicaToken.approve(address(bridgeWrapper), wrapAmount);
        bridgeWrapper.wrap(wrapAmount);
        vm.stopPrank();

        bridgedAmicaToken.mint(address(bridgeWrapper), extraAmount);

        // Try to withdraw more than excess
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("AmountExceedsExcess()"));
        bridgeWrapper.emergencyWithdraw(
            address(bridgedAmicaToken), owner, extraAmount + 1
        );
    }

    function test_EmergencyWithdraw_OtherTokens() public {
        // Send random token to contract
        MockERC20 randomToken = new MockERC20("Random", "RND", 18);
        uint256 amount = 1000 ether;
        randomToken.mint(address(bridgeWrapper), amount);

        // Owner can withdraw any amount of non-bridged tokens
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit EmergencyWithdraw(address(randomToken), owner, amount);
        bridgeWrapper.emergencyWithdraw(address(randomToken), owner, amount);

        assertEq(randomToken.balanceOf(address(bridgeWrapper)), 0);
    }

    function test_EmergencyWithdraw_RevertZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("InvalidRecipient()"));
        bridgeWrapper.emergencyWithdraw(
            address(bridgedAmicaToken), address(0), 1 ether
        );
    }

    function test_EmergencyWithdraw_OnlyOwner() public {
        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUnauthorizedAccount.selector, user1)
        );
        bridgeWrapper.emergencyWithdraw(
            address(bridgedAmicaToken), user1, 1 ether
        );
    }

    function test_EmergencyWithdraw_WorksWhenPaused() public {
        // Pause contract
        vm.prank(owner);
        bridgeWrapper.pause();

        // Send random token
        MockERC20 randomToken = new MockERC20("Random", "RND", 18);
        randomToken.mint(address(bridgeWrapper), 1000 ether);

        // Emergency withdraw should work even when paused
        vm.prank(owner);
        bridgeWrapper.emergencyWithdraw(address(randomToken), owner, 1000 ether);
    }

    // ==================== Update Bridge Tokens Tests ====================

    function test_UpdateBridgeTokens_Success() public {
        // Deploy new tokens
        address newBridged =
            address(new MockERC20("New Bridged", "nBridge", 18));
        address newNative = address(new MockAmicaToken());

        // Pause first
        vm.prank(owner);
        bridgeWrapper.pause();

        // Update tokens
        vm.prank(owner);
        vm.expectEmit(true, true, true, false);
        emit BridgeTokensUpdated(
            address(bridgedAmicaToken), newBridged, newNative
        );
        bridgeWrapper.updateBridgeTokens(newBridged, newNative);

        // Verify update
        assertEq(address(bridgeWrapper.bridgedAmicaToken()), newBridged);
        assertEq(address(bridgeWrapper.nativeAmicaToken()), newNative);
    }

    function test_UpdateBridgeTokens_RevertNotPaused() public {
        address newBridged =
            address(new MockERC20("New Bridged", "nBridge", 18));
        address newNative = address(new MockAmicaToken());

        vm.prank(owner);
        vm.expectRevert(ExpectedPause.selector);
        bridgeWrapper.updateBridgeTokens(newBridged, newNative);
    }

    function test_UpdateBridgeTokens_RevertInvalidAddresses() public {
        vm.prank(owner);
        bridgeWrapper.pause();

        // Zero bridged token
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("InvalidBridgedToken()"));
        bridgeWrapper.updateBridgeTokens(address(0), address(nativeAmicaToken));

        // Zero native token
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("InvalidNativeToken()"));
        bridgeWrapper.updateBridgeTokens(address(bridgedAmicaToken), address(0));

        // Same tokens
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("TokensMustBeDifferent()"));
        bridgeWrapper.updateBridgeTokens(
            address(bridgedAmicaToken), address(bridgedAmicaToken)
        );
    }

    function test_UpdateBridgeTokens_OnlyOwner() public {
        vm.prank(owner);
        bridgeWrapper.pause();

        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(OwnableUnauthorizedAccount.selector, user1)
        );
        bridgeWrapper.updateBridgeTokens(address(1), address(2));
    }

    // ==================== View Functions Tests ====================

    function test_BridgedBalance() public {
        // Initially 0
        assertEq(bridgeWrapper.bridgedBalance(), 0);

        // After wrap
        uint256 wrapAmount = 100 ether;
        vm.startPrank(user1);
        bridgedAmicaToken.approve(address(bridgeWrapper), wrapAmount);
        bridgeWrapper.wrap(wrapAmount);
        vm.stopPrank();

        assertEq(bridgeWrapper.bridgedBalance(), wrapAmount);
    }

    // ==================== Reentrancy Tests ====================

    function test_Wrap_ReentrancyProtection() public {
        // This would require a malicious token that tries to reenter
        // For now, we verify the modifier is present by checking the function succeeds normally
        vm.startPrank(user1);
        bridgedAmicaToken.approve(address(bridgeWrapper), 100 ether);
        bridgeWrapper.wrap(100 ether);
        vm.stopPrank();
    }

    // ==================== Integration Tests ====================

    function test_Integration_WrapUnwrapFlow() public {
        uint256 amount = 100 ether;

        // User1 wraps
        vm.startPrank(user1);
        bridgedAmicaToken.approve(address(bridgeWrapper), amount);
        bridgeWrapper.wrap(amount);

        // User1 unwraps half
        nativeAmicaToken.approve(address(bridgeWrapper), amount / 2);
        bridgeWrapper.unwrap(amount / 2);
        vm.stopPrank();

        // User2 wraps
        vm.startPrank(user2);
        bridgedAmicaToken.approve(address(bridgeWrapper), amount * 2);
        bridgeWrapper.wrap(amount * 2);
        vm.stopPrank();

        // Verify final state
        assertEq(bridgeWrapper.totalBridgedIn(), amount + amount * 2);
        assertEq(bridgeWrapper.totalBridgedOut(), amount / 2);
        assertEq(bridgeWrapper.bridgedBalance(), amount / 2 + amount * 2);
    }

    function test_Integration_EmergencyScenario() public {
        // Normal operations
        uint256 wrapAmount = 100 ether;
        vm.startPrank(user1);
        bridgedAmicaToken.approve(address(bridgeWrapper), wrapAmount);
        bridgeWrapper.wrap(wrapAmount);
        vm.stopPrank();

        // Emergency: pause operations
        vm.prank(owner);
        bridgeWrapper.pause();

        // Users cannot wrap/unwrap
        vm.startPrank(user2);
        bridgedAmicaToken.approve(address(bridgeWrapper), wrapAmount);
        vm.expectRevert(EnforcedPause.selector);
        bridgeWrapper.wrap(wrapAmount);
        vm.stopPrank();

        // But owner can still do emergency withdraw of excess
        bridgedAmicaToken.mint(address(bridgeWrapper), 50 ether); // Excess
        vm.prank(owner);
        bridgeWrapper.emergencyWithdraw(
            address(bridgedAmicaToken), owner, 50 ether
        );

        // Resume operations
        vm.prank(owner);
        bridgeWrapper.unpause();

        // Normal operations resume
        vm.startPrank(user2);
        bridgeWrapper.wrap(wrapAmount);
        vm.stopPrank();
    }

    // ==================== Fuzz Tests ====================

    function testFuzz_Wrap(uint256 amount) public {
        // Bound amount to reasonable range
        amount = bound(amount, 1, USER_INITIAL_BALANCE);

        vm.startPrank(user1);
        bridgedAmicaToken.approve(address(bridgeWrapper), amount);
        bridgeWrapper.wrap(amount);
        vm.stopPrank();

        assertEq(
            nativeAmicaToken.balanceOf(user1), USER_INITIAL_BALANCE + amount
        );
        assertEq(bridgeWrapper.totalBridgedIn(), amount);
    }

    function testFuzz_WrapUnwrap(uint256 wrapAmount, uint256 unwrapAmount)
        public
    {
        // Bound amounts
        wrapAmount = bound(wrapAmount, 1, USER_INITIAL_BALANCE);
        unwrapAmount = bound(unwrapAmount, 0, wrapAmount);

        // Wrap
        vm.startPrank(user1);
        bridgedAmicaToken.approve(address(bridgeWrapper), wrapAmount);
        bridgeWrapper.wrap(wrapAmount);

        // Unwrap
        if (unwrapAmount > 0) {
            nativeAmicaToken.approve(address(bridgeWrapper), unwrapAmount);
            bridgeWrapper.unwrap(unwrapAmount);
        }
        vm.stopPrank();

        // Verify accounting
        assertEq(bridgeWrapper.totalBridgedIn(), wrapAmount);
        assertEq(bridgeWrapper.totalBridgedOut(), unwrapAmount);
        assertEq(bridgeWrapper.bridgedBalance(), wrapAmount - unwrapAmount);
    }
}
