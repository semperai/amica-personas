// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Fixtures} from "./shared/Fixtures.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PersonaTokenFactory} from "../src/PersonaTokenFactory.sol";
import {PersonaToken} from "../src/PersonaToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PersonaTokenFactoryCreationTest is Fixtures {
    MockERC20 public agentToken;

    // Constants from the contract
    uint256 constant PERSONA_TOKEN_SUPPLY = 1_000_000_000 ether;
    uint256 constant AMICA_DEPOSIT_AMOUNT = 222_222_222 ether; // 2/9 of supply for agent personas
    uint256 constant STANDARD_AMICA_AMOUNT = 333_333_333 ether + 1 ether; // 1/3 + rounding

    // Graduation thresholds (85% of bonding tokens)
    uint256 constant AGENT_GRADUATION_THRESHOLD = 188_888_888 ether; // 85% of 222,222,222
    uint256 constant NORMAL_GRADUATION_THRESHOLD = 283_333_333 ether; // 85% of 333,333,333

    event PersonaCreated(
        uint256 indexed tokenId, bytes32 indexed domain, address indexed token
    );
    event TokensPurchased(
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 amountSpent,
        uint256 tokensReceived
    );
    event TokensClaimed(
        uint256 indexed tokenId,
        address indexed user,
        uint256 purchasedAmount,
        uint256 bonusAmount,
        uint256 totalAmount
    );
    event AgentTokenAssociated(
        uint256 indexed tokenId, address indexed agentToken
    );
    event AgentTokensDeposited(
        uint256 indexed tokenId, address indexed depositor, uint256 amount
    );
    event AgentTokensWithdrawn(
        uint256 indexed tokenId, address indexed depositor, uint256 amount
    );
    event AgentRewardsDistributed(
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 personaTokens,
        uint256 agentShare
    );
    event V4PoolCreated(
        uint256 indexed tokenId, bytes32 indexed poolId, uint256 liquidity
    );
    event V4AgentPoolCreated(
        uint256 indexed tokenId,
        bytes32 indexed agentPoolId,
        uint256 personaTokenAmount,
        uint160 initialPrice
    );

    function setUp() public override {
        super.setUp();

        // Deploy agent token
        agentToken = new MockERC20("Agent Token", "AGENT", 18);
        agentToken.mint(user1, 10_000_000 ether);
        agentToken.mint(user2, 10_000_000 ether);
        agentToken.mint(user3, 10_000_000 ether);

        // Approve tokens for all users
        vm.prank(user1);
        amicaToken.approve(address(personaFactory), type(uint256).max);

        vm.prank(user2);
        amicaToken.approve(address(personaFactory), type(uint256).max);

        vm.prank(user3);
        amicaToken.approve(address(personaFactory), type(uint256).max);
    }

    // ==================== Basic Creation Tests ====================

    function test_CreatePersona_WithoutAgent() public {
        vm.startPrank(user1);

        bytes32 domain = bytes32("testnormal");

        vm.expectEmit(true, true, false, false);
        emit PersonaCreated(1, domain, address(0));

        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Normal Persona",
            "NORMAL",
            domain,
            0,
            address(0), // No agent token
            0
        );

        vm.stopPrank();

        // Verify persona data
        (
            string memory name,
            string memory symbol,
            address token,
            address pairToken,
            address agentTokenAddr,
            bool pairCreated,
            uint256 createdAt,
            uint256 totalAgentDeposited,
            uint256 minAgentTokens,
            ,
        ) = personaFactory.personas(tokenId);

        assertEq(name, "Normal Persona");
        assertEq(symbol, "NORMAL");
        assertTrue(token != address(0));
        assertEq(pairToken, address(amicaToken));
        assertEq(agentTokenAddr, address(0));
        assertFalse(pairCreated);
        assertEq(createdAt, block.timestamp);
        assertEq(totalAgentDeposited, 0);
        assertEq(minAgentTokens, 0);

        // Check token details
        PersonaToken personaTokenContract = PersonaToken(token);
        assertEq(personaTokenContract.name(), "Normal Persona.amica");
        assertEq(personaTokenContract.symbol(), "NORMAL.amica");
        assertEq(personaTokenContract.totalSupply(), PERSONA_TOKEN_SUPPLY);
        assertEq(
            personaTokenContract.balanceOf(address(personaFactory)),
            PERSONA_TOKEN_SUPPLY
        );
    }

    function test_CreatePersona_WithAgent() public {
        vm.startPrank(user1);

        bytes32 domain = bytes32("testagent");
        uint256 minAgentAmount = 10_000 ether;

        vm.expectEmit(true, true, false, false);
        emit PersonaCreated(1, domain, address(0));

        vm.expectEmit(true, true, false, false);
        emit AgentTokenAssociated(1, address(agentToken));

        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Agent Persona",
            "AGENT",
            domain,
            0,
            address(agentToken),
            minAgentAmount
        );

        vm.stopPrank();

        // Verify persona data
        (
            string memory name,
            string memory symbol,
            address token,
            address pairToken,
            address agentTokenAddr,
            bool pairCreated,
            ,
            ,
            uint256 minAgentTokens,
            ,
        ) = personaFactory.personas(tokenId);

        assertEq(name, "Agent Persona");
        assertEq(symbol, "AGENT");
        assertEq(agentTokenAddr, address(agentToken));
        assertEq(minAgentTokens, minAgentAmount);
        assertFalse(pairCreated);
    }

    function test_CreatePersona_WithInitialBuy() public {
        vm.startPrank(user1);

        bytes32 domain = bytes32("testbuy");
        uint256 buyAmount = 5000 ether;

        vm.expectEmit(true, true, false, false);
        emit PersonaCreated(1, domain, address(0));

        vm.expectEmit(true, true, false, false);
        emit TokensPurchased(1, user1, buyAmount, 0);

        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Buy Persona",
            "BUY",
            domain,
            buyAmount,
            address(0),
            0
        );

        vm.stopPrank();

        // Check purchase was recorded
        uint256 userPurchase = personaFactory.userPurchases(tokenId, user1);
        assertGt(userPurchase, 0, "User should have purchased tokens");

        (uint256 totalDeposited, uint256 tokensSold) =
            personaFactory.purchases(tokenId);
        assertEq(totalDeposited, buyAmount);
        assertEq(tokensSold, userPurchase);
    }

    // ==================== Agent Token Tests ====================

    function test_DepositAgentTokens() public {
        // Create persona with agent token
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Agent Test",
            "ATEST",
            bytes32("agenttest"),
            0,
            address(agentToken),
            20_000 ether // min required
        );

        // Deposit agent tokens
        uint256 depositAmount = 10_000 ether;

        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), depositAmount);

        vm.expectEmit(true, true, false, true);
        emit AgentTokensDeposited(tokenId, user2, depositAmount);

        personaFactory.depositAgentTokens(tokenId, depositAmount);
        vm.stopPrank();

        // Verify deposit
        assertEq(personaFactory.agentDeposits(tokenId, user2), depositAmount);

        (,,,,,,, uint256 totalAgentDeposited,,,) =
            personaFactory.personas(tokenId);
        assertEq(totalAgentDeposited, depositAmount);
    }

    function test_DepositAgentTokens_RevertNoAgentToken() public {
        // Create persona without agent token
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "No Agent",
            "NOAG",
            bytes32("noagent"),
            0,
            address(0),
            0
        );

        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 6)); // No agent token
        personaFactory.depositAgentTokens(tokenId, 1000 ether);
    }

    function test_DepositAgentTokens_RevertAfterGraduation() public {
        // Create and graduate a persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Graduate Test",
            "GRAD",
            bytes32("gradtest"),
            0,
            address(agentToken),
            0 // No minimum for easy graduation
        );

        // Graduate by reaching threshold (85% of 222,222,222 for agent personas)
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId,
            AGENT_GRADUATION_THRESHOLD + 1000 ether,
            0,
            user2,
            block.timestamp + 300
        );

        // Try to deposit after graduation
        vm.startPrank(user3);
        agentToken.approve(address(personaFactory), 1000 ether);

        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 2)); // Already graduated
        personaFactory.depositAgentTokens(tokenId, 1000 ether);
        vm.stopPrank();
    }

    function test_WithdrawAgentTokens() public {
        // Create persona and deposit
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Withdraw Test",
            "WITH",
            bytes32("withtest"),
            0,
            address(agentToken),
            0
        );

        uint256 depositAmount = 10_000 ether;
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), depositAmount);
        personaFactory.depositAgentTokens(tokenId, depositAmount);

        // Withdraw half
        uint256 withdrawAmount = 5_000 ether;
        uint256 balanceBefore = agentToken.balanceOf(user2);

        vm.expectEmit(true, true, false, true);
        emit AgentTokensWithdrawn(tokenId, user2, withdrawAmount);

        personaFactory.withdrawAgentTokens(tokenId, withdrawAmount);
        vm.stopPrank();

        // Verify withdrawal
        assertEq(
            personaFactory.agentDeposits(tokenId, user2),
            depositAmount - withdrawAmount
        );
        assertEq(agentToken.balanceOf(user2), balanceBefore + withdrawAmount);

        (,,,,,,, uint256 totalAgentDeposited,,,) =
            personaFactory.personas(tokenId);
        assertEq(totalAgentDeposited, depositAmount - withdrawAmount);
    }

    function test_WithdrawAgentTokens_RevertInsufficientBalance() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Insufficient Test",
            "INSUF",
            bytes32("insuftest"),
            0,
            address(agentToken),
            0
        );

        // Deposit some tokens
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 1000 ether);
        personaFactory.depositAgentTokens(tokenId, 1000 ether);

        // Try to withdraw more than deposited
        vm.expectRevert(abi.encodeWithSignature("Insufficient(uint8)", 4)); // Insufficient balance
        personaFactory.withdrawAgentTokens(tokenId, 2000 ether);
        vm.stopPrank();
    }

    // ==================== Graduation with Agent Tests ====================

    function test_Graduation_WithSufficientAgentTokens() public {
        vm.prank(user1);
        uint256 minRequired = 50_000 ether;
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Agent Grad",
            "AGRAD",
            bytes32("agentgrad"),
            0,
            address(agentToken),
            minRequired
        );

        // Deposit enough agent tokens
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), minRequired);
        personaFactory.depositAgentTokens(tokenId, minRequired);
        vm.stopPrank();

        // Reach graduation threshold
        vm.startPrank(user3);

        vm.expectEmit(true, false, false, false);
        emit V4PoolCreated(tokenId, bytes32(0), 0);

        vm.expectEmit(true, false, false, false);
        emit V4AgentPoolCreated(tokenId, bytes32(0), 0, 0);

        personaFactory.swapExactTokensForTokens(
            tokenId,
            AGENT_GRADUATION_THRESHOLD + 1000 ether,
            0,
            user3,
            block.timestamp + 300
        );
        vm.stopPrank();

        // Verify graduation
        (,,,,, bool pairCreated,,,,,) = personaFactory.personas(tokenId);
        assertTrue(pairCreated, "Should have graduated");
    }

    function test_Graduation_InsufficientAgentTokens_NoGraduation() public {
        vm.prank(user1);
        uint256 minRequired = 100_000 ether;
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Need Agent",
            "NEED",
            bytes32("needagent"),
            0,
            address(agentToken),
            minRequired
        );

        // Deposit less than required
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 50_000 ether);
        personaFactory.depositAgentTokens(tokenId, 50_000 ether);
        vm.stopPrank();

        // Try to reach graduation threshold - should not graduate
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId,
            AGENT_GRADUATION_THRESHOLD + 1000 ether,
            0,
            user3,
            block.timestamp + 300
        );

        // Verify NOT graduated due to insufficient agent tokens
        (,,,,, bool pairCreated,,,,,) = personaFactory.personas(tokenId);
        assertFalse(pairCreated, "Should not have graduated");
    }

    // ==================== Agent Rewards Tests ====================

    function test_ClaimRewards_AgentDepositors() public {
        // Create persona with agent
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Reward Test",
            "REWARD",
            bytes32("rewardtest"),
            0,
            address(agentToken),
            20_000 ether
        );

        // Multiple users deposit agent tokens
        uint256 user2Deposit = 10_000 ether;
        uint256 user3Deposit = 15_000 ether;

        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), user2Deposit);
        personaFactory.depositAgentTokens(tokenId, user2Deposit);
        vm.stopPrank();

        vm.startPrank(user3);
        agentToken.approve(address(personaFactory), user3Deposit);
        personaFactory.depositAgentTokens(tokenId, user3Deposit);
        vm.stopPrank();

        // Graduate
        vm.prank(user1);
        personaFactory.swapExactTokensForTokens(
            tokenId,
            AGENT_GRADUATION_THRESHOLD + 1000 ether,
            0,
            user1,
            block.timestamp + 300
        );

        // Get persona token address
        (,, address personaTokenAddr,,,,,,,,) = personaFactory.personas(tokenId);

        // Claim rewards for user2
        vm.prank(user2);
        uint256 user2BalanceBefore = IERC20(personaTokenAddr).balanceOf(user2);

        vm.expectEmit(true, true, false, false);
        emit AgentRewardsDistributed(tokenId, user2, 0, user2Deposit);

        personaFactory.claimRewards(tokenId);

        uint256 user2BalanceAfter = IERC20(personaTokenAddr).balanceOf(user2);
        uint256 user2Reward = user2BalanceAfter - user2BalanceBefore;

        // Calculate expected reward (2/9 of supply * user2's share)
        uint256 totalDeposits = user2Deposit + user3Deposit;
        uint256 expectedReward =
            (222_222_223 ether) * user2Deposit / totalDeposits; // Agent rewards amount

        assertApproxEqAbs(
            user2Reward,
            expectedReward,
            1 ether,
            "User2 reward should match expected"
        );

        // Verify can't claim again
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 14)); // Already claimed
        personaFactory.claimRewards(tokenId);
    }

    function test_ClaimRewards_BeforeGraduation_Reverts() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Early Claim",
            "EARLY",
            bytes32("earlyclaim"),
            0,
            address(agentToken),
            0
        );

        // Deposit agent tokens
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 10_000 ether);
        personaFactory.depositAgentTokens(tokenId, 10_000 ether);

        // Try to claim before graduation
        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 3)); // Not graduated
        personaFactory.claimRewards(tokenId);
        vm.stopPrank();
    }

    function test_ClaimRewards_CombinedPurchaseAndAgent() public {
        // Create persona with agent
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Combined Test",
            "COMB",
            bytes32("combined"),
            0,
            address(agentToken),
            10_000 ether
        );

        // User2: Buy tokens AND deposit agent tokens
        vm.startPrank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, 50_000_000 ether, 0, user2, block.timestamp + 300
        );

        agentToken.approve(address(personaFactory), 10_000 ether);
        personaFactory.depositAgentTokens(tokenId, 10_000 ether);
        vm.stopPrank();

        // User3: Only buy tokens, graduate
        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId,
            140_000_000 ether, // Enough to graduate
            0,
            user3,
            block.timestamp + 300
        );

        // Get persona token address
        (,, address personaTokenAddr,,,,,,,,) = personaFactory.personas(tokenId);

        // User2 claims (should get purchased + bonus + agent rewards)
        vm.prank(user2);
        personaFactory.claimRewards(tokenId);

        // User3 claims (should get purchased + bonus only)
        vm.prank(user3);
        personaFactory.claimRewards(tokenId);

        // Verify user2 got more due to agent rewards
        uint256 user2Balance = IERC20(personaTokenAddr).balanceOf(user2);
        uint256 user3Balance = IERC20(personaTokenAddr).balanceOf(user3);

        // User2 should have significantly more due to agent rewards
        assertTrue(user2Balance > user3Balance, "User2 should have more tokens");
    }

    // ==================== Token Distribution Tests ====================

    function test_TokenDistribution_WithAgent() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Distribution Test",
            "DIST",
            bytes32("disttest"),
            0,
            address(agentToken),
            10_000 ether
        );

        // Get persona token address
        (,, address personaTokenAddr,,,,,,,,) = personaFactory.personas(tokenId);
        PersonaToken pToken = PersonaToken(personaTokenAddr);

        // Initial state - all tokens in factory
        assertEq(
            pToken.balanceOf(address(personaFactory)), PERSONA_TOKEN_SUPPLY
        );

        // Deposit agent tokens and graduate
        vm.startPrank(user2);
        agentToken.approve(address(personaFactory), 10_000 ether);
        personaFactory.depositAgentTokens(tokenId, 10_000 ether);

        personaFactory.swapExactTokensForTokens(
            tokenId,
            AGENT_GRADUATION_THRESHOLD + 1000 ether,
            0,
            user2,
            block.timestamp + 300
        );
        vm.stopPrank();

        // Check AMICA received deposit
        assertEq(
            amicaToken.depositedBalances(personaTokenAddr), AMICA_DEPOSIT_AMOUNT
        );
        assertEq(
            amicaToken.depositedBalances(address(agentToken)), 10_000 ether
        );
    }

    function test_TokenDistribution_WithoutAgent() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "No Agent Dist",
            "NODIST",
            bytes32("nodist"),
            0,
            address(0),
            0
        );

        // Get persona token address
        (,, address personaTokenAddr,,,,,,,,) = personaFactory.personas(tokenId);

        // Graduate (85% of 333,333,333 for non-agent personas)
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId,
            NORMAL_GRADUATION_THRESHOLD + 1000 ether,
            0,
            user2,
            block.timestamp + 300
        );

        // Check AMICA received correct amount (1/3 for non-agent personas)
        assertEq(
            amicaToken.depositedBalances(personaTokenAddr),
            STANDARD_AMICA_AMOUNT
        );
    }

    // ==================== Edge Cases ====================

    function test_CreatePersona_RevertMinAgentWithoutAgent() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 6)); // Invalid configuration

        personaFactory.createPersona(
            address(amicaToken),
            "Invalid Config",
            "INVAL",
            bytes32("invalid"),
            0,
            address(0), // No agent token
            10_000 ether // But has min requirement
        );
    }

    function test_MultipleAgentDepositors() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Multi Agent",
            "MULTI",
            bytes32("multiagent"),
            0,
            address(agentToken),
            30_000 ether
        );

        // Three users deposit different amounts
        uint256[] memory deposits = new uint256[](3);
        deposits[0] = 15_000 ether;
        deposits[1] = 10_000 ether;
        deposits[2] = 5_000 ether;

        address[] memory users = new address[](3);
        users[0] = user1;
        users[1] = user2;
        users[2] = user3;

        for (uint256 i = 0; i < 3; i++) {
            vm.startPrank(users[i]);
            agentToken.approve(address(personaFactory), deposits[i]);
            personaFactory.depositAgentTokens(tokenId, deposits[i]);
            vm.stopPrank();

            assertEq(
                personaFactory.agentDeposits(tokenId, users[i]), deposits[i]
            );
        }

        (,,,,,,, uint256 totalAgentDeposited,,,) =
            personaFactory.personas(tokenId);
        assertEq(totalAgentDeposited, 30_000 ether);
    }

    // ==================== Domain Tests ====================

    function test_CreatePersona_ValidDomains() public {
        bytes32[] memory validDomains = new bytes32[](5);
        validDomains[0] = bytes32("simple");
        validDomains[1] = bytes32("with-hyphen");
        validDomains[2] = bytes32("number123");
        validDomains[3] = bytes32("mix-123-test");
        validDomains[4] = bytes32("a"); // single character

        for (uint256 i = 0; i < validDomains.length; i++) {
            vm.prank(user1);
            uint256 tokenId = personaFactory.createPersona(
                address(amicaToken),
                string.concat("Test", vm.toString(i)),
                string.concat("T", vm.toString(i)),
                validDomains[i],
                0,
                address(0),
                0
            );

            assertEq(personaFactory.domains(validDomains[i]), tokenId);
        }
    }

    function test_CreatePersona_RevertInvalidDomains() public {
        bytes32[] memory invalidDomains = new bytes32[](6);
        invalidDomains[0] = bytes32("-start"); // starts with hyphen
        invalidDomains[1] = bytes32("end-"); // ends with hyphen
        invalidDomains[2] = bytes32("UPPER"); // uppercase
        invalidDomains[3] = bytes32("special!"); // special character
        invalidDomains[4] = bytes32("spa ce"); // space
        invalidDomains[5] = bytes32(0); // empty

        for (uint256 i = 0; i < invalidDomains.length; i++) {
            vm.prank(user1);
            uint8 expectedError = invalidDomains[i] == bytes32(0) ? 10 : 13; // empty vs invalid format

            vm.expectRevert(
                abi.encodeWithSignature("Invalid(uint8)", expectedError)
            );
            personaFactory.createPersona(
                address(amicaToken),
                "Invalid Domain",
                "INVD",
                invalidDomains[i],
                0,
                address(0),
                0
            );
        }
    }

    function test_CreatePersona_RevertDuplicateDomain() public {
        bytes32 domain = bytes32("duplicate");

        // First creation succeeds
        vm.prank(user1);
        personaFactory.createPersona(
            address(amicaToken), "First", "FIRST", domain, 0, address(0), 0
        );

        // Second creation with same domain fails
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 11)); // Already registered
        personaFactory.createPersona(
            address(amicaToken), "Second", "SECOND", domain, 0, address(0), 0
        );
    }

    // ==================== Unsold Token Bonus Tests ====================

    function test_ClaimRewards_WithUnsoldBonus() public {
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Unsold Test",
            "UNSOLD",
            bytes32("unsold"),
            0,
            address(0),
            0
        );

        // Buy exactly 85% to graduate
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId,
            NORMAL_GRADUATION_THRESHOLD,
            0,
            user2,
            block.timestamp + 300
        );

        // Verify graduated
        (,,,,, bool pairCreated,,,,,) = personaFactory.personas(tokenId);
        assertTrue(pairCreated, "Should have graduated");

        // Get persona token
        (,, address personaTokenAddr,,,,,,,,) = personaFactory.personas(tokenId);

        // Claim tokens (should include 15% bonus)
        vm.prank(user2);
        personaFactory.claimRewards(tokenId);

        uint256 balance = IERC20(personaTokenAddr).balanceOf(user2);

        // Should have roughly 85% + 15% = 100% of bonding tokens (333,333,333)
        assertApproxEqRel(balance, 333_333_333 ether, 1e16); // 1% tolerance
    }
}
