// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Fixtures} from "./shared/Fixtures.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {console} from "forge-std/console.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";

contract GraduationDebugTest is Fixtures {
    using PoolIdLibrary for PoolId;

    uint256 constant BONDING_SUPPLY = 333_333_333 ether; // 1/3 of total supply
    uint256 constant GRADUATION_THRESHOLD_PERCENT = 85;

    function testSimpleGraduationPath() public {
        console.log("=== SIMPLE GRADUATION PATH TEST ===");

        vm.startPrank(user1);
        amicaToken.approve(address(personaFactory), type(uint256).max);

        // Create persona with large initial buy
        uint256 initialBuy = 500_000 ether; // 500k AMICA
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Simple Test",
            "SIMPLE",
            bytes32("simpletest"),
            initialBuy,
            address(0),
            0
        );

        console.log(
            "Created persona with initial buy of", initialBuy / 1e18, "AMICA"
        );

        // Check immediate state
        (, uint256 tokensPurchased,) =
            personaFactory.preGraduationStates(tokenId);
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);

        console.log("Tokens purchased:", tokensPurchased / 1e18);
        console.log("Progress:", (tokensPurchased * 100) / BONDING_SUPPLY, "%");
        console.log("Graduated:", graduationTimestamp > 0);

        // If not graduated, keep buying until graduation
        uint256 buyCount = 0;
        while (graduationTimestamp == 0 && buyCount < 20) {
            buyCount++;
            console.log("\nAdditional buy #", buyCount);

            try personaFactory.swapExactTokensForTokens(
                tokenId,
                100_000 ether, // 100k AMICA
                0,
                user1,
                block.timestamp + 300
            ) {
                (, tokensPurchased,) =
                    personaFactory.preGraduationStates(tokenId);
                console.log("New total purchased:", tokensPurchased / 1e18);
                console.log(
                    "Progress:", (tokensPurchased * 100) / BONDING_SUPPLY, "%"
                );
            } catch {
                console.log("Buy failed - checking if graduated");
            }

            (,,, graduationTimestamp,,) = personaFactory.personas(tokenId);
        }

        console.log("\nFinal graduated status:", graduationTimestamp > 0);

        vm.stopPrank();
    }
}
