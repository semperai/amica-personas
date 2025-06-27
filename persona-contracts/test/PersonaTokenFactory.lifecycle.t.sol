// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Fixtures} from "./shared/Fixtures.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {
    Currency, CurrencyLibrary
} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {Position} from "@uniswap/v4-core/src/libraries/Position.sol";
import {IPositionManager} from
    "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
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

    // State variables to avoid stack too deep
    uint256 testTokenId;
    address testPersonaToken;

    function setUp() public override {
        super.setUp();

        // Configure AMICA pairing token with proper multiplier
        vm.prank(factoryOwner);
        personaFactory.configurePairingToken(
            address(amicaToken),
            1000 ether, // mint cost
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

        amicaToken.approve(address(personaFactory), type(uint256).max);
    }

    function test_FullLifecycle() public {
        console.log("=== Starting Persona Lifecycle Test ===", "");

        // Step 1: Create persona
        _step1_createPersona();

        // Step 2: Users buy on bonding curve
        _step2_bondingCurvePurchases();

        // Step 3: Trigger graduation
        _step3_graduation();

        // Step 4: Check pool state
        _step4_checkPool();

        // Step 5: Claim tokens
        _step5_claimTokens();

        // Step 6: Trade on Uniswap
        _step6_uniswapTrading();

        // Step 7: Verify token distribution
        _step7_verifyDistribution();

        console.log("\n=== Lifecycle Test Complete ===", "");
    }

    function _step1_createPersona() internal {
        console.log("\n--- Step 1: Creating Persona ---", "");

        uint256 balanceBefore = amicaToken.balanceOf(user1);

        vm.prank(user1);
        testTokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TEST",
            bytes32("testpersona"),
            0,
            address(0),
            0
        );

        uint256 creationCost = balanceBefore - amicaToken.balanceOf(user1);
        console.log("Persona created with ID:", testTokenId);
        console.log("Creation cost (AMICA):", creationCost / 1e18);
        assertEq(creationCost, 1000 ether, "Creation cost should be 1000 AMICA");

        // Get persona token address
        (,, address token,,,,,,,,) = personaFactory.personas(testTokenId);
        testPersonaToken = token;
        console.log("Persona token address:", testPersonaToken);
    }

    function _step2_bondingCurvePurchases() internal {
        console.log("\n--- Step 2: Buying on Bonding Curve ---", "");

        // User1 buys
        vm.prank(user1);
        personaFactory.swapExactTokensForTokens(
            testTokenId, 200_000 ether, 0, user1, block.timestamp + 1
        );

        uint256 user1Purchased =
            personaFactory.userPurchases(testTokenId, user1);
        console.log("User1 spent: 200k AMICA", "");
        console.log("User1 received (Persona):", user1Purchased / 1e18);

        // User2 buys
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            testTokenId, 300_000 ether, 0, user2, block.timestamp + 1
        );

        uint256 user2Purchased =
            personaFactory.userPurchases(testTokenId, user2);
        console.log("User2 spent: 300k AMICA", "");
        console.log("User2 received (Persona):", user2Purchased / 1e18);

        _logBondingState();
    }

    function _step3_graduation() internal {
        console.log("\n--- Step 3: Triggering Graduation ---", "");

        (uint256 totalDeposited, uint256 tokensSold) =
            personaFactory.purchases(testTokenId);
        uint256 graduationTarget = (BONDING_AMOUNT * GRADUATION_THRESHOLD) / 100;

        console.log("Graduation target (Persona):", graduationTarget / 1e18);
        console.log("Tokens sold so far:", tokensSold / 1e18);

        uint256 remainingAmica = EXPECTED_GRADUATION_AMOUNT - totalDeposited;
        console.log("Remaining AMICA needed:", remainingAmica / 1e18);

        if (remainingAmica > 0) {
            vm.prank(user2);
            personaFactory.swapExactTokensForTokens(
                testTokenId, remainingAmica, 0, user2, block.timestamp + 1
            );
        }

        // Check graduation
        (,,,,, bool graduated,,,,,) = personaFactory.personas(testTokenId);
        assertTrue(graduated, "Persona should have graduated");
        console.log("Persona graduated!", "");

        _logBondingState();

        // Verify collection amount
        (totalDeposited,) = personaFactory.purchases(testTokenId);
        assertApproxEqRel(
            totalDeposited,
            EXPECTED_GRADUATION_AMOUNT,
            0.1e18,
            "Should collect ~1M AMICA"
        );
    }

    function _step4_checkPool() internal {
        console.log("\n--- Step 4: Checking Uniswap V4 Pool ---", "");

        // Get pool info
        (,, address pairToken,,,,,,, PoolId poolId,) =
            personaFactory.personas(testTokenId);

        // Check pool state
        (uint160 sqrtPrice, int24 tick,,) = poolManager.getSlot0(poolId);
        console.log("Pool sqrt price:", sqrtPrice);
        console.log("Pool tick:", uint256(int256(tick)));

        // Check balances
        uint256 poolPersona =
            IERC20(testPersonaToken).balanceOf(address(poolManager));
        uint256 poolAmica =
            IERC20(address(amicaToken)).balanceOf(address(poolManager));

        console.log("Pool Persona balance:", poolPersona / 1e18);
        console.log("Pool AMICA balance:", poolAmica / 1e18);

        assertApproxEqRel(
            poolPersona,
            LIQUIDITY_AMOUNT,
            0.1e18,
            "Pool should have ~333M Persona"
        );
        assertApproxEqRel(
            poolAmica,
            EXPECTED_GRADUATION_AMOUNT,
            0.1e18,
            "Pool should have ~1M AMICA"
        );

        // Also check AMICA protocol received its share
        uint256 amicaProtocolBalance =
            IERC20(testPersonaToken).balanceOf(address(amicaToken));
        console.log("AMICA protocol received:", amicaProtocolBalance / 1e18);
        assertApproxEqRel(
            amicaProtocolBalance,
            LIQUIDITY_AMOUNT,
            0.01e18,
            "AMICA should receive ~333M Persona"
        );
    }

    function _step5_claimTokens() internal {
        console.log("\n--- Step 5: Claiming Tokens ---", "");

        // Track total claimed
        uint256 totalClaimedBefore = IERC20(testPersonaToken).balanceOf(user1)
            + IERC20(testPersonaToken).balanceOf(user2);

        // User1 claims
        _claimForUser(user1);

        // User2 claims
        _claimForUser(user2);

        // Verify total claimed amount
        uint256 totalClaimedAfter = IERC20(testPersonaToken).balanceOf(user1)
            + IERC20(testPersonaToken).balanceOf(user2);
        uint256 totalClaimed = totalClaimedAfter - totalClaimedBefore;

        console.log("\n--- Total Claims Summary ---", "");
        console.log("Total Persona claimed:", totalClaimed / 1e18);
        console.log("Expected (bonding amount):", BONDING_AMOUNT / 1e18);

        // Users should receive all tokens from bonding curve (333,333,333)
        assertApproxEqRel(
            totalClaimed,
            BONDING_AMOUNT,
            0.01e18,
            "Users should claim ~333M Persona total"
        );
    }

    function _claimForUser(address user) internal {
        (uint256 purchased, uint256 bonus,, uint256 total,) =
            personaFactory.getClaimableRewards(testTokenId, user);

        console.log("User claimable (purchased):", purchased / 1e18);
        console.log("User claimable (bonus):", bonus / 1e18);

        vm.prank(user);
        personaFactory.claimRewards(testTokenId);

        uint256 balance = IERC20(testPersonaToken).balanceOf(user);
        console.log("User balance after claim:", balance / 1e18);
        assertEq(balance, total, "Should receive correct amount");
    }

    function _step6_uniswapTrading() internal {
        console.log("\n--- Step 6: Trading on Uniswap V4 ---", "");

        uint256 swapAmount = 10_000 ether;
        uint256 balanceBefore = IERC20(testPersonaToken).balanceOf(user3);

        console.log("User3 swapping 10k AMICA", "");
        console.log("User3 Persona before:", balanceBefore / 1e18);

        // Execute swap
        _executeUniswapSwap(swapAmount);

        uint256 balanceAfter = IERC20(testPersonaToken).balanceOf(user3);
        uint256 received = balanceAfter - balanceBefore;

        console.log("User3 Persona after:", balanceAfter / 1e18);
        console.log("Persona received:", received / 1e18);

        assertGt(received, 0, "Should receive Persona tokens");

        uint256 rate = (received * 1e18) / swapAmount;
        console.log("Exchange rate (Persona/AMICA):", rate / 1e18);
    }

    function _step7_verifyDistribution() internal view {
        console.log("\n--- Step 7: Verifying Token Distribution ---", "");

        // Get all balances
        uint256 poolBalance =
            IERC20(testPersonaToken).balanceOf(address(poolManager));
        uint256 amicaProtocolBalance =
            IERC20(testPersonaToken).balanceOf(address(amicaToken));
        uint256 user1Balance = IERC20(testPersonaToken).balanceOf(user1);
        uint256 user2Balance = IERC20(testPersonaToken).balanceOf(user2);
        uint256 user3Balance = IERC20(testPersonaToken).balanceOf(user3);

        // Calculate totals
        uint256 totalUsersBalance = user1Balance + user2Balance + user3Balance;
        uint256 totalDistributed =
            poolBalance + amicaProtocolBalance + totalUsersBalance;

        console.log("\n=== Final Token Distribution ===", "");
        console.log("Uniswap Pool:", poolBalance / 1e18);
        console.log("AMICA Protocol:", amicaProtocolBalance / 1e18);
        console.log("User1:", user1Balance / 1e18);
        console.log("User2:", user2Balance / 1e18);
        console.log("User3:", user3Balance / 1e18);
        console.log("Total Users:", totalUsersBalance / 1e18);
        console.log("Total Distributed:", totalDistributed / 1e18);
        console.log("Total Supply:", PERSONA_SUPPLY / 1e18);

        // Verify distributions match expected amounts
        console.log("\n=== Distribution Verification ===", "");
        console.log("Expected pool:", LIQUIDITY_AMOUNT / 1e18);
        console.log("Expected AMICA:", LIQUIDITY_AMOUNT / 1e18);
        console.log("Expected users:", BONDING_AMOUNT / 1e18);

        // Pool should have ~333M (1/3)
        assertApproxEqRel(
            poolBalance,
            LIQUIDITY_AMOUNT,
            0.01e18,
            "Pool should have 1/3 of supply"
        );

        // AMICA protocol should have ~333M (1/3)
        assertApproxEqRel(
            amicaProtocolBalance,
            LIQUIDITY_AMOUNT,
            0.01e18,
            "AMICA should have 1/3 of supply"
        );

        // Users (combined) should have ~333M (1/3)
        assertApproxEqRel(
            totalUsersBalance,
            BONDING_AMOUNT,
            0.01e18,
            "Users should have 1/3 of supply"
        );

        // Total should equal supply (with small rounding tolerance)
        assertApproxEqRel(
            totalDistributed,
            PERSONA_SUPPLY,
            0.001e18,
            "Total distributed should equal supply"
        );
    }

    function _executeUniswapSwap(uint256 swapAmount) internal {
        // Get pool info
        (,, address pairToken,,,,,,, PoolId poolId,) =
            personaFactory.personas(testTokenId);

        // Setup pool key
        bool personaIsToken0 = uint160(testPersonaToken) < uint160(pairToken);

        PoolKey memory poolKey = PoolKey({
            currency0: personaIsToken0
                ? Currency.wrap(testPersonaToken)
                : Currency.wrap(pairToken),
            currency1: personaIsToken0
                ? Currency.wrap(pairToken)
                : Currency.wrap(testPersonaToken),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(address(dynamicFeeHook))
        });

        // Approve and execute
        vm.startPrank(user3);
        amicaToken.approve(address(positionManager), swapAmount);
        IERC20(testPersonaToken).approve(
            address(positionManager), type(uint256).max
        );

        bytes memory actions =
            abi.encodePacked(uint8(Actions.SWAP_EXACT_IN_SINGLE));
        bytes[] memory params = new bytes[](1);

        params[0] = abi.encode(
            poolKey,
            !personaIsToken0, // zeroForOne
            int256(swapAmount),
            0,
            abi.encode(user3)
        );

        positionManager.modifyLiquidities(
            abi.encode(actions, params), block.timestamp + 60
        );
        vm.stopPrank();
    }

    function _logBondingState() internal view {
        (uint256 totalDeposited, uint256 tokensSold) =
            personaFactory.purchases(testTokenId);
        console.log("Total AMICA raised:", totalDeposited / 1e18);
        console.log("Total Persona sold:", tokensSold / 1e18);
    }

    function test_BondingCurveProgression() public {
        console.log("=== Bonding Curve Analysis ===", "");

        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Analysis",
            "ANAL",
            bytes32("analysis"),
            0,
            address(0),
            0
        );

        _analyzeCheckpoint(tokenId, 100_000 ether, 0);
        _analyzeCheckpoint(tokenId, 150_000 ether, 100_000 ether);
        _analyzeCheckpoint(tokenId, 250_000 ether, 250_000 ether);
        _analyzeCheckpoint(tokenId, 250_000 ether, 500_000 ether);
        _analyzeCheckpoint(tokenId, 250_000 ether, 750_000 ether);
    }

    function _analyzeCheckpoint(
        uint256 tokenId,
        uint256 spendAmount,
        uint256 previousTotal
    ) internal {
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, spendAmount, 0, user2, block.timestamp + 1
        );

        (uint256 total, uint256 sold) = personaFactory.purchases(tokenId);
        uint256 newTotal = previousTotal + spendAmount;

        console.log("\nCheckpoint - Total spent:", total / 1e18);
        console.log("Tokens sold:", sold / 1e18);

        if (sold > 0) {
            uint256 avgPrice = (total * 1e18) / sold;
            console.log("Avg price:", avgPrice / 1e18);
        }

        (,,,,, bool graduated,,,,,) = personaFactory.personas(tokenId);
        if (graduated) {
            console.log("GRADUATED!", "");
        }
    }
}
