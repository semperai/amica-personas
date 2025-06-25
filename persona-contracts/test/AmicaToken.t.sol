// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UnsafeUpgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {Fixtures} from "./shared/Fixtures.sol";
import "../src/AmicaToken.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";

contract AmicaTokenTest is Fixtures {
    // Constants
    uint256 constant TOTAL_SUPPLY = 1_000_000_000 ether;
    uint256 constant PRECISION = 1 ether;
    
    // Contracts
    MockERC20 public usdc;
    MockERC20 public weth;
    MockERC20 public dai;
    
    // Users
    address public owner;
    
    // Events
    event TokensWithdrawn(address indexed recipient, uint256 amount);
    event TokensDeposited(address indexed depositor, address indexed token, uint256 amount);
    event TokensBurnedAndClaimed(
        address indexed user,
        uint256 amountBurned,
        address[] tokens,
        uint256[] amounts
    );
    event TokensRecovered(address indexed recipient, address indexed token, uint256 amount);
    
    function setUp() public override {
        super.setUp();

        // Setup users
        owner = makeAddr("owner");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        
        // Deploy test tokens
        usdc = new MockERC20("USD Coin", "USDC", 18);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);
        dai = new MockERC20("Dai Stablecoin", "DAI",18);
        
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
        
        uint256 ownerBalance = amicaToken.balanceOf(owner);
        uint256 userBalances = 40_000 ether; // 4 users * 10000
        assertEq(ownerBalance, TOTAL_SUPPLY - userBalances);
    }
    
    function test_Deployment_Owner() public {
        assertEq(amicaToken.owner(), owner);
    }
    
    function test_Deployment_EmptyDepositedTokensList() public {
        address[] memory tokens = amicaToken.getDepositedTokens();
        assertEq(tokens.length, 1);
        assertEq(tokens[0], address(0));
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
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, user1));
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
        
        assertEq(amicaToken.circulatingSupply(), initialCirculating + withdrawAmount);
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
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, user1));
        amicaToken.withdraw(user2, 1_000 ether);
    }
    
    function test_Withdraw_MultipleWithdrawals() public {
        // Transfer tokens to contract
        vm.prank(owner);
        amicaToken.transfer(address(amicaToken), 10_000 ether);
        
        vm.startPrank(owner);
        amicaToken.withdraw(user1, 1_000 ether);
        amicaToken.withdraw(user2, 2_000 ether);
        amicaToken.withdraw(user1, 500 ether);
        vm.stopPrank();
        
        assertEq(amicaToken.balanceOf(user1), 11_500 ether);
        assertEq(amicaToken.balanceOf(user2), 12_000 ether);
    }
    
    // Token Deposit Tests
    function test_Deposit_ERC20Token() public {
        uint256 depositAmount = 1_000 ether;
        
        vm.startPrank(owner);
        usdc.approve(address(amicaToken), depositAmount);
        
        vm.expectEmit(true, true, false, true);
        emit TokensDeposited(owner, address(usdc), depositAmount);
        
        amicaToken.deposit(address(usdc), depositAmount);
        vm.stopPrank();
        
        assertEq(amicaToken.depositedBalances(address(usdc)), depositAmount);
        assertEq(amicaToken.tokenIndex(address(usdc)), 1);
    }
    
    function test_Deposit_AddsNewTokensToList() public {
        vm.startPrank(owner);
        usdc.approve(address(amicaToken), 1_000 ether);
        weth.approve(address(amicaToken), 10 ether);
        dai.approve(address(amicaToken), 5_000 ether);
        
        amicaToken.deposit(address(usdc), 1_000 ether);
        amicaToken.deposit(address(weth), 10 ether);
        amicaToken.deposit(address(dai), 5_000 ether);
        vm.stopPrank();
        
        address[] memory depositedTokens = amicaToken.getDepositedTokens();
        assertEq(depositedTokens.length, 4); // Including index 0
        assertEq(depositedTokens[1], address(usdc));
        assertEq(depositedTokens[2], address(weth));
        assertEq(depositedTokens[3], address(dai));
    }
    
    function test_Deposit_MultipleDepositsOfSameToken() public {
        // First deposit
        vm.startPrank(owner);
        usdc.approve(address(amicaToken), 1_000 ether);
        amicaToken.deposit(address(usdc), 1_000 ether);
        
        // Second deposit from same user
        usdc.approve(address(amicaToken), 500 ether);
        amicaToken.deposit(address(usdc), 500 ether);
        vm.stopPrank();
        
        // Third deposit from different user
        vm.startPrank(user1);
        usdc.approve(address(amicaToken), 2_000 ether);
        amicaToken.deposit(address(usdc), 2_000 ether);
        vm.stopPrank();
        
        assertEq(amicaToken.depositedBalances(address(usdc)), 3_500 ether);
        assertEq(amicaToken.tokenIndex(address(usdc)), 1);
        
        // Should not add duplicate tokens to list
        address[] memory depositedTokens = amicaToken.getDepositedTokens();
        assertEq(depositedTokens.length, 2); // Only index 0 and USDC
    }
    
    function test_Deposit_RevertWhen_ZeroAmount() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("InvalidAmount()"));
        amicaToken.deposit(address(usdc), 0);
    }
    
    function test_Deposit_RevertWhen_ZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("InvalidToken()"));
        amicaToken.deposit(address(0), 1_000 ether);
    }
    
    function test_Deposit_RevertWhen_NoApproval() public {
        vm.prank(owner);
        vm.expectRevert();
        amicaToken.deposit(address(usdc), 1_000 ether);
    }
    
    function test_Deposit_TokensWithDifferentDecimals() public {
        // Deploy a 6-decimal token (like USDC on mainnet)
        MockERC20 sixDecimalToken = new MockERC20("Six Decimal", "SIX", 6);
        sixDecimalToken.mint(owner, 1_000_000e6);
        
        uint256 depositAmount = 1_000e6;
        
        sixDecimalToken.mint(owner, depositAmount);
        
        vm.startPrank(owner);
        sixDecimalToken.approve(address(amicaToken), depositAmount);
        amicaToken.deposit(address(sixDecimalToken), depositAmount);
        vm.stopPrank();
        
        assertEq(amicaToken.depositedBalances(address(sixDecimalToken)), depositAmount);
    }
    
    // Burn and Claim Tests
    function test_BurnAndClaim_Success() public {
        // Setup deposits
        _setupDeposits();
        
        uint256 userBalance = amicaToken.balanceOf(user1);
        uint256 burnAmount = 1_000 ether;
        uint256 circulatingSupply = amicaToken.circulatingSupply();
        
        // Calculate expected amounts
        uint256 sharePercentage = (burnAmount * PRECISION) / circulatingSupply;
        uint256 expectedUsdc = (100_000 ether * sharePercentage) / PRECISION;
        uint256 expectedWeth = (1_000 ether * sharePercentage) / PRECISION;
        uint256 expectedDai = (500_000 ether * sharePercentage) / PRECISION;
        
        uint256[] memory tokenIndexes = new uint256[](3);
        tokenIndexes[0] = 1;
        tokenIndexes[1] = 2;
        tokenIndexes[2] = 3;
        
        vm.expectEmit(true, false, false, false);
        emit TokensBurnedAndClaimed(user1, burnAmount, new address[](0), new uint256[](0));
        
        vm.prank(user1);
        amicaToken.burnAndClaim(burnAmount, tokenIndexes);
        
        // Check token balances (with small tolerance for rounding)
        assertApproxEqAbs(usdc.balanceOf(user1), 100_000 ether + expectedUsdc, 0.01 ether);
        assertApproxEqAbs(weth.balanceOf(user1), 1_000 ether + expectedWeth, 0.001 ether);
        assertApproxEqAbs(dai.balanceOf(user1), 100_000 ether + expectedDai, 0.01 ether);
        
        // Check AMICA balance
        assertEq(amicaToken.balanceOf(user1), userBalance - burnAmount);
    }
    
    function test_BurnAndClaim_SpecificTokensOnly() public {
        _setupDeposits();
        
        uint256 burnAmount = 500 ether;
        uint256 initialUsdcBalance = usdc.balanceOf(user1);
        uint256 initialWethBalance = weth.balanceOf(user1);
        uint256 initialDaiBalance = dai.balanceOf(user1);
        
        // Only claim USDC and WETH (indices 1 and 2)
        uint256[] memory tokenIndexes = new uint256[](2);
        tokenIndexes[0] = 1;
        tokenIndexes[1] = 2;
        
        vm.prank(user1);
        amicaToken.burnAndClaim(burnAmount, tokenIndexes);
        
        // Should receive USDC and WETH
        assertGt(usdc.balanceOf(user1), initialUsdcBalance);
        assertGt(weth.balanceOf(user1), initialWethBalance);
        
        // Should NOT receive DAI
        assertEq(dai.balanceOf(user1), initialDaiBalance);
    }
    
    function test_BurnAndClaim_UpdatesCirculatingSupply() public {
        _setupDeposits();
        
        uint256 initialCirculating = amicaToken.circulatingSupply();
        uint256 burnAmount = 1_000 ether;
        
        uint256[] memory tokenIndexes = new uint256[](1);
        tokenIndexes[0] = 1;
        
        vm.prank(user1);
        amicaToken.burnAndClaim(burnAmount, tokenIndexes);
        
        assertEq(amicaToken.circulatingSupply(), initialCirculating - burnAmount);
    }
    
    function test_BurnAndClaim_RevertWhen_NoTokensSelected() public {
        _setupDeposits();
        
        uint256[] memory emptyIndexes = new uint256[](0);
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("NoTokensSelected()"));
        amicaToken.burnAndClaim(1_000 ether, emptyIndexes);
    }
    
    function test_BurnAndClaim_RevertWhen_ZeroAmount() public {
        _setupDeposits();
        
        uint256[] memory tokenIndexes = new uint256[](1);
        tokenIndexes[0] = 1;
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("InvalidBurnAmount()"));
        amicaToken.burnAndClaim(0, tokenIndexes);
    }
    
    function test_BurnAndClaim_RevertWhen_ExceedsBalance() public {
        _setupDeposits();
        
        uint256 userBalance = amicaToken.balanceOf(user1);
        uint256[] memory tokenIndexes = new uint256[](1);
        tokenIndexes[0] = 1;
        
        vm.prank(user1);
        vm.expectRevert();
        amicaToken.burnAndClaim(userBalance + 1, tokenIndexes);
    }
    
    function test_BurnAndClaim_RevertWhen_InvalidTokenIndex() public {
        _setupDeposits();
        
        uint256[] memory tokenIndexes = new uint256[](1);
        tokenIndexes[0] = 999;
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("InvalidTokenIndex()"));
        amicaToken.burnAndClaim(1_000 ether, tokenIndexes);
    }
    
    // Vulnerability Test - Duplicate Token Indexes
    function test_BurnAndClaim_RevertWhen_DuplicateIndexes() public {
        _setupDeposits();
        
        uint256 burnAmount = 1_000 ether;
        
        // Try to claim the same token multiple times
        uint256[] memory duplicateIndexes = new uint256[](3);
        duplicateIndexes[0] = 1;
        duplicateIndexes[1] = 1;
        duplicateIndexes[2] = 1;
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("TokenIndexesMustBeSortedAndUnique()"));
        amicaToken.burnAndClaim(burnAmount, duplicateIndexes);
    }
    
    function test_BurnAndClaim_RevertWhen_UnsortedIndexes() public {
        _setupDeposits();
        
        uint256 burnAmount = 1_000 ether;
        
        // Try unsorted indexes
        uint256[] memory unsortedIndexes = new uint256[](2);
        unsortedIndexes[0] = 2;
        unsortedIndexes[1] = 1;
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSignature("TokenIndexesMustBeSortedAndUnique()"));
        amicaToken.burnAndClaim(burnAmount, unsortedIndexes);
    }
    
    function test_BurnAndClaim_AllowsSortedUniqueIndexes() public {
        _setupDeposits();
        
        uint256 burnAmount = 1_000 ether;
        
        // Properly sorted, unique indexes should work
        uint256[] memory validIndexes = new uint256[](2);
        validIndexes[0] = 1;
        validIndexes[1] = 2;
        
        vm.prank(user1);
        amicaToken.burnAndClaim(burnAmount, validIndexes);
        
        // Verify both tokens were claimed
        assertGt(usdc.balanceOf(user1), 100_000 ether);
        assertGt(weth.balanceOf(user1), 1_000 ether);
    }
    
    function test_BurnAndClaim_LowCirculatingSupply() public {
        _setupDeposits();
        
        // Get actual balances
        uint256 ownerBalance = amicaToken.balanceOf(owner);
        uint256 user2Balance = amicaToken.balanceOf(user2);
        uint256 user3Balance = amicaToken.balanceOf(user3);
        
        // Transfer most tokens back to contract to reduce circulating supply
        // Owner keeps only 1M tokens
        uint256 ownerKeeps = 1_000_000 ether;
        if (ownerBalance > ownerKeeps) {
            vm.prank(owner);
            amicaToken.transfer(address(amicaToken), ownerBalance - ownerKeeps);
        }
        
        // Other users transfer all their tokens
        vm.prank(user2);
        amicaToken.transfer(address(amicaToken), user2Balance);
        
        vm.prank(user3);
        amicaToken.transfer(address(amicaToken), user3Balance);
        
        uint256 lowCirculating = amicaToken.circulatingSupply();
        assertLt(lowCirculating, 10_000_000 ether);
        
        // User1 burns half their tokens
        uint256 user1Balance = amicaToken.balanceOf(user1);
        uint256 burnAmount = user1Balance / 2;
        uint256[] memory tokenIndexes = new uint256[](1);
        tokenIndexes[0] = 1;
        
        vm.prank(user1);
        amicaToken.burnAndClaim(burnAmount, tokenIndexes);
        
        // Should receive proportional share based on the low circulating supply
        uint256 sharePercentage = (burnAmount * PRECISION) / lowCirculating;
        uint256 expectedUsdc = (100_000 ether * sharePercentage) / PRECISION;
        
        assertApproxEqAbs(usdc.balanceOf(user1), 100_000 ether + expectedUsdc, 1 ether);
    }
    
    function test_RecoverToken_Success() public {
        // Get initial balance before any transfers
        uint256 initialOwnerBalance = usdc.balanceOf(owner);
        
        // Send tokens directly to contract (simulating accidental transfer)
        uint256 accidentalAmount = 5_000 ether;
        vm.prank(owner);
        usdc.mint(address(amicaToken), accidentalAmount);
        
        // After transfer, owner balance is reduced
        uint256 balanceAfterTransfer = usdc.balanceOf(owner);
        assertEq(balanceAfterTransfer, initialOwnerBalance - accidentalAmount);
        
        vm.expectEmit(true, true, false, true);
        emit TokensRecovered(owner, address(usdc), accidentalAmount);
        
        vm.prank(owner);
        amicaToken.recoverToken(address(usdc), owner);
        
        // Owner should have their initial balance back
        assertEq(usdc.balanceOf(owner), initialOwnerBalance);
    }
    
    function test_RecoverToken_PartialAmountWithDeposited() public {
        // First deposit some tokens properly
        uint256 depositAmount = 2_000 ether;
        vm.startPrank(owner);
        usdc.approve(address(amicaToken), depositAmount);
        amicaToken.deposit(address(usdc), depositAmount);
        vm.stopPrank();
        
        // Then send some accidentally
        uint256 accidentalAmount = 3_000 ether;
        usdc.mint(address(amicaToken), accidentalAmount);
        
        vm.expectEmit(true, true, false, true);
        emit TokensRecovered(owner, address(usdc), accidentalAmount);
        
        vm.prank(owner);
        amicaToken.recoverToken(address(usdc), owner);
        
        // Deposited balance should remain unchanged
        assertEq(amicaToken.depositedBalances(address(usdc)), depositAmount);
    }
    
    function test_RecoverToken_RevertWhen_NoExcessTokens() public {
        // Only deposit tokens (no accidental transfer)
        uint256 depositAmount = 1_000 ether;
        vm.startPrank(owner);
        usdc.approve(address(amicaToken), depositAmount);
        amicaToken.deposit(address(usdc), depositAmount);
        
        vm.expectRevert(abi.encodeWithSignature("NoTokensToRecover()"));
        amicaToken.recoverToken(address(usdc), owner);
        vm.stopPrank();
    }
    
    function test_RecoverToken_RevertWhen_RecoveringAmica() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("CannotRecoverAmica()"));
        amicaToken.recoverToken(address(amicaToken), owner);
    }
    
    function test_RecoverToken_RevertWhen_ZeroAddress() public {
        usdc.mint(address(amicaToken), 1_000 ether);
        
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("InvalidRecipient()"));
        amicaToken.recoverToken(address(usdc), address(0));
    }
    
    function test_RecoverToken_RevertWhen_NonOwner() public {
        usdc.mint(address(amicaToken), 1_000 ether);
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, user1));
        amicaToken.recoverToken(address(usdc), user1);
    }
    
    function test_RecoverToken_ZeroDepositedBalance() public {
        // Deploy new token
        MockERC20 newToken = new MockERC20("New", "NEW", 18);
        
        // Send tokens directly without deposit
        uint256 amount = 1_000 ether;
        newToken.mint(address(amicaToken), amount);
        
        // Should recover all tokens since depositedBalance is 0
        vm.expectEmit(true, true, false, true);
        emit TokensRecovered(owner, address(newToken), amount);
        
        vm.prank(owner);
        amicaToken.recoverToken(address(newToken), owner);
    }
    
    // Edge Cases
    function test_Deposit_ConcurrentDepositsOfSameToken() public {
        MockERC20 testToken = new MockERC20("Test", "TEST", 18);
        
        // Give both users tokens
        testToken.mint(user1, 1_000 ether);
        testToken.mint(user2, 1_000 ether);
        
        // Both approve
        vm.prank(user1);
        testToken.approve(address(amicaToken), 500 ether);
        
        vm.prank(user2);
        testToken.approve(address(amicaToken), 500 ether);
        
        // Both deposit
        vm.prank(user1);
        amicaToken.deposit(address(testToken), 500 ether);
        
        vm.prank(user2);
        amicaToken.deposit(address(testToken), 500 ether);
        
        // Check total deposited
        assertEq(amicaToken.depositedBalances(address(testToken)), 1_000 ether);
        
        // Token should only be in list once
        address[] memory depositedTokens = amicaToken.getDepositedTokens();
        uint256 tokenCount = 0;
        for (uint256 i = 0; i < depositedTokens.length; i++) {
            if (depositedTokens[i] == address(testToken)) {
                tokenCount++;
            }
        }
        assertEq(tokenCount, 1);
    }
    
    function test_RecoverToken_WhenDepositedEqualsBalance() public {
        MockERC20 testToken = new MockERC20("Test", "TEST", 18);
        
        // Ensure owner has tokens
        if (testToken.balanceOf(owner) == 0) {
            testToken.mint(owner, 1_000 ether);
        }
        
        // Deposit exact amount
        vm.startPrank(owner);
        testToken.approve(address(amicaToken), 1_000 ether);
        amicaToken.deposit(address(testToken), 1_000 ether);
        
        // No excess to recover
        vm.expectRevert(abi.encodeWithSignature("NoTokensToRecover()"));
        amicaToken.recoverToken(address(testToken), owner);
        vm.stopPrank();
    }
    
    // Helper functions
    function _setupDeposits() internal {
        // Deposit various amounts of tokens
        vm.startPrank(owner);
        usdc.approve(address(amicaToken), 100_000 ether);
        weth.approve(address(amicaToken), 1_000 ether);
        dai.approve(address(amicaToken), 500_000 ether);
        
        amicaToken.deposit(address(usdc), 100_000 ether);
        amicaToken.deposit(address(weth), 1_000 ether);
        amicaToken.deposit(address(dai), 500_000 ether);
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
    
    function testFuzz_Deposit_AnyValidAmount(uint256 amount) public {
        // Bound to reasonable amount
        amount = bound(amount, 1, 1_000_000 ether);
        
        // Mint tokens for test
        MockERC20 testToken = new MockERC20("Test", "TEST", 18);
        testToken.mint(owner, amount);
        
        vm.startPrank(owner);
        testToken.approve(address(amicaToken), amount);
        amicaToken.deposit(address(testToken), amount);
        vm.stopPrank();
        
        assertEq(amicaToken.depositedBalances(address(testToken)), amount);
    }
    
    function testFuzz_BurnAndClaim_ProportionalRewards(uint256 burnAmount) public {
        _setupDeposits();
        
        uint256 userBalance = amicaToken.balanceOf(user1);
        burnAmount = bound(burnAmount, 1, userBalance);
        
        uint256 circulatingSupply = amicaToken.circulatingSupply();
        uint256 usdcDeposited = amicaToken.depositedBalances(address(usdc));
        
        uint256[] memory tokenIndexes = new uint256[](1);
        tokenIndexes[0] = 1; // USDC
        
        // Calculate expected amount using the same formula as the contract
        uint256 sharePercentage = (burnAmount * PRECISION) / circulatingSupply;
        uint256 expectedUsdc = (usdcDeposited * sharePercentage) / PRECISION;
        
        // If the expected amount rounds to 0, the contract will revert with NoTokensToClaim
        if (expectedUsdc == 0) {
            vm.expectRevert(abi.encodeWithSignature("NoTokensToClaim()"));
            vm.prank(user1);
            amicaToken.burnAndClaim(burnAmount, tokenIndexes);
        } else {
            uint256 initialUsdcBalance = usdc.balanceOf(user1);
            
            vm.prank(user1);
            amicaToken.burnAndClaim(burnAmount, tokenIndexes);
            
            // Use a more reasonable tolerance - 0.1% of expected amount
            uint256 tolerance = expectedUsdc / 1000;
            if (tolerance == 0) tolerance = 1;
            
            assertApproxEqAbs(
                usdc.balanceOf(user1),
                initialUsdcBalance + expectedUsdc,
                tolerance
            );
        }
    }

    function test_Upgradeability() public {
        // Simply verify that this is a proxy by checking that the implementation
        // address is different from the proxy address
        address implementation = UnsafeUpgrades.getImplementationAddress(address(amicaToken));
        
        // Basic proxy verification
        assertTrue(implementation != address(0), "Implementation should exist");
        assertTrue(implementation != address(amicaToken), "Should be a proxy");
        
        // Verify admin exists
        address admin = UnsafeUpgrades.getAdminAddress(address(amicaToken));
        assertTrue(admin != address(0), "Admin should exist");
    }
}
