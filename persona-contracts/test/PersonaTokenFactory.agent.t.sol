// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Fixtures} from "./shared/Fixtures.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PersonaTokenFactory} from "../src/PersonaTokenFactory.sol";
import {PersonaToken} from "../src/PersonaToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";

contract PersonaTokenFactoryAgentTest is Fixtures {
    MockERC20 public agentToken;

    // Events to test
    event AgentTokenAssociated(
        uint256 indexed tokenId, address indexed agentToken
    );
    event AgentTokensDeposited(
        uint256 indexed tokenId,
        address indexed depositor,
        uint256 amount,
        uint256 newTotal
    );
    event AgentTokensWithdrawn(
        uint256 indexed tokenId,
        address indexed depositor,
        uint256 amount,
        uint256 newTotal
    );
    event AgentRewardsDistributed(
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 personaTokens
    );
    event TokensClaimed(
        uint256 indexed tokenId,
        address indexed user,
        uint256 purchasedAmount,
        uint256 bonusAmount,
        uint256 totalAmount
    );
    event PersonaCreated(
        uint256 indexed tokenId, bytes32 indexed domain, address indexed token
    );
    event V4PoolCreated(
        uint256 indexed tokenId, PoolId indexed poolId, uint256 liquidity
    );

    // Constants for agent personas (1/6 bonding supply)
    uint256 constant AGENT_BONDING_AMOUNT = 166_666_666 ether;
    uint256 constant AGENT_REWARDS_AMOUNT = 166_666_668 ether; // 1/6 + rounding
    uint256 constant AGENT_GRADUATION_THRESHOLD = 141_666_666 ether; // 85% of 166,666,666

    function setUp() public override {
        super.setUp();

        // Deploy agent token
        agentToken = new MockERC20("Agent Token", "AGENT", 18);
        agentToken.mint(user1, 100_000 ether);
        agentToken.mint(user2, 100_000 ether);
        agentToken.mint(user3, 100_000 ether);

        // Mint agent tokens to this test contract too
        agentToken.mint(address(this), 100_000 ether);

        // Approve factory for all users with enough for 1.1M purchases
        vm.prank(user1);
        amicaToken.approve(address(personaFactory), type(uint256).max);
        vm.prank(user2);
        amicaToken.approve(address(personaFactory), type(uint256).max);
        vm.prank(user3);
        amicaToken.approve(address(personaFactory), type(uint256).max);

        // Also approve for test contract
        amicaToken.approve(address(personaFactory), type(uint256).max);

        // Need to ensure users have enough tokens for 1.1M purchases
        // The Fixtures gives 10M to each user which should be enough
    }

    // Helper function to calculate the exact amount needed for graduation
    function calculateAmountForGraduation(
        uint256 bondingSupply,
        uint256 pricingMultiplier
    ) internal view returns (uint256) {
        // The contract uses: (amounts.bondingSupply * GRADUATION_THRESHOLD_PERCENT + 50) / 100
        uint256 graduationThreshold = (bondingSupply * 85 + 50) / 100;

        // We need to buy enough to reach this threshold
        // Using the bonding curve to calculate the exact amount needed
        uint256 currentPurchased = 0;
        uint256 totalCost = 0;

        // Binary search for the right amount
        uint256 low = 0;
        uint256 high = graduationThreshold * 2; // Upper bound

        while (low < high) {
            uint256 mid = (low + high) / 2;
            uint256 tokensOut = bondingCurve.calculateAmountOut(
                (mid * pricingMultiplier) / 1e18,
                currentPurchased,
                bondingSupply
            );

            if (tokensOut >= graduationThreshold) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        return low + 1; // Add 1 to ensure we're over the threshold
    }

    // ==================== Agent Token Association Tests ====================

    function test_CreatePersonaWithAgentToken() public {
        vm.startPrank(user1);

        // Expect both PersonaCreated and AgentTokenAssociated events
        vm.expectEmit(true, true, false, false);
        emit PersonaCreated(1, bytes32("agenttest"), address(0));

        vm.expectEmit(true, true, false, false);
        emit AgentTokenAssociated(1, address(agentToken));

        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Agent Persona",
            "AGENTP",
            bytes32("agenttest"),
            0, // no initial buy
            address(agentToken),
            0 // no minimum requirement
        );

        vm.stopPrank();

        // Verify persona data
        (
            address token,
            address pairToken,
            address storedAgentToken,
            uint256 graduationTimestamp,
            uint256 agentTokenThreshold,
            PoolId poolId
        ) = personaFactory.personas(tokenId);

        assertTrue(token != address(0));
        assertEq(pairToken, address(amicaToken));
        assertEq(storedAgentToken, address(agentToken));
        assertEq(agentTokenThreshold, 0);
        assertEq(graduationTimestamp, 0); // Not graduated

        // Check totalAgentDeposited in PreGraduationState
        (,, uint256 totalAgentDeposited) =
            personaFactory.preGraduationStates(tokenId);
        assertEq(totalAgentDeposited, 0);
    }

    function test_CreatePersonaWithoutAgentToken() public {
        vm.startPrank(user1);

        // Should not emit AgentTokenAssociated event
        vm.expectEmit(true, true, false, false);
        emit PersonaCreated(1, bytes32("noagent"), address(0));

        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Normal Persona",
            "NORMALP",
            bytes32("noagent"),
            0,
            address(0), // no agent token
            0
        );

        vm.stopPrank();

        // Verify no agent token is set
        (,, address storedAgentToken,,,) = personaFactory.personas(tokenId);
        assertEq(storedAgentToken, address(0));
    }

    function test_CreatePersonaWithMinAgentRequirement() public {
        uint256 minRequired = 5000 ether;

        vm.startPrank(user1);

        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Min Agent Persona",
            "MINAGENT",
            bytes32("minagent"),
            0,
            address(agentToken),
            minRequired
        );

        vm.stopPrank();

        // Verify minimum requirement is set
        (,,,, uint256 agentTokenThreshold,) = personaFactory.personas(tokenId);
        assertEq(agentTokenThreshold, minRequired);
    }

    function test_CreatePersonaWithMinRequirementButNoAgentToken_Reverts()
        public
    {
        vm.startPrank(user1);

        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 6)); // Invalid configuration = 6
        personaFactory.createPersona(
            address(amicaToken),
            "Invalid Persona",
            "INVALID",
            bytes32("invalid"),
            0,
            address(0), // no agent token
            1000 ether // but has minimum requirement
        );

        vm.stopPrank();
    }

    // ==================== Agent Token Deposit Tests ====================

    function test_DepositAgentTokens() public {
        // Create persona with agent token
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Agent Persona",
            "AGENTP",
            bytes32("deposit1"),
            0,
            address(agentToken),
            0
        );

        // Deposit agent tokens
        uint256 depositAmount = 1000 ether;

        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), depositAmount);

        vm.expectEmit(true, true, false, true);
        emit AgentTokensDeposited(tokenId, user2, depositAmount, depositAmount);

        personaFactory.depositAgentTokens(tokenId, depositAmount);
        vm.stopPrank();

        // Verify deposit was recorded
        uint256 userDeposit = personaFactory.agentDeposits(tokenId, user2);
        assertEq(userDeposit, depositAmount);

        // Verify total deposited in PreGraduationState
        (,, uint256 totalAgentDeposited) =
            personaFactory.preGraduationStates(tokenId);
        assertEq(totalAgentDeposited, depositAmount);
    }

    function test_DepositAgentTokens_MultipleUsers() public {
        // Create persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Multi Agent",
            "MULTI",
            bytes32("multi"),
            0,
            address(agentToken),
            0
        );

        // User2 deposits
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 1000 ether);
        personaFactory.depositAgentTokens(tokenId, 1000 ether);
        vm.stopPrank();

        // User3 deposits
        vm.startPrank(user3);
        agentToken.approve(address(personaFactory), 2000 ether);
        personaFactory.depositAgentTokens(tokenId, 2000 ether);
        vm.stopPrank();

        // Verify individual deposits
        assertEq(personaFactory.agentDeposits(tokenId, user2), 1000 ether);
        assertEq(personaFactory.agentDeposits(tokenId, user3), 2000 ether);

        // Verify total
        (,, uint256 totalAgentDeposited) =
            personaFactory.preGraduationStates(tokenId);
        assertEq(totalAgentDeposited, 3000 ether);
    }

    function test_DepositAgentTokens_AfterGraduation_Reverts() public {
        // Create persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Graduate Agent",
            "GRAD",
            bytes32("grad"),
            0,
            address(agentToken),
            0
        );

        // Graduate by buying enough tokens - need 1.1M to ensure graduation
        vm.startPrank(user2);
        uint256 amountNeeded = 1_100_000 ether; // 1.1M triggers graduation
        personaFactory.swapExactTokensForTokens(
            tokenId, amountNeeded, 0, user2, block.timestamp + 300
        );
        vm.stopPrank();

        // Verify graduated
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        assertTrue(graduationTimestamp > 0, "Should be graduated");

        // Try to deposit after graduation
        vm.startPrank(user3);
        agentToken.approve(address(personaFactory), 1000 ether);

        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 2)); // AlreadyGraduated = 2
        personaFactory.depositAgentTokens(tokenId, 1000 ether);
        vm.stopPrank();
    }

    function test_DepositAgentTokens_NoAgentToken_Reverts() public {
        // Create persona without agent token
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "No Agent",
            "NOAGENT",
            bytes32("noagent2"),
            0,
            address(0),
            0
        );

        // Try to deposit
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 1000 ether);

        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 6)); // NoAgentToken = 6
        personaFactory.depositAgentTokens(tokenId, 1000 ether);
        vm.stopPrank();
    }

    function test_DepositAgentTokens_ZeroAmount_Reverts() public {
        // Create persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Zero Agent",
            "ZERO",
            bytes32("zero"),
            0,
            address(agentToken),
            0
        );

        // Try to deposit zero
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 1)); // Invalid amount = 1
        personaFactory.depositAgentTokens(tokenId, 0);
    }

    // ==================== Agent Token Withdrawal Tests ====================

    function test_WithdrawAgentTokens() public {
        // Create persona and deposit
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Withdraw Agent",
            "WITHDRAW",
            bytes32("withdraw"),
            0,
            address(agentToken),
            0
        );

        // Deposit first
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 1000 ether);
        personaFactory.depositAgentTokens(tokenId, 1000 ether);

        uint256 balanceBefore = agentToken.balanceOf(user2);

        // Withdraw all
        vm.expectEmit(true, true, false, true);
        emit AgentTokensWithdrawn(tokenId, user2, 1000 ether, 0);

        personaFactory.withdrawAgentTokens(tokenId, 1000 ether);
        vm.stopPrank();

        uint256 balanceAfter = agentToken.balanceOf(user2);
        assertEq(balanceAfter - balanceBefore, 1000 ether);

        // Verify deposit was cleared
        assertEq(personaFactory.agentDeposits(tokenId, user2), 0);

        // Verify total was updated
        (,, uint256 totalAgentDeposited) =
            personaFactory.preGraduationStates(tokenId);
        assertEq(totalAgentDeposited, 0);
    }

    function test_WithdrawAgentTokens_Partial() public {
        // Create persona and deposit
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Partial Agent",
            "PARTIAL",
            bytes32("partial"),
            0,
            address(agentToken),
            0
        );

        // Deposit 3000
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 3000 ether);
        personaFactory.depositAgentTokens(tokenId, 3000 ether);

        // Withdraw 1000
        personaFactory.withdrawAgentTokens(tokenId, 1000 ether);
        vm.stopPrank();

        // Should have 2000 left
        assertEq(personaFactory.agentDeposits(tokenId, user2), 2000 ether);

        // Verify total
        (,, uint256 totalAgentDeposited) =
            personaFactory.preGraduationStates(tokenId);
        assertEq(totalAgentDeposited, 2000 ether);
    }

    function test_WithdrawAgentTokens_AfterGraduation_Reverts() public {
        // Create persona and deposit
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Grad Withdraw",
            "GRADW",
            bytes32("gradw"),
            0,
            address(agentToken),
            0
        );

        // Deposit
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 1000 ether);
        personaFactory.depositAgentTokens(tokenId, 1000 ether);
        vm.stopPrank();

        // Graduate with large amount
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId,
            1_100_000 ether, // 1.1M to ensure graduation
            0,
            user3,
            block.timestamp + 300
        );

        // Verify graduated
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        assertTrue(graduationTimestamp > 0, "Should be graduated");

        // Try to withdraw
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 2)); // AlreadyGraduated = 2
        personaFactory.withdrawAgentTokens(tokenId, 1000 ether);
    }

    function test_WithdrawAgentTokens_MoreThanDeposited_Reverts() public {
        // Create persona and deposit
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Overdraw",
            "OVER",
            bytes32("over"),
            0,
            address(agentToken),
            0
        );

        // Deposit 100
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 100 ether);
        personaFactory.depositAgentTokens(tokenId, 100 ether);

        // Try to withdraw 101
        vm.expectRevert(abi.encodeWithSignature("Insufficient(uint8)", 4)); // Insufficient balance = 4
        personaFactory.withdrawAgentTokens(tokenId, 101 ether);
        vm.stopPrank();
    }

    // ==================== Minimum Agent Token Tests ====================

    function test_Graduation_BelowMinAgentTokens_DoesNotGraduate() public {
        uint256 minRequired = 5000 ether;

        // Create persona with minimum requirement
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Min Required",
            "MINREQ",
            bytes32("minreq"),
            0,
            address(agentToken),
            minRequired
        );

        // Deposit less than minimum
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 2000 ether);
        personaFactory.depositAgentTokens(tokenId, 2000 ether);
        vm.stopPrank();

        // Try to graduate - should not graduate due to insufficient agent tokens
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId,
            1_100_000 ether, // Amount that would normally trigger graduation
            0,
            user3,
            block.timestamp + 300
        );

        // Verify NOT graduated
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        assertEq(graduationTimestamp, 0);
    }

    function test_Graduation_ExactlyMinAgentTokens_Succeeds() public {
        uint256 minRequired = 5000 ether;

        // Create persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Exact Min",
            "EXACTMIN",
            bytes32("exactmin"),
            0,
            address(agentToken),
            minRequired
        );

        // Deposit exactly the minimum
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), minRequired);
        personaFactory.depositAgentTokens(tokenId, minRequired);
        vm.stopPrank();

        // Should be able to graduate
        vm.prank(user3);

        // Don't check for specific pool ID, just that a pool was created
        vm.expectEmit(true, false, false, false);
        emit V4PoolCreated(tokenId, PoolId.wrap(bytes32(0)), 0);

        personaFactory.swapExactTokensForTokens(
            tokenId,
            1_100_000 ether, // 1.1M to ensure graduation
            0,
            user3,
            block.timestamp + 300
        );

        // Verify graduated
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        assertTrue(graduationTimestamp > 0);
    }

    function test_Graduation_WithdrawBelowMin_DoesNotGraduate() public {
        uint256 minRequired = 10000 ether;

        // Create persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Withdraw Min",
            "WMIN",
            bytes32("wmin"),
            0,
            address(agentToken),
            minRequired
        );

        // Deposit more than minimum
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 15000 ether);
        personaFactory.depositAgentTokens(tokenId, 15000 ether);

        // Withdraw to go below minimum
        personaFactory.withdrawAgentTokens(tokenId, 6000 ether);
        vm.stopPrank();

        // Try to graduate - should not graduate
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId, 1_100_000 ether, 0, user3, block.timestamp + 300
        );

        // Verify NOT graduated
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        assertEq(graduationTimestamp, 0);

        // Deposit again to meet minimum
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 1000 ether);
        personaFactory.depositAgentTokens(tokenId, 1000 ether);
        vm.stopPrank();

        // Now should graduate with another purchase (any amount since we already bought enough)
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId,
            1000 ether, // Small additional purchase
            0,
            user3,
            block.timestamp + 300
        );

        // Verify graduated
        (,,, uint256 graduationTimestamp2,,) = personaFactory.personas(tokenId);
        assertTrue(graduationTimestamp2 > 0);
    }

    // ==================== Agent Rewards Distribution Tests ====================

    function test_ClaimRewards_SingleDepositor() public {
        // Create persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Single Reward",
            "SINGLE",
            bytes32("single"),
            0,
            address(agentToken),
            0
        );

        // User2 deposits agent tokens
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 100 ether);
        personaFactory.depositAgentTokens(tokenId, 100 ether);
        vm.stopPrank();

        // Graduate
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId, 1_100_000 ether, 0, user3, block.timestamp + 300
        );

        // Get persona token
        (address personaTokenAddress,,,,,) = personaFactory.personas(tokenId);
        PersonaToken pToken = PersonaToken(personaTokenAddress);

        // Wait for claim delay
        vm.warp(block.timestamp + 1 days + 1);

        // Claim rewards
        vm.prank(user2);

        // Check for AgentRewardsDistributed event
        vm.expectEmit(true, true, false, false);
        emit AgentRewardsDistributed(tokenId, user2, AGENT_REWARDS_AMOUNT);

        personaFactory.claimRewards(tokenId);

        // User2 should get all agent rewards (1/6 of supply + rounding)
        uint256 balance = pToken.balanceOf(user2);
        assertEq(balance, AGENT_REWARDS_AMOUNT);
    }

    function test_ClaimRewards_MultipleDepositors() public {
        // Create persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Multi Reward",
            "MULTIR",
            bytes32("multir"),
            0,
            address(agentToken),
            0
        );

        // User1 deposits 1000 (creator can also deposit)
        vm.startPrank(user1);
        agentToken.approve(address(personaFactory), 1000 ether);
        personaFactory.depositAgentTokens(tokenId, 1000 ether);
        vm.stopPrank();

        // User2 deposits 2000
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 2000 ether);
        personaFactory.depositAgentTokens(tokenId, 2000 ether);
        vm.stopPrank();

        // Graduate
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId, 1_100_000 ether, 0, user3, block.timestamp + 300
        );

        // Get persona token
        (address personaTokenAddress,,,,,) = personaFactory.personas(tokenId);
        PersonaToken pToken = PersonaToken(personaTokenAddress);

        // Wait for claim delay
        vm.warp(block.timestamp + 1 days + 1);

        // Claim rewards
        vm.prank(user1);
        personaFactory.claimRewards(tokenId);

        vm.prank(user2);
        personaFactory.claimRewards(tokenId);

        // Check balances - should be proportional to deposits
        uint256 user1Balance = pToken.balanceOf(user1);
        uint256 user2Balance = pToken.balanceOf(user2);

        // User1 deposited 1/3, should get ~1/3 of rewards
        uint256 expectedUser1 = AGENT_REWARDS_AMOUNT * 1000 / 3000;
        assertApproxEqRel(user1Balance, expectedUser1, 1e16); // 1% tolerance

        // User2 deposited 2/3, should get ~2/3 of rewards
        uint256 expectedUser2 = AGENT_REWARDS_AMOUNT * 2000 / 3000;
        assertApproxEqRel(user2Balance, expectedUser2, 1e16); // 1% tolerance
    }

    function test_ClaimRewards_WithPurchasedTokens() public {
        // Create persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Combined Rewards",
            "COMBINED",
            bytes32("combined"),
            0,
            address(agentToken),
            0
        );

        // User2 buys tokens AND deposits agent tokens
        vm.startPrank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, 50_000 ether, 0, user2, block.timestamp + 300
        );

        agentToken.approve(address(personaFactory), 1000 ether);
        personaFactory.depositAgentTokens(tokenId, 1000 ether);
        vm.stopPrank();

        // User3 graduates by buying remaining tokens
        vm.startPrank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId,
            1_050_000 ether, // Enough to graduate (total will be 1.1M)
            0,
            user3,
            block.timestamp + 300
        );
        vm.stopPrank();

        // Get persona token
        (address personaTokenAddress,,,,,) = personaFactory.personas(tokenId);
        PersonaToken pToken = PersonaToken(personaTokenAddress);

        // Wait for claim delay
        vm.warp(block.timestamp + 1 days + 1);

        // User2 claims both purchased tokens and agent rewards
        vm.prank(user2);
        personaFactory.claimRewards(tokenId);

        // User3 claims only purchased tokens (no agent deposits)
        vm.prank(user3);
        personaFactory.claimRewards(tokenId);

        // Verify balances
        uint256 user2Balance = pToken.balanceOf(user2);
        uint256 user3Balance = pToken.balanceOf(user3);

        // User2 should have purchased tokens + unsold bonus + all agent rewards
        // User3 should have purchased tokens + unsold bonus
        assertTrue(user2Balance > user3Balance); // User2 has agent rewards too
    }

    function test_ClaimRewards_BeforeGraduation_Reverts() public {
        // Create persona and deposit
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Early Claim",
            "EARLY",
            bytes32("early"),
            0,
            address(agentToken),
            0
        );

        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 1000 ether);
        personaFactory.depositAgentTokens(tokenId, 1000 ether);

        // Try to claim before graduation
        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 3)); // NotGraduated = 3
        personaFactory.claimRewards(tokenId);
        vm.stopPrank();
    }

    function test_ClaimRewards_NoDepositsNoPurchases_Reverts() public {
        // Create persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "No Deposits",
            "NODEP",
            bytes32("nodep"),
            0,
            address(agentToken),
            0
        );

        // Graduate
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId, 1_100_000 ether, 0, user3, block.timestamp + 300
        );

        // Wait for claim delay
        vm.warp(block.timestamp + 1 days + 1);

        // Try to claim with no deposits or purchases
        vm.prank(user2); // user2 didn't participate
        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 9)); // NoTokens = 9
        personaFactory.claimRewards(tokenId);
    }

    function test_ClaimRewards_DoubleClaim_Reverts() public {
        // Create persona and deposit
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Double Claim",
            "DOUBLE",
            bytes32("double"),
            0,
            address(agentToken),
            0
        );

        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 1000 ether);
        personaFactory.depositAgentTokens(tokenId, 1000 ether);
        vm.stopPrank();

        // Graduate
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId, 300_000 ether, 0, user3, block.timestamp + 300
        );

        // Wait for claim delay
        vm.warp(block.timestamp + 1 days + 1);

        // First claim succeeds
        vm.prank(user2);
        personaFactory.claimRewards(tokenId);

        // Second claim should fail
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 14)); // AlreadyClaimed = 14
        personaFactory.claimRewards(tokenId);
    }

    // ==================== Token Distribution Tests ====================

    function test_TokenDistribution_WithAgent() public {
        // Create persona with agent token
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Agent Dist",
            "AGDIST",
            bytes32("agdist"),
            0,
            address(agentToken),
            0
        );

        // Check bonding amount for agent personas (1/6 of supply)
        (, uint256 tokensPurchased,) =
            personaFactory.preGraduationStates(tokenId);
        assertEq(tokensPurchased, 0);

        // Buy just under graduation threshold
        vm.prank(user2);
        // The exact threshold calculation uses (bondingSupply * 85 + 50) / 100
        uint256 threshold = (AGENT_BONDING_AMOUNT * 85 + 50) / 100;
        // Calculate amount needed but subtract some to stay under
        uint256 amountNeeded =
            calculateAmountForGraduation(AGENT_BONDING_AMOUNT, 1333 ether);
        uint256 justUnder = amountNeeded - 10_000 ether; // Stay well under threshold
        personaFactory.swapExactTokensForTokens(
            tokenId, justUnder, 0, user2, block.timestamp + 300
        );

        // Check not graduated
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        assertEq(graduationTimestamp, 0);
    }

    function test_TokenDistribution_WithoutAgent() public {
        // Create persona without agent token
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "No Agent Dist",
            "NOAGDIST",
            bytes32("noagdist"),
            0,
            address(0),
            0
        );

        // Check bonding amount for non-agent personas (1/3 of supply)
        (, uint256 tokensPurchased,) =
            personaFactory.preGraduationStates(tokenId);
        assertEq(tokensPurchased, 0);

        // Buy just under graduation threshold
        vm.prank(user2);
        // For non-agent: 333,333,333 * 0.85 = 283,333,333
        uint256 nonAgentBonding = 333_333_333 ether;
        uint256 amountNeeded =
            calculateAmountForGraduation(nonAgentBonding, 1333 ether);
        uint256 justUnder = amountNeeded - 10_000 ether; // Stay under threshold
        personaFactory.swapExactTokensForTokens(
            tokenId, justUnder, 0, user2, block.timestamp + 300
        );

        // Check not graduated
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        assertEq(graduationTimestamp, 0);
    }

    // ==================== Integration Tests ====================

    function test_FullFlow_DepositWithdrawGraduateClaim() public {
        // Create persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Full Flow",
            "FULL",
            bytes32("full"),
            0,
            address(agentToken),
            0
        );

        // Multiple deposits and withdrawals
        vm.startPrank(user1);
        agentToken.approve(address(personaFactory), 5000 ether);
        personaFactory.depositAgentTokens(tokenId, 3000 ether);
        personaFactory.withdrawAgentTokens(tokenId, 1000 ether);
        personaFactory.depositAgentTokens(tokenId, 500 ether);
        vm.stopPrank();

        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 4000 ether);
        personaFactory.depositAgentTokens(tokenId, 4000 ether);
        personaFactory.withdrawAgentTokens(tokenId, 1000 ether);
        vm.stopPrank();

        // Check final deposits
        assertEq(personaFactory.agentDeposits(tokenId, user1), 2500 ether);
        assertEq(personaFactory.agentDeposits(tokenId, user2), 3000 ether);

        // Graduate
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId, 300_000 ether, 0, user3, block.timestamp + 300
        );

        // Get persona token
        (address personaTokenAddress,,,,,) = personaFactory.personas(tokenId);
        PersonaToken pToken = PersonaToken(personaTokenAddress);

        // Wait for claim delay
        vm.warp(block.timestamp + 1 days + 1);

        // Claim rewards
        vm.prank(user1);
        personaFactory.claimRewards(tokenId);

        vm.prank(user2);
        personaFactory.claimRewards(tokenId);

        // Check proportional distribution
        uint256 user1Balance = pToken.balanceOf(user1);
        uint256 user2Balance = pToken.balanceOf(user2);
        uint256 totalRewards = user1Balance + user2Balance;

        // Total should be the agent rewards amount
        assertEq(totalRewards, AGENT_REWARDS_AMOUNT);

        // User1 had 2500/5500 = ~45.45% of deposits
        uint256 expectedUser1Balance = AGENT_REWARDS_AMOUNT * 2500 / 5500;
        assertApproxEqRel(user1Balance, expectedUser1Balance, 1e16); // 1% tolerance

        // User2 had 3000/5500 = ~54.55% of deposits
        uint256 expectedUser2Balance = AGENT_REWARDS_AMOUNT * 3000 / 5500;
        assertApproxEqRel(user2Balance, expectedUser2Balance, 1e16); // 1% tolerance
    }

    function test_AgentTokensSentToPersonaToken() public {
        // Create persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Persona Agent",
            "PAGENT",
            bytes32("pagent"),
            0,
            address(agentToken),
            0
        );

        // Deposit agent tokens
        vm.startPrank(user1);
        agentToken.approve(address(personaFactory), 1000 ether);
        personaFactory.depositAgentTokens(tokenId, 1000 ether);
        vm.stopPrank();

        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 2000 ether);
        personaFactory.depositAgentTokens(tokenId, 2000 ether);
        vm.stopPrank();

        // Get persona token address
        (address personaTokenAddress,,,,,) = personaFactory.personas(tokenId);

        // Check persona token balance before graduation
        uint256 personaAgentBalanceBefore =
            IERC20(address(agentToken)).balanceOf(personaTokenAddress);

        // Graduate
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId, 300_000 ether, 0, user3, block.timestamp + 300
        );

        // Check agent tokens were sent to persona token contract
        uint256 personaAgentBalanceAfter =
            IERC20(address(agentToken)).balanceOf(personaTokenAddress);
        assertEq(
            personaAgentBalanceAfter - personaAgentBalanceBefore, 3000 ether
        );

        // Also check persona tokens were sent to AMICA
        uint256 personaTokenBalance =
            IERC20(personaTokenAddress).balanceOf(address(amicaToken));
        assertEq(personaTokenBalance, 333_333_333 ether); // 1/3 for AMICA with agent
    }

    function test_GraduationWithNoAgentDeposits() public {
        // Create persona with agent token but don't deposit any
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "No Dep Grad",
            "NODEPG",
            bytes32("nodepg"),
            0,
            address(agentToken),
            0
        );

        // Graduate without any agent deposits
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId, 1_100_000 ether, 0, user3, block.timestamp + 300
        );

        // Should graduate successfully
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        assertTrue(graduationTimestamp > 0);

        // No agent tokens sent to persona token (since none were deposited)
        // Just verify it doesn't revert
    }

    function test_DepositTriggersGraduation() public {
        uint256 minRequired = 5000 ether;

        // Create persona with min requirement
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Deposit Grad",
            "DEPGRAD",
            bytes32("depgrad"),
            0,
            address(agentToken),
            minRequired
        );

        // First buy enough tokens to meet the 85% threshold
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, 1_100_000 ether, 0, user2, block.timestamp + 300
        );

        // Should not be graduated yet (missing agent tokens)
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        assertEq(graduationTimestamp, 0);

        // Now deposit enough agent tokens to trigger graduation
        vm.startPrank(user3);
        agentToken.approve(address(personaFactory), minRequired);

        // Don't check for specific pool ID
        vm.expectEmit(true, false, false, false);
        emit V4PoolCreated(tokenId, PoolId.wrap(bytes32(0)), 0);

        personaFactory.depositAgentTokens(tokenId, minRequired);
        vm.stopPrank();

        // Should be graduated now
        (,,, graduationTimestamp,,) = personaFactory.personas(tokenId);
        assertTrue(graduationTimestamp > 0);
    }
}
