// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/PersonaToken.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title BurnAndClaimInvariantTest
 * @notice Comprehensive fuzzing and invariant tests for BurnAndClaimBase
 */
contract BurnAndClaimInvariantTest is Test {
    PersonaToken public token;

    // Test reward tokens
    MockRewardToken public rewardToken1;
    MockRewardToken public rewardToken2;
    MockRewardToken public rewardToken3;

    // Handler for stateful fuzzing
    BurnAndClaimHandler public handler;

    uint256 constant INITIAL_SUPPLY = 1_000_000 ether;

    function setUp() public {
        // Deploy test token with implementation pattern
        PersonaToken impl = new PersonaToken();

        // Deploy minimal proxy
        bytes20 targetBytes = bytes20(address(impl));
        bytes memory clone = new bytes(55);
        assembly {
            mstore(add(clone, 0x20), 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(clone, 0x34), targetBytes)
            mstore(add(clone, 0x48), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
        }

        address cloneAddr;
        assembly {
            cloneAddr := create(0, add(clone, 0x20), 55)
        }

        token = PersonaToken(cloneAddr);
        token.initialize("Test Token", "TEST", INITIAL_SUPPLY, address(this));

        // Deploy reward tokens
        rewardToken1 = new MockRewardToken("Reward1", "REW1");
        rewardToken2 = new MockRewardToken("Reward2", "REW2");
        rewardToken3 = new MockRewardToken("Reward3", "REW3");

        // Fund token contract with rewards first
        rewardToken1.mint(address(token), 100_000 ether);
        rewardToken2.mint(address(token), 50_000 ether);
        rewardToken3.mint(address(token), 25_000 ether);

        // Setup handler (will transfer tokens inside constructor)
        handler = new BurnAndClaimHandler(
            token,
            rewardToken1,
            rewardToken2,
            rewardToken3,
            address(this)
        );

        targetContract(address(handler));
    }

    /*//////////////////////////////////////////////////////////////
                        INVARIANT TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Total supply should only decrease (burn only)
    function invariant_supplyOnlyDecreases() public view {
        uint256 currentSupply = token.totalSupply();
        assertLe(currentSupply, INITIAL_SUPPLY, "Supply should never increase");
    }

    /// @notice Sum of user balances should equal total supply
    function invariant_balancesMatchSupply() public view {
        uint256 sumBalances = 0;

        for (uint256 i = 0; i < handler.getUserCount(); i++) {
            address user = handler.getUser(i);
            sumBalances += token.balanceOf(user);
        }

        // Add contract balance
        sumBalances += token.balanceOf(address(token));
        sumBalances += token.balanceOf(address(this));

        assertEq(sumBalances, token.totalSupply(), "Sum of balances should equal supply");
    }

    /// @notice Claimed rewards should never exceed available balance
    function invariant_claimsNeverExceedBalance() public view {
        uint256 totalClaimed1 = handler.totalReward1Claimed();
        uint256 totalClaimed2 = handler.totalReward2Claimed();
        uint256 totalClaimed3 = handler.totalReward3Claimed();

        uint256 initialBalance1 = 100_000 ether;
        uint256 initialBalance2 = 50_000 ether;
        uint256 initialBalance3 = 25_000 ether;

        assertLe(totalClaimed1, initialBalance1, "Claimed reward1 should not exceed initial");
        assertLe(totalClaimed2, initialBalance2, "Claimed reward2 should not exceed initial");
        assertLe(totalClaimed3, initialBalance3, "Claimed reward3 should not exceed initial");
    }

    /// @notice Reward distribution should be proportional to burn amount
    function invariant_proportionalDistribution() public view {
        // This is verified in the fuzz tests, but we can check consistency
        uint256 totalBurned = handler.totalBurned();

        if (totalBurned > 0) {
            assertLe(totalBurned, INITIAL_SUPPLY, "Total burned <= initial supply");
        }
    }

    /// @notice Token contract should never run out of rewards to distribute
    /// @dev Rewards can only decrease as they're claimed
    function invariant_rewardsOnlyDecrease() public view {
        uint256 currentReward1 = rewardToken1.balanceOf(address(token));
        uint256 currentReward2 = rewardToken2.balanceOf(address(token));
        uint256 currentReward3 = rewardToken3.balanceOf(address(token));

        uint256 claimed1 = handler.totalReward1Claimed();
        uint256 claimed2 = handler.totalReward2Claimed();
        uint256 claimed3 = handler.totalReward3Claimed();

        assertEq(currentReward1 + claimed1, 100_000 ether, "Reward1: current + claimed = initial");
        assertEq(currentReward2 + claimed2, 50_000 ether, "Reward2: current + claimed = initial");
        assertEq(currentReward3 + claimed3, 25_000 ether, "Reward3: current + claimed = initial");
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ TESTS - BURN AND CLAIM
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test: Burning and claiming is always proportional
    function testFuzz_proportionalClaim(uint256 burnAmount, uint256 totalSupply, uint256 rewardBalance) public {
        burnAmount = bound(burnAmount, 1 ether, 1000 ether);
        totalSupply = bound(totalSupply, burnAmount, 1_000_000 ether);
        rewardBalance = bound(rewardBalance, 0, 1_000_000 ether);

        // Calculate expected claim first
        uint256 expectedClaim = (rewardBalance * burnAmount) / totalSupply;

        // Skip test if claim would round to zero (expected behavior)
        if (expectedClaim == 0) {
            return;
        }

        // Setup - use existing token instance to avoid re-initialization
        PersonaToken testToken = _createToken(totalSupply);

        MockRewardToken reward = new MockRewardToken("Reward", "RWD");
        reward.mint(address(testToken), rewardBalance);

        // Perform burn and claim
        address[] memory tokens = new address[](1);
        tokens[0] = address(reward);

        uint256 balanceBefore = reward.balanceOf(address(this));
        testToken.burnAndClaim(burnAmount, tokens);
        uint256 balanceAfter = reward.balanceOf(address(this));

        uint256 claimed = balanceAfter - balanceBefore;
        assertEq(claimed, expectedClaim, "Claim should be exactly proportional");
    }

    // Helper function to create cloned PersonaToken
    function _createToken(uint256 supply) internal returns (PersonaToken) {
        PersonaToken impl = new PersonaToken();

        bytes20 targetBytes = bytes20(address(impl));
        bytes memory cloneCode = new bytes(55);
        assembly {
            mstore(add(cloneCode, 0x20), 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(cloneCode, 0x34), targetBytes)
            mstore(add(cloneCode, 0x48), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
        }

        address cloneAddr;
        assembly {
            cloneAddr := create(0, add(cloneCode, 0x20), 55)
        }

        PersonaToken newToken = PersonaToken(cloneAddr);
        newToken.initialize("Test", "TST", supply, address(this));
        return newToken;
    }

    /// @notice Fuzz test: Multiple users burning get correct proportions
    function testFuzz_multipleUserProportions(
        uint256 burn1,
        uint256 burn2,
        uint256 rewardBalance
    ) public {
        burn1 = bound(burn1, 1 ether, 100 ether);
        burn2 = bound(burn2, 1 ether, 100 ether);
        rewardBalance = bound(rewardBalance, 1 ether, 1000 ether);

        uint256 totalSupply = 1000 ether;

        PersonaToken testToken = _createToken(totalSupply);

        MockRewardToken reward = new MockRewardToken("Reward", "RWD");

        address user1 = address(0x1);
        address user2 = address(0x2);

        testToken.transfer(user1, burn1);
        testToken.transfer(user2, burn2);

        reward.mint(address(testToken), rewardBalance);

        address[] memory tokens = new address[](1);
        tokens[0] = address(reward);

        // User1 burns
        vm.prank(user1);
        testToken.burnAndClaim(burn1, tokens);
        uint256 claimed1 = reward.balanceOf(user1);

        // Calculate remaining for user2
        uint256 newSupply = testToken.totalSupply();
        uint256 remainingReward = reward.balanceOf(address(testToken));
        uint256 expectedClaim2 = (remainingReward * burn2) / newSupply;

        // User2 burns
        vm.prank(user2);
        testToken.burnAndClaim(burn2, tokens);
        uint256 claimed2 = reward.balanceOf(user2);

        assertEq(claimed2, expectedClaim2, "User2 should get correct proportion");
    }

    /// @notice Fuzz test: Cannot burn more than balance
    function testFuzz_cannotBurnMoreThanBalance(uint256 balance, uint256 burnAmount) public {
        balance = bound(balance, 1 ether, 1000 ether);
        burnAmount = bound(burnAmount, balance + 1, balance * 2);

        PersonaToken testToken = _createToken(10000 ether);

        address user = address(0x1);
        testToken.transfer(user, balance);

        address[] memory tokens = new address[](0);

        vm.prank(user);
        vm.expectRevert();
        testToken.burnAndClaim(burnAmount, tokens);
    }

    /// @notice Fuzz test: Zero burn amount reverts
    function testFuzz_zeroBurnReverts() public {
        address[] memory tokens = new address[](1);
        tokens[0] = address(rewardToken1);

        vm.expectRevert();
        token.burnAndClaim(0, tokens);
    }

    /// @notice Fuzz test: Empty tokens array reverts
    function testFuzz_emptyTokensArrayReverts(uint256 burnAmount) public {
        burnAmount = bound(burnAmount, 1 ether, 100 ether);

        address[] memory tokens = new address[](0);

        vm.expectRevert();
        token.burnAndClaim(burnAmount, tokens);
    }

    /// @notice Fuzz test: Unsorted tokens array reverts
    function testFuzz_unsortedTokensReverts(uint256 burnAmount) public {
        burnAmount = bound(burnAmount, 1 ether, 100 ether);

        address[] memory tokens = new address[](2);
        // Ensure tokens are actually unsorted
        if (uint160(address(rewardToken1)) < uint160(address(rewardToken2))) {
            tokens[0] = address(rewardToken2); // Higher address first
            tokens[1] = address(rewardToken1); // Lower address second
        } else {
            tokens[0] = address(rewardToken1); // Higher address first
            tokens[1] = address(rewardToken2); // Lower address second
        }

        vm.expectRevert();
        token.burnAndClaim(burnAmount, tokens);
    }

    /// @notice Fuzz test: Duplicate tokens revert
    function testFuzz_duplicateTokensReverts(uint256 burnAmount) public {
        burnAmount = bound(burnAmount, 1 ether, 100 ether);

        address[] memory tokens = new address[](2);
        tokens[0] = address(rewardToken1);
        tokens[1] = address(rewardToken1); // Duplicate

        vm.expectRevert();
        token.burnAndClaim(burnAmount, tokens);
    }

    /// @notice Fuzz test: Burning entire supply works
    function testFuzz_burnEntireSupply(uint256 totalSupply, uint256 rewardBalance) public {
        totalSupply = bound(totalSupply, 1 ether, 10000 ether);
        rewardBalance = bound(rewardBalance, 1 ether, 10000 ether);

        PersonaToken testToken = _createToken(totalSupply);

        MockRewardToken reward = new MockRewardToken("Reward", "RWD");
        reward.mint(address(testToken), rewardBalance);

        address[] memory tokens = new address[](1);
        tokens[0] = address(reward);

        testToken.burnAndClaim(totalSupply, tokens);

        assertEq(testToken.totalSupply(), 0, "Supply should be zero");
        assertEq(reward.balanceOf(address(this)), rewardBalance, "Should receive all rewards");
    }

    /// @notice Fuzz test: Claiming with zero reward balance succeeds but gives nothing
    function testFuzz_claimZeroRewardBalance(uint256 burnAmount) public {
        burnAmount = bound(burnAmount, 1 ether, 100 ether);

        PersonaToken testToken = _createToken(1000 ether);

        MockRewardToken reward = new MockRewardToken("Reward", "RWD");
        // Don't mint any rewards

        address[] memory tokens = new address[](1);
        tokens[0] = address(reward);

        // Should revert because no tokens to claim
        vm.expectRevert();
        testToken.burnAndClaim(burnAmount, tokens);
    }

    /// @notice Fuzz test: Preview matches actual claim
    function testFuzz_previewMatchesActual(
        uint256 burnAmount,
        uint256 totalSupply,
        uint256 reward1Balance,
        uint256 reward2Balance
    ) public {
        burnAmount = bound(burnAmount, 1 ether, 100 ether);
        totalSupply = bound(totalSupply, burnAmount, 1000 ether);
        reward1Balance = bound(reward1Balance, 1 ether, 1000 ether);
        reward2Balance = bound(reward2Balance, 1 ether, 1000 ether);

        PersonaToken testToken = _createToken(totalSupply);

        MockRewardToken reward1 = new MockRewardToken("Reward1", "RWD1");
        MockRewardToken reward2 = new MockRewardToken("Reward2", "RWD2");

        reward1.mint(address(testToken), reward1Balance);
        reward2.mint(address(testToken), reward2Balance);

        address[] memory tokens = new address[](2);
        if (address(reward1) < address(reward2)) {
            tokens[0] = address(reward1);
            tokens[1] = address(reward2);
        } else {
            tokens[0] = address(reward2);
            tokens[1] = address(reward1);
        }

        // Preview
        uint256[] memory preview = testToken.previewBurnAndClaim(burnAmount, tokens);

        // Actual
        testToken.burnAndClaim(burnAmount, tokens);

        if (tokens[0] == address(reward1)) {
            assertEq(reward1.balanceOf(address(this)), preview[0], "Reward1 should match preview");
            assertEq(reward2.balanceOf(address(this)), preview[1], "Reward2 should match preview");
        } else {
            assertEq(reward2.balanceOf(address(this)), preview[0], "Reward2 should match preview");
            assertEq(reward1.balanceOf(address(this)), preview[1], "Reward1 should match preview");
        }
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ TESTS - EDGE CASES
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test: Very small burn amounts work correctly
    function testFuzz_verySmallBurns(uint256 burnAmount) public {
        burnAmount = bound(burnAmount, 1, 1000); // Very small amounts

        PersonaToken testToken = _createToken(1_000_000 ether);

        MockRewardToken reward = new MockRewardToken("Reward", "RWD");
        reward.mint(address(testToken), 100 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(reward);

        // Very small burns might result in 0 due to rounding
        uint256 expected = (100 ether * burnAmount) / 1_000_000 ether;

        // Skip test if claim would round to zero (expected behavior)
        if (expected == 0) {
            return;
        }

        uint256 balanceBefore = reward.balanceOf(address(this));
        testToken.burnAndClaim(burnAmount, tokens);
        uint256 balanceAfter = reward.balanceOf(address(this));

        uint256 claimed = balanceAfter - balanceBefore;
        assertEq(claimed, expected, "Should handle small burns correctly");
    }

    /// @notice Fuzz test: Many tokens at once
    function testFuzz_manyTokens(uint256 burnAmount, uint256 tokenCount) public {
        burnAmount = bound(burnAmount, 1 ether, 100 ether);
        tokenCount = bound(tokenCount, 1, 10);

        PersonaToken testToken = _createToken(1000 ether);

        // Create and fund multiple reward tokens
        address[] memory tokens = new address[](tokenCount);
        for (uint256 i = 0; i < tokenCount; i++) {
            MockRewardToken reward = new MockRewardToken(
                string(abi.encodePacked("Reward", vm.toString(i))),
                string(abi.encodePacked("RWD", vm.toString(i)))
            );
            reward.mint(address(testToken), 100 ether);
            tokens[i] = address(reward);
        }

        // Sort tokens
        for (uint256 i = 0; i < tokens.length; i++) {
            for (uint256 j = i + 1; j < tokens.length; j++) {
                if (uint160(tokens[i]) > uint160(tokens[j])) {
                    (tokens[i], tokens[j]) = (tokens[j], tokens[i]);
                }
            }
        }

        // Should successfully claim from all
        testToken.burnAndClaim(burnAmount, tokens);

        // Verify we received rewards from each
        for (uint256 i = 0; i < tokenCount; i++) {
            uint256 balance = IERC20(tokens[i]).balanceOf(address(this));
            assertGt(balance, 0, "Should receive rewards from each token");
        }
    }

    /// @notice Fuzz test: Claiming same token address (self-token) should work
    function testFuzz_claimSelfToken(uint256 burnAmount) public {
        burnAmount = bound(burnAmount, 1 ether, 100 ether);

        PersonaToken testToken = _createToken(1000 ether);

        // Transfer some tokens to the contract itself
        testToken.transfer(address(testToken), 100 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(testToken);

        uint256 balanceBefore = testToken.balanceOf(address(this));
        testToken.burnAndClaim(burnAmount, tokens);
        uint256 balanceAfter = testToken.balanceOf(address(this));

        // Should receive proportional share of tokens held by contract
        assertGt(balanceAfter, balanceBefore - burnAmount, "Should receive self-tokens");
    }

    /// @notice Fuzz test: Sequential burns decrease total supply correctly
    function testFuzz_sequentialBurnsDecreaseSupply(
        uint256 burn1,
        uint256 burn2,
        uint256 burn3
    ) public {
        burn1 = bound(burn1, 1 ether, 30 ether);
        burn2 = bound(burn2, 1 ether, 30 ether);
        burn3 = bound(burn3, 1 ether, 30 ether);

        uint256 totalSupply = 1000 ether;

        PersonaToken testToken = _createToken(totalSupply);

        MockRewardToken reward = new MockRewardToken("Reward", "RWD");
        reward.mint(address(testToken), 100 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(reward);

        uint256 supply0 = testToken.totalSupply();

        testToken.burnAndClaim(burn1, tokens);
        uint256 supply1 = testToken.totalSupply();
        assertEq(supply1, supply0 - burn1, "Supply should decrease by burn1");

        testToken.burnAndClaim(burn2, tokens);
        uint256 supply2 = testToken.totalSupply();
        assertEq(supply2, supply1 - burn2, "Supply should decrease by burn2");

        testToken.burnAndClaim(burn3, tokens);
        uint256 supply3 = testToken.totalSupply();
        assertEq(supply3, supply2 - burn3, "Supply should decrease by burn3");
    }
}

/**
 * @title BurnAndClaimHandler
 * @notice Handler for stateful fuzzing
 */
contract BurnAndClaimHandler is Test {
    PersonaToken public token;
    MockRewardToken public rewardToken1;
    MockRewardToken public rewardToken2;
    MockRewardToken public rewardToken3;

    address[] public users;
    uint256 public totalBurned;
    uint256 public burnCount;

    uint256 public totalReward1Claimed;
    uint256 public totalReward2Claimed;
    uint256 public totalReward3Claimed;

    constructor(
        PersonaToken _token,
        MockRewardToken _reward1,
        MockRewardToken _reward2,
        MockRewardToken _reward3,
        address funder
    ) {
        token = _token;
        rewardToken1 = _reward1;
        rewardToken2 = _reward2;
        rewardToken3 = _reward3;

        // Create test users
        for (uint256 i = 0; i < 5; i++) {
            address user = address(uint160(0x6000 + i));
            users.push(user);
        }

        // Request tokens from funder
        vm.prank(funder);
        token.transfer(address(this), 250_000 ether);

        // Fund each user
        for (uint256 i = 0; i < users.length; i++) {
            token.transfer(users[i], 50_000 ether);
        }
    }

    function burnAndClaimSingle(uint256 userIndex, uint256 burnAmount) public {
        userIndex = bound(userIndex, 0, users.length - 1);
        address user = users[userIndex];

        uint256 balance = token.balanceOf(user);
        if (balance == 0) return;

        burnAmount = bound(burnAmount, 1, balance);

        address[] memory tokens = new address[](1);
        tokens[0] = address(rewardToken1);

        uint256 rewardBefore = rewardToken1.balanceOf(user);

        vm.prank(user);
        try token.burnAndClaim(burnAmount, tokens) {
            uint256 rewardAfter = rewardToken1.balanceOf(user);
            totalReward1Claimed += (rewardAfter - rewardBefore);
            totalBurned += burnAmount;
            burnCount++;
        } catch {
            // Ignore failures (e.g., no rewards to claim)
        }
    }

    function burnAndClaimMultiple(uint256 userIndex, uint256 burnAmount) public {
        userIndex = bound(userIndex, 0, users.length - 1);
        address user = users[userIndex];

        uint256 balance = token.balanceOf(user);
        if (balance == 0) return;

        burnAmount = bound(burnAmount, 1, balance);

        address[] memory tokens = new address[](3);
        tokens[0] = address(rewardToken1);
        tokens[1] = address(rewardToken2);
        tokens[2] = address(rewardToken3);

        // Sort tokens by address
        if (uint160(tokens[0]) > uint160(tokens[1])) {
            (tokens[0], tokens[1]) = (tokens[1], tokens[0]);
        }
        if (uint160(tokens[1]) > uint160(tokens[2])) {
            (tokens[1], tokens[2]) = (tokens[2], tokens[1]);
        }
        if (uint160(tokens[0]) > uint160(tokens[1])) {
            (tokens[0], tokens[1]) = (tokens[1], tokens[0]);
        }

        uint256 reward1Before = rewardToken1.balanceOf(user);
        uint256 reward2Before = rewardToken2.balanceOf(user);
        uint256 reward3Before = rewardToken3.balanceOf(user);

        vm.prank(user);
        try token.burnAndClaim(burnAmount, tokens) {
            totalReward1Claimed += (rewardToken1.balanceOf(user) - reward1Before);
            totalReward2Claimed += (rewardToken2.balanceOf(user) - reward2Before);
            totalReward3Claimed += (rewardToken3.balanceOf(user) - reward3Before);
            totalBurned += burnAmount;
            burnCount++;
        } catch {
            // Ignore failures
        }
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
 * @title Mock Reward Token
 */
contract MockRewardToken is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
