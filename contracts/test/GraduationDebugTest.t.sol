// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Fixtures} from "./shared/Fixtures.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {console} from "forge-std/console.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {
    Currency, CurrencyLibrary
} from "@uniswap/v4-core/src/types/Currency.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {Pool} from "@uniswap/v4-core/src/libraries/Pool.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

contract GraduationDebugTest is Fixtures {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;

    uint256 constant TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 constant BONDING_SUPPLY = 333_333_333 ether; // 1/3 of total supply
    uint256 constant GRADUATION_THRESHOLD_PERCENT = 85;
    int24 constant TICK_SPACING = 60;

    // Structure to hold test data and reduce stack variables
    struct TestData {
        uint256 tokenId;
        address personaToken;
        address pairToken;
        uint256 graduationTimestamp;
        uint256 totalCollected;
        uint256 tokensPurchased;
        uint256 totalAgentDeposited;
        uint256 amicaBalanceBefore;
        uint256 amicaBalanceAfter;
    }

    function testSimpleGraduationPath() public {
        console.log("=== SIMPLE GRADUATION PATH TEST ===");

        TestData memory data;

        vm.startPrank(user1);
        amicaToken.approve(address(personaFactory), type(uint256).max);

        // Record initial balances
        data.amicaBalanceBefore = amicaToken.balanceOf(address(amicaToken));

        // Create persona with large initial buy
        uint256 initialBuy = 500_000 ether; // 500k AMICA
        data.tokenId = personaFactory.createPersona(
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

        // Get persona data
        (data.personaToken, data.pairToken,, data.graduationTimestamp,,,) =
            personaFactory.personas(data.tokenId);

        // Check immediate state
        (data.totalCollected, data.tokensPurchased, data.totalAgentDeposited) =
            personaFactory.preGraduationStates(data.tokenId);

        _logInitialState(data);

        // If not graduated, keep buying until graduation
        uint256 buyCount = 0;
        while (data.graduationTimestamp == 0 && buyCount < 20) {
            buyCount++;
            console.log("\nAdditional buy #", buyCount);

            try personaFactory.swapExactTokensForTokens(
                data.tokenId,
                9_000_000 ether, // 100k AMICA
                0,
                user1,
                block.timestamp + 300
            ) {
                (data.totalCollected, data.tokensPurchased,) =
                    personaFactory.preGraduationStates(data.tokenId);
                console.log(
                    "  New total purchased:", data.tokensPurchased / 1e18
                );
                console.log(
                    "  New total collected:", data.totalCollected / 1e18
                );
                console.log(
                    "  Progress:",
                    (data.tokensPurchased * 100) / BONDING_SUPPLY,
                    "%"
                );
            } catch {
                console.log("  Buy failed - checking if graduated");
            }

            (,,, data.graduationTimestamp,,,) =
                personaFactory.personas(data.tokenId);
        }

        console.log("\n=== GRADUATION REPORT ===");
        console.log("Final graduated status:", data.graduationTimestamp > 0);

        if (data.graduationTimestamp > 0) {
            _handlePostGraduation(data);
        }

        vm.stopPrank();
    }

    function _logInitialState(TestData memory data) private pure {
        console.log("Initial state:");
        console.log("  Tokens purchased:", data.tokensPurchased / 1e18);
        console.log("  Total AMICA collected:", data.totalCollected / 1e18);
        console.log(
            "  Progress:", (data.tokensPurchased * 100) / BONDING_SUPPLY, "%"
        );
        console.log("  Graduated:", data.graduationTimestamp > 0);
    }

    function _handlePostGraduation(TestData memory data) private {
        // Get final state
        (data.totalCollected, data.tokensPurchased,) =
            personaFactory.preGraduationStates(data.tokenId);

        console.log("\nPre-graduation summary:");
        console.log(
            "  Total persona tokens purchased:", data.tokensPurchased / 1e18
        );
        console.log("  Total AMICA collected:", data.totalCollected / 1e18);
        console.log(
            "  Final progress:",
            (data.tokensPurchased * 100) / BONDING_SUPPLY,
            "%"
        );

        _logTokenDistributions();

        // Check actual AMICA balance
        data.amicaBalanceAfter = amicaToken.balanceOf(address(amicaToken));
        uint256 amicaReceived = data.amicaBalanceAfter - data.amicaBalanceBefore;
        console.log(
            "\nAMICA protocol actually received:",
            amicaReceived / 1e18,
            "persona tokens"
        );

        // Check liquidity pool state
        _checkLiquidityPool(data);

        // Check claimable tokens
        _checkClaimableTokens(data);

        // Show accountability
        _showTokenAccountability(data);
    }

    function _logTokenDistributions() private pure {
        // Calculate distributions
        uint256 amicaDistribution = BONDING_SUPPLY + 1 ether; // 1/3 + rounding
        uint256 liquidityDistribution = BONDING_SUPPLY; // 1/3
        uint256 bondingDistribution = BONDING_SUPPLY; // 1/3

        console.log("\nToken distributions:");
        console.log(
            "  To AMICA protocol:", amicaDistribution / 1e18, "persona tokens"
        );
        console.log(
            "  To liquidity pool:",
            liquidityDistribution / 1e18,
            "persona tokens"
        );
        console.log(
            "  To bonding curve:", bondingDistribution / 1e18, "persona tokens"
        );
    }

    function _checkLiquidityPool(TestData memory data) private view {
        (,,,,, PoolId poolId, uint256 positionTokenId) = personaFactory.personas(data.tokenId);

        if (PoolId.unwrap(poolId) != bytes32(0)) {
            console.log("\nLiquidity pool created:");
            console.log("  Pool ID:", uint256(uint256(PoolId.unwrap(poolId))));
            console.log("  Position NFT tokenId:", positionTokenId);

            // Check position NFT ownership
            address positionOwner = IERC721(address(positionManager)).ownerOf(positionTokenId);
            console.log("  Position NFT owner:", positionOwner);
            console.log("  Factory address:", address(personaFactory));

            if (positionOwner == address(personaFactory)) {
                console.log("  [OK] Position NFT owned by factory");
            } else {
                console.log("  [FAIL] Position NFT NOT owned by factory!");
            }

            // Get pool key
            PoolKey memory poolKey =
                _getPoolKey(data.personaToken, data.pairToken);

            // Get pool liquidity
            (uint160 sqrtPriceX96, int24 tick,,) = poolManager.getSlot0(poolId);

            if (sqrtPriceX96 > 0) {
                console.log("  Pool initialized: true");
                console.log("  Current tick:", int256(tick));

                _logPoolBalances(poolKey, data);
            }
        }
    }

    function _logPoolBalances(PoolKey memory poolKey, TestData memory data)
        private
        view
    {
        // Check actual token balances in pool manager
        uint256 token0Balance = IERC20(Currency.unwrap(poolKey.currency0))
            .balanceOf(address(poolManager));
        uint256 token1Balance = IERC20(Currency.unwrap(poolKey.currency1))
            .balanceOf(address(poolManager));

        bool personaIsToken0 =
            uint160(data.personaToken) < uint160(data.pairToken);

        if (personaIsToken0) {
            console.log("  Persona tokens in pool:", token0Balance / 1e18);
            console.log("  AMICA tokens in pool:", token1Balance / 1e18);
        } else {
            console.log("  AMICA tokens in pool:", token0Balance / 1e18);
            console.log("  Persona tokens in pool:", token1Balance / 1e18);
        }

        console.log("\nExpected liquidity amounts:");
        console.log("  Persona tokens:", BONDING_SUPPLY / 1e18);
        console.log("  AMICA tokens:", data.totalCollected / 1e18);
    }

    function _checkClaimableTokens(TestData memory data) private {
        console.log("\nClaimable tokens for user1:");

        // Fast forward past claim delay
        vm.warp(block.timestamp + 1 days + 1);

        (
            uint256 purchasedAmount,
            uint256 bonusAmount,
            uint256 agentRewardAmount,
            uint256 totalClaimable,
            bool claimed,
            bool claimable
        ) = personaFactory.getClaimableRewards(data.tokenId, user1);

        console.log("  Purchased amount:", purchasedAmount / 1e18);
        console.log("  Bonus from unsold:", bonusAmount / 1e18);
        console.log("  Agent rewards:", agentRewardAmount / 1e18);
        console.log("  Total claimable:", totalClaimable / 1e18);
        console.log("  Already claimed:", claimed);
        console.log("  Can claim now:", claimable);

        // Calculate unsold tokens
        uint256 unsoldTokens = BONDING_SUPPLY > data.tokensPurchased
            ? BONDING_SUPPLY - data.tokensPurchased
            : 0;
        console.log("\nUnsold tokens in bonding curve:", unsoldTokens / 1e18);
    }

    function _showTokenAccountability(TestData memory data) private pure {
        uint256 amicaDistribution = BONDING_SUPPLY + 1 ether;
        uint256 liquidityDistribution = BONDING_SUPPLY;
        uint256 unsoldTokens = BONDING_SUPPLY > data.tokensPurchased
            ? BONDING_SUPPLY - data.tokensPurchased
            : 0;

        console.log("\n=== TOKEN ACCOUNTABILITY ===");
        console.log("Total supply:", TOTAL_SUPPLY / 1e18);
        console.log("Distributed to:");
        console.log("  - AMICA protocol:", amicaDistribution / 1e18);
        console.log("  - Liquidity pool:", liquidityDistribution / 1e18);
        console.log("  - Sold to users:", data.tokensPurchased / 1e18);
        console.log("  - Unsold (bonus pool):", unsoldTokens / 1e18);

        uint256 totalAccountedFor = amicaDistribution + liquidityDistribution
            + data.tokensPurchased + unsoldTokens;
        console.log("Total accounted for:", totalAccountedFor / 1e18);
        console.log("Difference:", (TOTAL_SUPPLY - totalAccountedFor) / 1e18);
    }

    // Helper function to construct pool key
    function _getPoolKey(address tokenA, address tokenB)
        private
        view
        returns (PoolKey memory)
    {
        (Currency currency0, Currency currency1) =
            _orderCurrencies(tokenA, tokenB);

        return PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(personaFactory.dynamicFeeHook())
        });
    }

    function _orderCurrencies(address tokenA, address tokenB)
        private
        pure
        returns (Currency currency0, Currency currency1)
    {
        if (uint160(tokenA) < uint160(tokenB)) {
            currency0 = Currency.wrap(tokenA);
            currency1 = Currency.wrap(tokenB);
        } else {
            currency0 = Currency.wrap(tokenB);
            currency1 = Currency.wrap(tokenA);
        }
    }

    // Test to verify position NFT ownership after graduation
    function testPositionNFTOwnership() public {
        console.log("=== POSITION NFT OWNERSHIP TEST ===");

        vm.startPrank(user1);
        amicaToken.approve(address(personaFactory), type(uint256).max);

        // Create and graduate a persona
        uint256 initialBuy = 500_000 ether;
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "NFT Test",
            "NFTTEST",
            bytes32("nfttest"),
            initialBuy,
            address(0),
            0
        );

        // Buy until graduation
        uint256 buyCount = 0;
        uint256 graduationTimestamp;
        while (graduationTimestamp == 0 && buyCount < 20) {
            buyCount++;
            try personaFactory.swapExactTokensForTokens(
                tokenId,
                9_000_000 ether,
                0,
                user1,
                block.timestamp + 300
            ) {} catch {}

            (,,, graduationTimestamp,,,) = personaFactory.personas(tokenId);
        }

        require(graduationTimestamp > 0, "Must be graduated");

        // Verify position NFT ownership
        (,,,,, PoolId poolId, uint256 positionTokenId) = personaFactory.personas(tokenId);

        console.log("Pool ID:", uint256(PoolId.unwrap(poolId)));
        console.log("Position Token ID:", positionTokenId);

        // Check NFT owner
        address positionOwner = IERC721(address(positionManager)).ownerOf(positionTokenId);
        console.log("Position owner:", positionOwner);
        console.log("Factory address:", address(personaFactory));

        // Verify factory owns the position NFT
        assertEq(positionOwner, address(personaFactory), "Factory should own position NFT");
        console.log("[OK] Position NFT correctly owned by factory");

        vm.stopPrank();
    }
}
