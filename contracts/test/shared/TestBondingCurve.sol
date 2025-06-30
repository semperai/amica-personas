// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BondingCurve} from "../../src/BondingCurve.sol";

/**
 * @title TestBondingCurve
 * @notice Test version of BondingCurve with configurable parameters
 * @dev Only for testing - allows dynamic adjustment of curve steepness
 */
contract TestBondingCurve is BondingCurve {
    /// @notice Configurable curve steepness parameter (replaces SQRT133_MINUS_1)
    /// @dev Default value: 10532 (represents (√133 - 1) * 1000)
    uint256 public curveMultiplier = 10532;

    /// @notice Sets the curve multiplier for testing different price curves
    /// @param _multiplier New multiplier value (smaller = steeper curve, larger = flatter curve)
    function setCurveMultiplier(uint256 _multiplier) external {
        require(_multiplier > 0, "Multiplier must be positive");
        curveMultiplier = _multiplier;
    }

    /// @notice Returns the current curve multiplier
    /// @dev We override this to allow dynamic adjustment in tests
    /// @return Current curve multiplier value
    function getCurveMultiplier() public view override returns (uint256) {
        return curveMultiplier;
    }

    /// @notice Helper to calculate expected final price multiplier
    /// @dev Shows what the price will be when all tokens are sold
    function getExpectedFinalMultiplier() external view returns (uint256) {
        // When all tokens are sold, the price multiplier is approximately:
        // (1 + 1000/curveMultiplier)^2
        uint256 ratio = 1000 + curveMultiplier;
        return (ratio * ratio * 1e18) / (curveMultiplier * curveMultiplier);
    }

    /// @notice Helper to estimate total cost to buy all tokens
    /// @param totalSupply Total tokens in the curve
    /// @return totalCost Estimated total ETH/pairing tokens needed
    function estimateTotalCost(uint256 totalSupply)
        external
        view
        returns (uint256 totalCost)
    {
        // This is an approximation - actual cost depends on the integral of the curve
        uint256 virtualBuffer = (totalSupply * 1000) / curveMultiplier;
        uint256 avgPrice = (1e18 + this.getExpectedFinalMultiplier()) / 2;
        totalCost = (totalSupply * avgPrice) / 1e18;
    }
}
