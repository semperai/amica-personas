// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Fixtures} from "./shared/Fixtures.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {console} from "forge-std/console.sol";

contract ClaimRewardsDebugTest is Fixtures {
    MockERC20 agentToken;

    function setUp() public override {
        super.setUp();

        // Create agent token
        agentToken = new MockERC20("Agent Token", "AGENT", 18);
        agentToken.mint(user1, 10_000_000 ether);
        agentToken.mint(user2, 10_000_000 ether);
        agentToken.mint(user3, 10_000_000 ether);

        // Approve factory
        vm.prank(user1);
        amicaToken.approve(address(personaFactory), type(uint256).max);
        vm.prank(user2);
        amicaToken.approve(address(personaFactory), type(uint256).max);
        vm.prank(user3);
        amicaToken.approve(address(personaFactory), type(uint256).max);
    }

    function testDebug_BuyersBalanceAfterGraduation() public {
        console.log("=== DEBUG: Buyers Balance After Graduation ===");

        // Create persona with agent requirement
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TEST",
            bytes32("testpersona"),
            0,
            address(agentToken),
            20_000 ether
        );

        // User2 and User3 deposit agent tokens
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 10_000 ether);
        personaFactory.depositAgentTokens(tokenId, 10_000 ether);
        vm.stopPrank();

        vm.startPrank(user3);
        agentToken.approve(address(personaFactory), 15_000 ether);
        personaFactory.depositAgentTokens(tokenId, 15_000 ether);
        vm.stopPrank();

        // User2 and User3 buy tokens BEFORE graduation
        console.log("\n=== BEFORE GRADUATION ===");

        vm.prank(user2);
        uint256 user2Bought1 = personaFactory.swapExactTokensForTokens(
            tokenId, 50_000 ether, 0, user2, block.timestamp + 300
        );
        console.log("User2 bought (pre-grad):", user2Bought1 / 1e18);

        vm.prank(user3);
        uint256 user3Bought1 = personaFactory.swapExactTokensForTokens(
            tokenId, 30_000 ether, 0, user3, block.timestamp + 300
        );
        console.log("User3 bought (pre-grad):", user3Bought1 / 1e18);

        // Check persona state
        (address personaTokenAddr,,, uint256 gradTime1,,,) = personaFactory.personas(tokenId);
        console.log("Graduation timestamp:", gradTime1);

        // Check balances BEFORE graduation
        uint256 user2BalanceBefore = IERC20(personaTokenAddr).balanceOf(user2);
        uint256 user3BalanceBefore = IERC20(personaTokenAddr).balanceOf(user3);
        console.log("User2 persona token balance:", user2BalanceBefore / 1e18);
        console.log("User3 persona token balance:", user3BalanceBefore / 1e18);

        // Now graduate
        console.log("\n=== GRADUATING ===");
        uint256 buyCount = 0;
        uint256 graduationTimestamp = 0;

        while (graduationTimestamp == 0 && buyCount < 20) {
            buyCount++;

            (uint256 totalCollected, uint256 tokensPurchased, uint256 totalAgentDeposited) = personaFactory.preGraduationStates(tokenId);
            console.log("Buy #", buyCount, "- Tokens purchased so far:", tokensPurchased / 1e18);
            console.log("  Total collected:", totalCollected / 1e18);
            console.log("  Agent deposited:", totalAgentDeposited / 1e18);

            vm.prank(user2);
            try personaFactory.swapExactTokensForTokens(
                tokenId, 100_000 ether, 0, user2, block.timestamp + 1
            ) returns (uint256 bought) {
                console.log("  User2 bought:", bought / 1e18);
            } catch {
                console.log("  Buy failed - likely graduated");
                break;
            }

            (,,, graduationTimestamp,,,) = personaFactory.personas(tokenId);
            if (graduationTimestamp > 0) {
                console.log("  GRADUATED!");
                break;
            }
        }

        // Check final state
        console.log("\n=== AFTER GRADUATION ===");
        (,,, uint256 gradTime2,,,) = personaFactory.personas(tokenId);
        console.log("Graduation timestamp:", gradTime2);

        uint256 user2BalanceAfter = IERC20(personaTokenAddr).balanceOf(user2);
        uint256 user3BalanceAfter = IERC20(personaTokenAddr).balanceOf(user3);
        console.log("User2 persona token balance:", user2BalanceAfter / 1e18);
        console.log("User3 persona token balance:", user3BalanceAfter / 1e18);

        // Check pre-graduation state
        console.log("\nPre-graduation state recorded");

        // Check claimable rewards
        _checkClaimableRewards(tokenId, user2, user2BalanceAfter, personaTokenAddr);
    }

    function _checkClaimableRewards(
        uint256 tokenId,
        address user,
        uint256 userBalance,
        address personaTokenAddr
    ) internal {
        console.log("\n=== CLAIMABLE REWARDS ===");
        vm.warp(block.timestamp + 1 days + 1);

        (
            uint256 purchasedAmt,
            uint256 bonusAmt,
            uint256 agentReward,
            uint256 totalClaimable,
            bool claimed,
            bool claimable
        ) = personaFactory.getClaimableRewards(tokenId, user);

        console.log("User claimable:");
        console.log("  Purchased amount:", purchasedAmt / 1e18);
        console.log("  Bonus amount:", bonusAmt / 1e18);
        console.log("  Agent reward:", agentReward / 1e18);
        console.log("  Total claimable:", totalClaimable / 1e18);
        console.log("  Can claim:", claimable);
        console.log("  Already claimed:", claimed);

        // The issue: if user has 0 balance but claimable > 0, that's the bug
        if (userBalance == 0 && totalClaimable > 0) {
            console.log("\n!!! BUG DETECTED !!!");
            console.log("User has 0 balance but", totalClaimable / 1e18, "claimable tokens");
            console.log("This means tokens were not transferred during purchase");
        }

        // Try to claim
        if (totalClaimable > 0 && claimable) {
            console.log("\n=== ATTEMPTING CLAIM ===");
            vm.prank(user);
            try personaFactory.claimRewards(tokenId) {
                console.log("Claim succeeded!");
                uint256 balanceAfterClaim = IERC20(personaTokenAddr).balanceOf(user);
                console.log("User balance after claim:", balanceAfterClaim / 1e18);
            } catch Error(string memory reason) {
                console.log("Claim failed:", reason);
            } catch (bytes memory lowLevelData) {
                console.log("Claim failed with low level error");
                console.logBytes(lowLevelData);
            }
        }
    }

    function testCorrectBehavior_ClaimAfterGraduation() public {
        console.log("=== CORRECT BEHAVIOR: Tokens claimed after graduation ===");

        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("test"),
            0,
            address(0),
            0
        );

        // User2 buys tokens
        vm.prank(user2);
        uint256 bought = personaFactory.swapExactTokensForTokens(
            tokenId, 50_000 ether, 0, user2, block.timestamp + 300
        );
        console.log("User2 bought:", bought / 1e18);

        // Get persona token address
        (address personaTokenAddr,,,,,,) = personaFactory.personas(tokenId);

        // Check balance BEFORE graduation - should be 0
        uint256 balanceBefore = IERC20(personaTokenAddr).balanceOf(user2);
        console.log("User2 balance before graduation:", balanceBefore / 1e18);
        assertEq(balanceBefore, 0, "Balance should be 0 before graduation");

        // Graduate
        uint256 buyCount = 0;
        uint256 graduationTimestamp = 0;
        while (graduationTimestamp == 0 && buyCount < 20) {
            buyCount++;
            vm.prank(user2);
            try personaFactory.swapExactTokensForTokens(
                tokenId, 100_000 ether, 0, user2, block.timestamp + 1
            ) {} catch { break; }

            (,,, graduationTimestamp,,,) = personaFactory.personas(tokenId);
        }

        require(graduationTimestamp > 0, "Must graduate");
        console.log("Graduated!");

        // Check balance AFTER graduation but BEFORE claim - still 0
        uint256 balanceAfterGrad = IERC20(personaTokenAddr).balanceOf(user2);
        console.log("User2 balance after graduation (before claim):", balanceAfterGrad / 1e18);
        assertEq(balanceAfterGrad, 0, "Balance should still be 0 before claim");

        // Wait and claim
        vm.warp(block.timestamp + 1 days + 1);

        (,,, uint256 totalClaimable,,) = personaFactory.getClaimableRewards(tokenId, user2);
        console.log("Total claimable:", totalClaimable / 1e18);
        assertGt(totalClaimable, 0, "Should have claimable tokens");

        vm.prank(user2);
        personaFactory.claimRewards(tokenId);

        // Check balance AFTER claim - should have tokens now
        uint256 balanceAfterClaim = IERC20(personaTokenAddr).balanceOf(user2);
        console.log("User2 balance after claim:", balanceAfterClaim / 1e18);
        assertGt(balanceAfterClaim, 0, "Balance should be > 0 after claim");
        assertEq(balanceAfterClaim, totalClaimable, "Balance should equal claimable amount");

        console.log("\n[OK] CORRECT: Tokens are only received after calling claimRewards()");
    }

    function testDebug_AgentOnlyDepositor() public {
        console.log("=== DEBUG: Agent Only Depositor Test ===");

        // Create persona with agent
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Agent Only Test",
            "AGONLY",
            bytes32("agentonly"),
            0,
            address(agentToken),
            10_000 ether
        );

        // Get persona token address
        (address personaTokenAddr,,,,,,) = personaFactory.personas(tokenId);

        // User2 deposits agent tokens but doesn't buy
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 10_000 ether);
        personaFactory.depositAgentTokens(tokenId, 10_000 ether);
        vm.stopPrank();

        console.log("User2 deposited 10k agent tokens");

        // User3 buys tokens to help graduate
        console.log("\nUser3 buying to trigger graduation...");
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId, 1_100_000 ether, 0, user3, block.timestamp + 300
        );

        // Check if graduated
        (,,, uint256 graduationTimestamp,,,) = personaFactory.personas(tokenId);
        console.log("Graduation timestamp after buy:", graduationTimestamp);

        if (graduationTimestamp == 0) {
            console.log("NOT GRADUATED - need more buys");
            // Continue buying
            for (uint256 i = 0; i < 20; i++) {
                vm.prank(user3);
                try personaFactory.swapExactTokensForTokens(
                    tokenId, 1_000_000 ether, 0, user3, block.timestamp + 1
                ) {} catch { break; }

                (,,, graduationTimestamp,,,) = personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) {
                    console.log("GRADUATED on iteration", i + 1);
                    break;
                }
            }
        }

        require(graduationTimestamp > 0, "Must be graduated");

        // Wait for claim delay
        vm.warp(block.timestamp + 1 days + 1);

        // Check claimable
        console.log("\n=== CHECKING CLAIMABLE ===");
        (
            uint256 purchased,
            uint256 bonus,
            uint256 agentReward,
            uint256 totalClaimable,
            bool claimed,
            bool claimable
        ) = personaFactory.getClaimableRewards(tokenId, user2);

        console.log("User2 claimable:");
        console.log("  Purchased:", purchased / 1e18);
        console.log("  Bonus:", bonus / 1e18);
        console.log("  Agent reward:", agentReward / 1e18);
        console.log("  Total claimable:", totalClaimable / 1e18);
        console.log("  Claimed:", claimed);
        console.log("  Claimable:", claimable);

        // Check factory balance
        uint256 factoryBalance = IERC20(personaTokenAddr).balanceOf(address(personaFactory));
        console.log("\nFactory persona token balance:", factoryBalance / 1e18);

        if (factoryBalance < totalClaimable) {
            console.log("!!! PROBLEM: Factory doesn't have enough tokens!");
            console.log("   Needs:", totalClaimable / 1e18);
            console.log("   Has:", factoryBalance / 1e18);
        }

        // Try to claim
        console.log("\n=== ATTEMPTING CLAIM ===");
        vm.prank(user2);
        try personaFactory.claimRewards(tokenId) {
            console.log("Claim succeeded!");
        } catch Error(string memory reason) {
            console.log("Claim failed:", reason);
        } catch (bytes memory lowLevelData) {
            console.log("Claim failed with error:");
            console.logBytes(lowLevelData);
        }
    }

    function testDebug_GraduationHelper() public {
        console.log("=== DEBUG: Graduation Helper Function ===");

        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("test"),
            0,
            address(0),
            0
        );

        // Use the graduatePersona helper
        console.log("Before graduation helper");
        (,,, uint256 gradBefore,,,) = personaFactory.personas(tokenId);
        console.log("Grad timestamp before:", gradBefore);

        // Manually graduate like the helper does
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            (,,, uint256 gradTime,,,) = personaFactory.personas(tokenId);
            console.log("Iteration", i, "- gradTime:", gradTime);

            if (gradTime > 0) {
                console.log("Already graduated!");
                break;
            }

            vm.prank(user2);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 1
            ) returns (uint256 bought) {
                console.log("  Bought:", bought / 1e18);
            } catch {
                console.log("  Buy failed");
                break;
            }
        }

        console.log("\nAfter graduation helper");
        (,,, uint256 gradAfter,,,) = personaFactory.personas(tokenId);
        console.log("Grad timestamp after:", gradAfter);

        if (gradAfter == 0) {
            console.log("!!! GRADUATION FAILED !!!");
        }
    }
}
