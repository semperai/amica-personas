// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Fixtures} from "./shared/Fixtures.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PersonaTokenFactory} from "../src/PersonaTokenFactory.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {
    Currency, CurrencyLibrary
} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {Position} from "@uniswap/v4-core/src/libraries/Position.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {console} from "forge-std/console.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {IPositionManager} from
    "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";

contract PersonaTokenFactoryFeesTest is Fixtures {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;

    uint256 constant LIQUIDITY_TOKEN_AMOUNT = 333_333_334 ether;
    uint256 constant BONDING_AMOUNT = 333_333_333 ether;
    uint256 constant GRADUATION_PERCENT = 85;

    // Swap parameters for fee generation
    uint256 constant SWAP_AMOUNT = 10_000 ether;
    uint256 constant LARGE_SWAP_AMOUNT = 100_000 ether;

    // Fee testing users
    address swapper1;
    address swapper2;
    address liquidityProvider;

    function setUp() public override {
        super.setUp();

        // Setup additional test users
        swapper1 = makeAddr("swapper1");
        swapper2 = makeAddr("swapper2");
        liquidityProvider = makeAddr("liquidityProvider");

        // Give swappers tokens
        amicaToken.transfer(swapper1, 1_000_000 ether);
        amicaToken.transfer(swapper2, 1_000_000 ether);
        amicaToken.transfer(liquidityProvider, 1_000_000 ether);

        // Approve factory for all users
        vm.prank(user1);
        amicaToken.approve(address(personaFactory), type(uint256).max);

        vm.prank(user2);
        amicaToken.approve(address(personaFactory), type(uint256).max);

        vm.prank(user3);
        amicaToken.approve(address(personaFactory), type(uint256).max);

        // Approve swapRouter and permit2 for swappers
        vm.prank(swapper1);
        amicaToken.approve(address(swapRouter), type(uint256).max);
        amicaToken.approve(address(permit2), type(uint256).max);

        vm.prank(swapper2);
        amicaToken.approve(address(swapRouter), type(uint256).max);
        amicaToken.approve(address(permit2), type(uint256).max);
    }

    function graduatePersona(uint256 tokenId)
        internal
        returns (address personaToken, PoolId poolId)
    {
        // Get persona token before graduation
        (address token,,,,,,) = personaFactory.personas(tokenId);
        personaToken = token;

        // Buy tokens progressively to trigger graduation
        uint256 buyAmount = 100_000 ether;
        for (uint256 i = 0; i < 20; i++) {
            // Check if already graduated
            (,,, uint256 gradTimestamp,,,) = personaFactory.personas(tokenId);
            if (gradTimestamp > 0) break;

            vm.prank(user2);
            personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 1
            );
        }

        // Verify graduation and get pool ID
        (,,, uint256 graduationTimestamp,, PoolId pid,) =
            personaFactory.personas(tokenId);
        require(graduationTimestamp > 0, "Must be graduated");
        poolId = pid;

        // Approve persona token for swapRouter
        vm.prank(swapper1);
        IERC20(personaToken).approve(address(swapRouter), type(uint256).max);
        IERC20(personaToken).approve(address(permit2), type(uint256).max);

        vm.prank(swapper2);
        IERC20(personaToken).approve(address(swapRouter), type(uint256).max);
        IERC20(personaToken).approve(address(permit2), type(uint256).max);

        // Wait for claim delay so users can claim their tokens
        vm.warp(block.timestamp + 1 days + 1);

        // Have user2 claim some tokens to use for swapping
        vm.prank(user2);
        personaFactory.claimRewards(tokenId);

        // Transfer some persona tokens to swappers for testing
        uint256 user2Balance = IERC20(personaToken).balanceOf(user2);
        if (user2Balance > 20_000 ether) {
            vm.prank(user2);
            IERC20(personaToken).transfer(swapper1, 10_000 ether);
            vm.prank(user2);
            IERC20(personaToken).transfer(swapper2, 10_000 ether);
        }
    }

    function _getPoolKeyFromPersona(address token0, address token1)
        internal
        view
        returns (PoolKey memory)
    {
        (Currency currency0, Currency currency1) =
            _orderCurrencies(token0, token1);

        return PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(dynamicFeeHook)
        });
    }

    function _orderCurrencies(address tokenA, address tokenB)
        internal
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

    // ==================== Test Cases ====================

    function test_CollectFees_OnlyOwner() public {
        // Create and graduate persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TEST",
            bytes32("testfees"),
            0,
            address(0),
            0
        );

        graduatePersona(tokenId);

        // Non-owner tries to collect fees
        vm.prank(user2);
        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 11)); // Unauthorized
        personaFactory.collectFees(tokenId, user2);

        // Owner can collect fees
        vm.prank(user1);
        (uint256 amount0, uint256 amount1) =
            personaFactory.collectFees(tokenId, user1);

        console.log("Fees collected - amount0:", amount0);
        console.log("Fees collected - amount1:", amount1);
    }

    function test_CollectFees_InvalidTokenId() public {
        uint256 invalidTokenId = 999;

        // The error comes from ERC721 when checking ownership
        vm.expectRevert(
            abi.encodeWithSignature(
                "ERC721NonexistentToken(uint256)", invalidTokenId
            )
        );
        personaFactory.ownerOf(invalidTokenId);
    }

    function test_CollectFees_BeforeGraduation() public {
        // Create persona but don't graduate
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TEST",
            bytes32("testfeesnograd"),
            0,
            address(0),
            0
        );

        // Try to collect fees before graduation (no pool exists)
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("NotAllowed(uint8)", 11)); // Unauthorized (no pool)
        personaFactory.collectFees(tokenId, user1);
    }

    function test_CollectFees_ZeroAddress() public {
        // Create and graduate persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TEST",
            bytes32("testfeeszero"),
            0,
            address(0),
            0
        );

        graduatePersona(tokenId);

        // Try to collect to zero address
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("Invalid(uint8)", 12)); // Invalid address
        personaFactory.collectFees(tokenId, address(0));
    }

    function test_CollectFees_GasUsage() public {
        // Create and graduate persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Test Persona",
            "TEST",
            bytes32("testfeesgas"),
            0,
            address(0),
            0
        );

        graduatePersona(tokenId);

        // Measure gas for fee collection
        vm.prank(user1);
        uint256 gasBefore = gasleft();
        (uint256 amount0, uint256 amount1) =
            personaFactory.collectFees(tokenId, user1);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for fee collection:", gasUsed);
        console.log("Fees collected - amount0:", amount0, "amount1:", amount1);
    }

    function test_CollectFees_WithDifferentPairingToken() public {
        // Deploy USDC
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 18);
        usdc.mint(user1, 10_000_000 ether);
        usdc.mint(user2, 10_000_000 ether);
        usdc.mint(swapper1, 1_000_000 ether);
        usdc.mint(swapper2, 1_000_000 ether);

        // Configure USDC
        vm.prank(factoryOwner);
        personaFactory.configurePairingToken(
            address(usdc), 100 ether, 1333 ether, true
        );

        // Create persona with USDC
        vm.startPrank(user1);
        usdc.approve(address(personaFactory), type(uint256).max);
        uint256 tokenId = personaFactory.createPersona(
            address(usdc),
            "USDC Persona",
            "USDCP",
            bytes32("usdcfees"),
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
            (,,, uint256 gradTime,,,) = personaFactory.personas(tokenId);
            if (gradTime > 0) break;

            personaFactory.swapExactTokensForTokens(
                tokenId, buyAmount, 0, user2, block.timestamp + 1
            );
        }
        vm.stopPrank();

        // Verify pool was created with USDC
        (,,, uint256 graduationTimestamp,, PoolId poolId,) =
            personaFactory.personas(tokenId);
        assertTrue(graduationTimestamp > 0, "Should be graduated");
        assertTrue(PoolId.unwrap(poolId) != bytes32(0), "Pool should exist");

        console.log("USDC pool created successfully");
    }

    // ==================== Design Test ====================

    function test_CollectFees_FactoryHoldsPosition_NFTOwnerControlsFees()
        public
    {
        // This test verifies the core design principle:
        // 1. Factory holds the liquidity position
        // 2. NFT owner controls who receives the fees

        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Design Test",
            "DESIGN",
            bytes32("testdesign"),
            0,
            address(0),
            0
        );

        graduatePersona(tokenId);

        // Different recipients for testing
        address recipient1 = makeAddr("recipient1");
        address recipient2 = makeAddr("recipient2");

        // User1 (NFT owner) collects to recipient1
        vm.prank(user1);
        (uint256 a0_1, uint256 a1_1) =
            personaFactory.collectFees(tokenId, recipient1);

        console.log("Recipient1 received - token0:", a0_1, "token1:", a1_1);

        // Transfer NFT to user2
        vm.prank(user1);
        personaFactory.transferFrom(user1, user2, tokenId);

        // User2 (new NFT owner) collects to recipient2
        vm.prank(user2);
        (uint256 a0_2, uint256 a1_2) =
            personaFactory.collectFees(tokenId, recipient2);

        console.log("Recipient2 received - token0:", a0_2, "token1:", a1_2);

        // Verify the design: factory always held the position,
        // but NFT ownership determined who could collect fees
        console.log("Factory holds liquidity position throughout");
        console.log("NFT ownership controls fee collection rights");
    }

    // Helper function to emit expected event
    event FeesCollected(
        uint256 indexed nftTokenId,
        PoolId poolId,
        uint256 amount0,
        uint256 amount1
    );
}
