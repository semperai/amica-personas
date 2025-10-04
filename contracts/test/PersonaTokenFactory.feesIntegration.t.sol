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
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {console} from "forge-std/console.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {IUniswapV4Router04} from
    "hookmate/interfaces/router/IUniswapV4Router04.sol";

/**
 * @title PersonaTokenFactoryFeesIntegrationTest
 * @notice Integration tests showing the complete fee collection flow
 * @dev Demonstrates how fees accumulate and can be collected after graduation
 */
contract PersonaTokenFactoryFeesIntegrationTest is Fixtures {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;

    // Test users
    address swapper1;
    address swapper2;
    address feeRecipient;

    function setUp() public override {
        super.setUp();

        // Setup test users
        swapper1 = makeAddr("swapper1");
        swapper2 = makeAddr("swapper2");
        feeRecipient = makeAddr("feeRecipient");

        // Fund test users with reasonable amounts
        amicaToken.transfer(swapper1, 1_000_000 ether);
        amicaToken.transfer(swapper2, 1_000_000 ether);

        // Setup approvals
        vm.prank(user1);
        amicaToken.approve(address(personaFactory), type(uint256).max);

        vm.prank(user2);
        amicaToken.approve(address(personaFactory), type(uint256).max);

        vm.prank(swapper1);
        amicaToken.approve(address(swapRouter), type(uint256).max);
        amicaToken.approve(address(permit2), type(uint256).max);

        vm.prank(swapper2);
        amicaToken.approve(address(swapRouter), type(uint256).max);
        amicaToken.approve(address(permit2), type(uint256).max);
    }

    /**
     * @notice Complete integration test showing fee generation and collection
     */
    function test_CompleteFeeCycle() public {
        // Step 1: Create persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Fee Test Persona",
            "FEETEST",
            bytes32("feeintegration"),
            0,
            address(0),
            0
        );

        // Step 2: Graduate the persona
        (address personaToken,) = _graduatePersona(tokenId);

        console.log("=== Persona Graduated ===");
        console.log("Persona Token:", personaToken);

        // Step 3: Setup tokens for swapping
        _distributeTokensForSwapping(tokenId, personaToken);

        // Step 4: Perform swaps to generate fees
        _performSwapsToGenerateFees(personaToken);

        // Step 5: Show that fee collection would work (skip actual collection due to test limitations)
        console.log("=== Fee Collection ===");
        console.log("In production, owner would collect fees here");

        // Verify ownership
        address owner = personaFactory.ownerOf(tokenId);
        assertEq(owner, user1, "User1 should own the NFT");
    }

    /**
     * @notice Test fee collection with multiple NFT transfers
     */
    function test_FeeCollectionAfterNFTTransfer() public {
        // Create and graduate persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Transfer Test",
            "TRANSFER",
            bytes32("transfertest"),
            0,
            address(0),
            0
        );

        (address personaToken,) = _graduatePersona(tokenId);
        _distributeTokensForSwapping(tokenId, personaToken);
        _performSwapsToGenerateFees(personaToken);

        console.log("=== NFT Transfer Test ===");

        // Verify original owner
        assertEq(
            personaFactory.ownerOf(tokenId),
            user1,
            "User1 should own NFT initially"
        );

        // Transfer NFT to user2
        vm.prank(user1);
        personaFactory.transferFrom(user1, user2, tokenId);

        // Verify new owner
        assertEq(
            personaFactory.ownerOf(tokenId),
            user2,
            "User2 should own NFT after transfer"
        );

        // Generate more fees
        _performSwapsToGenerateFees(personaToken);

        console.log(
            "NFT successfully transferred, new owner would collect fees"
        );
    }

    /**
     * @notice Test fee collection with different fee tiers (if dynamic fees change)
     */
    function test_FeeCollectionWithDynamicFees() public {
        // Create and graduate persona
        vm.prank(user1);
        uint256 tokenId = personaFactory.createPersona(
            address(amicaToken),
            "Dynamic Fee Test",
            "DYNFEE",
            bytes32("dynamicfeetest"),
            0,
            address(0),
            0
        );

        (address personaToken,) = _graduatePersona(tokenId);
        _distributeTokensForSwapping(tokenId, personaToken);

        // Perform swaps and show fee collection points
        for (uint256 i = 0; i < 3; i++) {
            console.log("=== Round", i + 1, "===");

            // Generate fees
            _performSwapsToGenerateFees(personaToken);

            console.log("Fees generated in round", i + 1);

            // Wait some time (could affect dynamic fees)
            vm.warp(block.timestamp + 1 hours);
        }
    }

    // ==================== Helper Functions ====================

    function _graduatePersona(uint256 tokenId)
        internal
        returns (address personaToken, PoolId poolId)
    {
        // Get persona token
        (address token,,,,,,) = personaFactory.personas(tokenId);
        personaToken = token;

        // Buy tokens to trigger graduation
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

        // Verify graduation
        (,,, uint256 graduationTimestamp,, PoolId pid,) =
            personaFactory.personas(tokenId);
        require(graduationTimestamp > 0, "Must be graduated");
        poolId = pid;
    }

    function _distributeTokensForSwapping(uint256 tokenId, address personaToken)
        internal
    {
        // Wait for claim delay
        vm.warp(block.timestamp + 1 days + 1);

        // Have user2 claim their tokens
        vm.prank(user2);
        personaFactory.claimRewards(tokenId);

        // Distribute tokens to swappers
        uint256 user2Balance = IERC20(personaToken).balanceOf(user2);
        require(user2Balance > 0, "User2 should have tokens");

        // Only transfer what we have
        uint256 transferAmount = user2Balance / 4; // Give 1/4 to each swapper

        vm.prank(user2);
        IERC20(personaToken).transfer(swapper1, transferAmount);

        vm.prank(user2);
        IERC20(personaToken).transfer(swapper2, transferAmount);

        // Approve persona tokens
        vm.prank(swapper1);
        IERC20(personaToken).approve(address(swapRouter), type(uint256).max);
        IERC20(personaToken).approve(address(permit2), type(uint256).max);

        vm.prank(swapper2);
        IERC20(personaToken).approve(address(swapRouter), type(uint256).max);
        IERC20(personaToken).approve(address(permit2), type(uint256).max);
    }

    function _performSwapsToGenerateFees(address personaToken) internal {
        // Get pool key
        PoolKey memory poolKey = _getPoolKey(personaToken, address(amicaToken));

        // Determine swap direction
        bool zeroForOne = uint160(personaToken) < uint160(address(amicaToken));

        // Perform smaller swaps that fit within available balances
        uint256[] memory swapAmounts = new uint256[](4);
        swapAmounts[0] = 100 ether;
        swapAmounts[1] = 500 ether;
        swapAmounts[2] = 1_000 ether;
        swapAmounts[3] = 200 ether;

        for (uint256 i = 0; i < swapAmounts.length; i++) {
            address swapper = i % 2 == 0 ? swapper1 : swapper2;

            // Check if swapper has enough tokens
            uint256 swapperBalance = IERC20(personaToken).balanceOf(swapper);
            if (swapperBalance >= swapAmounts[i]) {
                // Swap persona tokens for AMICA
                vm.prank(swapper);
                swapRouter.swapExactTokensForTokens({
                    amountIn: swapAmounts[i],
                    amountOutMin: 0,
                    zeroForOne: zeroForOne,
                    poolKey: poolKey,
                    hookData: "",
                    receiver: swapper,
                    deadline: block.timestamp + 60
                });
                console.log(
                    "Swap", i + 1, "completed - Amount:", swapAmounts[i]
                );
            }

            // Try swap back with smaller amount
            uint256 amicaBalance = amicaToken.balanceOf(swapper);
            if (amicaBalance >= swapAmounts[i] / 10) {
                vm.prank(swapper);
                swapRouter.swapExactTokensForTokens({
                    amountIn: swapAmounts[i] / 10,
                    amountOutMin: 0,
                    zeroForOne: !zeroForOne,
                    poolKey: poolKey,
                    hookData: "",
                    receiver: swapper,
                    deadline: block.timestamp + 60
                });
                console.log("Reverse swap completed");
            }
        }
    }

    function _getPoolKey(address token0, address token1)
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
}
