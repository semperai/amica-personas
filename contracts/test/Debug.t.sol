// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Fixtures} from "./shared/Fixtures.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {console} from "forge-std/console.sol";

contract DebugTest is Fixtures {
    MockERC20 public agentToken;

    function setUp() public override {
        super.setUp();

        // Deploy agent token
        agentToken = new MockERC20("Agent Token", "AGENT", 18);
        agentToken.mint(user1, 10_000_000 ether);
        agentToken.mint(user2, 10_000_000 ether);
        agentToken.mint(user3, 10_000_000 ether);

        // Approve tokens
        vm.prank(user1);
        amicaToken.approve(address(personaFactory), type(uint256).max);

        vm.prank(user2);
        amicaToken.approve(address(personaFactory), type(uint256).max);

        vm.prank(user3);
        amicaToken.approve(address(personaFactory), type(uint256).max);
    }

    function test_AgentOnlyClaimDebug() public {
        // Create persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("test"),
            0,
            address(agentToken),
            10_000 ether
        );

        // User2 deposits exactly the minimum
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 10_000 ether);
        personaFactory.depositAgentTokens(tokenId, 10_000 ether);
        vm.stopPrank();

        console.log("After deposit - checking agentDeposits");
        console.log(
            "agentDeposits[tokenId][user2]:",
            personaFactory.agentDeposits(tokenId, user2)
        );

        (, uint256 tokensPurchased1, uint256 totalAgentDeposited1) =
            personaFactory.preGraduationStates(tokenId);
        console.log(
            "totalAgentDeposited before graduation:", totalAgentDeposited1
        );

        // User3 buys to graduate
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId, 1_100_000 ether, 0, user3, block.timestamp + 300
        );

        // Check if graduated
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        console.log("graduationTimestamp:", graduationTimestamp);
        require(graduationTimestamp > 0, "Must be graduated");

        console.log("\nAfter graduation - checking state");
        console.log(
            "agentDeposits[tokenId][user2]:",
            personaFactory.agentDeposits(tokenId, user2)
        );

        (, uint256 tokensPurchased2, uint256 totalAgentDeposited2) =
            personaFactory.preGraduationStates(tokenId);
        console.log(
            "totalAgentDeposited after graduation:", totalAgentDeposited2
        );

        // Wait for claim delay
        vm.warp(block.timestamp + 1 days + 1);

        // Check claimable
        (
            uint256 purchased,
            uint256 bonus,
            uint256 agentReward,
            uint256 totalClaimable,
            bool claimed,
            bool claimable
        ) = personaFactory.getClaimableRewards(tokenId, user2);

        console.log("\ngetClaimableRewards results:");
        console.log("purchased:", purchased);
        console.log("bonus:", bonus);
        console.log("agentReward:", agentReward);
        console.log("totalClaimable:", totalClaimable);
        console.log("claimed:", claimed);
        console.log("claimable:", claimable);

        // Try to claim
        vm.prank(user2);
        personaFactory.claimRewards(tokenId);

        console.log("\nClaim succeeded!");
    }
}
