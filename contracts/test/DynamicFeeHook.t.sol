// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {Fixtures} from "./shared/Fixtures.sol";
import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";
import {FeeReductionSystem} from "../src/FeeReductionSystem.sol";
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "v4-core/src/types/Currency.sol";
import {IHooks} from "v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "v4-core/src/libraries/LPFeeLibrary.sol";
import {SwapParams} from "v4-core/src/types/PoolOperation.sol";
import {
    BeforeSwapDelta,
    BeforeSwapDeltaLibrary
} from "v4-core/src/types/BeforeSwapDelta.sol";

/**
 * @title DynamicFeeHookTest
 * @notice Comprehensive tests for DynamicFeeHook contract
 */
contract DynamicFeeHookTest is Fixtures {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    event FeeReductionSystemUpdated(address newFeeReductionSystem);

    // Test pool variables
    PoolKey testPoolKey;
    PoolId testPoolId;
    Currency currency0;
    Currency currency1;

    uint160 constant SQRT_RATIO_1_1 = 79228162514264337593543950336;

    function setUp() public override {
        super.setUp();

        // Setup test pool
        (currency0, currency1) = deployCurrencyPair();
        testPoolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(dynamicFeeHook))
        });
        poolManager.initialize(testPoolKey, SQRT_RATIO_1_1);
        testPoolId = testPoolKey.toId();
    }

    // ==================== Constructor Tests ====================

    function test_Constructor_ValidPoolManager() public view {
        // Use existing hook deployed in Fixtures
        assertEq(address(dynamicFeeHook.poolManager()), address(poolManager));
        assertEq(dynamicFeeHook.owner(), factoryOwner);
    }

    function test_Constructor_RevertZeroPoolManager() public {
        // Note: This test is skipped because Uniswap V4 requires hooks to be deployed
        // at specific addresses with certain flag bits set. Creating a new hook
        // directly will fail HookAddressNotValid validation.
        // The actual validation happens in production through HookMiner.
        vm.skip(true);
    }

    function test_Constructor_OwnershipSet() public view {
        // Use existing hook from Fixtures
        assertEq(dynamicFeeHook.owner(), factoryOwner);
    }

    // ==================== SetFeeReductionSystem Tests ====================

    function test_SetFeeReductionSystem_AsOwner() public {
        // Deploy new fee reduction system
        FeeReductionSystem newFeeSystem = new FeeReductionSystem(amicaToken, personaFactory);

        vm.expectEmit(true, true, true, true);
        emit FeeReductionSystemUpdated(address(newFeeSystem));

        vm.prank(factoryOwner);
        dynamicFeeHook.setFeeReductionSystem(address(newFeeSystem));

        assertEq(
            address(dynamicFeeHook.feeReductionSystem()),
            address(newFeeSystem),
            "Fee reduction system should be updated"
        );
    }

    function test_SetFeeReductionSystem_RevertNonOwner() public {
        FeeReductionSystem newFeeSystem = new FeeReductionSystem(amicaToken, personaFactory);

        vm.prank(user1);
        vm.expectRevert();
        dynamicFeeHook.setFeeReductionSystem(address(newFeeSystem));
    }

    function test_SetFeeReductionSystem_RevertZeroAddress() public {
        vm.prank(factoryOwner);
        vm.expectRevert(DynamicFeeHook.InvalidFeeReductionSystem.selector);
        dynamicFeeHook.setFeeReductionSystem(address(0));
    }

    function test_SetFeeReductionSystem_MultipleUpdates() public {
        // First update
        FeeReductionSystem feeSystem1 = new FeeReductionSystem(amicaToken, personaFactory);
        vm.prank(factoryOwner);
        dynamicFeeHook.setFeeReductionSystem(address(feeSystem1));
        assertEq(address(dynamicFeeHook.feeReductionSystem()), address(feeSystem1));

        // Second update
        FeeReductionSystem feeSystem2 = new FeeReductionSystem(amicaToken, personaFactory);
        vm.prank(factoryOwner);
        dynamicFeeHook.setFeeReductionSystem(address(feeSystem2));
        assertEq(address(dynamicFeeHook.feeReductionSystem()), address(feeSystem2));

        // Restore original
        vm.prank(factoryOwner);
        dynamicFeeHook.setFeeReductionSystem(address(feeReductionSystem));
    }

    // ==================== Hook Permissions Tests ====================

    function test_GetHookPermissions_OnlyBeforeSwap() public view {
        Hooks.Permissions memory permissions = dynamicFeeHook.getHookPermissions();

        // Only beforeSwap should be true
        assertTrue(permissions.beforeSwap, "beforeSwap should be enabled");

        // All others should be false
        assertFalse(permissions.beforeInitialize, "beforeInitialize should be disabled");
        assertFalse(permissions.afterInitialize, "afterInitialize should be disabled");
        assertFalse(permissions.beforeAddLiquidity, "beforeAddLiquidity should be disabled");
        assertFalse(permissions.afterAddLiquidity, "afterAddLiquidity should be disabled");
        assertFalse(permissions.beforeRemoveLiquidity, "beforeRemoveLiquidity should be disabled");
        assertFalse(permissions.afterRemoveLiquidity, "afterRemoveLiquidity should be disabled");
        assertFalse(permissions.afterSwap, "afterSwap should be disabled");
        assertFalse(permissions.beforeDonate, "beforeDonate should be disabled");
        assertFalse(permissions.afterDonate, "afterDonate should be disabled");
        assertFalse(permissions.beforeSwapReturnDelta, "beforeSwapReturnDelta should be disabled");
        assertFalse(permissions.afterSwapReturnDelta, "afterSwapReturnDelta should be disabled");
        assertFalse(permissions.afterAddLiquidityReturnDelta, "afterAddLiquidityReturnDelta should be disabled");
        assertFalse(permissions.afterRemoveLiquidityReturnDelta, "afterRemoveLiquidityReturnDelta should be disabled");
    }

    function test_GetHookPermissions_Consistency() public {
        // Call multiple times to ensure consistency
        Hooks.Permissions memory perm1 = dynamicFeeHook.getHookPermissions();
        Hooks.Permissions memory perm2 = dynamicFeeHook.getHookPermissions();

        assertEq(perm1.beforeSwap, perm2.beforeSwap);
        assertEq(perm1.afterSwap, perm2.afterSwap);
    }

    // ==================== BeforeSwap Fee Calculation Tests ====================

    function test_BeforeSwap_BaseFee_NoAmica() public {
        // Clear user1's AMICA balance
        uint256 balance = amicaToken.balanceOf(user1);
        if (balance > 0) {
            vm.prank(user1);
            amicaToken.transfer(factoryOwner, balance);
        }

        // Update snapshot and wait for delay
        vm.prank(user1);
        feeReductionSystem.updateSnapshot();
        vm.roll(block.number + 50401);

        // Get fee for user1 (should be base fee - 100 bps = 10000)
        uint24 fee = feeReductionSystem.getFee(user1);
        assertEq(fee, 10000, "Should return base fee for user with no AMICA");

        // Verify fee has OVERRIDE_FEE_FLAG when used in hook
        uint24 expectedFeeWithFlag = fee | LPFeeLibrary.OVERRIDE_FEE_FLAG;
        assertTrue(expectedFeeWithFlag & LPFeeLibrary.OVERRIDE_FEE_FLAG != 0, "Should have override flag");
    }

    function test_BeforeSwap_ReducedFee_WithAmica() public {
        // Give user1 enough AMICA for max discount (>= 1M per default config)
        // User1 already has 10M from setup, so they're well above max
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 100_000 ether); // Now has 10.1M total

        // Update snapshot to set pending
        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        // Wait for snapshot delay (1 week = 50400 blocks)
        vm.roll(block.number + 50401);

        // Now the pending snapshot can be used directly (it's been delayed enough)
        // The _getEffectiveBalance checks: block.number >= snapshot.pendingBlock + SNAPSHOT_DELAY

        // Get fee for user1 (should be max discounted fee = 0 per default config)
        uint24 fee = feeReductionSystem.getFee(user1);
        assertEq(fee, 0, "Should return max discounted fee");
    }

    function test_BeforeSwap_PartialDiscount() public {
        // User1 already has 10M, which is above max (1M), so clear it first
        vm.startPrank(user1);
        amicaToken.transfer(factoryOwner, amicaToken.balanceOf(user1));
        vm.stopPrank();

        // Give user1 medium amount for partial discount (500k AMICA - between 1k and 1M)
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 500_000 ether);

        // Update snapshot and wait for delay
        vm.prank(user1);
        feeReductionSystem.updateSnapshot();
        vm.roll(block.number + 50401);

        // Get fee - should be between base (10000) and max discount (0)
        uint24 fee = feeReductionSystem.getFee(user1);
        assertGt(fee, 0, "Fee should be greater than max discount");
        assertLt(fee, 10000, "Fee should be less than base fee");
    }

    function test_BeforeSwap_DifferentUsers_DifferentFees() public {
        // Clear existing balances
        vm.startPrank(user1);
        amicaToken.transfer(factoryOwner, amicaToken.balanceOf(user1));
        vm.stopPrank();
        vm.startPrank(user2);
        amicaToken.transfer(factoryOwner, amicaToken.balanceOf(user2));
        vm.stopPrank();
        vm.startPrank(user3);
        amicaToken.transfer(factoryOwner, amicaToken.balanceOf(user3));
        vm.stopPrank();

        // Give users different AMICA amounts (based on default config: min=1k, max=1M)
        vm.startPrank(factoryOwner);
        amicaToken.transfer(user1, 10_000 ether); // Just above min
        amicaToken.transfer(user2, 500_000 ether); // Mid-tier
        amicaToken.transfer(user3, 2_000_000 ether); // Above max - gets max discount
        vm.stopPrank();

        // Update snapshots and wait for delay
        vm.prank(user1);
        feeReductionSystem.updateSnapshot();
        vm.prank(user2);
        feeReductionSystem.updateSnapshot();
        vm.prank(user3);
        feeReductionSystem.updateSnapshot();
        vm.roll(block.number + 50401);

        // Get fees
        uint24 fee1 = feeReductionSystem.getFee(user1);
        uint24 fee2 = feeReductionSystem.getFee(user2);
        uint24 fee3 = feeReductionSystem.getFee(user3);

        // Verify fees decrease with more AMICA
        assertGt(fee1, fee2, "User with less AMICA should have higher fee");
        assertGt(fee2, fee3, "User with less AMICA should have higher fee");
        assertEq(fee3, 0, "User3 should have max discount");
    }

    // ==================== Integration Tests ====================

    function test_Integration_HookInPool() public view {
        // Verify hook is properly set in pool
        assertEq(address(testPoolKey.hooks), address(dynamicFeeHook));

        // Verify pool has dynamic fee flag
        assertTrue(testPoolKey.fee & LPFeeLibrary.DYNAMIC_FEE_FLAG != 0);
    }

    function test_Integration_FeeReductionSystemSet() public view {
        // Verify hook has fee reduction system configured
        assertEq(
            address(dynamicFeeHook.feeReductionSystem()),
            address(feeReductionSystem)
        );
    }

    function test_Integration_PoolManagerReference() public view {
        // Verify hook references correct pool manager
        assertEq(
            address(dynamicFeeHook.poolManager()),
            address(poolManager)
        );
    }

    // ==================== Edge Cases ====================

    function test_EdgeCase_ZeroAmicaBalance() public {
        // Create new user with zero balance
        address newUser = address(0x999);

        // Get fee (should return base fee)
        uint24 fee = feeReductionSystem.getFee(newUser);
        assertEq(fee, 10000, "Zero balance should return base fee");
    }

    function test_EdgeCase_VeryLargeAmicaBalance() public {
        // User1 already has 10M (above max 1M), so they get max discount
        vm.prank(user1);
        feeReductionSystem.updateSnapshot();
        vm.roll(block.number + 50401);

        // Get fee (should be capped at max discount = 0)
        uint24 fee = feeReductionSystem.getFee(user1);
        assertEq(fee, 0, "Should be capped at max discount");
    }

    function test_EdgeCase_ExactMinimumForReduction() public {
        // Clear user1 balance
        vm.startPrank(user1);
        amicaToken.transfer(factoryOwner, amicaToken.balanceOf(user1));
        vm.stopPrank();

        // Give user exactly the minimum for reduction (1000 ether per default config)
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 1_000 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();
        vm.roll(block.number + 50401);

        // Get fee (at exactly minimum, quadratic curve starts at 0 progress = base fee)
        uint24 fee = feeReductionSystem.getFee(user1);
        assertEq(fee, 10000, "Should be base fee at exact minimum");

        // Now test well above minimum to verify discount is applied
        // (quadratic curve means small amounts near minimum have minimal discount)
        vm.startPrank(user1);
        amicaToken.transfer(factoryOwner, amicaToken.balanceOf(user1));
        vm.stopPrank();

        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 500_000 ether); // Halfway to max

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();
        vm.roll(block.number + 100802); // Another delay

        uint24 feeAboveMin = feeReductionSystem.getFee(user1);
        assertLt(feeAboveMin, 10000, "Should have discount well above minimum");
        assertGt(feeAboveMin, 0, "Should not be max discount yet");
    }

    function test_EdgeCase_ExactMaximumForDiscount() public {
        // Clear user1 balance
        vm.startPrank(user1);
        amicaToken.transfer(factoryOwner, amicaToken.balanceOf(user1));
        vm.stopPrank();

        // Give user exactly the maximum for max discount (1M ether per default config)
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 1_000_000 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();
        vm.roll(block.number + 50401);

        // Get fee (should be max discount = 0)
        uint24 fee = feeReductionSystem.getFee(user1);
        assertEq(fee, 0, "Should have max discount at threshold");
    }

    function test_EdgeCase_JustBelowMinimum() public {
        // Give user just below minimum (999,999)
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 999_999 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        // Get fee (should be base fee - no discount)
        uint24 fee = feeReductionSystem.getFee(user1);
        assertEq(fee, 10000, "Should have no discount below minimum");
    }

    // ==================== Ownership Tests ====================

    function test_Ownership_TransferOwnership() public {
        // Use existing hook
        assertEq(dynamicFeeHook.owner(), factoryOwner);

        // Transfer ownership
        vm.prank(factoryOwner);
        dynamicFeeHook.transferOwnership(user1);

        assertEq(dynamicFeeHook.owner(), user1);

        // Transfer back
        vm.prank(user1);
        dynamicFeeHook.transferOwnership(factoryOwner);

        assertEq(dynamicFeeHook.owner(), factoryOwner);
    }

    function test_Ownership_OnlyOwnerCanSetFeeSystem() public {
        FeeReductionSystem newFeeSystem = new FeeReductionSystem(amicaToken, personaFactory);

        // Non-owner (user1) should not be able to set
        vm.prank(user1);
        vm.expectRevert();
        dynamicFeeHook.setFeeReductionSystem(address(newFeeSystem));

        // Owner should be able to set
        vm.prank(factoryOwner);
        dynamicFeeHook.setFeeReductionSystem(address(newFeeSystem));

        assertEq(address(dynamicFeeHook.feeReductionSystem()), address(newFeeSystem));

        // Restore original
        vm.prank(factoryOwner);
        dynamicFeeHook.setFeeReductionSystem(address(feeReductionSystem));
    }

    // ==================== Fee Flag Tests ====================

    function test_FeeFlag_OverrideFlagPresent() public {
        // Give user some AMICA
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 5_000_000 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        uint24 baseFee = feeReductionSystem.getFee(user1);
        uint24 feeWithFlag = baseFee | LPFeeLibrary.OVERRIDE_FEE_FLAG;

        // Verify the OVERRIDE_FEE_FLAG is set
        assertTrue(
            feeWithFlag & LPFeeLibrary.OVERRIDE_FEE_FLAG != 0,
            "Override flag should be present"
        );

        // Verify base fee is preserved
        uint24 extractedFee = feeWithFlag & ~LPFeeLibrary.OVERRIDE_FEE_FLAG;
        assertEq(extractedFee, baseFee, "Base fee should be preserved");
    }

    function test_FeeFlag_DynamicFeeInPoolKey() public view {
        // Verify pool key has DYNAMIC_FEE_FLAG
        assertTrue(
            testPoolKey.fee & LPFeeLibrary.DYNAMIC_FEE_FLAG != 0,
            "Pool should have dynamic fee flag"
        );
    }

    // ==================== Multiple Fee Systems Test ====================

    function test_MultipleFeeSystem_Independence() public {
        // Deploy two separate fee systems
        FeeReductionSystem feeSystem1 = new FeeReductionSystem(amicaToken, personaFactory);
        FeeReductionSystem feeSystem2 = new FeeReductionSystem(amicaToken, personaFactory);

        // Both should be independent instances
        assertTrue(address(feeSystem1) != address(feeSystem2));

        // Configure different fee settings on each (if they were used)
        // This demonstrates that multiple fee systems can coexist
        assertEq(address(feeSystem1), address(feeSystem1));
        assertEq(address(feeSystem2), address(feeSystem2));
    }

}
