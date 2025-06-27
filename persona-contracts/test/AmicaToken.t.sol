// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UnsafeUpgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {Fixtures} from "./shared/Fixtures.sol";
import {AmicaToken} from "../src/AmicaToken.sol";

contract AmicaTokenTest is Fixtures {
    // Constants
    uint256 constant TOTAL_SUPPLY = 1_000_000_000 ether;

    // Contracts
    MockERC20 public usdc;
    MockERC20 public weth;
    MockERC20 public dai;

    // Users
    address public owner;

    // Events
    event TokensWithdrawn(address indexed to, uint256 amount);
    event TokensBurnedAndClaimed(
        address indexed user,
        uint256 amountBurned,
        address[] tokens,
        uint256[] amounts
    );

    function setUp() public override {
        super.setUp();

        // Setup users - use factoryOwner as owner for consistency
        owner = factoryOwner;
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");

        // Deploy test tokens
        usdc = new MockERC20("USD Coin", "USDC", 18);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        dai = new MockERC20("Dai Stablecoin", "DAI", 18);

        // Distribute test tokens
        usdc.mint(owner, 1_000_000 ether);
        weth.mint(owner, 10_000 ether);
        dai.mint(owner, 1_000_000 ether);

        usdc.mint(user1, 100_000 ether);
        weth.mint(user1, 1_000 ether);
        dai.mint(user1, 100_000 ether);
    }

    // Deployment Tests
    function test_Deployment_NameAndSymbol() public {
        assertEq(amicaToken.name(), "Amica");
        assertEq(amicaToken.symbol(), "AMICA");
    }

    function test_Deployment_TotalSupply() public {
        assertEq(amicaToken.totalSupply(), TOTAL_SUPPLY);
    }

    function test_Deployment_Owner() public {
        assertEq(amicaToken.owner(), owner);
    }

    function test_Deployment_InitialCirculatingSupply() public {
        uint256 circulatingSupply = amicaToken.circulatingSupply();
        assertEq(circulatingSupply, TOTAL_SUPPLY);
    }

    // Ownership Tests
    function test_Ownership_TransferOwnership() public {
        vm.prank(owner);
        amicaToken.transferOwnership(user1);
        assertEq(amicaToken.owner(), user1);
    }

    function test_Ownership_RevertWhen_NonOwnerTransfers() public {
        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(
                OwnableUpgradeable.OwnableUnauthorizedAccount.selector, user1
            )
        );
        amicaToken.transferOwnership(user2);
    }

    function test_Ownership_RenounceOwnership() public {
        vm.prank(owner);
        amicaToken.renounceOwnership();
        assertEq(amicaToken.owner(), address(0));
    }

    // Withdraw Tests
    function test_Withdraw_Success() public {
        // Transfer tokens to contract
        vm.prank(owner);
        amicaToken.transfer(address(amicaToken), 10_000 ether);

        uint256 withdrawAmount = 5_000 ether;
        uint256 initialBalance = amicaToken.balanceOf(user1);

        vm.expectEmit(true, false, false, true);
        emit TokensWithdrawn(user1, withdrawAmount);

        vm.prank(owner);
        amicaToken.withdraw(user1, withdrawAmount);

        assertEq(amicaToken.balanceOf(user1), initialBalance + withdrawAmount);
    }

    function test_Withdraw_UpdatesCirculatingSupply() public {
        vm.prank(owner);
        amicaToken.transfer(address(amicaToken), 10_000 ether);

        uint256 initialCirculating = amicaToken.circulatingSupply();
        uint256 withdrawAmount = 5_000 ether;

        vm.prank(owner);
        amicaToken.withdraw(user1, withdrawAmount);

        assertEq(
            amicaToken.circulatingSupply(), initialCirculating + withdrawAmount
        );
    }

    function test_Withdraw_RevertWhen_ExceedsBalance() public {
        uint256 contractBalance = amicaToken.balanceOf(address(amicaToken));
        uint256 excessAmount = contractBalance + 1 ether;

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("InsufficientBalance()"));
        amicaToken.withdraw(user1, excessAmount);
    }

    function test_Withdraw_RevertWhen_ZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("InvalidRecipient()"));
        amicaToken.withdraw(address(0), 1_000 ether);
    }

    function test_Withdraw_RevertWhen_NonOwner() public {
        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(
                OwnableUpgradeable.OwnableUnauthorizedAccount.selector, user1
            )
        );
        amicaToken.withdraw(user2, 1_000 ether);
    }

    function test_Withdraw_MultipleWithdrawals() public {
        // Transfer tokens to contract
        vm.prank(owner);
        amicaToken.transfer(address(amicaToken), 10_000 ether);

        uint256 initialUser1Balance = amicaToken.balanceOf(user1);
        uint256 initialUser2Balance = amicaToken.balanceOf(user2);

        vm.startPrank(owner);
        amicaToken.withdraw(user1, 1_000 ether);
        amicaToken.withdraw(user2, 2_000 ether);
        amicaToken.withdraw(user1, 500 ether);
        vm.stopPrank();

        assertEq(amicaToken.balanceOf(user1), initialUser1Balance + 1_500 ether);
        assertEq(amicaToken.balanceOf(user2), initialUser2Balance + 2_000 ether);
    }

    // Burn and Claim Tests
    function test_BurnAndClaim_Success() public {
        // Setup by sending tokens directly to contract
        _setupTokenBalances();

        uint256 userBalance = amicaToken.balanceOf(user1);
        uint256 burnAmount = 1_000 ether;
        uint256 circulatingSupply = amicaToken.circulatingSupply();

        // Calculate expected amounts
        uint256 expectedUsdc = (100_000 ether * burnAmount) / circulatingSupply;
        uint256 expectedWeth = (1_000 ether * burnAmount) / circulatingSupply;
        uint256 expectedDai = (500_000 ether * burnAmount) / circulatingSupply;

        address[] memory tokens = new address[](3);
        tokens[0] = address(usdc);
        tokens[1] = address(weth);
        tokens[2] = address(dai);

        vm.expectEmit(true, false, false, false);
        emit TokensBurnedAndClaimed(
            user1, burnAmount, new address[](0), new uint256[](0)
        );

        vm.prank(user1);
        amicaToken.burnAndClaim(burnAmount, tokens);

        // Check token balances
        assertApproxEqAbs(
            usdc.balanceOf(user1), 100_000 ether + expectedUsdc, 0.01 ether
        );
        assertApproxEqAbs(
            weth.balanceOf(user1), 1_000 ether + expectedWeth, 0.001 ether
        );
        assertApproxEqAbs(
            dai.balanceOf(user1), 100_000 ether + expectedDai, 0.01 ether
        );

        // Check AMICA balance
        assertEq(amicaToken.balanceOf(user1), userBalance - burnAmount);
    }

    function test_BurnAndClaim_SpecificTokensOnly() public {
        _setupTokenBalances();

        uint256 burnAmount = 500 ether;
        uint256 initialUsdcBalance = usdc.balanceOf(user1);
        uint256 initialWethBalance = weth.balanceOf(user1);
        uint256 initialDaiBalance = dai.balanceOf(user1);

        // Only claim USDC and WETH
        address[] memory tokens = new address[](2);
        tokens[0] = address(usdc);
        tokens[1] = address(weth);

        vm.prank(user1);
        amicaToken.burnAndClaim(burnAmount, tokens);

        // Should receive USDC and WETH
        assertGt(usdc.balanceOf(user1), initialUsdcBalance);
        assertGt(weth.balanceOf(user1), initialWethBalance);

        // Should NOT receive DAI
        assertEq(dai.balanceOf(user1), initialDaiBalance);
    }

    function test_BurnAndClaim_UpdatesCirculatingSupply() public {
        _setupTokenBalances();

        uint256 initialCirculating = amicaToken.circulatingSupply();
        uint256 burnAmount = 1_000 ether;

        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);

        vm.prank(user1);
        amicaToken.burnAndClaim(burnAmount, tokens);

        assertEq(
            amicaToken.circulatingSupply(), initialCirculating - burnAmount
        );
    }

    function test_BurnAndClaim_RevertWhen_NoTokensSelected() public {
        _setupTokenBalances();

        address[] memory emptyTokens = new address[](0);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("NoTokensSelected()"));
        amicaToken.burnAndClaim(1_000 ether, emptyTokens);
    }

    function test_BurnAndClaim_RevertWhen_ZeroAmount() public {
        _setupTokenBalances();

        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("InvalidBurnAmount()"));
        amicaToken.burnAndClaim(0, tokens);
    }

    function test_BurnAndClaim_RevertWhen_ExceedsBalance() public {
        _setupTokenBalances();

        uint256 userBalance = amicaToken.balanceOf(user1);
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);

        vm.prank(user1);
        vm.expectRevert();
        amicaToken.burnAndClaim(userBalance + 1, tokens);
    }

    function test_BurnAndClaim_RevertWhen_InvalidTokenAddress() public {
        _setupTokenBalances();

        address[] memory tokens = new address[](1);
        tokens[0] = address(0);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("InvalidTokenAddress()"));
        amicaToken.burnAndClaim(1_000 ether, tokens);
    }

    function test_BurnAndClaim_RevertWhen_ClaimingAmica() public {
        _setupTokenBalances();

        address[] memory tokens = new address[](1);
        tokens[0] = address(amicaToken);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("CannotClaimAmica()"));
        amicaToken.burnAndClaim(1_000 ether, tokens);
    }

    // Vulnerability Test - Duplicate Token Addresses
    function test_BurnAndClaim_RevertWhen_DuplicateTokens() public {
        _setupTokenBalances();

        uint256 burnAmount = 1_000 ether;

        // Try to claim the same token multiple times
        address[] memory duplicateTokens = new address[](3);
        duplicateTokens[0] = address(usdc);
        duplicateTokens[1] = address(usdc);
        duplicateTokens[2] = address(usdc);

        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSignature("TokensMustBeSortedAndUnique()")
        );
        amicaToken.burnAndClaim(burnAmount, duplicateTokens);
    }

    function test_BurnAndClaim_RevertWhen_UnsortedTokens() public {
        _setupTokenBalances();

        uint256 burnAmount = 1_000 ether;

        // Try unsorted tokens
        address[] memory unsortedTokens = new address[](2);
        unsortedTokens[0] = address(weth);
        unsortedTokens[1] = address(usdc);

        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSignature("TokensMustBeSortedAndUnique()")
        );
        amicaToken.burnAndClaim(burnAmount, unsortedTokens);
    }

    function test_BurnAndClaim_AllowsSortedUniqueTokens() public {
        _setupTokenBalances();

        uint256 burnAmount = 1_000 ether;

        // Properly sorted, unique tokens should work
        address[] memory validTokens = new address[](2);
        // Sort by address value (dai < usdc in our case)
        if (uint160(address(dai)) < uint160(address(usdc))) {
            validTokens[0] = address(dai);
            validTokens[1] = address(usdc);
        } else {
            validTokens[0] = address(usdc);
            validTokens[1] = address(dai);
        }

        vm.prank(user1);
        amicaToken.burnAndClaim(burnAmount, validTokens);

        // Verify both tokens were claimed
        assertGt(usdc.balanceOf(user1), 100_000 ether);
        assertGt(dai.balanceOf(user1), 100_000 ether);
    }

    function test_BurnAndClaim_LowCirculatingSupply() public {
        _setupTokenBalances();

        // Get actual balances
        uint256 ownerBalance = amicaToken.balanceOf(owner);
        uint256 user1Balance = amicaToken.balanceOf(user1);
        uint256 user2Balance = amicaToken.balanceOf(user2);
        uint256 user3Balance = amicaToken.balanceOf(user3);
        uint256 testContractBalance = amicaToken.balanceOf(address(this));

        // Transfer most tokens back to contract to reduce circulating supply
        vm.prank(owner);
        amicaToken.transfer(address(amicaToken), ownerBalance - 1_000_000 ether);

        vm.prank(user2);
        amicaToken.transfer(address(amicaToken), user2Balance);

        vm.prank(user3);
        amicaToken.transfer(address(amicaToken), user3Balance);

        amicaToken.transfer(address(amicaToken), testContractBalance);

        uint256 lowCirculating = amicaToken.circulatingSupply();
        assertLt(lowCirculating, 12_000_000 ether);
        assertGt(lowCirculating, 10_000_000 ether);

        // User1 burns half their tokens
        uint256 burnAmount = user1Balance / 2;
        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);

        vm.prank(user1);
        amicaToken.burnAndClaim(burnAmount, tokens);

        // Should receive proportional share based on the low circulating supply
        uint256 expectedUsdc = (100_000 ether * burnAmount) / lowCirculating;

        assertApproxEqAbs(
            usdc.balanceOf(user1), 100_000 ether + expectedUsdc, 1 ether
        );
    }

    function test_BurnAndClaim_NoTokenBalance() public {
        // Send a token to contract that has 0 balance
        MockERC20 emptyToken = new MockERC20("Empty", "EMPTY", 18);

        address[] memory tokens = new address[](1);
        tokens[0] = address(emptyToken);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("NoTokensToClaim()"));
        amicaToken.burnAndClaim(1_000 ether, tokens);
    }

    function test_PreviewBurnAndClaim_Success() public {
        _setupTokenBalances();

        uint256 burnAmount = 1_000 ether;
        uint256 circulatingSupply = amicaToken.circulatingSupply();

        address[] memory tokens = new address[](3);
        tokens[0] = address(usdc);
        tokens[1] = address(weth);
        tokens[2] = address(dai);

        uint256[] memory amounts =
            amicaToken.previewBurnAndClaim(burnAmount, tokens);

        // Calculate expected amounts
        uint256 expectedUsdc = (100_000 ether * burnAmount) / circulatingSupply;
        uint256 expectedWeth = (1_000 ether * burnAmount) / circulatingSupply;
        uint256 expectedDai = (500_000 ether * burnAmount) / circulatingSupply;

        assertEq(amounts[0], expectedUsdc);
        assertEq(amounts[1], expectedWeth);
        assertEq(amounts[2], expectedDai);
    }

    function test_PreviewBurnAndClaim_ZeroAmount() public {
        _setupTokenBalances();

        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);

        uint256[] memory amounts = amicaToken.previewBurnAndClaim(0, tokens);
        assertEq(amounts[0], 0);
    }

    function test_PreviewBurnAndClaim_ZeroCirculatingSupply() public {
        // Transfer all tokens to contract
        vm.prank(owner);
        amicaToken.transfer(address(amicaToken), amicaToken.balanceOf(owner));

        // Other users also transfer
        vm.prank(user1);
        amicaToken.transfer(address(amicaToken), amicaToken.balanceOf(user1));
        vm.prank(user2);
        amicaToken.transfer(address(amicaToken), amicaToken.balanceOf(user2));
        vm.prank(user3);
        amicaToken.transfer(address(amicaToken), amicaToken.balanceOf(user3));

        // Transfer test contract balance
        amicaToken.transfer(
            address(amicaToken), amicaToken.balanceOf(address(this))
        );

        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);

        uint256[] memory amounts =
            amicaToken.previewBurnAndClaim(1_000 ether, tokens);
        assertEq(amounts.length, 1);
        assertEq(amounts[0], 0);
    }

    function test_PreviewBurnAndClaim_SkipsAmicaToken() public {
        _setupTokenBalances();

        address[] memory tokens = new address[](2);
        tokens[0] = address(amicaToken);
        tokens[1] = address(usdc);

        uint256[] memory amounts =
            amicaToken.previewBurnAndClaim(1_000 ether, tokens);

        // First should be 0 (AMICA skipped)
        assertEq(amounts[0], 0);
        // Second should have value
        assertGt(amounts[1], 0);
    }

    // Helper functions
    function _setupTokenBalances() internal {
        // Send tokens directly to contract (simulating balance-based approach)
        vm.startPrank(owner);
        usdc.transfer(address(amicaToken), 100_000 ether);
        weth.transfer(address(amicaToken), 1_000 ether);
        dai.transfer(address(amicaToken), 500_000 ether);
        vm.stopPrank();
    }

    // Fuzz Tests
    function testFuzz_Withdraw_AnyValidAmount(uint256 amount) public {
        // Transfer some tokens to contract first
        uint256 contractFunds = 100_000 ether;
        vm.prank(owner);
        amicaToken.transfer(address(amicaToken), contractFunds);

        // Bound the amount to valid range
        amount = bound(amount, 1, contractFunds);

        uint256 initialBalance = amicaToken.balanceOf(user1);

        vm.prank(owner);
        amicaToken.withdraw(user1, amount);

        assertEq(amicaToken.balanceOf(user1), initialBalance + amount);
    }

    function testFuzz_BurnAndClaim_ProportionalRewards(uint256 burnAmount)
        public
    {
        _setupTokenBalances();

        uint256 userBalance = amicaToken.balanceOf(user1);
        burnAmount = bound(burnAmount, 1, userBalance);

        uint256 circulatingSupply = amicaToken.circulatingSupply();
        uint256 usdcBalance = usdc.balanceOf(address(amicaToken));

        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);

        // Calculate expected amount
        uint256 expectedUsdc = (usdcBalance * burnAmount) / circulatingSupply;

        // If the expected amount rounds to 0, the contract will revert
        if (expectedUsdc == 0) {
            vm.expectRevert(abi.encodeWithSignature("NoTokensToClaim()"));
            vm.prank(user1);
            amicaToken.burnAndClaim(burnAmount, tokens);
        } else {
            uint256 initialUsdcBalance = usdc.balanceOf(user1);

            vm.prank(user1);
            amicaToken.burnAndClaim(burnAmount, tokens);

            // Use a reasonable tolerance - 0.1% of expected amount
            uint256 tolerance = expectedUsdc / 1000;
            if (tolerance == 0) tolerance = 1;

            assertApproxEqAbs(
                usdc.balanceOf(user1),
                initialUsdcBalance + expectedUsdc,
                tolerance
            );
        }
    }

    function testFuzz_PreviewMatchesActualClaim(uint256 burnAmount) public {
        _setupTokenBalances();

        uint256 userBalance = amicaToken.balanceOf(user1);
        burnAmount = bound(burnAmount, 1, userBalance);

        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);

        // Get preview
        uint256[] memory previewAmounts =
            amicaToken.previewBurnAndClaim(burnAmount, tokens);

        if (previewAmounts[0] > 0) {
            uint256 initialBalance = usdc.balanceOf(user1);

            // Perform actual burn and claim
            vm.prank(user1);
            amicaToken.burnAndClaim(burnAmount, tokens);

            uint256 actualReceived = usdc.balanceOf(user1) - initialBalance;

            // Preview should match actual (allowing for rounding)
            assertApproxEqAbs(actualReceived, previewAmounts[0], 1);
        }
    }
}
