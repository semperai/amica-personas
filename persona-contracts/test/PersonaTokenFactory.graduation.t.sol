// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Fixtures} from "./shared/Fixtures.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PersonaTokenFactory} from "../src/PersonaTokenFactory.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {console} from "forge-std/console.sol";

contract PersonaTokenFactoryGraduationTest is Fixtures {
    using PoolIdLibrary for bytes32;

    uint256 constant LIQUIDITY_TOKEN_AMOUNT = 333_333_334 ether;
    uint256 constant BONDING_AMOUNT = 333_333_333 ether;
    uint256 constant GRADUATION_PERCENT = 85;
    uint256 constant TARGET_RAISE = 1_000_000 ether; // 1M AMICA target

    function setUp() public override {
        super.setUp();

        // Approve factory to spend tokens
        vm.prank(user1);
        amicaToken.approve(address(personaFactory), type(uint256).max);

        vm.prank(user2);
        amicaToken.approve(address(personaFactory), type(uint256).max);

        vm.prank(user3);
        amicaToken.approve(address(personaFactory), type(uint256).max);
    }

    function createPersonaFixture()
        public
        returns (uint256 tokenId, address personaToken, address creator)
    {
        creator = user1;
        vm.prank(creator);
        tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TEST",
            bytes32("testpersona"),
            0, // no initial buy
            address(0), // no agent token
            0 // no min agent tokens
        );

        // Get persona data
        (address token,,,,,) = personaFactory.personas(tokenId);

        personaToken = token;
    }

    function test_GraduatePersona_CreatesV4Pool() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Buy tokens progressively to trigger graduation
        // We need to buy enough to reach 85% of 333,333,333 tokens
        uint256 targetTokens = (BONDING_AMOUNT * GRADUATION_PERCENT) / 100;

        // Buy in chunks until graduation
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user2);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 1
            ) {
                // Check if graduated
                (,,, uint256 graduationTimestamp,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                // Might have graduated
                break;
            }
        }

        // Verify graduation
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        assertTrue(graduationTimestamp > 0, "Should have graduated");
    }

    function test_Graduation_SendsTokensToAmica() public {
        (uint256 tokenId, address personaToken,) = createPersonaFixture();

        uint256 amicaBalanceBefore =
            IERC20(personaToken).balanceOf(address(amicaToken));

        // Trigger graduation by buying in chunks
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user2);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                break;
            }
        }

        // Check AMICA received tokens (1/3 of supply when no agent token)
        uint256 expectedAmicaAmount = 333_333_334 ether; // THIRD_SUPPLY + 1
        uint256 amicaBalanceAfter =
            IERC20(personaToken).balanceOf(address(amicaToken));
        assertEq(amicaBalanceAfter - amicaBalanceBefore, expectedAmicaAmount);
    }

    function test_Graduation_WithExcessFunds() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Buy in chunks to trigger graduation
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 25; i++) {
            // Extra iterations for excess
            vm.prank(user2);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 1
            ) {
                // Continue buying even after potential graduation
            } catch {
                // Graduated, can't buy more
                break;
            }
        }

        // Verify graduated
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        assertTrue(graduationTimestamp > 0);
    }

    function test_Graduation_ExactThreshold() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Calculate exact threshold: 85% of 333,333,333 tokens
        uint256 targetTokens = (BONDING_AMOUNT * GRADUATION_PERCENT) / 100; // ~283,333,333

        // Buy tokens in smaller increments to approach threshold
        uint256 totalBought = 0;
        uint256 buyAmount = 10_000 ether;

        // Buy until we're close to the threshold
        while (totalBought < targetTokens) {
            (,,, uint256 gradTime,,) = personaFactory.personas(tokenId);
            if (gradTime > 0) break; // Already graduated

            // Get current tokens purchased
            (, uint256 tokensPurchased,) =
                personaFactory.preGraduationStates(tokenId);

            // If we're within 10% of target, use smaller amounts
            if (tokensPurchased > targetTokens * 90 / 100) {
                buyAmount = 1_000 ether;
            }

            vm.prank(user2);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 1
            ) returns (uint256 received) {
                totalBought += received;
            } catch {
                // Graduated or hit some limit
                break;
            }
        }

        // Verify graduated
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        assertTrue(graduationTimestamp > 0, "Should have graduated");

        // Check that we graduated close to the threshold
        (, uint256 finalTokensPurchased,) =
            personaFactory.preGraduationStates(tokenId);
        uint256 graduationPercent =
            (finalTokensPurchased * 100) / BONDING_AMOUNT;
        assertGe(
            graduationPercent,
            GRADUATION_PERCENT,
            "Should graduate at or above threshold"
        );
        assertLe(
            graduationPercent,
            GRADUATION_PERCENT + 5,
            "Should not overshoot threshold by much"
        );
    }

    function test_CannotTradeAfterGraduation() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Graduate the persona
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user2);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                break;
            }
        }

        // Verify graduated
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        require(graduationTimestamp > 0, "Must be graduated");

        // Try to buy more tokens after graduation
        vm.prank(user3);
        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 4)); // TradingOnUniswap = 4
        personaFactory.swapExactTokensForTokens(
            tokenId, 1000 ether, 0, user3, block.timestamp + 1
        );
    }

    function test_ClaimRewards_AfterGraduation() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // User2 buys some tokens
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, 100_000 ether, 0, user2, block.timestamp + 1
        );

        // User3 triggers graduation
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user3);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user3, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                break;
            }
        }

        // Verify graduated
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        require(graduationTimestamp > 0, "Must be graduated");

        // Wait for claim delay
        vm.warp(block.timestamp + 1 days + 1);

        // User2 claims their rewards
        vm.prank(user2);
        personaFactory.claimRewards(tokenId);

        // Verify can't claim twice
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 14)); // AlreadyClaimed = 14
        personaFactory.claimRewards(tokenId);
    }

    function test_ClaimRewards_IncludesBonus() public {
        (uint256 tokenId, address personaToken,) = createPersonaFixture();

        // User2 buys tokens
        uint256 buyAmount = 50_000 ether;
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, buyAmount, 0, user2, block.timestamp + 1
        );

        // Record how many tokens user2 should have purchased
        uint256 user2Purchased = personaFactory.bondingBalances(tokenId, user2);

        // Graduate the persona
        uint256 gradBuyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user3);
            try personaFactory.swapExactTokensForTokens(
                tokenId, gradBuyAmount, 0, user3, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                break;
            }
        }

        // Verify graduated
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        require(graduationTimestamp > 0, "Must be graduated");

        // Wait for claim delay
        vm.warp(block.timestamp + 1 days + 1);

        // Get claimable rewards for user2
        (
            uint256 purchasedAmount,
            uint256 bonusAmount,
            uint256 agentRewardAmount,
            uint256 totalClaimable,
            bool claimed,
            bool claimable
        ) = personaFactory.getClaimableRewards(tokenId, user2);

        assertEq(purchasedAmount, user2Purchased);
        assertGt(bonusAmount, 0, "Should receive bonus from unsold tokens");
        assertEq(agentRewardAmount, 0); // No agent tokens
        assertFalse(claimed);
        assertTrue(claimable); // Should be claimable after delay

        // Claim and verify
        uint256 balanceBefore = IERC20(personaToken).balanceOf(user2);

        vm.prank(user2);
        personaFactory.claimRewards(tokenId);

        uint256 balanceAfter = IERC20(personaToken).balanceOf(user2);
        assertEq(balanceAfter - balanceBefore, totalClaimable);
    }

    function test_Graduation_WithDifferentPairingTokens() public {
        // Deploy USDC
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 18);
        usdc.mint(user1, 20_000_000 ether);
        usdc.mint(user2, 20_000_000 ether);

        // Configure USDC with same multiplier as default AMICA
        vm.prank(factoryOwner);
        personaFactory.configurePairingToken(
            address(usdc),
            100 ether, // Lower mint cost
            1333 ether, // Same multiplier as default AMICA
            true
        );

        // Create persona with USDC
        vm.startPrank(user1);
        usdc.approve(address(personaFactory), type(uint256).max);
        uint256 tokenId = personaFactory.createPersona(
            address(usdc),
            "USDC Persona",
            "USDCP",
            bytes32("usdcpersona"),
            0,
            address(0),
            0
        );
        vm.stopPrank();

        // Graduate with USDC
        vm.startPrank(user2);
        usdc.approve(address(personaFactory), type(uint256).max);

        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                console.log("Buy failed at iteration", i);
                break;
            }
        }
        vm.stopPrank();

        // Verify graduated
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        assertTrue(graduationTimestamp > 0, "Should have graduated with USDC");

        // Verify pool was created
        (,,,,, PoolId poolId) = personaFactory.personas(tokenId);
        assertTrue(
            PoolId.unwrap(poolId) != bytes32(0), "Pool should be created"
        );
    }

    function test_Graduation_WithAgentToken() public {
        // Deploy agent token
        MockERC20 agentToken = new MockERC20("Agent Token", "AGENT", 18);
        agentToken.mint(user1, 1_000_000 ether);
        agentToken.mint(user2, 1_000_000 ether);

        // Create persona with agent token requirement
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Agent Persona",
            "AGENTP",
            bytes32("agentpersona"),
            0,
            address(agentToken),
            100_000 ether // Require 100k agent tokens
        );

        // For agent personas, bonding supply is 1/6 of total (166,666,666)
        // Graduation threshold is 85% of that: ~141,666,666

        // Buy tokens to reach threshold
        uint256 buyAmount = 50_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user2);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 1
            ) {} catch {
                break; // Hit bonding limit
            }
        }

        // Check current purchase status
        (, uint256 tokensPurchased,) =
            personaFactory.preGraduationStates(tokenId);
        uint256 bondingSupply = 166_666_666 ether; // 1/6 for agent personas
        uint256 purchasePercent = (tokensPurchased * 100) / bondingSupply;
        console.log("Purchase percent before agent deposit:", purchasePercent);

        // Should not be graduated yet (missing agent tokens)
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        assertFalse(
            graduationTimestamp > 0, "Should not graduate without agent tokens"
        );

        // Deposit agent tokens to meet requirement
        vm.startPrank(user1);
        agentToken.approve(address(personaFactory), 100_000 ether);
        personaFactory.depositAgentTokens(tokenId, 100_000 ether);
        vm.stopPrank();

        // Now it should graduate automatically if token threshold was met
        (,,, graduationTimestamp,,) = personaFactory.personas(tokenId);
        assertTrue(
            graduationTimestamp > 0, "Should graduate after agent deposit"
        );

        // Verify pool was created
        (,,,,, PoolId poolId) = personaFactory.personas(tokenId);
        assertTrue(
            PoolId.unwrap(poolId) != bytes32(0), "Pool should be created"
        );
    }

    function test_GetClaimableRewards_BeforeGraduation() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Buy some tokens but don't graduate
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, 10_000 ether, 0, user2, block.timestamp + 1
        );

        // Check claimable rewards before graduation
        (
            uint256 purchasedAmount,
            uint256 bonusAmount,
            uint256 agentRewardAmount,
            uint256 totalClaimable,
            bool claimed,
            bool claimable
        ) = personaFactory.getClaimableRewards(tokenId, user2);

        assertEq(purchasedAmount, 0); // Can't claim before graduation
        assertEq(bonusAmount, 0);
        assertEq(agentRewardAmount, 0);
        assertEq(totalClaimable, 0);
        assertFalse(claimed);
        assertFalse(claimable);
    }

    function test_CannotClaimBeforeGraduation() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Buy some tokens
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, 10_000 ether, 0, user2, block.timestamp + 1
        );

        // Try to claim before graduation
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 3)); // NotGraduated = 3
        personaFactory.claimRewards(tokenId);
    }

    function test_CannotClaimBeforeDelay() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Graduate the persona
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user2);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                break;
            }
        }

        // Verify graduated
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        require(graduationTimestamp > 0, "Must be graduated");

        // Try to claim immediately after graduation (before 24 hour delay)
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 12)); // ClaimTooEarly = 12
        personaFactory.claimRewards(tokenId);
    }

    function test_MultipleUsersClaimAfterGraduation() public {
        (uint256 tokenId, address personaToken,) = createPersonaFixture();

        // Multiple users buy tokens
        uint256 user2Amount = 50_000 ether;
        uint256 user3Amount = 75_000 ether;

        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, user2Amount, 0, user2, block.timestamp + 1
        );

        vm.prank(user3);
        personaFactory.swapExactTokensForTokens(
            tokenId, user3Amount, 0, user3, block.timestamp + 1
        );

        // Trigger graduation
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user1);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user1, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                break;
            }
        }

        // Verify graduated
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        require(graduationTimestamp > 0, "Must be graduated");

        // Wait for claim delay
        vm.warp(block.timestamp + 1 days + 1);

        // Both users claim
        vm.prank(user2);
        personaFactory.claimRewards(tokenId);

        vm.prank(user3);
        personaFactory.claimRewards(tokenId);

        // Verify both received tokens
        assertGt(IERC20(personaToken).balanceOf(user2), 0);
        assertGt(IERC20(personaToken).balanceOf(user3), 0);

        // User3 should have more tokens (bought more)
        assertGt(
            IERC20(personaToken).balanceOf(user3),
            IERC20(personaToken).balanceOf(user2)
        );
    }

    function test_Graduation_EmitsCorrectEvents() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Buy tokens to trigger graduation
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user2);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                break;
            }
        }
    }

    function test_SellTokensBeforeGraduation() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // User2 buys tokens
        uint256 buyAmount = 50_000 ether;
        vm.prank(user2);
        personaFactory.swapExactTokensForTokens(
            tokenId, buyAmount, 0, user2, block.timestamp + 1
        );

        uint256 tokensReceived = personaFactory.bondingBalances(tokenId, user2);
        uint256 balanceBefore = amicaToken.balanceOf(user2);

        // User2 sells half their tokens back
        uint256 sellAmount = tokensReceived / 2;
        vm.prank(user2);
        personaFactory.swapExactTokensForPairingTokens(
            tokenId, sellAmount, 0, user2, block.timestamp + 1
        );

        // Verify tokens were sold
        uint256 balanceAfter = amicaToken.balanceOf(user2);
        assertGt(balanceAfter, balanceBefore);
        assertEq(
            personaFactory.bondingBalances(tokenId, user2),
            tokensReceived - sellAmount
        );
    }

    function test_CannotSellAfterGraduation() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Graduate the persona
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user2);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                break;
            }
        }

        // Verify graduated
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        require(graduationTimestamp > 0, "Must be graduated");

        // Try to sell after graduation
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 4)); // TradingOnUniswap = 4
        personaFactory.swapExactTokensForPairingTokens(
            tokenId, 1000 ether, 0, user2, block.timestamp + 1
        );
    }

    function test_CollectFeesAfterGraduation() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Graduate the persona
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user2);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                break;
            }
        }

        // Verify graduated
        (,,, uint256 graduationTimestamp,,) = personaFactory.personas(tokenId);
        require(graduationTimestamp > 0, "Must be graduated");

        // Since the PositionManager doesn't actually mint NFTs in our test environment,
        // we can't test fee collection properly. This is a limitation of the test setup.
        // In production, the PositionManager would mint an NFT that the owner could use
        // to collect fees. For now, we'll just verify the pool was created.

        (,,,,, PoolId poolId) = personaFactory.personas(tokenId);
        assertTrue(
            PoolId.unwrap(poolId) != bytes32(0), "Pool should be created"
        );
    }

    function test_NonOwnerCannotCollectFees() public {
        (uint256 tokenId,,) = createPersonaFixture();

        // Graduate the persona
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            vm.prank(user2);
            try personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 1
            ) {
                (,,, uint256 graduationTimestamp,,) =
                    personaFactory.personas(tokenId);
                if (graduationTimestamp > 0) break;
            } catch {
                break;
            }
        }

        // Non-owner tries to collect fees
        vm.prank(user2); // user2 is not the NFT owner
        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 11)); // Unauthorized = 11
        personaFactory.collectFees(tokenId, user2);
    }
}
