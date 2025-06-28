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
import {AmicaToken} from "../src/AmicaToken.sol";
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

    function testFindOptimalParameters() public {
        console.log("=== Finding Optimal Bonding Curve Parameters ===");
        console.log("Target: Spend ~1M AMICA to get ~333M persona tokens");
        console.log("");

        // Test different curve multipliers (smaller = steeper curve)
        uint256[] memory curveMultipliers = new uint256[](7);
        curveMultipliers[0] = 5000; // Very steep
        curveMultipliers[1] = 7500; // Steep
        curveMultipliers[2] = 10000; // Medium-steep
        curveMultipliers[3] = 10532; // Original (sqrt(133) - 1) * 1000
        curveMultipliers[4] = 12500; // Medium-flat
        curveMultipliers[5] = 15000; // Flat
        curveMultipliers[6] = 20000; // Very flat

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

    function testDetailedLifecycle() public {
        console.log("=== Detailed Lifecycle Test ===");

        // Use the original parameters first
        uint256 curveMultiplier = 10532;
        uint256 pricingMultiplier = 333 ether;

        vm.startPrank(factoryOwner);
        deployTestFactory(curveMultiplier, pricingMultiplier);
        vm.stopPrank();

        // Step 1: Create persona
        vm.startPrank(user1);
        amicaToken.approve(address(testFactory), type(uint256).max);

        uint256 tokenId = testFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TEST",
            bytes32("testpersona"),
            0,
            address(0),
            0
        );

        console.log("Step 1: Created persona with tokenId:", tokenId);

        // Step 2: Buy tokens progressively and track progress
        uint256 totalSpent = DEFAULT_MINT_COST;
        uint256 totalReceived = 0;
        uint256 iterations = 0;

        while (true) {
            (,,, uint256 graduationTimestamp,,) = testFactory.personas(tokenId);
            if (graduationTimestamp > 0) break;

            uint256 buyAmount = 10_000 ether;
            uint256 balanceBefore = testFactory.bondingBalances(tokenId, user1);

            try testFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user1, block.timestamp + 300
            ) returns (uint256 received) {
                totalSpent += buyAmount;
                totalReceived += received;
                iterations++;

                if (iterations % 10 == 0) {
                    console.log("Progress - Iteration:", iterations);
                    console.log("  Total spent:", totalSpent / 1e18, "AMICA");
                    console.log(
                        "  Total received:",
                        totalReceived / 1e18,
                        "persona tokens"
                    );
                    console.log(
                        "  Avg price:",
                        (totalSpent * 1e18) / totalReceived / 1e18,
                        "AMICA per persona"
                    );
                }
            } catch {
                // check if graduated
                (,,, uint256 graduationTimestamp,,) =
                    testFactory.personas(tokenId);
                console.log("Graduation timestamp", graduationTimestamp);
                break;
            }
        }

        // Step 3: Check graduation state
        {
            (, uint256 tokensPurchased,) =
                testFactory.preGraduationStates(tokenId);
            uint256 graduationPercent =
                (tokensPurchased * 100) / (333_333_333 ether);

            console.log("\nStep 3: Graduation achieved!");
            console.log("  Total AMICA spent:", totalSpent / 1e18);
            console.log("  Tokens purchased:", tokensPurchased / 1e18);
            console.log("  Graduation %:", graduationPercent);
        }

        // Step 4: Wait and claim
        {
            vm.warp(block.timestamp + 1 days + 1);

            (
                uint256 purchasedAmount,
                uint256 bonusAmount,
                uint256 agentRewardAmount,
                uint256 totalClaimable,
                bool claimed,
                bool claimable
            ) = testFactory.getClaimableRewards(tokenId, user1);

            console.log("\nStep 4: Claimable rewards:");
            console.log("  Purchased amount:", purchasedAmount / 1e18);
            console.log("  Bonus amount:", bonusAmount / 1e18);
            console.log("  Total claimable:", totalClaimable / 1e18);

            testFactory.claimRewards(tokenId);
        }

        // Step 5: Check final state
        {
            (address personaTokenAddr,,,,,) = testFactory.personas(tokenId);
            uint256 userPersonaBalance =
                IERC20(personaTokenAddr).balanceOf(user1);
            uint256 amicaPersonaBalance =
                IERC20(personaTokenAddr).balanceOf(address(amicaToken));

            console.log("\nStep 5: Final state:");
            console.log("  User persona balance:", userPersonaBalance / 1e18);
            console.log("  AMICA persona balance:", amicaPersonaBalance / 1e18);
            console.log(
                "  Total distributed:",
                (userPersonaBalance + amicaPersonaBalance) / 1e18
            );

            // Verify pool exists and has liquidity
            (, address pairToken,,,, PoolId poolId) =
                testFactory.personas(tokenId);
            assertTrue(PoolId.unwrap(poolId) != bytes32(0), "Pool should exist");

            console.log("\n=== Summary ===");
            console.log(
                "AMICA spent per persona token:",
                (totalSpent * 1e18) / userPersonaBalance / 1e18
            );
            console.log(
                "Expected ratio: 1M AMICA / 333M persona = 0.003 AMICA per persona"
            );
        }

        vm.stopPrank();
    }
}
