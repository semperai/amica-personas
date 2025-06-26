// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Fixtures} from "./shared/Fixtures.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {Position} from "@uniswap/v4-core/src/libraries/Position.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {console} from "forge-std/console.sol";

contract PersonaTokenFactoryLifecycleTest is Fixtures {
    using PoolIdLibrary for bytes32;
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;

    uint256 constant PERSONA_SUPPLY = 1_000_000_000 ether;
    uint256 constant LIQUIDITY_AMOUNT = 333_333_334 ether; // 1/3 of supply
    uint256 constant BONDING_AMOUNT = 333_333_333 ether; // 1/3 of supply
    uint256 constant GRADUATION_THRESHOLD = 85; // 85%
    uint256 constant EXPECTED_GRADUATION_AMOUNT = 1_000_000 ether; // ~1M AMICA

    function setUp() public override {
        super.setUp();

        // Configure AMICA pairing token with proper multiplier
        // To raise 1M AMICA for graduation: multiplier = 283.33
        vm.prank(factoryOwner);
        personaFactory.configurePairingToken(
            address(amicaToken),
            1000 ether,  // mint cost
            283.33 ether, // multiplier
            true
        );

        // Approve factory for all users
        vm.prank(user1);
        amicaToken.approve(address(personaFactory), type(uint256).max);
        
        vm.prank(user2);
        amicaToken.approve(address(personaFactory), type(uint256).max);
        
        vm.prank(user3);
        amicaToken.approve(address(personaFactory), type(uint256).max);

        // Also approve for the test contract
        amicaToken.approve(address(personaFactory), type(uint256).max);
    }

    function test_FullLifecycle() public {
        console.log("=== Starting Persona Lifecycle Test ===", "");
        
        // Step 1: User1 creates a persona
        console.log("\n--- Step 1: Creating Persona ---", "");
        
        uint256 user1BalanceBefore = amicaToken.balanceOf(user1);
        console.log("User1 AMICA before:", user1BalanceBefore / 1e18);
        
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TEST",
            bytes32("testpersona"),
            0, // no initial buy
            address(0), // no agent token
            0 // no min agent tokens
        );
        
        uint256 user1BalanceAfter = amicaToken.balanceOf(user1);
        uint256 creationCost = user1BalanceBefore - user1BalanceAfter;
        console.log("Persona created with ID:", tokenId);
        console.log("Creation cost (AMICA):", creationCost / 1e18);
        assertEq(creationCost, 1000 ether, "Creation cost should be 1000 AMICA");
        
        // Get persona details
        (
            string memory name,
            string memory symbol,
            address personaToken,
            address pairToken,
            address agentToken,
            bool pairCreated,
            uint256 createdAt,
            uint256 totalAgentDeposited,
            uint256 minAgentTokens,
            PoolId poolId,
            PoolId agentPoolId
        ) = personaFactory.personas(tokenId);
        
        console.log("Persona token address:", personaToken);
        assertFalse(pairCreated, "Pair should not be created yet");
        
        // Step 2: User1 and User2 buy on bonding curve
        console.log("\n--- Step 2: Buying on Bonding Curve ---", "");
        
        // User1 buys 200k AMICA worth
        uint256 user1BuyAmount = 200_000 ether;
        vm.prank(user1);
        uint256 user1TokensOut = personaFactory.swapExactTokensForTokens(
            tokenId,
            user1BuyAmount,
            0,
            user1,
            block.timestamp + 1
        );
        
        uint256 user1Purchased = personaFactory.userPurchases(tokenId, user1);
        console.log("User1 spent (AMICA):", user1BuyAmount / 1e18);
        console.log("User1 received (Persona):", user1Purchased / 1e18);
        
        // User2 buys 300k AMICA worth
        uint256 user2BuyAmount = 300_000 ether;
        vm.prank(user2);
        uint256 user2TokensOut = personaFactory.swapExactTokensForTokens(
            tokenId,
            user2BuyAmount,
            0,
            user2,
            block.timestamp + 1
        );
        
        uint256 user2Purchased = personaFactory.userPurchases(tokenId, user2);
        console.log("User2 spent (AMICA):", user2BuyAmount / 1e18);
        console.log("User2 received (Persona):", user2Purchased / 1e18);
        
        // Check total raised so far
        (uint256 totalDeposited, uint256 tokensSold) = personaFactory.purchases(tokenId);
        console.log("Total AMICA raised so far:", totalDeposited / 1e18);
        console.log("Total Persona tokens sold:", tokensSold / 1e18);
        
        // Step 3: Continue buying until graduation
        console.log("\n--- Step 3: Triggering Graduation ---", "");
        
        // Calculate remaining needed for graduation
        uint256 graduationTarget = (BONDING_AMOUNT * GRADUATION_THRESHOLD) / 100;
        console.log("Graduation target (Persona):", graduationTarget / 1e18);
        console.log("Tokens sold so far:", tokensSold / 1e18);
        
        // Buy remaining amount to trigger graduation
        uint256 remainingAmica = EXPECTED_GRADUATION_AMOUNT - totalDeposited;
        console.log("Remaining AMICA needed:", remainingAmica / 1e18);
        
        if (remainingAmica > 0) {
            vm.prank(user2);
            personaFactory.swapExactTokensForTokens(
                tokenId,
                remainingAmica,
                0,
                user2,
                block.timestamp + 1
            );
        }
        
        // Verify graduation
        (,,,, agentToken, pairCreated,,,, poolId,) = personaFactory.personas(tokenId);
        assertTrue(pairCreated, "Persona should have graduated");
        console.log("Persona graduated! Pool created:", true);
        
        // Get final bonding curve state
        (totalDeposited, tokensSold) = personaFactory.purchases(tokenId);
        console.log("Final AMICA collected:", totalDeposited / 1e18);
        console.log("Final Persona tokens sold:", tokensSold / 1e18);
        
        // Verify approximately 1M AMICA was collected
        assertApproxEqRel(totalDeposited, EXPECTED_GRADUATION_AMOUNT, 0.1e18, "Should collect ~1M AMICA");
        
        // Step 4: Check Uniswap V4 pool state
        console.log("\n--- Step 4: Checking Uniswap V4 Pool ---", "");
        
        // Get pool key
        Currency currency0;
        Currency currency1;
        bool personaIsToken0 = uint160(personaToken) < uint160(pairToken);
        
        if (personaIsToken0) {
            currency0 = Currency.wrap(personaToken);
            currency1 = Currency.wrap(pairToken);
        } else {
            currency0 = Currency.wrap(pairToken);
            currency1 = Currency.wrap(personaToken);
        }
        
        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(dynamicFeeHook))
        });
        
        // Check pool liquidity
        (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee) = poolManager.getSlot0(poolKey.toId());
        console.log("Pool sqrt price:", sqrtPriceX96);
        console.log("Pool current tick:", uint256(int256(tick)));
        
        // Check pool balances
        uint256 poolPersonaBalance = IERC20(personaToken).balanceOf(address(poolManager));
        uint256 poolAmicaBalance = IERC20(address(amicaToken)).balanceOf(address(poolManager));
        
        console.log("Pool Persona balance:", poolPersonaBalance / 1e18);
        console.log("Pool AMICA balance:", poolAmicaBalance / 1e18);
        
        // Verify pool has expected amounts (approximately)
        assertApproxEqRel(poolPersonaBalance, LIQUIDITY_AMOUNT, 0.1e18, "Pool should have ~333M Persona");
        assertApproxEqRel(poolAmicaBalance, totalDeposited, 0.1e18, "Pool should have ~1M AMICA");
        
        // Step 5: User1 and User2 claim their tokens
        console.log("\n--- Step 5: Claiming Tokens ---", "");
        
        // Check claimable amounts
        (
            uint256 user1PurchasedAmount,
            uint256 user1BonusAmount,
            uint256 user1AgentReward,
            uint256 user1TotalClaimable,
            bool user1Claimed
        ) = personaFactory.getClaimableRewards(tokenId, user1);
        
        console.log("User1 purchased:", user1PurchasedAmount / 1e18);
        console.log("User1 bonus:", user1BonusAmount / 1e18);
        console.log("User1 total claimable:", user1TotalClaimable / 1e18);
        
        // User1 claims
        vm.prank(user1);
        personaFactory.claimRewards(tokenId);
        
        uint256 user1PersonaBalance = IERC20(personaToken).balanceOf(user1);
        console.log("User1 Persona balance after claim:", user1PersonaBalance / 1e18);
        assertEq(user1PersonaBalance, user1TotalClaimable, "User1 should receive correct amount");
        
        // User2 claims
        (
            uint256 user2PurchasedAmount,
            uint256 user2BonusAmount,
            uint256 user2AgentReward,
            uint256 user2TotalClaimable,
            bool user2Claimed
        ) = personaFactory.getClaimableRewards(tokenId, user2);
        
        console.log("User2 total claimable:", user2TotalClaimable / 1e18);
        
        vm.prank(user2);
        personaFactory.claimRewards(tokenId);
        
        uint256 user2PersonaBalance = IERC20(personaToken).balanceOf(user2);
        console.log("User2 Persona balance after claim:", user2PersonaBalance / 1e18);
        
        // Step 6: User3 buys on Uniswap V4
        console.log("\n--- Step 6: Trading on Uniswap V4 ---", "");
        
        uint256 user3AmicaBefore = amicaToken.balanceOf(user3);
        uint256 user3PersonaBefore = IERC20(personaToken).balanceOf(user3);
        
        console.log("User3 AMICA before swap:", user3AmicaBefore / 1e18);
        console.log("User3 Persona before swap:", user3PersonaBefore / 1e18);
        
        // Prepare swap through position manager
        uint256 swapAmount = 10_000 ether; // 10k AMICA
        
        // Approve tokens for position manager
        vm.startPrank(user3);
        amicaToken.approve(address(positionManager), swapAmount);
        IERC20(personaToken).approve(address(positionManager), type(uint256).max);
        
        // Prepare swap parameters
        bytes memory actions = abi.encodePacked(
            uint8(Actions.SWAP_EXACT_IN_SINGLE)
        );
        
        bytes[] memory params = new bytes[](1);
        
        // Determine swap direction based on token ordering
        bool zeroForOne = !personaIsToken0; // We're swapping AMICA for Persona
        
        params[0] = abi.encode(
            poolKey,
            zeroForOne,
            int256(swapAmount),
            0, // min amount out
            abi.encode(user3) // hookData with recipient
        );
        
        // Execute swap
        positionManager.modifyLiquidities(
            abi.encode(actions, params),
            block.timestamp + 60
        );
        vm.stopPrank();
        
        uint256 user3AmicaAfter = amicaToken.balanceOf(user3);
        uint256 user3PersonaAfter = IERC20(personaToken).balanceOf(user3);
        
        console.log("User3 AMICA after swap:", user3AmicaAfter / 1e18);
        console.log("User3 Persona after swap:", user3PersonaAfter / 1e18);
        
        uint256 amicaSpent = user3AmicaBefore - user3AmicaAfter;
        uint256 personaReceived = user3PersonaAfter - user3PersonaBefore;
        
        console.log("AMICA spent:", amicaSpent / 1e18);
        console.log("Persona received:", personaReceived / 1e18);
        
        // Verify swap happened
        assertEq(amicaSpent, swapAmount, "Should spend exact AMICA amount");
        assertGt(personaReceived, 0, "Should receive Persona tokens");
        
        // Calculate and display exchange rate
        uint256 rate = (personaReceived * 1e18) / amicaSpent;
        console.log("Exchange rate (Persona per AMICA):", rate / 1e18);
        
        console.log("\n=== Lifecycle Test Complete ===", "");
    }

    function test_DetailedBondingCurveProgression() public {
        console.log("=== Bonding Curve Progression Analysis ===", "");
        
        // Create persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Analysis Persona",
            "ANALYSIS",
            bytes32("analysis"),
            0,
            address(0),
            0
        );
        
        // Track bonding curve progression
        uint256[] memory checkpoints = new uint256[](5);
        checkpoints[0] = 100_000 ether;  // 100k
        checkpoints[1] = 250_000 ether;  // 250k
        checkpoints[2] = 500_000 ether;  // 500k
        checkpoints[3] = 750_000 ether;  // 750k
        checkpoints[4] = 1_000_000 ether; // 1M
        
        uint256 cumulativeSpent = 0;
        uint256 cumulativeReceived = 0;
        
        for (uint i = 0; i < checkpoints.length; i++) {
            uint256 spendAmount = checkpoints[i] - cumulativeSpent;
            
            vm.prank(user2);
            uint256 received = personaFactory.swapExactTokensForTokens(
                tokenId,
                spendAmount,
                0,
                user2,
                block.timestamp + 1
            );
            
            cumulativeSpent += spendAmount;
            cumulativeReceived += received;
            
            (uint256 totalDeposited, uint256 tokensSold) = personaFactory.purchases(tokenId);
            
            console.log("\n--- Checkpoint", i + 1);
            console.log("Total AMICA spent:", cumulativeSpent / 1e18);
            console.log("Total Persona received:", tokensSold / 1e18);
            
            uint256 avgPrice = (cumulativeSpent * 1e18) / tokensSold;
            console.log("Average price (AMICA/Persona):", avgPrice / 1e18);
            
            // Check if graduated
            (,,,,,bool graduated,,,,,) = personaFactory.personas(tokenId);
            if (graduated) {
                console.log("GRADUATED at checkpoint", i + 1);
                break;
            }
        }
    }
}
