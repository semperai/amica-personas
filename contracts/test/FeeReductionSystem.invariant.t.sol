// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/FeeReductionSystem.sol";
import "../src/PersonaTokenFactory.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title FeeReductionSystemInvariantTest
 * @notice Comprehensive fuzzing and invariant tests for FeeReductionSystem
 */
contract FeeReductionSystemInvariantTest is Test {
    FeeReductionSystem public feeSystem;
    MockERC20 public amicaToken;
    MockPersonaFactory public factory;

    // Test constants
    uint256 constant MIN_AMICA = 1000 ether;
    uint256 constant MAX_AMICA = 1_000_000 ether;
    uint24 constant BASE_FEE = 10000; // 1%
    uint24 constant MAX_DISCOUNTED_FEE = 0; // 0%

    FeeReductionHandler public handler;

    function setUp() public {
        amicaToken = new MockERC20("AMICA", "AMICA", 18);
        factory = new MockPersonaFactory();

        feeSystem = new FeeReductionSystem(
            IERC20(address(amicaToken)),
            PersonaTokenFactory(address(factory))
        );

        handler = new FeeReductionHandler(feeSystem, amicaToken);

        // Fund handler with AMICA
        amicaToken.mint(address(handler), 10_000_000 ether);

        targetContract(address(handler));
    }

    /*//////////////////////////////////////////////////////////////
                        INVARIANT TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Fee should always be within configured range
    function invariant_feeWithinRange() public view {
        (uint256 minAmica, uint256 maxAmica, uint24 baseFee, uint24 maxDiscountedFee) = feeSystem.feeReductionConfig();

        for (uint256 i = 0; i < handler.getUserCount(); i++) {
            address user = handler.getUser(i);
            uint24 fee = feeSystem.getFee(user);

            assertGe(fee, maxDiscountedFee, "Fee should not be below max discount");
            assertLe(fee, baseFee, "Fee should not exceed base fee");
        }
    }

    /// @notice Higher AMICA balance should result in lower or equal fees
    function invariant_higherBalanceLowerFee() public view {
        address[] memory users = new address[](handler.getUserCount());
        uint256[] memory balances = new uint256[](handler.getUserCount());
        uint24[] memory fees = new uint24[](handler.getUserCount());

        // Collect data
        for (uint256 i = 0; i < handler.getUserCount(); i++) {
            users[i] = handler.getUser(i);
            balances[i] = feeSystem.getEffectiveBalance(users[i]);
            fees[i] = feeSystem.getFee(users[i]);
        }

        // Compare pairs
        for (uint256 i = 0; i < users.length; i++) {
            for (uint256 j = i + 1; j < users.length; j++) {
                if (balances[i] > balances[j]) {
                    assertLe(
                        fees[i],
                        fees[j],
                        "Higher balance should result in lower or equal fee"
                    );
                } else if (balances[i] < balances[j]) {
                    assertGe(
                        fees[i],
                        fees[j],
                        "Lower balance should result in higher or equal fee"
                    );
                }
            }
        }
    }

    /// @notice Effective balance should never exceed actual balance
    function invariant_effectiveBalanceNotExceedActual() public view {
        for (uint256 i = 0; i < handler.getUserCount(); i++) {
            address user = handler.getUser(i);
            uint256 effectiveBalance = feeSystem.getEffectiveBalance(user);
            uint256 actualBalance = amicaToken.balanceOf(user);

            assertLe(
                effectiveBalance,
                actualBalance,
                "Effective balance should not exceed actual balance"
            );
        }
    }

    /// @notice Snapshot must wait SNAPSHOT_DELAY before becoming active
    function invariant_snapshotDelayEnforced() public view {
        for (uint256 i = 0; i < handler.getUserCount(); i++) {
            address user = handler.getUser(i);

            (
                uint256 activeBalance,
                uint256 activeBlock,
                uint256 pendingBalance,
                uint256 pendingBlock
            ) = feeSystem.userSnapshots(user);

            uint256 blocksRemaining = feeSystem.getBlocksUntilActive(user);

            if (pendingBlock > 0 && block.number < pendingBlock + feeSystem.SNAPSHOT_DELAY()) {
                assertGt(blocksRemaining, 0, "Should have blocks remaining if pending and delay not passed");
            }

            if (activeBlock > 0 && block.number >= activeBlock + feeSystem.SNAPSHOT_DELAY()) {
                // Active snapshot should be usable
                uint256 effectiveBalance = feeSystem.getEffectiveBalance(user);
                if (amicaToken.balanceOf(user) >= activeBalance) {
                    assertGe(effectiveBalance, 0, "Should have some effective balance");
                }
            }
        }
    }

    /// @notice Fee below minimum threshold should return base fee
    function invariant_belowMinReturnsBaseFee() public view {
        (uint256 minAmica, , uint24 baseFee, ) = feeSystem.feeReductionConfig();

        for (uint256 i = 0; i < handler.getUserCount(); i++) {
            address user = handler.getUser(i);
            uint256 effectiveBalance = feeSystem.getEffectiveBalance(user);

            if (effectiveBalance < minAmica) {
                uint24 fee = feeSystem.getFee(user);
                assertEq(fee, baseFee, "Below min threshold should return base fee");
            }
        }
    }

    /// @notice Fee at or above max threshold should return max discount
    function invariant_aboveMaxReturnsMaxDiscount() public view {
        (, uint256 maxAmica, , uint24 maxDiscountedFee) = feeSystem.feeReductionConfig();

        for (uint256 i = 0; i < handler.getUserCount(); i++) {
            address user = handler.getUser(i);
            uint256 effectiveBalance = feeSystem.getEffectiveBalance(user);

            if (effectiveBalance >= maxAmica) {
                uint24 fee = feeSystem.getFee(user);
                assertEq(fee, maxDiscountedFee, "Above max threshold should return max discount");
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ TESTS - FEE CALCULATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test: Fee calculation is deterministic
    function testFuzz_feeCalculationDeterministic(uint256 balance) public {
        balance = bound(balance, 0, 10_000_000 ether);

        address user = address(0x1234);
        amicaToken.mint(user, balance);

        vm.prank(user);
        feeSystem.updateSnapshot();

        // Advance blocks
        vm.roll(block.number + feeSystem.SNAPSHOT_DELAY() + 1);

        // Call twice and verify same result
        uint24 fee1 = feeSystem.getFee(user);
        uint24 fee2 = feeSystem.getFee(user);

        assertEq(fee1, fee2, "Fee should be deterministic");
    }

    /// @notice Fuzz test: Fee decreases monotonically with balance
    function testFuzz_feeDecreasesWithBalance(uint256 balance1, uint256 balance2) public {
        balance1 = bound(balance1, MIN_AMICA, MAX_AMICA);
        balance2 = bound(balance2, balance1, MAX_AMICA * 2);

        address user1 = address(0x1001);
        address user2 = address(0x1002);

        amicaToken.mint(user1, balance1);
        amicaToken.mint(user2, balance2);

        vm.prank(user1);
        feeSystem.updateSnapshot();

        vm.prank(user2);
        feeSystem.updateSnapshot();

        vm.roll(block.number + feeSystem.SNAPSHOT_DELAY() + 1);

        uint24 fee1 = feeSystem.getFee(user1);
        uint24 fee2 = feeSystem.getFee(user2);

        assertGe(fee1, fee2, "Higher balance should have lower or equal fee");
    }

    /// @notice Fuzz test: Quadratic curve produces smooth reduction
    function testFuzz_quadraticCurveSmooth(uint256 balance) public {
        balance = bound(balance, MIN_AMICA, MAX_AMICA);

        address user = address(0x2001);
        amicaToken.mint(user, balance);

        vm.prank(user);
        feeSystem.updateSnapshot();

        vm.roll(block.number + feeSystem.SNAPSHOT_DELAY() + 1);

        uint24 fee = feeSystem.getFee(user);

        // Fee should be between base and max discounted
        assertGe(fee, MAX_DISCOUNTED_FEE, "Fee >= max discounted");
        assertLe(fee, BASE_FEE, "Fee <= base fee");
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ TESTS - SNAPSHOT MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test: Cannot use snapshot before delay
    function testFuzz_snapshotDelayRequired(uint256 balance, uint256 blocksToAdvance) public {
        balance = bound(balance, MIN_AMICA, MAX_AMICA);
        blocksToAdvance = bound(blocksToAdvance, 1, feeSystem.SNAPSHOT_DELAY() - 1);

        address user = address(0x3001);
        amicaToken.mint(user, balance);

        vm.prank(user);
        feeSystem.updateSnapshot();

        vm.roll(block.number + blocksToAdvance);

        // Effective balance should be 0 (snapshot not active yet)
        uint256 effectiveBalance = feeSystem.getEffectiveBalance(user);
        assertEq(effectiveBalance, 0, "Snapshot should not be active before delay");
    }

    /// @notice Fuzz test: Snapshot becomes active after delay
    function testFuzz_snapshotActivatesAfterDelay(uint256 balance, uint256 extraBlocks) public {
        balance = bound(balance, MIN_AMICA, MAX_AMICA);
        extraBlocks = bound(extraBlocks, 0, 1000);

        address user = address(0x3002);
        amicaToken.mint(user, balance);

        vm.prank(user);
        feeSystem.updateSnapshot();

        vm.roll(block.number + feeSystem.SNAPSHOT_DELAY() + extraBlocks);

        uint256 effectiveBalance = feeSystem.getEffectiveBalance(user);
        assertEq(effectiveBalance, balance, "Snapshot should be active after delay");
    }

    /// @notice Fuzz test: Decreasing balance doesn't increase effective balance
    function testFuzz_balanceDecreaseProtection(
        uint256 initialBalance,
        uint256 transferAmount
    ) public {
        initialBalance = bound(initialBalance, MIN_AMICA * 2, MAX_AMICA);
        transferAmount = bound(transferAmount, MIN_AMICA, initialBalance - MIN_AMICA);

        address user = address(0x3003);
        amicaToken.mint(user, initialBalance);

        vm.prank(user);
        feeSystem.updateSnapshot();

        vm.roll(block.number + feeSystem.SNAPSHOT_DELAY() + 1);

        uint256 effectiveBefore = feeSystem.getEffectiveBalance(user);

        // Transfer away some tokens
        vm.prank(user);
        amicaToken.transfer(address(0xdead), transferAmount);

        uint256 effectiveAfter = feeSystem.getEffectiveBalance(user);

        // Effective balance should decrease (uses min of snapshot and current)
        assertLe(effectiveAfter, effectiveBefore, "Effective balance should decrease");
    }

    /// @notice Fuzz test: Multiple snapshot updates work correctly
    function testFuzz_multipleSnapshotUpdates(
        uint256 balance1,
        uint256 balance2,
        uint256 blocksDelay
    ) public {
        balance1 = bound(balance1, MIN_AMICA, MAX_AMICA);
        balance2 = bound(balance2, MIN_AMICA, MAX_AMICA);
        blocksDelay = bound(blocksDelay, feeSystem.SNAPSHOT_DELAY() + 1, 1000);

        address user = address(0x3004);
        amicaToken.mint(user, balance1);

        // First snapshot
        vm.prank(user);
        feeSystem.updateSnapshot();

        vm.roll(block.number + blocksDelay);

        // Adjust balance
        if (balance2 > balance1) {
            amicaToken.mint(user, balance2 - balance1);
        } else {
            vm.prank(user);
            amicaToken.transfer(address(0xdead), balance1 - balance2);
        }

        // Second snapshot
        vm.prank(user);
        feeSystem.updateSnapshot();

        vm.roll(block.number + feeSystem.SNAPSHOT_DELAY() + 1);

        uint256 effectiveBalance = feeSystem.getEffectiveBalance(user);
        uint256 currentBalance = amicaToken.balanceOf(user);

        // Effective should be min of snapshot and current
        assertLe(effectiveBalance, currentBalance, "Effective <= current");
    }

    /// @notice Fuzz test: Clearing snapshot below minimum works
    function testFuzz_clearSnapshotBelowMin(uint256 initialBalance) public {
        initialBalance = bound(initialBalance, MIN_AMICA, MAX_AMICA);

        address user = address(0x3005);
        amicaToken.mint(user, initialBalance);

        vm.prank(user);
        feeSystem.updateSnapshot();

        // Transfer to go below minimum
        vm.prank(user);
        amicaToken.transfer(address(0xdead), initialBalance - MIN_AMICA + 1);

        vm.prank(user);
        feeSystem.updateSnapshot();

        (uint256 activeBalance, , uint256 pendingBalance, ) = feeSystem.userSnapshots(user);

        assertEq(activeBalance, 0, "Active should be cleared");
        assertEq(pendingBalance, 0, "Pending should be cleared");
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ TESTS - CONFIGURATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test: Valid configuration updates succeed
    function testFuzz_validConfigurationUpdates(
        uint256 minAmica,
        uint256 maxAmica,
        uint24 baseFee,
        uint24 maxDiscountedFee
    ) public {
        minAmica = bound(minAmica, 1 ether, 100_000 ether);
        maxAmica = bound(maxAmica, minAmica + 1 ether, 10_000_000 ether);
        baseFee = uint24(bound(baseFee, 1, 1_000_000));
        maxDiscountedFee = uint24(bound(maxDiscountedFee, 0, baseFee));

        feeSystem.configureFeeReduction(
            minAmica,
            maxAmica,
            baseFee,
            maxDiscountedFee
        );

        (uint256 minSet, uint256 maxSet, uint24 baseFeeSet, uint24 maxDiscountSet) = feeSystem.feeReductionConfig();

        assertEq(minSet, minAmica, "Min should be set");
        assertEq(maxSet, maxAmica, "Max should be set");
        assertEq(baseFeeSet, baseFee, "Base fee should be set");
        assertEq(maxDiscountSet, maxDiscountedFee, "Max discount should be set");
    }

    /// @notice Fuzz test: Invalid configurations revert
    function testFuzz_invalidConfigurationReverts(
        uint256 minAmica,
        uint256 maxAmica
    ) public {
        // Test: min >= max should revert
        minAmica = bound(minAmica, 1000 ether, 5_000_000 ether);
        maxAmica = bound(maxAmica, 0, minAmica);

        vm.expectRevert(FeeReductionSystem.InvalidConfiguration.selector);
        feeSystem.configureFeeReduction(
            minAmica,
            maxAmica,
            BASE_FEE,
            MAX_DISCOUNTED_FEE
        );
    }

    /// @notice Fuzz test: Max discounted fee > base fee reverts
    function testFuzz_maxDiscountedGreaterThanBaseReverts(uint24 baseFee, uint24 maxDiscountedFee) public {
        baseFee = uint24(bound(baseFee, 0, 500_000));
        maxDiscountedFee = uint24(bound(maxDiscountedFee, baseFee + 1, 1_000_000));

        vm.expectRevert(FeeReductionSystem.InvalidConfiguration.selector);
        feeSystem.configureFeeReduction(
            MIN_AMICA,
            MAX_AMICA,
            baseFee,
            maxDiscountedFee
        );
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ TESTS - EDGE CASES
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test: Zero balance always returns base fee
    function testFuzz_zeroBalanceReturnsBaseFee(uint256 initialBalance) public {
        initialBalance = bound(initialBalance, MIN_AMICA, MAX_AMICA);

        address user = address(0x4001);
        amicaToken.mint(user, initialBalance);

        vm.prank(user);
        feeSystem.updateSnapshot();

        vm.roll(block.number + feeSystem.SNAPSHOT_DELAY() + 1);

        // Transfer all away
        vm.prank(user);
        amicaToken.transfer(address(0xdead), initialBalance);

        uint24 fee = feeSystem.getFee(user);
        assertEq(fee, BASE_FEE, "Zero balance should return base fee");
    }

    /// @notice Fuzz test: Extremely high balance is capped properly
    function testFuzz_extremelyHighBalanceCapped(uint256 balance) public {
        balance = bound(balance, MAX_AMICA, type(uint128).max);

        address user = address(0x4002);
        amicaToken.mint(user, balance);

        vm.prank(user);
        feeSystem.updateSnapshot();

        vm.roll(block.number + feeSystem.SNAPSHOT_DELAY() + 1);

        uint24 fee = feeSystem.getFee(user);
        assertEq(fee, MAX_DISCOUNTED_FEE, "Extreme balance should return max discount");
    }

    /// @notice Fuzz test: Pending promotion to active works correctly
    function testFuzz_pendingPromotion(uint256 balance, uint256 newBalance) public {
        balance = bound(balance, MIN_AMICA, MAX_AMICA);
        newBalance = bound(newBalance, MIN_AMICA, MAX_AMICA);

        address user = address(0x4003);
        amicaToken.mint(user, balance);

        // First snapshot
        vm.prank(user);
        feeSystem.updateSnapshot();

        vm.roll(block.number + feeSystem.SNAPSHOT_DELAY() + 1);

        // Adjust balance and create pending
        if (newBalance > balance) {
            amicaToken.mint(user, newBalance - balance);
        } else {
            vm.prank(user);
            amicaToken.transfer(address(0xdead), balance - newBalance);
        }

        vm.prank(user);
        feeSystem.updateSnapshot();

        // Before promotion
        (uint256 activeBefore, , uint256 pendingBefore, ) = feeSystem.userSnapshots(user);

        // Wait for promotion
        vm.roll(block.number + feeSystem.SNAPSHOT_DELAY() + 1);

        // Update again to trigger promotion
        vm.prank(user);
        feeSystem.updateSnapshot();

        (uint256 activeAfter, , , ) = feeSystem.userSnapshots(user);

        // Active should now equal what was pending
        if (pendingBefore >= MIN_AMICA) {
            assertEq(activeAfter, pendingBefore, "Pending should be promoted to active");
        }
    }
}

/**
 * @title FeeReductionHandler
 * @notice Handler for stateful fuzzing
 */
contract FeeReductionHandler is Test {
    FeeReductionSystem public feeSystem;
    MockERC20 public amicaToken;

    address[] public users;
    uint256 public snapshotUpdateCount;
    uint256 public balanceChangeCount;

    constructor(FeeReductionSystem _feeSystem, MockERC20 _amicaToken) {
        feeSystem = _feeSystem;
        amicaToken = _amicaToken;

        // Create some test users
        for (uint256 i = 0; i < 5; i++) {
            address user = address(uint160(0x5000 + i));
            users.push(user);
        }
    }

    function updateSnapshot(uint256 userIndex) public {
        userIndex = bound(userIndex, 0, users.length - 1);
        address user = users[userIndex];

        vm.prank(user);
        feeSystem.updateSnapshot();

        snapshotUpdateCount++;
    }

    function changeBalance(uint256 userIndex, uint256 newBalance) public {
        userIndex = bound(userIndex, 0, users.length - 1);
        newBalance = bound(newBalance, 0, 5_000_000 ether);

        address user = users[userIndex];
        uint256 currentBalance = amicaToken.balanceOf(user);

        if (newBalance > currentBalance) {
            amicaToken.mint(user, newBalance - currentBalance);
        } else if (newBalance < currentBalance) {
            vm.prank(user);
            amicaToken.transfer(address(0xdead), currentBalance - newBalance);
        }

        balanceChangeCount++;
    }

    function advanceBlocks(uint256 blocks) public {
        blocks = bound(blocks, 1, 500);
        vm.roll(block.number + blocks);
    }

    // View functions for invariants
    function getUserCount() external view returns (uint256) {
        return users.length;
    }

    function getUser(uint256 index) external view returns (address) {
        return users[index];
    }
}

/**
 * @title Mock Contracts
 */
contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_)
        ERC20(name, symbol)
    {
        _decimals = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockPersonaFactory {
    // Minimal mock
}
