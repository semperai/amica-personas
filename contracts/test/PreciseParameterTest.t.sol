// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {TestBondingCurve} from "./shared/TestBondingCurve.sol";

/**
 * @title PreciseParameterTest
 * @notice Calculates exact parameters needed for the bonding curve
 */
contract PreciseParameterTest is Test {
    TestBondingCurve curve;

    // Constants
    uint256 constant PRECISION = 1e18;
    uint256 constant THIRD_SUPPLY = 333_333_333 ether; // Without agent
    uint256 constant SIXTH_SUPPLY = 166_666_666 ether; // With agent
    uint256 constant TARGET_AMICA = 1_000_000 ether;
    uint256 constant GRADUATION_PERCENT = 85;

    function setUp() public {
        curve = new TestBondingCurve();
    }

    function testCalculateOptimalParameters() public {
        console.log("=== Calculating Optimal Parameters ===");
        console.log("Target: 1M AMICA for 333M persona tokens");
        console.log("");

        // Scenario 1: No agent token (1/3 supply in bonding)
        calculateForSupply("No Agent", THIRD_SUPPLY);

        // Scenario 2: With agent token (1/6 supply in bonding)
        calculateForSupply("With Agent", SIXTH_SUPPLY);
    }

    function calculateForSupply(string memory scenario, uint256 bondingSupply)
        internal
    {
        console.log("=== Scenario:", scenario, "===");
        console.log("Bonding supply:", bondingSupply / 1e18);

        uint256 tokensSold = (bondingSupply * GRADUATION_PERCENT) / 100;
        console.log("Tokens sold at graduation:", tokensSold / 1e18);
        console.log("");

        // Test specific curve multipliers
        uint256[3] memory testMultipliers = [uint256(3000), 3333, 4000];

        for (uint256 i = 0; i < testMultipliers.length; i++) {
            curve.setCurveMultiplier(testMultipliers[i]);

            // Calculate base cost (before pricing multiplier)
            uint256 baseCost =
                curve.calculateCostBetween(0, tokensSold, bondingSupply);

            // Calculate required pricing multiplier
            // pricingMultiplier = TARGET_AMICA / baseCost
            uint256 pricingMultiplier = (TARGET_AMICA * PRECISION) / baseCost;

            console.log("Curve Multiplier:", testMultipliers[i]);
            console.log("  Base cost:", baseCost / 1e18);
            console.log(
                "  Required pricing multiplier:", pricingMultiplier / 1e18, "x"
            );

            // Verify the calculation
            uint256 actualAmicaSpent =
                (baseCost * pricingMultiplier) / PRECISION;
            console.log(
                "  Verification - AMICA spent:", actualAmicaSpent / 1e18
            );

            // Calculate price progression
            uint256 startPrice = curve.getCurrentPrice(0, bondingSupply);
            uint256 endPrice = curve.getCurrentPrice(tokensSold, bondingSupply);
            uint256 priceIncrease = (endPrice * 100) / startPrice;
            console.log("  Price increase:", priceIncrease, "%");
            console.log("");
        }

        // Recommend best parameters
        console.log("RECOMMENDATION for", scenario, ":");
        console.log("- Curve Multiplier: 3333");
        console.log(
            "- Pricing Multiplier: ~0.3-0.4x (adjust based on actual bonding supply)"
        );
        console.log("");
    }

    function testVerifySpecificConfiguration() public {
        console.log("=== Verifying Specific Configuration ===");

        // Set specific parameters
        uint256 curveMultiplier = 3333;
        uint256 bondingSupply = THIRD_SUPPLY; // No agent scenario

        curve.setCurveMultiplier(curveMultiplier);

        // Calculate for exact graduation
        uint256 tokensSold = (bondingSupply * GRADUATION_PERCENT) / 100;
        uint256 baseCost =
            curve.calculateCostBetween(0, tokensSold, bondingSupply);
        uint256 pricingMultiplier = (TARGET_AMICA * PRECISION) / baseCost;

        console.log("Configuration:");
        console.log("- Curve Multiplier:", curveMultiplier);
        console.log("- Pricing Multiplier:", pricingMultiplier / 1e18, "x");
        console.log("- Bonding Supply:", bondingSupply / 1e18);
        console.log("");

        // Simulate buying in chunks
        uint256 totalSpent = 0;
        uint256 totalReceived = 0;
        uint256 chunkSize = tokensSold / 100; // Buy in 1% chunks

        for (uint256 i = 0; i < 85; i++) {
            uint256 cost = curve.calculateCostBetween(
                totalReceived, totalReceived + chunkSize, bondingSupply
            );

            // Apply pricing multiplier
            uint256 amicaCost = (cost * pricingMultiplier) / PRECISION;

            totalSpent += amicaCost;
            totalReceived += chunkSize;

            if (i % 20 == 0) {
                console.log("Progress", i, "%:");
                console.log("  Total AMICA spent:", totalSpent / 1e18);
                console.log("  Total tokens bought:", totalReceived / 1e18);
                console.log(
                    "  Avg price:", (totalSpent * 1e18) / totalReceived / 1e18
                );
            }
        }

        console.log("");
        console.log("Final Results:");
        console.log("- Total AMICA spent:", totalSpent / 1e18);
        console.log("- Total tokens received:", totalReceived / 1e18);
        console.log(
            "- Average price:",
            (totalSpent * 1e18) / totalReceived / 1e18,
            "AMICA per token"
        );

        // With bonus distribution
        uint256 unsold = bondingSupply - totalReceived;
        uint256 bonus = unsold; // All unsold go to buyers
        uint256 totalWithBonus = totalReceived + bonus;

        console.log("");
        console.log("After bonus distribution:");
        console.log("- Total tokens for buyers:", totalWithBonus / 1e18);
        console.log(
            "- Effective price:",
            (totalSpent * 1e18) / totalWithBonus / 1e18,
            "AMICA per token"
        );
        console.log("- Target was:", "0.003 AMICA per token (1M / 333M)");
    }
}
