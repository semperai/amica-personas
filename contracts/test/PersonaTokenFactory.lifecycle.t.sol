// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Fixtures} from "./shared/Fixtures.sol";
import {TestBondingCurve} from "./shared/TestBondingCurve.sol";
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
import {NotAllowed} from "../src/PersonaTokenFactory.sol";
import {PersonaTokenFactory} from "../src/PersonaTokenFactory.sol";
import {PersonaToken} from "../src/PersonaToken.sol";
import {DynamicFeeHook} from "../src/DynamicFeeHook.sol";
import {FeeReductionSystem} from "../src/FeeReductionSystem.sol";
import {UnsafeUpgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";

contract PersonaTokenFactoryLifecycleTest is Fixtures {
    TestBondingCurve public testBondingCurve;
    PersonaTokenFactory public testFactory;

    // Target values
    uint256 constant TARGET_AMICA_SPENT = 1_000_000 ether; // 1M AMICA
    uint256 constant TARGET_PERSONA_RECEIVED = 333_333_333 ether; // 333M persona tokens
    uint256 constant TOLERANCE_PERCENT = 5; // 5% tolerance

    // Test results structure
    struct TestResult {
        uint256 curveMultiplier;
        uint256 pricingMultiplier;
        uint256 amicaSpent;
        uint256 personaReceived;
        uint256 graduationPercent;
        bool success;
        string failReason;
    }

    // Structure to track pricing milestones
    struct PricingMilestone {
        uint256 percentComplete;
        uint256 totalTokensBought;
        uint256 totalAmicaSpent;
        uint256 incrementalCost;
        uint256 avgPriceFromStart;
        uint256 priceMultiplier;
    }

    // State tracking struct to reduce stack depth
    struct TestState {
        uint256 tokenId;
        uint256 totalSpent;
        uint256 totalReceived;
        uint256 pricingMultiplier;
        uint256 adjustedStartingPrice;
        uint256 lastMilestone;
    }

    function deployTestFactory(
        uint256 curveMultiplier,
        uint256 pricingMultiplier
    ) internal {
        // Deploy test bonding curve with adjustable multiplier
        testBondingCurve = new TestBondingCurve();
        testBondingCurve.setCurveMultiplier(curveMultiplier);

        // Deploy test factory with test bonding curve
        address factoryImpl = address(new PersonaTokenFactory());
        address factoryProxy = UnsafeUpgrades.deployUUPSProxy(
            factoryImpl,
            abi.encodeCall(
                PersonaTokenFactory.initialize,
                (
                    address(amicaToken),
                    address(poolManager),
                    address(positionManager),
                    address(permit2),
                    address(dynamicFeeHook),
                    address(personaToken),
                    address(testBondingCurve) // Use test bonding curve
                )
            )
        );

        testFactory = PersonaTokenFactory(factoryProxy);

        // Configure AMICA as pairing token with test pricing multiplier
        testFactory.configurePairingToken(
            address(amicaToken), DEFAULT_MINT_COST, pricingMultiplier, true
        );
    }

    function testPreciseLifecycleWithPricing() public {
        console.log("=== Precise Lifecycle Test with Pricing Analysis ===");

        // Use the best parameters found
        uint256 curveMultiplier = 10532;
        uint256 pricingMultiplier = 333 ether; // 0.333x

        vm.startPrank(factoryOwner);
        deployTestFactory(curveMultiplier, pricingMultiplier);
        vm.stopPrank();

        // Create persona
        vm.startPrank(user1);
        amicaToken.approve(address(testFactory), type(uint256).max);

        uint256 tokenId = testFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TEST",
            bytes32("testpersona"),
            0, // No initial buy
            address(0), // No agent token
            0
        );

        console.log("Created persona with tokenId:", tokenId);

        // Get starting price
        uint256 startingPrice =
            testBondingCurve.getCurrentPrice(0, 333_333_333 ether);
        uint256 adjustedStartingPrice =
            (startingPrice * pricingMultiplier) / 1e18;
        console.log("\nStarting price per persona token:");
        console.log("  Raw bonding curve:", startingPrice, "wei per token");
        console.log(
            "  With pricing multiplier:", adjustedStartingPrice, "wei per token"
        );
        console.log(
            "  In AMICA:",
            adjustedStartingPrice / 1e18,
            "AMICA per persona token"
        );

        // Initialize test state
        TestState memory state = TestState({
            tokenId: tokenId,
            totalSpent: DEFAULT_MINT_COST,
            totalReceived: 0,
            pricingMultiplier: pricingMultiplier,
            adjustedStartingPrice: adjustedStartingPrice,
            lastMilestone: 0
        });

        // Track milestones
        PricingMilestone[] memory milestones = new PricingMilestone[](10);

        console.log("\n=== Buying Progress ===");

        // Execute buying loop
        _executeBuyingLoop(state, milestones);

        // Print final results
        _printFinalResults(state.tokenId, state.totalSpent, state.totalReceived);

        vm.stopPrank();
    }

    function _executeBuyingLoop(
        TestState memory state,
        PricingMilestone[] memory milestones
    ) private {
        uint256 buyAmount = 1_000 ether; // Buy in smaller chunks for precision

        while (true) {
            // Check if graduated
            (,,, uint256 graduationTimestamp,,) =
                testFactory.personas(state.tokenId);
            if (graduationTimestamp > 0) break;

            // Try to buy tokens
            try testFactory.swapExactTokensForTokens(
                state.tokenId, buyAmount, 0, user1, block.timestamp + 300
            ) returns (uint256 received) {
                state.totalSpent += buyAmount;
                state.totalReceived += received;

                // Check for milestone
                _checkAndRecordMilestone(state, milestones);
            } catch {
                // Graduated
                break;
            }
        }
    }

    function _checkAndRecordMilestone(
        TestState memory state,
        PricingMilestone[] memory milestones
    ) private {
        // Calculate current progress percentage
        uint256 currentPercent = (state.totalReceived * 100) / 333_333_333 ether;

        // Check if we hit a 10% milestone
        if (
            currentPercent >= (state.lastMilestone + 1) * 10
                && state.lastMilestone < 9
        ) {
            state.lastMilestone = currentPercent / 10;
            if (state.lastMilestone > 9) state.lastMilestone = 9;

            // Record the milestone data
            _recordMilestoneData(state, milestones, state.lastMilestone);
        }
    }

    function _recordMilestoneData(
        TestState memory state,
        PricingMilestone[] memory milestones,
        uint256 milestone
    ) private {
        // Get current state from bonding curve
        (, uint256 tokensPurchased,) =
            testFactory.preGraduationStates(state.tokenId);

        // Calculate prices
        uint256 currentPrice =
            testBondingCurve.getCurrentPrice(tokensPurchased, 333_333_333 ether);
        uint256 adjustedCurrentPrice =
            (currentPrice * state.pricingMultiplier) / 1e18;
        uint256 avgPrice = state.totalReceived > 0
            ? (state.totalSpent * 1e18) / state.totalReceived
            : 0;
        uint256 priceMultiplier = state.adjustedStartingPrice > 0
            ? (adjustedCurrentPrice * 1e18) / state.adjustedStartingPrice
            : 0;

        // Calculate incremental cost
        uint256 incrementalCost = state.totalSpent;
        if (milestone > 1) {
            incrementalCost =
                state.totalSpent - milestones[milestone - 2].totalAmicaSpent;
        } else {
            incrementalCost = state.totalSpent - DEFAULT_MINT_COST;
        }

        // Store milestone
        milestones[milestone - 1] = PricingMilestone({
            percentComplete: milestone * 10,
            totalTokensBought: state.totalReceived,
            totalAmicaSpent: state.totalSpent,
            incrementalCost: incrementalCost,
            avgPriceFromStart: avgPrice,
            priceMultiplier: priceMultiplier
        });

        // Print milestone info
        console.log("\nMilestone:", milestone * 10, "%");
        console.log("  Total tokens bought:", state.totalReceived / 1e18);
        console.log("  Total AMICA spent:", state.totalSpent / 1e18);
        console.log(
            "  Incremental cost for this 10%:", incrementalCost / 1e18, "AMICA"
        );
        console.log(
            "  Average price from start:", avgPrice / 1e18, "AMICA per persona"
        );
        console.log(
            "  Current spot price:",
            adjustedCurrentPrice / 1e18,
            "AMICA per persona"
        );
        console.log("  Price multiplier vs start:", priceMultiplier / 1e16, "%");
    }

    function _printFinalResults(
        uint256 tokenId,
        uint256 totalSpent,
        uint256 totalReceived
    ) private {
        // Final graduation stats
        (, uint256 finalTokensPurchased,) =
            testFactory.preGraduationStates(tokenId);
        uint256 graduationPercent =
            (finalTokensPurchased * 100) / 333_333_333 ether;
        uint256 finalAvgPrice =
            totalReceived > 0 ? (totalSpent * 1e18) / totalReceived : 0;

        console.log("\n=== Graduation Summary ===");
        console.log("Graduated at:", graduationPercent, "%");
        console.log("Total AMICA spent:", totalSpent / 1e18);
        console.log("Total persona tokens bought:", totalReceived / 1e18);
        console.log(
            "Final average price:", finalAvgPrice / 1e18, "AMICA per persona"
        );

        // Wait and claim
        vm.warp(block.timestamp + 1 days + 1);

        (
            uint256 purchasedAmount,
            uint256 bonusAmount,
            ,
            uint256 totalClaimable,
            ,
        ) = testFactory.getClaimableRewards(tokenId, user1);

        console.log("\n=== Claim Details ===");
        console.log("Purchased amount:", purchasedAmount / 1e18);
        console.log("Bonus amount:", bonusAmount / 1e18);
        console.log("Total claimable:", totalClaimable / 1e18);

        testFactory.claimRewards(tokenId);

        // Final balances
        (address personaTokenAddr,,,,,) = testFactory.personas(tokenId);
        uint256 userBalance = IERC20(personaTokenAddr).balanceOf(user1);

        console.log("\n=== Final Results ===");
        console.log("User received:", userBalance / 1e18, "persona tokens");
        console.log(
            "Effective price paid:",
            (totalSpent * 1e18) / userBalance / 1e18,
            "AMICA per persona"
        );
        console.log(
            "Target was: ~3 AMICA per persona (1M AMICA / 333M persona)"
        );
    }

    function testFindOptimalParameters() public {
        console.log("=== Finding Optimal Bonding Curve Parameters ===");
        console.log("Target: Spend ~1M AMICA to get ~333M persona tokens");
        console.log("");

        // Test different curve multipliers (smaller = steeper curve)
        uint256[] memory curveMultipliers = new uint256[](11);
        curveMultipliers[0] = 1000;
        curveMultipliers[1] = 2000; // Very steep
        curveMultipliers[2] = 3000; // Steep
        curveMultipliers[3] = 4000; // Medium-steep
        curveMultipliers[4] = 5000; // Very steep
        curveMultipliers[5] = 7500; // Steep
        curveMultipliers[6] = 10000; // Medium-steep
        curveMultipliers[7] = 10532; // Original (sqrt(133) - 1) * 1000
        curveMultipliers[8] = 12500; // Medium-flat
        curveMultipliers[9] = 15000; // Flat
        curveMultipliers[10] = 20000; // Very flat

        // Test different pricing multipliers
        uint256[] memory pricingMultipliers = new uint256[](7);
        pricingMultipliers[0] = 100 ether; // 0.1x
        pricingMultipliers[1] = 200 ether; // 0.2x
        pricingMultipliers[2] = 333 ether; // 0.333x (original)
        pricingMultipliers[3] = 500 ether; // 0.5x
        pricingMultipliers[4] = 1000 ether; // 1x
        pricingMultipliers[5] = 2000 ether; // 2x
        pricingMultipliers[6] = 3000 ether; // 3x

        TestResult memory bestResult;
        uint256 bestScore = type(uint256).max;

        for (uint256 i = 0; i < curveMultipliers.length; i++) {
            for (uint256 j = 0; j < pricingMultipliers.length; j++) {
                TestResult memory result =
                    runSingleTest(curveMultipliers[i], pricingMultipliers[j]);

                if (result.success) {
                    uint256 score = calculateScore(result);
                    if (score < bestScore) {
                        bestScore = score;
                        bestResult = result;
                    }

                    console.log(
                        "SUCCESS - Curve:",
                        curveMultipliers[i],
                        "Pricing:",
                        pricingMultipliers[j] / 1e18
                    );
                    console.log("  AMICA spent:", result.amicaSpent / 1e18);
                    console.log(
                        "  Persona received:", result.personaReceived / 1e18
                    );
                    console.log("  Graduation %:", result.graduationPercent);
                    console.log("  Score:", score);
                    console.log("");
                }
            }
        }

        console.log("=== BEST RESULT ===");
        console.log("Curve Multiplier:", bestResult.curveMultiplier);
        console.log(
            "Pricing Multiplier:", bestResult.pricingMultiplier / 1e18, "x"
        );
        console.log("AMICA Spent:", bestResult.amicaSpent / 1e18);
        console.log("Persona Received:", bestResult.personaReceived / 1e18);
        console.log("Graduation %:", bestResult.graduationPercent);

        // Assert we found a good solution
        assertTrue(
            bestResult.success,
            "Should find at least one successful configuration"
        );
        assertApproxEqRel(
            bestResult.amicaSpent,
            TARGET_AMICA_SPENT,
            0.1e18,
            "AMICA spent should be close to target"
        );
        assertApproxEqRel(
            bestResult.personaReceived,
            TARGET_PERSONA_RECEIVED,
            0.1e18,
            "Persona received should be close to target"
        );
    }

    function runSingleTest(uint256 curveMultiplier, uint256 pricingMultiplier)
        internal
        returns (TestResult memory result)
    {
        result.curveMultiplier = curveMultiplier;
        result.pricingMultiplier = pricingMultiplier;

        // Reset state
        vm.startPrank(factoryOwner);
        deployTestFactory(curveMultiplier, pricingMultiplier);
        vm.stopPrank();

        // Create persona
        vm.startPrank(user1);
        amicaToken.approve(address(testFactory), type(uint256).max);

        try testFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TEST",
            bytes32("testpersona"),
            0, // No initial buy
            address(0), // No agent token
            0
        ) returns (uint256 tokenId) {
            // Buy tokens until graduation
            uint256 totalSpent = DEFAULT_MINT_COST; // Include mint cost
            uint256 buyAmount = 10_000 ether; // Buy in 10k AMICA chunks
            bool graduated = false;

            for (uint256 i = 0; i < 200; i++) {
                // Max 200 iterations to prevent infinite loop
                try testFactory.swapExactTokensForTokens(
                    tokenId, buyAmount, 0, user1, block.timestamp + 300
                ) {
                    totalSpent += buyAmount;
                } catch {
                    // Graduated
                    graduated = true;
                    break;
                }

                // Check if graduated
                (,,, uint256 graduationTimestamp,,) =
                    testFactory.personas(tokenId);
                if (graduationTimestamp > 0) {
                    graduated = true;
                    break;
                }
            }

            if (!graduated) {
                result.failReason = "Did not graduate after 200 iterations";
                return result;
            }

            result.amicaSpent = totalSpent;

            // Get graduation percent
            (, uint256 tokensPurchased,) =
                testFactory.preGraduationStates(tokenId);
            result.graduationPercent =
                (tokensPurchased * 100) / (333_333_333 ether);

            // Fast forward to claim
            vm.warp(block.timestamp + 1 days + 1);

            // Claim rewards
            try testFactory.claimRewards(tokenId) {
                // Get persona token
                (address personaTokenAddr,,,,,) = testFactory.personas(tokenId);
                result.personaReceived =
                    IERC20(personaTokenAddr).balanceOf(user1);
                result.success = true;
            } catch {
                result.failReason = "Failed to claim rewards";
            }
        } catch {
            result.failReason = "Failed to create persona";
        }

        vm.stopPrank();
    }

    function calculateScore(TestResult memory result)
        internal
        pure
        returns (uint256)
    {
        // Calculate how far we are from targets (lower is better)
        uint256 amicaDiff = result.amicaSpent > TARGET_AMICA_SPENT
            ? result.amicaSpent - TARGET_AMICA_SPENT
            : TARGET_AMICA_SPENT - result.amicaSpent;

        uint256 personaDiff = result.personaReceived > TARGET_PERSONA_RECEIVED
            ? result.personaReceived - TARGET_PERSONA_RECEIVED
            : TARGET_PERSONA_RECEIVED - result.personaReceived;

        // Normalize by targets and sum
        uint256 amicaScore = (amicaDiff * 1000) / TARGET_AMICA_SPENT;
        uint256 personaScore = (personaDiff * 1000) / TARGET_PERSONA_RECEIVED;

        return amicaScore + personaScore;
    }
}
