// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {TestBondingCurve} from "../test/shared/TestBondingCurve.sol";

/**
 * @title FindOptimalParameters
 * @notice Script to find optimal bonding curve parameters
 * @dev Run with: forge script script/FindOptimalParameters.s.sol -vvv
 */
contract FindOptimalParameters is Script {
    uint256 constant SIXTH_SUPPLY = 166_666_666 ether; // 1/6 of 1B
    uint256 constant THIRD_SUPPLY = 333_333_333 ether; // 1/3 of 1B
    uint256 constant TARGET_AMICA = 1_000_000 ether; // 1M AMICA
    uint256 constant GRADUATION_THRESHOLD = 85; // 85%

    function run() public {
        console.log("=== Bonding Curve Parameter Analysis ===");
        console.log("Goal: Sell ~333M persona tokens for ~1M AMICA total");
        console.log(
            "Bonding supply: 333M tokens (no agent) or 166M tokens (with agent)"
        );
        console.log("Graduation at: 85% minimum");
        console.log("");

        // Test different scenarios
        analyzeScenario("No Agent Token", THIRD_SUPPLY);
        analyzeScenario("With Agent Token", SIXTH_SUPPLY);
    }

    function analyzeScenario(string memory scenario, uint256 bondingSupply)
        internal
    {
        console.log("=== Scenario:", scenario, "===");
        console.log("Bonding supply:", bondingSupply / 1e18, "tokens");
        console.log("");

        // Calculate tokens sold at graduation
        uint256 tokensSoldAtGraduation =
            (bondingSupply * GRADUATION_THRESHOLD) / 100;
        console.log(
            "Tokens sold at graduation (85%):", tokensSoldAtGraduation / 1e18
        );

        // With bonus distribution, buyers get their purchased tokens + pro-rata share of unsold
        uint256 unsoldTokens = bondingSupply - tokensSoldAtGraduation;
        uint256 totalTokensReceived = bondingSupply; // All tokens go to buyers
        console.log("Total tokens buyers receive:", totalTokensReceived / 1e18);
        console.log("");

        // Now we need to find parameters where tokensSoldAtGraduation costs ~1M AMICA

        TestBondingCurve curve = new TestBondingCurve();

        // Test different curve multipliers
        uint256[] memory curveMultipliers = new uint256[](5);
        curveMultipliers[0] = 3000; // Very steep (final multiplier ~112x)
        curveMultipliers[1] = 5000; // Steep (final multiplier ~41x)
        curveMultipliers[2] = 10532; // Original (final multiplier ~19x)
        curveMultipliers[3] = 15000; // Flat (final multiplier ~14x)
        curveMultipliers[4] = 20000; // Very flat (final multiplier ~11x)

        for (uint256 i = 0; i < curveMultipliers.length; i++) {
            curve.setCurveMultiplier(curveMultipliers[i]);

            console.log("Curve Multiplier:", curveMultipliers[i]);

            // Calculate cost to reach graduation
            uint256 totalCost =
                calculateTotalCost(curve, tokensSoldAtGraduation, bondingSupply);
            console.log("  Cost to graduate:", totalCost / 1e18, "base tokens");

            // Calculate required pricing multiplier
            uint256 requiredPricingMultiplier =
                (TARGET_AMICA * 1e18) / totalCost;
            console.log(
                "  Required pricing multiplier:",
                requiredPricingMultiplier / 1e16,
                "/ 100"
            );

            // Verify final price multiplier
            uint256 startPrice = curve.getCurrentPrice(0, bondingSupply);
            uint256 endPrice =
                curve.getCurrentPrice(tokensSoldAtGraduation, bondingSupply);
            uint256 priceMultiplier = (endPrice * 1e18) / startPrice;
            console.log(
                "  Price multiplier at graduation:",
                priceMultiplier / 1e16,
                "x / 100"
            );

            // Calculate effective AMICA per persona ratio
            uint256 amicaPerPersona =
                (TARGET_AMICA * 1e18) / totalTokensReceived;
            console.log(
                "  AMICA per persona token:", amicaPerPersona / 1e15, "/ 1000"
            );
            console.log("");
        }

        console.log("Recommended parameters for", scenario, ":");
        console.log("- Curve Multiplier: 3000-5000 (steeper curve)");
        console.log(
            "- Pricing Multiplier: Adjust based on curve to hit 1M AMICA target"
        );
        console.log("");
    }

    function calculateTotalCost(
        TestBondingCurve curve,
        uint256 tokensToBuy,
        uint256 totalSupply
    ) internal view returns (uint256) {
        // Use the bonding curve's built-in cost calculation
        return curve.calculateCostBetween(0, tokensToBuy, totalSupply);
    }
}
