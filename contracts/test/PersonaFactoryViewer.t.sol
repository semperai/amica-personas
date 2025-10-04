// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Fixtures} from "./shared/Fixtures.sol";
import {PersonaFactoryViewer} from "../src/PersonaFactoryViewer.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {console} from "forge-std/console.sol";

contract PersonaFactoryViewerTest is Fixtures {
    PersonaFactoryViewer public viewer;
    MockERC20 public agentToken;

    function setUp() public override {
        super.setUp();

        // Deploy viewer
        viewer = new PersonaFactoryViewer(address(personaFactory));

        // Create agent token
        agentToken = new MockERC20("Agent Token", "AGENT", 18);
        agentToken.mint(user1, 10_000_000 ether);
        agentToken.mint(user2, 10_000_000 ether);

        // Approve tokens
        vm.prank(user1);
        amicaToken.approve(address(personaFactory), type(uint256).max);
        vm.prank(user2);
        amicaToken.approve(address(personaFactory), type(uint256).max);
    }

    // ==================== Basic Tests ====================

    function test_Constructor() public {
        assertEq(address(viewer.factory()), address(personaFactory));
    }

    function test_Constructor_RevertsWithZeroAddress() public {
        vm.expectRevert("Invalid factory");
        new PersonaFactoryViewer(address(0));
    }

    // ==================== Metadata Tests ====================

    function test_GetMetadata() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TEST",
            bytes32("testpersona"),
            0,
            address(0),
            0
        );

        bytes32[] memory keys = new bytes32[](2);
        keys[0] = bytes32("key1");
        keys[1] = bytes32("key2");

        string[] memory values = viewer.getMetadata(tokenId, keys);
        assertEq(values.length, 2);
    }

    // ==================== Token Distribution Tests ====================

    function test_GetTokenDistribution_WithoutAgent() public {
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

        (
            uint256 liquidityAmount,
            uint256 bondingSupplyAmount,
            uint256 amicaAmount,
            uint256 agentRewardsAmount
        ) = viewer.getTokenDistribution(tokenId);

        assertEq(liquidityAmount, 333_333_333 ether);
        assertEq(bondingSupplyAmount, 333_333_333 ether);
        assertEq(amicaAmount, 333_333_334 ether);
        assertEq(agentRewardsAmount, 0);
    }

    function test_GetTokenDistribution_WithAgent() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("testagent"),
            0,
            address(agentToken),
            1000 ether
        );

        (
            uint256 liquidityAmount,
            uint256 bondingSupplyAmount,
            uint256 amicaAmount,
            uint256 agentRewardsAmount
        ) = viewer.getTokenDistribution(tokenId);

        assertEq(liquidityAmount, 333_333_333 ether);
        assertEq(bondingSupplyAmount, 166_666_666 ether);
        assertEq(amicaAmount, 333_333_333 ether);
        assertEq(agentRewardsAmount, 166_666_668 ether);
    }

    // ==================== Bonding Curve State Tests ====================

    function test_GetBondingCurveState() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("testbond"),
            0,
            address(0),
            0
        );

        // Buy some tokens
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, 100_000 ether, 0, user2, block.timestamp + 300
        );

        (
            uint256 totalPairingTokensCollected,
            uint256 tokensPurchased,
            uint256 availableTokens
        ) = viewer.getBondingCurveState(tokenId);

        assertEq(totalPairingTokensCollected, 100_000 ether);
        assertGt(tokensPurchased, 0);
        assertEq(availableTokens, 333_333_333 ether - tokensPurchased);
    }

    function test_GetUserBondingBalance() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("testbal"),
            0,
            address(0),
            0
        );

        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, 50_000 ether, 0, user2, block.timestamp + 300
        );

        uint256 balance = viewer.getUserBondingBalance(tokenId, user2);
        assertGt(balance, 0);
    }

    // ==================== Pricing Tests ====================

    function test_GetCurrentPrice() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("testprice"),
            0,
            address(0),
            0
        );

        uint256 price = viewer.getCurrentPrice(tokenId);
        assertGt(price, 0);
    }

    function test_CalculateBuyAmount() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("testcalc"),
            0,
            address(0),
            0
        );

        uint256 amountOut = viewer.calculateBuyAmount(tokenId, 100_000 ether);
        assertGt(amountOut, 0);
    }

    function test_CalculateSellAmount() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("testsell"),
            0,
            address(0),
            0
        );

        // First buy some tokens
        vm.prank(user2);
        uint256 bought = personaFactory.swapExactTokensForTokens(
            tokenId, 50_000 ether, 0, user2, block.timestamp + 300
        );

        uint256 amountOut = viewer.calculateSellAmount(tokenId, bought / 2);
        assertGt(amountOut, 0);
    }

    function test_CalculateCostBetween() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("testcost"),
            0,
            address(0),
            0
        );

        uint256 cost = viewer.calculateCostBetween(
            tokenId,
            0,
            100_000 ether
        );

        assertGt(cost, 0);
    }

    // ==================== Graduation Tests ====================

    function test_CanGraduate_NotEnoughPurchased() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("testgrad1"),
            0,
            address(0),
            0
        );

        (bool canGrad, PersonaFactoryViewer.GraduationStatus status) = viewer.canGraduate(tokenId);
        assertFalse(canGrad);
        assertEq(uint256(status), uint256(PersonaFactoryViewer.GraduationStatus.BELOW_TOKEN_THRESHOLD));
    }

    function test_GetGraduationProgress() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("testprog"),
            0,
            address(0),
            0
        );

        (
            uint256 tokensPurchasedPercent,
            uint256 currentAgentDeposited,
            uint256 agentRequired
        ) = viewer.getGraduationProgress(tokenId);

        assertEq(tokensPurchasedPercent, 0);
        assertEq(currentAgentDeposited, 0);
        assertEq(agentRequired, 0);
    }

    // ==================== Claim Tests ====================

    function test_GetClaimableRewards() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("testclaim"),
            0,
            address(0),
            0
        );

        (
            uint256 purchasedAmount,
            uint256 bonusAmount,
            uint256 agentRewardAmount,
            uint256 totalClaimable,
            bool claimed,
            bool claimable
        ) = viewer.getClaimableRewards(tokenId, user2);

        assertEq(purchasedAmount, 0);
        assertEq(bonusAmount, 0);
        assertEq(agentRewardAmount, 0);
        assertEq(totalClaimable, 0);
        assertFalse(claimed);
        assertFalse(claimable);
    }

    function test_IsClaimAllowed() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("testallow"),
            0,
            address(0),
            0
        );

        (bool allowed, uint256 timeRemaining) = viewer.isClaimAllowed(tokenId);
        assertFalse(allowed);
        assertEq(timeRemaining, 0);
    }

    // ==================== Agent Tests ====================

    function test_GetUserAgentDeposit() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("testagent2"),
            0,
            address(agentToken),
            1000 ether
        );

        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 500 ether);
        personaFactory.depositAgentTokens(tokenId, 500 ether);
        vm.stopPrank();

        uint256 deposit = viewer.getUserAgentDeposit(tokenId, user2);
        assertEq(deposit, 500 ether);
    }

    function test_GetTotalAgentDeposited() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("testagent3"),
            0,
            address(agentToken),
            1000 ether
        );

        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 500 ether);
        personaFactory.depositAgentTokens(tokenId, 500 ether);
        vm.stopPrank();

        uint256 total = viewer.getTotalAgentDeposited(tokenId);
        assertEq(total, 500 ether);
    }

    // ==================== Pairing Config Tests ====================

    function test_GetPairingConfig() public {
        (
            bool enabled,
            uint256 mintCost,
            uint256 pricingMultiplier
        ) = viewer.getPairingConfig(address(amicaToken));

        assertTrue(enabled);
        assertGt(pricingMultiplier, 0);
    }

    function test_IsPairingTokenEnabled() public {
        bool enabled = viewer.isPairingTokenEnabled(address(amicaToken));
        assertTrue(enabled);
    }

    // ==================== Batch Tests ====================

    function test_GetPersonaBatch() public {
        vm.startPrank(user1);
        uint256 tokenId1 = personaFactory.createPersona(
            address(amicaToken),
            "Test1",
            "TEST1",
            bytes32("test1"),
            0,
            address(0),
            0
        );

        uint256 tokenId2 = personaFactory.createPersona(
            address(amicaToken),
            "Test2",
            "TEST2",
            bytes32("test2"),
            0,
            address(0),
            0
        );
        vm.stopPrank();

        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = tokenId1;
        tokenIds[1] = tokenId2;

        (address[] memory tokens, bool[] memory graduated) = viewer.getPersonaBatch(tokenIds);
        assertEq(tokens.length, 2);
        assertFalse(graduated[0]);
        assertFalse(graduated[1]);
    }

    function test_GetBondingCurveStateBatch() public {
        vm.startPrank(user1);
        uint256 tokenId1 = personaFactory.createPersona(
            address(amicaToken),
            "Test1",
            "TEST1",
            bytes32("testbatch1"),
            0,
            address(0),
            0
        );

        uint256 tokenId2 = personaFactory.createPersona(
            address(amicaToken),
            "Test2",
            "TEST2",
            bytes32("testbatch2"),
            0,
            address(0),
            0
        );
        vm.stopPrank();

        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = tokenId1;
        tokenIds[1] = tokenId2;

        (
            uint256[] memory collected,
            uint256[] memory purchased,
            uint256[] memory available
        ) = viewer.getBondingCurveStateBatch(tokenIds);

        assertEq(collected.length, 2);
        assertEq(purchased.length, 2);
        assertEq(available.length, 2);
    }

    function test_GetUserBondingBalancesBatch() public {
        vm.startPrank(user1);
        uint256 tokenId1 = personaFactory.createPersona(
            address(amicaToken),
            "Test1",
            "TEST1",
            bytes32("testbal1"),
            0,
            address(0),
            0
        );

        uint256 tokenId2 = personaFactory.createPersona(
            address(amicaToken),
            "Test2",
            "TEST2",
            bytes32("testbal2"),
            0,
            address(0),
            0
        );
        vm.stopPrank();

        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = tokenId1;
        tokenIds[1] = tokenId2;

        uint256[] memory balances = viewer.getUserBondingBalancesBatch(tokenIds, user2);
        assertEq(balances.length, 2);
    }

    function test_GetCurrentPricesBatch() public {
        vm.startPrank(user1);
        uint256 tokenId1 = personaFactory.createPersona(
            address(amicaToken),
            "Test1",
            "TEST1",
            bytes32("testpr1"),
            0,
            address(0),
            0
        );

        uint256 tokenId2 = personaFactory.createPersona(
            address(amicaToken),
            "Test2",
            "TEST2",
            bytes32("testpr2"),
            0,
            address(0),
            0
        );
        vm.stopPrank();

        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = tokenId1;
        tokenIds[1] = tokenId2;

        uint256[] memory prices = viewer.getCurrentPricesBatch(tokenIds);
        assertEq(prices.length, 2);
        assertGt(prices[0], 0);
        assertGt(prices[1], 0);
    }

    function test_GetClaimableRewardsBatch() public {
        vm.startPrank(user1);
        uint256 tokenId1 = personaFactory.createPersona(
            address(amicaToken),
            "Test1",
            "TEST1",
            bytes32("testrew1"),
            0,
            address(0),
            0
        );

        uint256 tokenId2 = personaFactory.createPersona(
            address(amicaToken),
            "Test2",
            "TEST2",
            bytes32("testrew2"),
            0,
            address(0),
            0
        );
        vm.stopPrank();

        uint256[] memory tokenIds = new uint256[](2);
        tokenIds[0] = tokenId1;
        tokenIds[1] = tokenId2;

        (
            uint256[] memory purchased,
            uint256[] memory bonus,
            uint256[] memory agentRewards,
            uint256[] memory totalClaimable,
            bool[] memory hasClaimed,
            bool[] memory claimable
        ) = viewer.getClaimableRewardsBatch(tokenIds, user2);

        assertEq(purchased.length, 2);
        assertEq(bonus.length, 2);
        assertEq(agentRewards.length, 2);
        assertEq(totalClaimable.length, 2);
        assertEq(hasClaimed.length, 2);
        assertEq(claimable.length, 2);
    }

    // ==================== Other View Functions ====================

    function test_GetGraduationTimestamp() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("testtime"),
            0,
            address(0),
            0
        );

        uint256 timestamp = viewer.getGraduationTimestamp(tokenId);
        assertEq(timestamp, 0); // Not graduated yet
    }

    function test_GetPreGraduationState() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test",
            "TEST",
            bytes32("testpre"),
            0,
            address(0),
            0
        );

        (
            uint256 totalPairingTokensCollected,
            uint256 tokensPurchased,
            uint256 totalAgentDeposited
        ) = viewer.getPreGraduationState(tokenId);

        assertEq(totalPairingTokensCollected, 0);
        assertEq(tokensPurchased, 0);
        assertEq(totalAgentDeposited, 0);
    }
}
