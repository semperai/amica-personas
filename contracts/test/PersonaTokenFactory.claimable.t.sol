// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Fixtures} from "./shared/Fixtures.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PersonaTokenFactory} from "../src/PersonaTokenFactory.sol";
import {PersonaFactoryViewer} from "../src/PersonaFactoryViewer.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PersonaTokenFactoryClaimableTest
 * @notice Tests for deeply nested conditionals in getClaimableRewards
 * @dev Covers all branches in the complex getClaimableRewards function
 */
contract PersonaTokenFactoryClaimableTest is Fixtures {
    PersonaFactoryViewer public viewer;
    uint256 constant BONDING_AMOUNT = 333_333_333 ether;
    uint256 constant GRADUATION_PERCENT = 85;

    function setUp() public override {
        super.setUp();

        // Deploy viewer
        viewer = new PersonaFactoryViewer(address(personaFactory));

        vm.prank(user1);
        amicaToken.approve(address(personaFactory), type(uint256).max);
        vm.prank(user2);
        amicaToken.approve(address(personaFactory), type(uint256).max);
        vm.prank(user3);
        amicaToken.approve(address(personaFactory), type(uint256).max);
    }

    /**
     * @notice Test: graduationTimestamp == 0 (early return)
     * @dev First condition in getClaimableRewards - should return all zeros
     */
    function test_GetClaimableRewards_NotGraduated() public {
        // Create persona without graduating
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

        // Query claimable rewards before graduation
        (
            uint256 purchasedAmount,
            uint256 bonusAmount,
            uint256 agentRewardAmount,
            uint256 totalClaimable,
            bool claimed,
            bool claimable
        ) = personaFactory.getClaimableRewards(tokenId, user1);

        // All should be zero since not graduated
        assertEq(purchasedAmount, 0, "Purchased should be 0");
        assertEq(bonusAmount, 0, "Bonus should be 0");
        assertEq(agentRewardAmount, 0, "Agent reward should be 0");
        assertEq(totalClaimable, 0, "Total should be 0");
        assertFalse(claimed, "Should not be claimed");
        assertFalse(claimable, "Should not be claimable");
    }

    /**
     * @notice Test: purchasedAmount == 0 (no purchase, only agent)
     * @dev Tests branch where user has agent deposits but no token purchases
     */
    function test_GetClaimableRewards_OnlyAgentDeposits() public {
        // Create persona with agent token
        MockERC20 agentToken = new MockERC20("Agent", "AGT", 18);
        agentToken.mint(user2, 10000 ether);

        vm.prank(user2);
        agentToken.approve(address(personaFactory), type(uint256).max);

        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("test"),
            0,
            address(agentToken),
            100 ether // min agent threshold
        );

        // User2 deposits agent tokens but doesn't buy
        vm.prank(user2);
        personaFactory.depositAgentTokens(tokenId, 1000 ether);

        // User3 buys enough to graduate
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user3);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user3, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                break;
            }
        }

        // Check user2's claimable rewards (agent only, no purchases)
        (
            uint256 purchasedAmount,
            uint256 bonusAmount,
            uint256 agentRewardAmount,
            uint256 totalClaimable,
            bool claimed,
            bool claimable
        ) = personaFactory.getClaimableRewards(tokenId, user2);

        assertEq(purchasedAmount, 0, "No purchased tokens");
        assertEq(bonusAmount, 0, "No bonus without purchases");
        assertGt(agentRewardAmount, 0, "Should have agent rewards");
        assertEq(totalClaimable, agentRewardAmount, "Total should equal agent rewards");
        assertFalse(claimed, "Not claimed yet");
        assertFalse(claimable, "Not claimable until delay passes");
    }

    /**
     * @notice Test: purchasedAmount > 0 && claimed == true
     * @dev Tests branch where user already claimed
     */
    function test_GetClaimableRewards_AlreadyClaimed() public {
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

        // Buy and graduate
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user1);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user1, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                break;
            }
        }

        // Wait for claim delay
        vm.warp(block.timestamp + 1 days + 1);

        // Claim once
        vm.prank(user1);
        personaFactory.claimRewards(tokenId);

        // Check claimable after claiming
        (
            uint256 purchasedAmount,
            uint256 bonusAmount,
            uint256 agentRewardAmount,
            uint256 totalClaimable,
            bool claimed,
            bool claimable
        ) = personaFactory.getClaimableRewards(tokenId, user1);

        assertGt(purchasedAmount, 0, "Should show purchased amount");
        assertEq(bonusAmount, 0, "Bonus should be 0 (already claimed)");
        assertEq(agentRewardAmount, 0, "No agent rewards");
        assertEq(totalClaimable, purchasedAmount, "Total equals purchased (no bonus)");
        assertTrue(claimed, "Should be marked as claimed");
        assertTrue(claimable, "Delay has passed");
    }

    /**
     * @notice Test: Bonus calculation with normal graduation (15% unsold)
     * @dev Tests branch where there are unsold tokens from normal graduation
     */
    function test_GetClaimableRewards_WithUnsoldBonus() public {
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

        // Buy to trigger graduation (85%)
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user1);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user1, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                break;
            }
        }

        // Wait for claim delay
        vm.warp(block.timestamp + 1 days + 1);

        // Check claimable (should have bonus from 15% unsold)
        (
            uint256 purchasedAmount,
            uint256 bonusAmount,
            uint256 agentRewardAmount,
            uint256 totalClaimable,
            ,
        ) = personaFactory.getClaimableRewards(tokenId, user1);

        assertGt(purchasedAmount, 0, "Has purchased tokens");
        assertGt(bonusAmount, 0, "Has bonus from 15% unsold");
        assertEq(agentRewardAmount, 0, "No agent rewards");
        assertEq(totalClaimable, purchasedAmount + bonusAmount, "Total equals purchased + bonus");
    }

    /**
     * @notice Test: unsoldTokens > 0 && tokensPurchased == 0
     * @dev Tests division by zero protection in bonus calculation
     */
    function test_GetClaimableRewards_ZeroTokensPurchased() public {
        // This scenario cannot naturally occur because graduation requires
        // 85% of tokens to be purchased. Testing the edge case logic.
        // We'll verify it through a different path - user with 0 balance.

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

        // User2 graduates the persona
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user2);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                break;
            }
        }

        // User3 never purchased, so their purchasedAmount is 0
        (
            uint256 purchasedAmount,
            uint256 bonusAmount,
            uint256 agentRewardAmount,
            uint256 totalClaimable,
            ,
        ) = personaFactory.getClaimableRewards(tokenId, user3);

        assertEq(purchasedAmount, 0, "User3 purchased nothing");
        assertEq(bonusAmount, 0, "No bonus without purchases");
        assertEq(agentRewardAmount, 0, "No agent rewards");
        assertEq(totalClaimable, 0, "Nothing to claim");
    }

    /**
     * @notice Test: agentToken == address(0) (no agent token)
     * @dev Tests branch where persona has no agent token
     */
    function test_GetClaimableRewards_NoAgentToken() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("test"),
            0,
            address(0), // no agent token
            0
        );

        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user1);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user1, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                break;
            }
        }

        vm.warp(block.timestamp + 1 days + 1);

        (
            uint256 purchasedAmount,
            uint256 bonusAmount,
            uint256 agentRewardAmount,
            uint256 totalClaimable,
            ,
        ) = personaFactory.getClaimableRewards(tokenId, user1);

        assertGt(purchasedAmount, 0, "Has purchased tokens");
        assertGt(bonusAmount, 0, "Has bonus from unsold tokens");
        assertEq(agentRewardAmount, 0, "No agent token configured");
        assertEq(totalClaimable, purchasedAmount + bonusAmount, "Total is purchase + bonus");
    }

    /**
     * @notice Test: agentToken != address(0) && userAgentAmount == 0
     * @dev Tests branch where agent token exists but user didn't deposit
     */
    function test_GetClaimableRewards_AgentTokenButUserDidntDeposit() public {
        MockERC20 agentToken = new MockERC20("Agent", "AGT", 18);
        agentToken.mint(user2, 10000 ether);

        vm.prank(user2);
        agentToken.approve(address(personaFactory), type(uint256).max);

        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("test"),
            0,
            address(agentToken),
            100 ether
        );

        // User2 deposits agent tokens
        vm.prank(user2);
        personaFactory.depositAgentTokens(tokenId, 1000 ether);

        // User1 buys to graduate (but didn't deposit agent)
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user1);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user1, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                break;
            }
        }

        vm.warp(block.timestamp + 1 days + 1);

        // User1 should have no agent rewards
        (
            uint256 purchasedAmount,
            uint256 bonusAmount,
            uint256 agentRewardAmount,
            uint256 totalClaimable,
            ,
        ) = personaFactory.getClaimableRewards(tokenId, user1);

        assertGt(purchasedAmount, 0, "Has purchased tokens");
        assertGt(bonusAmount, 0, "Has bonus");
        assertEq(agentRewardAmount, 0, "No agent deposit, no agent rewards");
        assertEq(totalClaimable, purchasedAmount + bonusAmount, "Total excludes agent");
    }

    /**
     * @notice Test: totalAgentDeposited == 0 (edge case)
     * @dev Tests division by zero protection in agent reward calculation
     */
    function test_GetClaimableRewards_ZeroAgentDeposited() public {
        // This scenario cannot occur if agentToken exists and user has deposits
        // Testing the guard against division by zero

        MockERC20 agentToken = new MockERC20("Agent", "AGT", 18);

        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("test"),
            0,
            address(agentToken),
            0 // no minimum required
        );

        // Graduate without any agent deposits
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user1);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user1, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                break;
            }
        }

        vm.warp(block.timestamp + 1 days + 1);

        (
            uint256 purchasedAmount,
            uint256 bonusAmount,
            uint256 agentRewardAmount,
            uint256 totalClaimable,
            ,
        ) = personaFactory.getClaimableRewards(tokenId, user1);

        assertGt(purchasedAmount, 0, "Has purchased tokens");
        assertGt(bonusAmount, 0, "Has bonus");
        assertEq(agentRewardAmount, 0, "No agent deposits in system");
        assertEq(totalClaimable, purchasedAmount + bonusAmount, "Total excludes agent");
    }

    /**
     * @notice Test: All conditions true (full rewards)
     * @dev Tests path where user gets purchased + bonus + agent rewards
     */
    function test_GetClaimableRewards_AllRewardsTypes() public {
        MockERC20 agentToken = new MockERC20("Agent", "AGT", 18);
        agentToken.mint(user1, 10000 ether);

        vm.prank(user1);
        agentToken.approve(address(personaFactory), type(uint256).max);

        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("test"),
            0,
            address(agentToken),
            100 ether
        );

        // User1 deposits agent tokens
        vm.prank(user1);
        personaFactory.depositAgentTokens(tokenId, 1000 ether);

        // User1 buys to graduate
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user1);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user1, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                break;
            }
        }

        vm.warp(block.timestamp + 1 days + 1);

        // User1 should have all three types of rewards
        (
            uint256 purchasedAmount,
            uint256 bonusAmount,
            uint256 agentRewardAmount,
            uint256 totalClaimable,
            bool claimed,
            bool claimable
        ) = personaFactory.getClaimableRewards(tokenId, user1);

        assertGt(purchasedAmount, 0, "Has purchased tokens");
        assertGt(bonusAmount, 0, "Has bonus from unsold");
        assertGt(agentRewardAmount, 0, "Has agent rewards");
        assertEq(
            totalClaimable,
            purchasedAmount + bonusAmount + agentRewardAmount,
            "Total includes all three"
        );
        assertFalse(claimed, "Not claimed yet");
        assertTrue(claimable, "Claimable after delay");
    }

    /**
     * @notice Test: Before claim delay (claimable == false)
     * @dev Tests time-based conditional
     */
    function test_GetClaimableRewards_BeforeClaimDelay() public {
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

        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user1);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user1, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                break;
            }
        }

        // Don't wait for delay

        (,,, uint256 totalClaimable, bool claimed, bool claimable) =
            personaFactory.getClaimableRewards(tokenId, user1);

        assertGt(totalClaimable, 0, "Has claimable amount");
        assertFalse(claimed, "Not claimed");
        assertFalse(claimable, "Not claimable yet (delay not passed)");

        // After delay passes
        vm.warp(block.timestamp + 1 days + 1);

        (,,,,, claimable) = personaFactory.getClaimableRewards(tokenId, user1);
        assertTrue(claimable, "Now claimable after delay");
    }
}
