// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "forge-std/console.sol";

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
import {IPoolManager} from "v4-core/src/interfaces/IPoolManager.sol";

import {Fixtures} from "../test/shared/Fixtures.sol";
import {FeeReductionSystem} from "../src/FeeReductionSystem.sol";
import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";

contract FeeReductionSystemTest is Fixtures {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    // Events
    event SnapshotUpdated(
        address indexed user, uint256 balance, uint256 blockNumber
    );
    event FeeReductionConfigUpdated(
        uint256 minAmicaForReduction,
        uint256 maxAmicaForReduction,
        uint24 baseFee,
        uint24 maxDiscountedFee
    );
    event FeeReductionSystemUpdated(address newFeeReductionSystem);

    // Constants
    uint160 constant SQRT_RATIO_1_1 = 79228162514264337593543950336;

    // Test pool variables
    PoolKey testPoolKey;
    PoolId testPoolId;
    Currency currency0;
    Currency currency1;

    function setUp() public override {
        super.setUp();

        // Setup test pool for integration tests
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

    // ==================== Helper Functions ====================

    function clearUserBalance(address user) internal {
        uint256 balance = amicaToken.balanceOf(user);
        if (balance > 0) {
            vm.prank(user);
            amicaToken.transfer(factoryOwner, balance);
        }
    }

    function clearAllUserBalances() internal {
        clearUserBalance(user1);
        clearUserBalance(user2);
        clearUserBalance(user3);
        clearUserBalance(address(this));
    }

    // ==================== Basic Setup Tests ====================

    function test_BasicSetup() public {
        // Verify hook is deployed
        assertTrue(
            address(dynamicFeeHook) != address(0), "Hook should be deployed"
        );

        // Verify fee reduction system is deployed
        assertTrue(
            address(feeReductionSystem) != address(0),
            "FeeReductionSystem should be deployed"
        );

        // Verify hook has fee reduction system set
        assertEq(
            address(dynamicFeeHook.feeReductionSystem()),
            address(feeReductionSystem),
            "Hook should have FeeReductionSystem set"
        );

        // Verify ownership
        assertEq(
            dynamicFeeHook.owner(),
            factoryOwner,
            "Hook owner should be factoryOwner"
        );
        assertEq(
            feeReductionSystem.owner(),
            factoryOwner,
            "FeeReductionSystem owner should be factoryOwner"
        );
    }

    function test_Constructor_FeeReductionSystem() public {
        FeeReductionSystem newSystem =
            new FeeReductionSystem(amicaToken, personaFactory);

        assertEq(address(newSystem.amicaToken()), address(amicaToken));
        assertEq(address(newSystem.factory()), address(personaFactory));
        assertEq(newSystem.owner(), address(this));

        // Check default config
        (
            uint256 minAmicaForReduction,
            uint256 maxAmicaForReduction,
            uint24 baseFee,
            uint24 maxDiscountedFee
        ) = newSystem.feeReductionConfig();

        assertEq(minAmicaForReduction, 1000 ether);
        assertEq(maxAmicaForReduction, 1_000_000 ether);
        assertEq(baseFee, 10000);
        assertEq(maxDiscountedFee, 0);
    }

    // ==================== Configuration Tests ====================

    function test_ConfigureFeeReduction_Success() public {
        uint256 newMin = 500 ether;
        uint256 newMax = 500_000 ether;
        uint24 newBaseFee = 20000;
        uint24 newMaxDiscountedFee = 1000;

        vm.prank(factoryOwner);
        vm.expectEmit(true, true, true, true);
        emit FeeReductionConfigUpdated(
            newMin, newMax, newBaseFee, newMaxDiscountedFee
        );

        feeReductionSystem.configureFeeReduction(
            newMin, newMax, newBaseFee, newMaxDiscountedFee
        );

        (
            uint256 minAmicaForReduction,
            uint256 maxAmicaForReduction,
            uint24 baseFee,
            uint24 maxDiscountedFee
        ) = feeReductionSystem.feeReductionConfig();

        assertEq(minAmicaForReduction, newMin);
        assertEq(maxAmicaForReduction, newMax);
        assertEq(baseFee, newBaseFee);
        assertEq(maxDiscountedFee, newMaxDiscountedFee);
    }

    function test_ConfigureFeeReduction_RevertNotOwner() public {
        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSignature(
                "OwnableUnauthorizedAccount(address)", user1
            )
        );
        feeReductionSystem.configureFeeReduction(
            500 ether, 500_000 ether, 20000, 1000
        );
    }

    function test_ConfigureFeeReduction_RevertInvalidMinMax() public {
        vm.prank(factoryOwner);
        vm.expectRevert(FeeReductionSystem.InvalidConfiguration.selector);
        feeReductionSystem.configureFeeReduction(
            500_000 ether, 500_000 ether, 20000, 1000
        );

        vm.prank(factoryOwner);
        vm.expectRevert(FeeReductionSystem.InvalidConfiguration.selector);
        feeReductionSystem.configureFeeReduction(
            500_000 ether, 100 ether, 20000, 1000
        );
    }

    function test_ConfigureFeeReduction_RevertBaseFeeExceedsMax() public {
        vm.prank(factoryOwner);
        vm.expectRevert(FeeReductionSystem.InvalidConfiguration.selector);
        feeReductionSystem.configureFeeReduction(
            500 ether, 500_000 ether, 1_000_001, 1000
        );
    }

    function test_ConfigureFeeReduction_RevertMaxDiscountedFeeExceedsBase()
        public
    {
        vm.prank(factoryOwner);
        vm.expectRevert(FeeReductionSystem.InvalidConfiguration.selector);
        feeReductionSystem.configureFeeReduction(
            500 ether, 500_000 ether, 10000, 10001
        );
    }

    // ==================== Snapshot Tests ====================

    function test_UpdateSnapshot_WithSufficientBalance() public {
        clearUserBalance(user1);

        // Give user AMICA tokens
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 5000 ether);

        vm.prank(user1);
        vm.expectEmit(true, false, false, true);
        emit SnapshotUpdated(user1, 5000 ether, block.number);
        feeReductionSystem.updateSnapshot();

        (
            uint256 activeBalance,
            uint256 activeBlock,
            uint256 pendingBalance,
            uint256 pendingBlock
        ) = feeReductionSystem.userSnapshots(user1);

        assertEq(activeBalance, 0);
        assertEq(activeBlock, 0);
        assertEq(pendingBalance, 5000 ether);
        assertEq(pendingBlock, block.number);
    }

    function test_UpdateSnapshot_BelowMinimumClearsSnapshot() public {
        clearUserBalance(user1);

        // First create a snapshot
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 5000 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        // Transfer tokens away to go below minimum
        vm.prank(user1);
        amicaToken.transfer(user2, 4500 ether);

        // Update snapshot again - should clear it
        vm.prank(user1);
        vm.expectEmit(true, false, false, true);
        emit SnapshotUpdated(user1, 0, block.number);
        feeReductionSystem.updateSnapshot();

        (
            uint256 activeBalance,
            uint256 activeBlock,
            uint256 pendingBalance,
            uint256 pendingBlock
        ) = feeReductionSystem.userSnapshots(user1);

        assertEq(activeBalance, 0);
        assertEq(activeBlock, 0);
        assertEq(pendingBalance, 0);
        assertEq(pendingBlock, 0);
    }

    function test_UpdateSnapshot_PromotesPendingToActive() public {
        clearUserBalance(user1);

        // Give user AMICA tokens
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 5000 ether);

        // First snapshot
        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        uint256 firstBlock = block.number;

        // Wait for delay
        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        // Update balance
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 3000 ether);

        // Second snapshot - should promote pending to active
        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        (
            uint256 activeBalance,
            uint256 activeBlock,
            uint256 pendingBalance,
            uint256 pendingBlock
        ) = feeReductionSystem.userSnapshots(user1);

        assertEq(activeBalance, 5000 ether);
        assertEq(activeBlock, firstBlock);
        assertEq(pendingBalance, 8000 ether);
        assertEq(pendingBlock, block.number);
    }

    // ==================== Fee Calculation Tests ====================

    function test_SimpleFeeCalculation() public {
        clearUserBalance(user1);

        // Test with no AMICA balance
        uint24 fee = feeReductionSystem.getFee(user1);
        assertEq(fee, 10000, "Should return base fee for user with no AMICA");

        // Give user some AMICA (above minimum threshold)
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 10_000 ether);

        // Update snapshot
        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        // Fee should still be base fee (snapshot not active yet)
        fee = feeReductionSystem.getFee(user1);
        assertEq(fee, 10000, "Should still be base fee before snapshot delay");

        // Wait for snapshot to become active
        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        // Now fee should be reduced
        fee = feeReductionSystem.getFee(user1);
        assertTrue(
            fee < 10000, "Fee should be reduced after snapshot is active"
        );

        // With 10k AMICA, fee should be very close to base
        assertTrue(
            fee >= 9990, "Fee should be close to base with small balance"
        );
        assertTrue(fee <= 10000, "Fee should not exceed base");
    }

    function test_GetFee_NoSnapshot() public {
        clearUserBalance(user1);
        uint24 fee = feeReductionSystem.getFee(user1);
        assertEq(fee, 10000); // Base fee
    }

    function test_GetFee_SnapshotNotYetActive() public {
        clearUserBalance(user1);

        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 5000 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        // Check fee before delay
        uint24 fee = feeReductionSystem.getFee(user1);
        assertEq(fee, 10000); // Still base fee
    }

    function test_GetFee_BelowMinimum() public {
        clearUserBalance(user1);

        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 500 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        uint24 fee = feeReductionSystem.getFee(user1);
        assertEq(fee, 10000); // Base fee
    }

    function test_GetFee_AtMinimum() public {
        clearUserBalance(user1);

        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 1000 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        uint24 fee = feeReductionSystem.getFee(user1);
        assertEq(fee, 10000); // Still base fee at exact minimum
    }

    function test_GetFee_AboveMinimum() public {
        clearUserBalance(user1);

        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 10_000 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        uint24 fee = feeReductionSystem.getFee(user1);
        assertTrue(fee < 10000); // Reduced fee
        assertTrue(fee > 0); // But not zero
    }

    function test_GetFee_AtMaximum() public {
        clearUserBalance(user1);

        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 1_000_000 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        uint24 fee = feeReductionSystem.getFee(user1);
        assertEq(fee, 0); // Max discount
    }

    function test_GetFee_AboveMaximum() public {
        clearUserBalance(user1);

        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 2_000_000 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        uint24 fee = feeReductionSystem.getFee(user1);
        assertEq(fee, 0); // Still max discount
    }

    function test_GetFee_UsesMinimumOfSnapshotAndCurrent() public {
        clearUserBalance(user1);

        // Give user initial balance
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 100_000 ether);

        // Take snapshot
        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        // Wait for snapshot to become active
        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        // Transfer away some tokens
        vm.prank(user1);
        amicaToken.transfer(user2, 50_000 ether);

        // Fee should be based on current balance (50k), not snapshot (100k)
        uint24 fee1 = feeReductionSystem.getFee(user1);

        // Now give user more tokens
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 100_000 ether); // Now has 150k

        // Fee should still be based on snapshot (100k), not current (150k)
        uint24 fee2 = feeReductionSystem.getFee(user1);

        // fee1 should be higher (less discount) than fee2
        assertTrue(fee1 > fee2);
    }

    // ==================== View Function Tests ====================

    function test_GetBlocksUntilActive_NoPendingSnapshot() public {
        clearUserBalance(user1);
        uint256 blocks = feeReductionSystem.getBlocksUntilActive(user1);
        assertEq(blocks, 0);
    }

    function test_GetBlocksUntilActive_WithPendingSnapshot() public {
        clearUserBalance(user1);

        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 5000 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        uint256 blocks = feeReductionSystem.getBlocksUntilActive(user1);
        assertEq(blocks, feeReductionSystem.SNAPSHOT_DELAY());

        // Advance some blocks
        vm.roll(block.number + 50);
        blocks = feeReductionSystem.getBlocksUntilActive(user1);
        assertEq(blocks, feeReductionSystem.SNAPSHOT_DELAY() - 50);
    }

    function test_GetBlocksUntilActive_AlreadyActive() public {
        clearUserBalance(user1);

        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 5000 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        uint256 blocks = feeReductionSystem.getBlocksUntilActive(user1);
        assertEq(blocks, 0);
    }

    function test_GetEffectiveBalance_NoSnapshot() public {
        clearUserBalance(user1);
        uint256 balance = feeReductionSystem.getEffectiveBalance(user1);
        assertEq(balance, 0);
    }

    function test_GetEffectiveBalance_PendingNotActive() public {
        clearUserBalance(user1);

        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 5000 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        uint256 balance = feeReductionSystem.getEffectiveBalance(user1);
        assertEq(balance, 0);
    }

    function test_GetEffectiveBalance_ActiveSnapshot() public {
        clearUserBalance(user1);

        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 5000 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        // Wait for pending to become active
        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        // Update again to promote pending to active
        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        uint256 balance = feeReductionSystem.getEffectiveBalance(user1);
        assertEq(balance, 5000 ether);
    }

    // ==================== Quadratic Curve Test ====================

    function test_FeeReduction_QuadraticCurve() public {
        // Ensure test contract has enough tokens
        vm.prank(factoryOwner);
        amicaToken.transfer(address(this), 10_000_000 ether);

        // Test that fee reduction follows quadratic curve
        uint256[] memory testAmounts = new uint256[](5);
        testAmounts[0] = 100_000 ether; // 10% of range
        testAmounts[1] = 250_000 ether; // 25% of range
        testAmounts[2] = 500_000 ether; // 50% of range
        testAmounts[3] = 750_000 ether; // 75% of range
        testAmounts[4] = 900_000 ether; // 90% of range

        uint24[] memory fees = new uint24[](5);

        for (uint256 i = 0; i < testAmounts.length; i++) {
            // Clear user1 balance
            clearUserBalance(user1);

            // Transfer from test contract
            amicaToken.transfer(user1, testAmounts[i]);

            vm.prank(user1);
            feeReductionSystem.updateSnapshot();

            vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

            fees[i] = feeReductionSystem.getFee(user1);
        }

        // Verify quadratic progression
        uint256 reduction1 = 10000 - fees[0]; // 10% progress
        uint256 reduction2 = 10000 - fees[1]; // 25% progress
        uint256 reduction3 = 10000 - fees[2]; // 50% progress
        uint256 reduction4 = 10000 - fees[3]; // 75% progress
        uint256 reduction5 = 10000 - fees[4]; // 90% progress

        // Due to quadratic curve, later reductions should be proportionally larger
        assertTrue(reduction2 > (reduction1 * 25) / 10); // reduction2 > reduction1 * 2.5
        assertTrue(reduction3 > reduction1 * 5);
        assertTrue(reduction4 > (reduction1 * 75) / 10); // reduction4 > reduction1 * 7.5
        assertTrue(reduction5 > reduction1 * 9);
    }

    // ==================== Edge Cases ====================

    function test_EdgeCase_MultipleSnapshotUpdates() public {
        clearUserBalance(user1);

        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 5000 ether);

        // First update
        vm.prank(user1);
        feeReductionSystem.updateSnapshot();
        uint256 firstBlock = block.number;

        // Immediate second update (should overwrite pending)
        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        (,, uint256 pendingBalance,) = feeReductionSystem.userSnapshots(user1);
        assertEq(pendingBalance, 5000 ether);

        // Wait and update again
        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 3000 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        (uint256 activeBalance,,,) = feeReductionSystem.userSnapshots(user1);
        assertEq(activeBalance, 5000 ether);
    }

    function test_EdgeCase_TransferAllTokensAfterSnapshot() public {
        clearUserBalance(user1);

        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 100_000 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        // Transfer all tokens away
        vm.prank(user1);
        amicaToken.transfer(user2, 100_000 ether);

        // Should get base fee since effective balance is 0
        uint24 fee = feeReductionSystem.getFee(user1);
        assertEq(fee, 10000);
    }

    function test_EdgeCase_ZeroToMaxBalance() public {
        clearUserBalance(user1);

        // Give max balance
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 1_000_000 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();
        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        uint24 fee = feeReductionSystem.getFee(user1);
        assertEq(fee, 0, "Max balance should give zero fee");

        // Lose all tokens
        vm.prank(user1);
        amicaToken.transfer(factoryOwner, 1_000_000 ether);

        fee = feeReductionSystem.getFee(user1);
        assertEq(fee, 10000, "Zero balance should give base fee");
    }

    function test_EdgeCase_PrecisionAtBoundaries() public {
        clearUserBalance(user1);

        // Test fee calculation precision at exact boundaries
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 1000 ether); // Exact minimum

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();
        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        uint24 fee = feeReductionSystem.getFee(user1);
        assertEq(fee, 10000, "At minimum threshold should still have base fee");

        // Just above minimum
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 1 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();
        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        fee = feeReductionSystem.getFee(user1);
        assertTrue(fee < 10000, "Just above minimum should have reduced fee");
    }

    // ==================== Hook Tests ====================

    function test_HookPermissions() public {
        Hooks.Permissions memory perms = dynamicFeeHook.getHookPermissions();

        // Only beforeSwap should be enabled
        assertTrue(perms.beforeSwap, "beforeSwap should be enabled");

        // All others should be disabled
        assertFalse(
            perms.beforeInitialize, "beforeInitialize should be disabled"
        );
        assertFalse(perms.afterInitialize, "afterInitialize should be disabled");
        assertFalse(
            perms.beforeAddLiquidity, "beforeAddLiquidity should be disabled"
        );
        assertFalse(
            perms.afterAddLiquidity, "afterAddLiquidity should be disabled"
        );
        assertFalse(
            perms.beforeRemoveLiquidity,
            "beforeRemoveLiquidity should be disabled"
        );
        assertFalse(
            perms.afterRemoveLiquidity,
            "afterRemoveLiquidity should be disabled"
        );
        assertFalse(perms.afterSwap, "afterSwap should be disabled");
        assertFalse(perms.beforeDonate, "beforeDonate should be disabled");
        assertFalse(perms.afterDonate, "afterDonate should be disabled");
    }

    function test_SetFeeReductionSystem_Success() public {
        // Deploy new fee reduction system
        FeeReductionSystem newSystem =
            new FeeReductionSystem(amicaToken, personaFactory);

        vm.prank(factoryOwner);
        vm.expectEmit(true, false, false, true);
        emit FeeReductionSystemUpdated(address(newSystem));
        dynamicFeeHook.setFeeReductionSystem(address(newSystem));

        assertEq(
            address(dynamicFeeHook.feeReductionSystem()), address(newSystem)
        );
    }

    function test_SetFeeReductionSystem_RevertNotOwner() public {
        FeeReductionSystem newSystem =
            new FeeReductionSystem(amicaToken, personaFactory);

        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSignature(
                "OwnableUnauthorizedAccount(address)", user1
            )
        );
        dynamicFeeHook.setFeeReductionSystem(address(newSystem));
    }

    function test_SetFeeReductionSystem_RevertZeroAddress() public {
        vm.prank(factoryOwner);
        vm.expectRevert(DynamicFeeHook.InvalidFeeReductionSystem.selector);
        dynamicFeeHook.setFeeReductionSystem(address(0));
    }

    // ==================== Integration Tests ====================

    function test_Integration_DynamicFeeHookWithFeeReductionSystem() public {
        // Verify hook is properly connected to fee reduction system
        assertEq(
            address(dynamicFeeHook.feeReductionSystem()),
            address(feeReductionSystem),
            "Hook should be connected to fee reduction system"
        );

        // Test that hook permissions are correct
        Hooks.Permissions memory perms = dynamicFeeHook.getHookPermissions();
        assertTrue(perms.beforeSwap, "beforeSwap should be enabled");
        assertFalse(perms.afterSwap, "afterSwap should be disabled");
    }

    function test_Integration_MultipleUsersWithDifferentFees() public {
        clearAllUserBalances();

        // Give users different amounts of AMICA
        vm.startPrank(factoryOwner);
        amicaToken.transfer(user2, 50_000 ether); // Mid-tier
        amicaToken.transfer(user3, 1_000_000 ether); // Max tier
        // user1 gets nothing
        vm.stopPrank();

        // Update snapshots for users with AMICA
        vm.prank(user2);
        feeReductionSystem.updateSnapshot();
        vm.prank(user3);
        feeReductionSystem.updateSnapshot();

        // Wait for snapshots to become active
        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        // Get fees for each user
        uint24 fee1 = feeReductionSystem.getFee(user1);
        uint24 fee2 = feeReductionSystem.getFee(user2);
        uint24 fee3 = feeReductionSystem.getFee(user3);

        // Verify fee hierarchy
        assertEq(fee1, 10000, "User1 should have base fee");
        assertTrue(fee2 < fee1, "User2 should have reduced fee");
        assertEq(fee3, 0, "User3 should have zero fee");
    }

    function test_Integration_FeeChangesAfterSnapshotUpdate() public {
        clearUserBalance(user1);

        // Give user initial AMICA balance
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 10_000 ether);

        // Take snapshot
        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        // Wait for snapshot to become active
        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        // Get initial fee
        uint24 fee1 = feeReductionSystem.getFee(user1);

        // Give user more AMICA
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 90_000 ether); // Total 100k

        // Update snapshot
        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        // Wait for new snapshot
        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        // Get new fee
        uint24 fee2 = feeReductionSystem.getFee(user1);

        // Second fee should be lower
        assertTrue(fee2 < fee1, "Fee should decrease with more AMICA");
    }

    function test_Integration_SnapshotDelayPreventsImmediateFeeReduction()
        public
    {
        clearUserBalance(user1);

        // User starts with no AMICA
        uint24 feeBefore = feeReductionSystem.getFee(user1);

        // Give user AMICA and immediately update snapshot
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 100_000 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        // Check fee immediately (before delay)
        uint24 feeImmediate = feeReductionSystem.getFee(user1);

        // Should still have base fee
        assertEq(feeImmediate, feeBefore, "Fee should not change immediately");

        // Wait for delay
        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        // Now fee should be reduced
        uint24 feeAfterDelay = feeReductionSystem.getFee(user1);
        assertTrue(
            feeAfterDelay < feeBefore, "Fee should be reduced after delay"
        );
    }

    function test_Integration_LosingAmicaIncreasesFeesAgain() public {
        clearUserBalance(user1);

        // Give user AMICA
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 100_000 ether);

        // Update snapshot and wait
        vm.prank(user1);
        feeReductionSystem.updateSnapshot();
        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        // Get fee with AMICA
        uint24 feeWithAmica = feeReductionSystem.getFee(user1);

        // User loses AMICA
        vm.prank(user1);
        amicaToken.transfer(user2, 100_000 ether);

        // Fee should immediately increase (uses min of snapshot and current)
        uint24 feeWithoutAmica = feeReductionSystem.getFee(user1);

        // Should have base fee again
        assertEq(
            feeWithoutAmica,
            10000,
            "Fee should return to base when AMICA is lost"
        );
        assertTrue(
            feeWithoutAmica > feeWithAmica,
            "Fee should increase when AMICA is lost"
        );
    }

    function test_Integration_FeeReductionWithDifferentConfigurations()
        public
    {
        clearUserBalance(user1);

        // Test changing fee reduction configuration
        vm.prank(factoryOwner);
        feeReductionSystem.configureFeeReduction(
            100 ether, // Lower minimum
            10_000 ether, // Lower maximum
            30000, // 3% base fee
            10000 // 1% minimum fee
        );

        // Give user amount that would be mid-tier in new config
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 5_000 ether);

        // Update snapshot
        vm.prank(user1);
        feeReductionSystem.updateSnapshot();
        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        // Get fee
        uint24 fee = feeReductionSystem.getFee(user1);

        // Should be between 1% and 3%
        assertTrue(fee > 10000, "Fee should be above minimum");
        assertTrue(fee < 30000, "Fee should be below base");

        // Allow for some rounding differences
        assertApproxEqRel(fee, 25100, 0.01e18); // 1% tolerance
    }

    function test_Integration_HookUpdatesFeeReductionSystem() public {
        clearUserBalance(user1);

        // Create a new fee reduction system with different config
        FeeReductionSystem newSystem =
            new FeeReductionSystem(amicaToken, personaFactory);

        newSystem.configureFeeReduction(
            1 ether, // Very low minimum
            1000 ether, // Very low maximum
            50000, // 5% base fee
            0 // 0% minimum fee
        );

        // Give user some AMICA
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 500 ether);

        // Update snapshot in new system
        vm.prank(user1);
        newSystem.updateSnapshot();
        vm.roll(block.number + newSystem.SNAPSHOT_DELAY() + 1);

        // Get fee from new system
        uint24 feeNewSystem = newSystem.getFee(user1);

        // Update hook to use new system
        vm.prank(factoryOwner);
        dynamicFeeHook.setFeeReductionSystem(address(newSystem));

        // Verify hook now uses new system
        assertEq(
            address(dynamicFeeHook.feeReductionSystem()),
            address(newSystem),
            "Hook should use new fee reduction system"
        );

        // The hook would now use the new fee calculation in actual swaps
        assertTrue(feeNewSystem < 50000, "Fee should be reduced in new system");
    }

    function test_Integration_MultiplePoolsUseSameFeeReduction() public {
        clearUserBalance(user1);

        // Give user AMICA for fee reduction
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 100_000 ether);

        // Update snapshot
        vm.prank(user1);
        feeReductionSystem.updateSnapshot();
        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        // Get fee for user
        uint24 userFee = feeReductionSystem.getFee(user1);

        // Verify user has reduced fee
        assertTrue(userFee < 10000, "User should have reduced fee");

        // The same fee would apply to any pool using this hook
        console.log("User fee across all pools:", userFee);
    }

    // ==================== Gas Usage Tests ====================

    function test_GasUsage_UpdateSnapshot() public {
        clearUserBalance(user1);

        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 100_000 ether);

        vm.prank(user1);
        uint256 gasBefore = gasleft();
        feeReductionSystem.updateSnapshot();
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for snapshot update:", gasUsed);

        // Ensure reasonable gas usage (less than 100k)
        assertTrue(
            gasUsed < 100_000, "Snapshot update should use reasonable gas"
        );
    }

    function test_GasUsage_GetFee() public {
        clearUserBalance(user1);

        // Setup user with AMICA and active snapshot
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 100_000 ether);

        vm.prank(user1);
        feeReductionSystem.updateSnapshot();
        vm.roll(block.number + feeReductionSystem.SNAPSHOT_DELAY() + 1);

        // Measure gas for fee calculation
        uint256 gasBefore = gasleft();
        feeReductionSystem.getFee(user1);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for fee calculation:", gasUsed);

        // Ensure reasonable gas usage (less than 50k)
        assertTrue(
            gasUsed < 50_000, "Fee calculation should use reasonable gas"
        );
    }

    function test_GasUsage_MultipleSnapshots() public {
        clearUserBalance(user1);

        // Test gas usage when updating snapshot multiple times
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 50_000 ether);

        // First snapshot
        vm.prank(user1);
        feeReductionSystem.updateSnapshot();

        // Wait and get more tokens
        vm.roll(block.number + 50);
        vm.prank(factoryOwner);
        amicaToken.transfer(user1, 50_000 ether);

        // Second snapshot (should promote pending to active)
        vm.prank(user1);
        uint256 gasBefore = gasleft();
        feeReductionSystem.updateSnapshot();
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for snapshot update with promotion:", gasUsed);
        assertTrue(
            gasUsed < 100_000, "Snapshot promotion should use reasonable gas"
        );
    }
}
