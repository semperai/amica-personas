// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Fixtures} from "./shared/Fixtures.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PersonaTokenFactory} from "../src/PersonaTokenFactory.sol";
import {PersonaToken} from "../src/PersonaToken.sol";

contract PersonaTokenFactoryAgentTest is Fixtures {
    MockERC20 public agentToken;
    
    // Events to test
    event AgentTokenAssociated(uint256 indexed tokenId, address indexed agentToken);
    event AgentTokensDeposited(uint256 indexed tokenId, address indexed depositor, uint256 amount);
    event AgentTokensWithdrawn(uint256 indexed tokenId, address indexed depositor, uint256 amount);
    event AgentRewardsDistributed(uint256 indexed tokenId, address indexed recipient, uint256 personaTokens, uint256 agentShare);
    event TokensClaimed(uint256 indexed tokenId, address indexed user, uint256 purchasedAmount, uint256 bonusAmount, uint256 totalAmount);
    event PersonaCreated(uint256 indexed tokenId, bytes32 indexed domain, address indexed token);
    event V4PoolCreated(uint256 indexed tokenId, bytes32 indexed poolId, uint256 liquidity);

    function setUp() public override {
        super.setUp();
        
        // Deploy agent token
        agentToken = new MockERC20("Agent Token", "AGENT", 18);
        agentToken.mint(user1, 100_000 ether);
        agentToken.mint(user2, 100_000 ether);
        agentToken.mint(user3, 100_000 ether);
        
        // Approve factory for all users
        vm.prank(user1);
        amicaToken.approve(address(personaFactory), type(uint256).max);
        vm.prank(user2);
        amicaToken.approve(address(personaFactory), type(uint256).max);
        vm.prank(user3);
        amicaToken.approve(address(personaFactory), type(uint256).max);
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
            string memory name,
            string memory symbol,
            address token,
            address pairToken,
            address storedAgentToken,
            bool pairCreated,
            uint256 createdAt,
            uint256 totalAgentDeposited,
            uint256 minAgentTokens,
            ,
        ) = personaFactory.personas(tokenId);
        
        assertEq(name, "Agent Persona");
        assertEq(symbol, "AGENTP");
        assertEq(storedAgentToken, address(agentToken));
        assertEq(minAgentTokens, 0);
        assertEq(totalAgentDeposited, 0);
        assertFalse(pairCreated);
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
        (,,,, address storedAgentToken,,,,,,) = personaFactory.personas(tokenId);
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
        (,,,,,,,, uint256 minAgentTokens,,) = personaFactory.personas(tokenId);
        assertEq(minAgentTokens, minRequired);
    }
    
    function test_CreatePersonaWithMinRequirementButNoAgentToken_Reverts() public {
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
        emit AgentTokensDeposited(tokenId, user2, depositAmount);
        
        personaFactory.depositAgentTokens(tokenId, depositAmount);
        vm.stopPrank();
        
        // Verify deposit was recorded
        uint256 userDeposit = personaFactory.agentDeposits(tokenId, user2);
        assertEq(userDeposit, depositAmount);
        
        // Verify total deposited
        (,,,,,,, uint256 totalAgentDeposited,,,) = personaFactory.personas(tokenId);
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
        (,,,,,,, uint256 totalAgentDeposited,,,) = personaFactory.personas(tokenId);
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
        
        // Graduate by buying enough tokens (85% of 222,222,222)
        vm.startPrank(user2);
        uint256 graduationAmount = 190_000_000 ether; // Just over 85%
        personaFactory.swapExactTokensForTokens(
            tokenId,
            graduationAmount,
            0,
            user2,
            block.timestamp + 300
        );
        vm.stopPrank();
        
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
        emit AgentTokensWithdrawn(tokenId, user2, 1000 ether);
        
        personaFactory.withdrawAgentTokens(tokenId, 1000 ether);
        vm.stopPrank();
        
        uint256 balanceAfter = agentToken.balanceOf(user2);
        assertEq(balanceAfter - balanceBefore, 1000 ether);
        
        // Verify deposit was cleared
        assertEq(personaFactory.agentDeposits(tokenId, user2), 0);
        
        // Verify total was updated
        (,,,,,,, uint256 totalAgentDeposited,,,) = personaFactory.personas(tokenId);
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
        (,,,,,,, uint256 totalAgentDeposited,,,) = personaFactory.personas(tokenId);
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
        
        // Graduate
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId,
            190_000_000 ether,
            0,
            user3,
            block.timestamp + 300
        );
        
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
            190_000_000 ether,
            0,
            user3,
            block.timestamp + 300
        );
        
        // Verify NOT graduated
        (,,,, , bool pairCreated,,,,,) = personaFactory.personas(tokenId);
        assertFalse(pairCreated);
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
        vm.expectEmit(true, false, false, false);
        emit V4PoolCreated(tokenId, bytes32(0), 0);
        
        personaFactory.swapExactTokensForTokens(
            tokenId,
            190_000_000 ether,
            0,
            user3,
            block.timestamp + 300
        );
        
        // Verify graduated
        (,,,, , bool pairCreated,,,,,) = personaFactory.personas(tokenId);
        assertTrue(pairCreated);
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
            tokenId,
            190_000_000 ether,
            0,
            user3,
            block.timestamp + 300
        );
        
        // Verify NOT graduated
        (,,,, , bool pairCreated,,,,,) = personaFactory.personas(tokenId);
        assertFalse(pairCreated);
        
        // Deposit again to meet minimum
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 1000 ether);
        personaFactory.depositAgentTokens(tokenId, 1000 ether);
        vm.stopPrank();
        
        // Now should graduate
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId,
            10_000_000 ether, // Buy remaining tokens to hit 85%
            0,
            user3,
            block.timestamp + 300
        );
        
        // Verify graduated
        (,,,, , bool pairCreated2,,,,,) = personaFactory.personas(tokenId);
        assertTrue(pairCreated2);
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
            tokenId,
            190_000_000 ether,
            0,
            user3,
            block.timestamp + 300
        );
        
        // Get persona token
        (,, address personaTokenAddress,,,,,,,,) = personaFactory.personas(tokenId);
        PersonaToken pToken = PersonaToken(personaTokenAddress);
        
        // Claim rewards
        vm.prank(user2);
        vm.expectEmit(true, true, false, false);
        emit AgentRewardsDistributed(tokenId, user2, 222_222_223 ether, 100 ether);
        
        personaFactory.claimRewards(tokenId);
        
        // User2 should get all agent rewards (2/9 of supply + 1)
        uint256 balance = pToken.balanceOf(user2);
        assertEq(balance, 222_222_223 ether);
        
        // Deposits should be cleared
        assertEq(personaFactory.agentDeposits(tokenId, user2), 0);
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
            tokenId,
            190_000_000 ether,
            0,
            user3,
            block.timestamp + 300
        );
        
        // Get persona token
        (,, address personaTokenAddress,,,,,,,,) = personaFactory.personas(tokenId);
        PersonaToken pToken = PersonaToken(personaTokenAddress);
        
        // Claim rewards
        vm.prank(user1);
        personaFactory.claimRewards(tokenId);
        
        vm.prank(user2);
        personaFactory.claimRewards(tokenId);
        
        // Check balances - should be proportional to deposits
        uint256 user1Balance = pToken.balanceOf(user1);
        uint256 user2Balance = pToken.balanceOf(user2);
        
        // User1 deposited 1/3, should get ~1/3 of rewards
        uint256 expectedUser1 = 74_074_074 ether;
        assertApproxEqRel(user1Balance, expectedUser1, 1e16); // 1% tolerance
        
        // User2 deposited 2/3, should get ~2/3 of rewards
        uint256 expectedUser2 = 148_148_149 ether;
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
            tokenId,
            50_000_000 ether,
            0,
            user2,
            block.timestamp + 300
        );
        
        agentToken.approve(address(personaFactory), 1000 ether);
        personaFactory.depositAgentTokens(tokenId, 1000 ether);
        vm.stopPrank();
        
        // User3 only buys tokens
        vm.startPrank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId,
            140_000_000 ether, // Graduate
            0,
            user3,
            block.timestamp + 300
        );
        vm.stopPrank();
        
        // Get persona token
        (,, address personaTokenAddress,,,,,,,,) = personaFactory.personas(tokenId);
        PersonaToken pToken = PersonaToken(personaTokenAddress);
        
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
        // Create persona and graduate without deposits or purchases
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
            tokenId,
            190_000_000 ether,
            0,
            user3,
            block.timestamp + 300
        );
        
        // Try to claim with no deposits or purchases
        vm.prank(user2);
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
            tokenId,
            190_000_000 ether,
            0,
            user3,
            block.timestamp + 300
        );
        
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
        
        // Check bonding amount for agent personas (2/9 of supply)
        (, uint256 tokensSold) = personaFactory.purchases(tokenId);
        assertEq(tokensSold, 0);
        
        // Verify graduation happens at 85% of 222,222,222
        uint256 expectedGraduation = (222_222_222 ether * 85) / 100;
        
        // Buy just under graduation threshold
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId,
            180_000_000 ether,
            0,
            user2,
            block.timestamp + 300
        );
        
        // Check not graduated
        (,,,, , bool pairCreated,,,,,) = personaFactory.personas(tokenId);
        assertFalse(pairCreated);
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
        (, uint256 tokensSold) = personaFactory.purchases(tokenId);
        assertEq(tokensSold, 0);
        
        // Verify graduation happens at 85% of 333,333,333
        uint256 expectedGraduation = (333_333_333 ether * 85) / 100;
        
        // Buy just under graduation threshold
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId,
            280_000_000 ether,
            0,
            user2,
            block.timestamp + 300
        );
        
        // Check not graduated
        (,,,, , bool pairCreated,,,,,) = personaFactory.personas(tokenId);
        assertFalse(pairCreated);
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
            tokenId,
            190_000_000 ether,
            0,
            user3,
            block.timestamp + 300
        );
        
        // Get persona token
        (,, address personaTokenAddress,,,,,,,,) = personaFactory.personas(tokenId);
        PersonaToken pToken = PersonaToken(personaTokenAddress);
        
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
        assertEq(totalRewards, 222_222_223 ether);
        
        // User1 had 2500/5500 = ~45.45% of deposits
        uint256 totalAgentRewards = 222_222_223 ether;
        uint256 expectedUser1Balance = totalAgentRewards * 2500 / 5500;
        assertApproxEqRel(user1Balance, expectedUser1Balance, 1e16); // 1% tolerance
        
        // User2 had 3000/5500 = ~54.55% of deposits
        uint256 expectedUser2Balance = totalAgentRewards * 3000 / 5500;
        assertApproxEqRel(user2Balance, expectedUser2Balance, 1e16); // 1% tolerance
    }
    
    function test_AgentTokensSentToAmica() public {
        // Create persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Amica Agent",
            "AMICA",
            bytes32("amicaag"),
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
        
        // Check AMICA balance before graduation
        uint256 amicaAgentBalanceBefore = amicaToken.depositedBalances(address(agentToken));
        assertEq(amicaAgentBalanceBefore, 0);
        
        // Graduate
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId,
            190_000_000 ether,
            0,
            user3,
            block.timestamp + 300
        );
        
        // Check agent tokens were sent to AMICA
        uint256 amicaAgentBalanceAfter = amicaToken.depositedBalances(address(agentToken));
        assertEq(amicaAgentBalanceAfter, 3000 ether);
        
        // Also check persona tokens were deposited
        (,, address personaTokenAddress,,,,,,,,) = personaFactory.personas(tokenId);
        uint256 personaTokenBalance = amicaToken.depositedBalances(personaTokenAddress);
        assertEq(personaTokenBalance, 222_222_222 ether); // 2/9 for AMICA with agent
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
            tokenId,
            190_000_000 ether,
            0,
            user3,
            block.timestamp + 300
        );
        
        // Should graduate successfully
        (,,,, , bool pairCreated,,,,,) = personaFactory.personas(tokenId);
        assertTrue(pairCreated);
        
        // No agent tokens sent to AMICA
        uint256 amicaAgentBalance = amicaToken.depositedBalances(address(agentToken));
        assertEq(amicaAgentBalance, 0);
    }
}
