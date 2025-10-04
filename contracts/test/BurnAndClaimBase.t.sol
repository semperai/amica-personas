// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    BurnAndClaimBase,
    InvalidBurnAmount,
    NoTokensSelected,
    TokensMustBeSortedAndUnique,
    NoSupply,
    InvalidTokenAddress,
    NoTokensToClaim,
    TransferFailed
} from "../src/BurnAndClaimBase.sol";
import {ERC20Upgradeable} from
    "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

// Mock implementation of BurnAndClaimBase for testing
contract MockBurnAndClaimToken is BurnAndClaimBase {
    function initialize(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply,
        address recipient
    ) external initializer {
        __ERC20_init(name_, symbol_);
        __ReentrancyGuard_init();
        _mint(recipient, initialSupply);
    }

    // Function to mint tokens for testing
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    // Function to burn tokens for testing
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}

// Malicious token that returns false on transfer
contract MaliciousToken {
    mapping(address => uint256) public balanceOf;

    function mint(address to, uint256 amount) external {
        balanceOf[to] = amount;
    }

    function transfer(address, uint256) external pure returns (bool) {
        return false;
    }
}

// Reentrancy attacker contract
contract ReentrancyAttacker is IERC20 {
    MockBurnAndClaimToken public target;
    bool public attacking;
    uint256 public attackCount;

    function setTarget(address _target) external {
        target = MockBurnAndClaimToken(_target);
    }

    function startAttack(address[] calldata tokens) external {
        attacking = true;
        attackCount = 0;
        target.burnAndClaim(1 ether, tokens);
    }

    function transfer(address, uint256) external returns (bool) {
        if (attacking && attackCount < 1) {
            attackCount++;
            address[] memory tokens = new address[](1);
            tokens[0] = address(this);
            // This should fail due to reentrancy guard
            target.burnAndClaim(1 ether, tokens);
        }
        return true;
    }

    // Minimal IERC20 implementation
    function totalSupply() external pure returns (uint256) {
        return 0;
    }

    function balanceOf(address) external pure returns (uint256) {
        return 1000 ether;
    }

    function allowance(address, address) external pure returns (uint256) {
        return 0;
    }

    function approve(address, uint256) external pure returns (bool) {
        return false;
    }

    function transferFrom(address, address, uint256)
        external
        pure
        returns (bool)
    {
        return false;
    }
}

contract BurnAndClaimBaseTest is Test {
    MockBurnAndClaimToken public token;

    MockERC20 public token1;
    MockERC20 public token2;
    MockERC20 public token3;
    MockERC20 public token4;

    address public user1 = address(0x1);
    address public user2 = address(0x2);
    address public user3 = address(0x3);

    uint256 constant INITIAL_SUPPLY = 1_000_000 ether;

    // Event for testing
    event TokenClaimed(
        address indexed user,
        address indexed claimedToken,
        uint256 amountBurned,
        uint256 amountClaimed
    );

    function setUp() public {
        // Deploy mock burn and claim token
        token = new MockBurnAndClaimToken();
        token.initialize("Test Token", "TEST", INITIAL_SUPPLY, address(this));

        // Deploy mock ERC20 tokens
        token1 = new MockERC20("Token1", "TK1", 18);
        token2 = new MockERC20("Token2", "TK2", 18);
        token3 = new MockERC20("Token3", "TK3", 18);
        token4 = new MockERC20("Token4", "TK4", 18);

        // Mint tokens to this contract
        token1.mint(address(this), 1_000_000 ether);
        token2.mint(address(this), 1_000_000 ether);
        token3.mint(address(this), 1_000_000 ether);
        token4.mint(address(this), 1_000_000 ether);
    }

    // ==================== Basic Burn and Claim Tests ====================

    function test_BurnAndClaim_SingleToken_Success() public {
        uint256 depositAmount = 1000 ether;
        token1.transfer(address(token), depositAmount);

        token.transfer(user1, 100 ether);

        uint256 burnAmount = 50 ether;
        uint256 expectedClaim =
            (depositAmount * burnAmount) / token.totalSupply();

        address[] memory tokens = new address[](1);
        tokens[0] = address(token1);

        vm.prank(user1);
        vm.expectEmit(true, true, true, true);
        emit TokenClaimed(user1, address(token1), burnAmount, expectedClaim);
        token.burnAndClaim(burnAmount, tokens);

        assertEq(token.balanceOf(user1), 50 ether);
        assertEq(token1.balanceOf(user1), expectedClaim);
        assertEq(
            token1.balanceOf(address(token)), depositAmount - expectedClaim
        );
    }

    function test_BurnAndClaim_MultipleTokens_Success() public {
        token1.transfer(address(token), 1000 ether);
        token2.transfer(address(token), 500 ether);
        token3.transfer(address(token), 250 ether);

        token.transfer(user1, 100 ether);

        uint256 burnAmount = 10 ether;
        uint256 totalSupply = token.totalSupply();

        address[] memory tokens = _sortAddresses(
            address(token1), address(token2), address(token3)
        );

        uint256 expectedClaim1 = (1000 ether * burnAmount) / totalSupply;
        uint256 expectedClaim2 = (500 ether * burnAmount) / totalSupply;
        uint256 expectedClaim3 = (250 ether * burnAmount) / totalSupply;

        vm.prank(user1);
        token.burnAndClaim(burnAmount, tokens);

        assertEq(token1.balanceOf(user1), expectedClaim1);
        assertEq(token2.balanceOf(user1), expectedClaim2);
        assertEq(token3.balanceOf(user1), expectedClaim3);
        assertEq(token.balanceOf(user1), 90 ether);
    }

    function test_BurnAndClaim_EntireBalance() public {
        token1.transfer(address(token), 1000 ether);

        uint256 userBalance = 100 ether;
        token.transfer(user1, userBalance);

        address[] memory tokens = new address[](1);
        tokens[0] = address(token1);

        vm.prank(user1);
        token.burnAndClaim(userBalance, tokens);

        assertEq(token.balanceOf(user1), 0);
        assertGt(token1.balanceOf(user1), 0);
    }

    function test_BurnAndClaim_ClaimOwnTokens() public {
        // Transfer some test tokens to the contract itself
        token.transfer(address(token), 500 ether);

        token.transfer(user1, 100 ether);

        uint256 burnAmount = 50 ether;
        uint256 balanceBefore = token.balanceOf(user1);

        address[] memory tokens = new address[](1);
        tokens[0] = address(token);

        vm.prank(user1);
        token.burnAndClaim(burnAmount, tokens);

        // User should have received some tokens back (minus burned)
        assertGt(token.balanceOf(user1), balanceBefore - burnAmount);
    }

    // ==================== Validation Error Tests ====================

    function test_BurnAndClaim_RevertWhen_ZeroBurnAmount() public {
        address[] memory tokens = new address[](1);
        tokens[0] = address(token1);

        vm.expectRevert(InvalidBurnAmount.selector);
        token.burnAndClaim(0, tokens);
    }

    function test_BurnAndClaim_RevertWhen_NoTokensSelected() public {
        address[] memory tokens = new address[](0);

        vm.expectRevert(NoTokensSelected.selector);
        token.burnAndClaim(100 ether, tokens);
    }

    function test_BurnAndClaim_RevertWhen_TokensNotSorted() public {
        token.transfer(user1, 100 ether);

        address[] memory tokens = new address[](2);
        // Intentionally unsorted
        if (uint160(address(token1)) < uint160(address(token2))) {
            tokens[0] = address(token2);
            tokens[1] = address(token1);
        } else {
            tokens[0] = address(token1);
            tokens[1] = address(token2);
        }

        vm.prank(user1);
        vm.expectRevert(TokensMustBeSortedAndUnique.selector);
        token.burnAndClaim(50 ether, tokens);
    }

    function test_BurnAndClaim_RevertWhen_DuplicateTokens() public {
        token.transfer(user1, 100 ether);

        address[] memory tokens = new address[](2);
        tokens[0] = address(token1);
        tokens[1] = address(token1);

        vm.prank(user1);
        vm.expectRevert(TokensMustBeSortedAndUnique.selector);
        token.burnAndClaim(50 ether, tokens);
    }

    function test_BurnAndClaim_RevertWhen_ZeroAddressToken() public {
        token.transfer(user1, 100 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(0);

        vm.prank(user1);
        vm.expectRevert(InvalidTokenAddress.selector);
        token.burnAndClaim(50 ether, tokens);
    }

    function test_BurnAndClaim_RevertWhen_ZeroAddressInMiddle() public {
        token.transfer(user1, 100 ether);

        address[] memory tokens = new address[](3);
        tokens[0] = address(0);
        tokens[1] = address(token1);
        tokens[2] = address(token2);

        vm.prank(user1);
        vm.expectRevert(InvalidTokenAddress.selector);
        token.burnAndClaim(50 ether, tokens);
    }

    function test_BurnAndClaim_RevertWhen_NoTokensToClaim() public {
        token.transfer(user1, 100 ether);

        // Don't send any tokens to the contract
        address[] memory tokens = new address[](1);
        tokens[0] = address(token1);

        vm.prank(user1);
        vm.expectRevert(NoTokensToClaim.selector);
        token.burnAndClaim(50 ether, tokens);
    }

    function test_BurnAndClaim_RevertWhen_InsufficientBalance() public {
        token.transfer(user1, 50 ether);
        token1.transfer(address(token), 1000 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(token1);

        vm.prank(user1);
        vm.expectRevert(); // ERC20InsufficientBalance
        token.burnAndClaim(100 ether, tokens);
    }

    function test_BurnAndClaim_RevertWhen_NoSupply() public {
        MockBurnAndClaimToken zeroToken = new MockBurnAndClaimToken();
        zeroToken.initialize("Zero", "ZERO", 100 ether, address(this));

        token1.transfer(address(zeroToken), 1000 ether);

        address[] memory tokensForBurn = new address[](1);
        tokensForBurn[0] = address(token1);
        zeroToken.burnAndClaim(100 ether, tokensForBurn);

        // Now supply is zero, trying to burn should fail
        vm.expectRevert(NoSupply.selector);
        zeroToken.burnAndClaim(1 ether, tokensForBurn);
    }

    function test_BurnAndClaim_RevertWhen_TransferFails() public {
        MaliciousToken malicious = new MaliciousToken();
        malicious.mint(address(token), 1000 ether);

        token.transfer(user1, 100 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(malicious);

        vm.prank(user1);
        vm.expectRevert(TransferFailed.selector);
        token.burnAndClaim(50 ether, tokens);
    }

    // ==================== Edge Cases ====================

    function test_BurnAndClaim_VerySmallBurnAmount() public {
        uint256 largeDeposit = 1_000_000 ether;
        token1.mint(address(token), largeDeposit);

        token.transfer(user1, 1000 ether);

        // Burn 1 wei
        address[] memory tokens = new address[](1);
        tokens[0] = address(token1);

        uint256 totalSupply = token.totalSupply();
        uint256 expectedClaim = (largeDeposit * 1) / totalSupply;

        vm.prank(user1);
        token.burnAndClaim(1, tokens);

        assertEq(token1.balanceOf(user1), expectedClaim);
    }

    function test_BurnAndClaim_ClaimAmountRoundsToZero() public {
        // Deposit very small amount
        token1.transfer(address(token), 1);

        token.transfer(user1, 1000 ether);

        // Burn small amount that would result in zero claim
        address[] memory tokens = new address[](1);
        tokens[0] = address(token1);

        vm.prank(user1);
        vm.expectRevert(NoTokensToClaim.selector);
        token.burnAndClaim(1, tokens);
    }

    function test_BurnAndClaim_SomeTokensHaveZeroBalance() public {
        token1.transfer(address(token), 1000 ether);
        // token2 has zero balance
        token3.transfer(address(token), 500 ether);

        token.transfer(user1, 100 ether);

        address[] memory tokens =
            _sortAddresses(address(token1), address(token2), address(token3));

        vm.prank(user1);
        token.burnAndClaim(50 ether, tokens);

        assertGt(token1.balanceOf(user1), 0);
        assertEq(token2.balanceOf(user1), 0);
        assertGt(token3.balanceOf(user1), 0);
    }

    function test_BurnAndClaim_AllButOneTokenHasZeroBalance() public {
        token1.transfer(address(token), 1000 ether);
        // token2 and token3 have zero balance

        token.transfer(user1, 100 ether);

        address[] memory tokens =
            _sortAddresses(address(token1), address(token2), address(token3));

        vm.prank(user1);
        token.burnAndClaim(50 ether, tokens);

        assertGt(token1.balanceOf(user1), 0);
        assertEq(token2.balanceOf(user1), 0);
        assertEq(token3.balanceOf(user1), 0);
    }

    function test_BurnAndClaim_MultipleTokensSomeClaimZero() public {
        // token1 has enough for a claim
        token1.transfer(address(token), 1_000_000 ether);

        // token2 has very little, will round to zero
        token2.transfer(address(token), 10);

        token.transfer(user1, 100 ether);

        address[] memory tokens = _sortAddresses(address(token1), address(token2));

        uint256 totalSupply = token.totalSupply();

        vm.prank(user1);
        token.burnAndClaim(1, tokens);

        // token1 should be claimed
        assertGt(token1.balanceOf(user1), 0);
        // token2 claim rounds to zero but doesn't revert the whole tx
    }

    function test_BurnAndClaim_LargeAmounts() public {
        // This tests with large but reasonable amounts
        MockBurnAndClaimToken hugeToken = new MockBurnAndClaimToken();
        uint256 largeSupply = 1_000_000_000_000 ether;
        hugeToken.initialize("Huge", "HUGE", largeSupply, address(this));

        // Transfer large amount of token1 to the contract
        uint256 largeDeposit = 500_000_000_000 ether;
        token1.mint(address(hugeToken), largeDeposit);

        address[] memory tokens = new address[](1);
        tokens[0] = address(token1);

        // Burn half the supply
        uint256 burnAmount = largeSupply / 2;
        hugeToken.burnAndClaim(burnAmount, tokens);

        // Should not overflow and should receive approximately half the deposit
        assertGt(token1.balanceOf(address(this)), 0);
        assertApproxEqRel(
            token1.balanceOf(address(this)), largeDeposit / 2, 0.01e18
        );
    }

    function test_BurnAndClaim_ManyTokensAtOnce() public {
        uint256 numTokens = 20;
        MockERC20[] memory manyTokens = new MockERC20[](numTokens);
        address[] memory tokenAddresses = new address[](numTokens);

        for (uint256 i = 0; i < numTokens; i++) {
            manyTokens[i] = new MockERC20(
                string(abi.encodePacked("Token", vm.toString(i))),
                string(abi.encodePacked("TK", vm.toString(i))),
                18
            );
            manyTokens[i].mint(address(this), 1_000_000 ether);
            manyTokens[i].transfer(address(token), (i + 1) * 100 ether);
            tokenAddresses[i] = address(manyTokens[i]);
        }

        tokenAddresses = _sortAddressArray(tokenAddresses);

        token.transfer(user1, 100 ether);

        vm.prank(user1);
        token.burnAndClaim(50 ether, tokenAddresses);

        for (uint256 i = 0; i < numTokens; i++) {
            assertGt(IERC20(tokenAddresses[i]).balanceOf(user1), 0);
        }
    }

    // ==================== Multiple Users Tests ====================

    function test_BurnAndClaim_MultipleUsersConcurrent() public {
        token1.transfer(address(token), 10000 ether);

        token.transfer(user1, 100 ether);
        token.transfer(user2, 200 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(token1);

        uint256 totalSupplyBefore = token.totalSupply();

        // User1 burns first
        vm.prank(user1);
        token.burnAndClaim(50 ether, tokens);
        uint256 user1Claimed = token1.balanceOf(user1);

        // Total supply decreased
        uint256 totalSupplyAfterUser1 = token.totalSupply();
        assertEq(totalSupplyAfterUser1, totalSupplyBefore - 50 ether);

        // User2 burns second (gets different proportion due to changed supply)
        vm.prank(user2);
        token.burnAndClaim(100 ether, tokens);
        uint256 user2Claimed = token1.balanceOf(user2);

        assertGt(user1Claimed, 0);
        assertGt(user2Claimed, 0);
        // User2 should have received more since they burned more
        assertGt(user2Claimed, user1Claimed);
    }

    function test_BurnAndClaim_ProportionalDistribution() public {
        uint256 depositAmount = 10000 ether;
        token1.transfer(address(token), depositAmount);

        token.transfer(user1, 300 ether);
        token.transfer(user2, 200 ether);
        token.transfer(user3, 100 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(token1);

        // Each user burns their entire balance
        vm.prank(user1);
        token.burnAndClaim(300 ether, tokens);
        uint256 user1Claimed = token1.balanceOf(user1);

        vm.prank(user2);
        token.burnAndClaim(200 ether, tokens);
        uint256 user2Claimed = token1.balanceOf(user2);

        vm.prank(user3);
        token.burnAndClaim(100 ether, tokens);
        uint256 user3Claimed = token1.balanceOf(user3);

        uint256 remainingInContract = token1.balanceOf(address(token));

        // All token1 should be distributed (with possible dust remaining in contract)
        assertApproxEqAbs(
            user1Claimed + user2Claimed + user3Claimed + remainingInContract,
            depositAmount,
            10,
            "All tokens should be accounted for"
        );

        // User1 should have received the most since they burned when supply was highest
        assertGt(user1Claimed, user2Claimed);
        assertGt(user2Claimed, user3Claimed);
    }

    // ==================== Preview Tests ====================

    function test_PreviewBurnAndClaim_AccurateCalculation() public {
        token1.transfer(address(token), 1000 ether);
        token2.transfer(address(token), 500 ether);

        token.transfer(user1, 100 ether);

        uint256 burnAmount = 50 ether;

        address[] memory tokens =
            _sortAddresses(address(token1), address(token2));

        uint256[] memory preview = token.previewBurnAndClaim(burnAmount, tokens);

        vm.prank(user1);
        token.burnAndClaim(burnAmount, tokens);

        assertEq(token1.balanceOf(user1), preview[0]);
        assertEq(token2.balanceOf(user1), preview[1]);
    }

    function test_PreviewBurnAndClaim_ZeroWhenNoBalance() public view {
        address[] memory tokens = new address[](1);
        tokens[0] = address(token1);

        uint256[] memory preview = token.previewBurnAndClaim(100 ether, tokens);
        assertEq(preview[0], 0);
    }

    function test_PreviewBurnAndClaim_ZeroWhenZeroBurnAmount() public {
        token1.transfer(address(token), 1000 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(token1);

        uint256[] memory preview = token.previewBurnAndClaim(0, tokens);
        assertEq(preview[0], 0);
    }

    function test_PreviewBurnAndClaim_ZeroWhenZeroSupply() public {
        MockBurnAndClaimToken zeroToken = new MockBurnAndClaimToken();
        zeroToken.initialize("Zero", "ZERO", 100 ether, address(this));

        token1.transfer(address(zeroToken), 1000 ether);

        address[] memory tokensForBurn = new address[](1);
        tokensForBurn[0] = address(token1);
        zeroToken.burnAndClaim(100 ether, tokensForBurn);

        // Supply is now zero
        token1.transfer(address(zeroToken), 500 ether);

        uint256[] memory preview =
            zeroToken.previewBurnAndClaim(10 ether, tokensForBurn);
        assertEq(preview[0], 0);
    }

    function test_PreviewBurnAndClaim_ZeroAddressReturnsZero() public {
        token1.transfer(address(token), 1000 ether);

        address[] memory tokens = new address[](2);
        tokens[0] = address(0);
        tokens[1] = address(token1);

        uint256[] memory preview = token.previewBurnAndClaim(50 ether, tokens);
        assertEq(preview[0], 0);
        assertGt(preview[1], 0);
    }

    function test_PreviewBurnAndClaim_MultipleTokens() public {
        token1.transfer(address(token), 1000 ether);
        token2.transfer(address(token), 500 ether);
        token3.transfer(address(token), 250 ether);

        address[] memory tokens = _sortAddresses(
            address(token1), address(token2), address(token3)
        );

        uint256 burnAmount = 100 ether;
        uint256[] memory preview = token.previewBurnAndClaim(burnAmount, tokens);

        assertEq(preview.length, 3);
        assertGt(preview[0], 0);
        assertGt(preview[1], 0);
        assertGt(preview[2], 0);
    }

    function test_PreviewBurnAndClaim_DoesNotChangeState() public {
        token1.transfer(address(token), 1000 ether);

        uint256 supplyBefore = token.totalSupply();
        uint256 token1BalanceBefore = token1.balanceOf(address(token));

        address[] memory tokens = new address[](1);
        tokens[0] = address(token1);

        token.previewBurnAndClaim(100 ether, tokens);

        assertEq(token.totalSupply(), supplyBefore);
        assertEq(token1.balanceOf(address(token)), token1BalanceBefore);
    }

    // ==================== Invariant Tests ====================

    function test_BurnAndClaim_MaintainsInvariants() public {
        uint256 initialDeposit = 10000 ether;
        token1.transfer(address(token), initialDeposit);

        token.transfer(user1, 300 ether);
        token.transfer(user2, 200 ether);
        token.transfer(user3, 100 ether);

        uint256 initialSupply = token.totalSupply();
        uint256 totalClaimed = 0;

        address[] memory tokens = new address[](1);
        tokens[0] = address(token1);

        // Multiple burn cycles
        for (uint256 i = 0; i < 5; i++) {
            address user = i % 3 == 0 ? user1 : (i % 3 == 1 ? user2 : user3);
            uint256 userBalance = token.balanceOf(user);

            if (userBalance > 10 ether) {
                uint256 burnAmount = userBalance / 10;
                uint256 balanceBefore = token1.balanceOf(user);

                vm.prank(user);
                token.burnAndClaim(burnAmount, tokens);

                totalClaimed += token1.balanceOf(user) - balanceBefore;
            }
        }

        uint256 finalSupply = token.totalSupply();
        uint256 finalContractBalance = token1.balanceOf(address(token));

        assertLt(finalSupply, initialSupply);
        assertEq(finalContractBalance + totalClaimed, initialDeposit);
    }

    // ==================== Reentrancy Tests ====================

    function test_BurnAndClaim_ReentrancyProtection() public {
        ReentrancyAttacker attacker = new ReentrancyAttacker();
        attacker.setTarget(address(token));

        // Give attacker some tokens
        token.mint(address(attacker), 100 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(attacker);

        vm.expectRevert();
        attacker.startAttack(tokens);
    }

    function test_BurnAndClaim_NormalOperationAfterReentrancyAttempt() public {
        // Verify normal operation still works after reentrancy attempt
        token1.transfer(address(token), 1000 ether);
        token.transfer(user1, 100 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(token1);

        vm.prank(user1);
        token.burnAndClaim(50 ether, tokens);

        assertGt(token1.balanceOf(user1), 0);
    }

    // ==================== Gas Optimization Tests ====================

    function test_BurnAndClaim_ArrayResizing() public {
        // Test that array resizing works correctly
        token1.transfer(address(token), 1000 ether);
        // token2 has zero balance, should be filtered out
        token3.transfer(address(token), 500 ether);

        token.transfer(user1, 100 ether);

        address[] memory tokens =
            _sortAddresses(address(token1), address(token2), address(token3));

        vm.prank(user1);
        token.burnAndClaim(50 ether, tokens);

        // Only token1 and token3 should be claimed
        assertGt(token1.balanceOf(user1), 0);
        assertEq(token2.balanceOf(user1), 0);
        assertGt(token3.balanceOf(user1), 0);
    }

    // ==================== Different Token Decimals ====================

    function test_BurnAndClaim_DifferentDecimals() public {
        MockERC20 token6Decimals = new MockERC20("Six Decimals", "SIX", 6);
        MockERC20 token18Decimals =
            new MockERC20("Eighteen Decimals", "EIGHTEEN", 18);

        token6Decimals.mint(address(this), 1_000_000 * 10 ** 6);
        token18Decimals.mint(address(this), 1_000_000 ether);

        token6Decimals.transfer(address(token), 1000 * 10 ** 6);
        token18Decimals.transfer(address(token), 1000 ether);

        token.transfer(user1, 100 ether);

        address[] memory tokens =
            _sortAddresses(address(token6Decimals), address(token18Decimals));

        vm.prank(user1);
        token.burnAndClaim(50 ether, tokens);

        assertGt(token6Decimals.balanceOf(user1), 0);
        assertGt(token18Decimals.balanceOf(user1), 0);
    }

    // ==================== Boundary Value Tests ====================

    function test_BurnAndClaim_BurnExactlyOneWei() public {
        token1.transfer(address(token), 1_000_000 ether);
        token.transfer(user1, 1000 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(token1);

        vm.prank(user1);
        token.burnAndClaim(1, tokens);

        assertGt(token1.balanceOf(user1), 0);
        assertEq(token.balanceOf(user1), 1000 ether - 1);
    }

    function test_BurnAndClaim_OneTokenInArray() public {
        token1.transfer(address(token), 1000 ether);
        token.transfer(user1, 100 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(token1);

        vm.prank(user1);
        token.burnAndClaim(50 ether, tokens);

        assertGt(token1.balanceOf(user1), 0);
    }

    function test_BurnAndClaim_TwoTokensInArray() public {
        token1.transfer(address(token), 1000 ether);
        token2.transfer(address(token), 500 ether);
        token.transfer(user1, 100 ether);

        address[] memory tokens = _sortAddresses(address(token1), address(token2));

        vm.prank(user1);
        token.burnAndClaim(50 ether, tokens);

        assertGt(token1.balanceOf(user1), 0);
        assertGt(token2.balanceOf(user1), 0);
    }

    // ==================== Event Emission Tests ====================

    function test_BurnAndClaim_EmitsEventsForEachToken() public {
        token1.transfer(address(token), 1000 ether);
        token2.transfer(address(token), 500 ether);

        token.transfer(user1, 100 ether);

        uint256 burnAmount = 50 ether;
        uint256 totalSupply = token.totalSupply();

        address[] memory tokens = _sortAddresses(address(token1), address(token2));

        uint256 expectedClaim1 = (1000 ether * burnAmount) / totalSupply;
        uint256 expectedClaim2 = (500 ether * burnAmount) / totalSupply;

        vm.prank(user1);
        if (tokens[0] == address(token1)) {
            vm.expectEmit(true, true, true, true);
            emit TokenClaimed(user1, address(token1), burnAmount, expectedClaim1);
            vm.expectEmit(true, true, true, true);
            emit TokenClaimed(user1, address(token2), burnAmount, expectedClaim2);
        } else {
            vm.expectEmit(true, true, true, true);
            emit TokenClaimed(user1, address(token2), burnAmount, expectedClaim2);
            vm.expectEmit(true, true, true, true);
            emit TokenClaimed(user1, address(token1), burnAmount, expectedClaim1);
        }
        token.burnAndClaim(burnAmount, tokens);
    }

    function test_BurnAndClaim_NoEventForZeroClaimToken() public {
        token1.transfer(address(token), 1000 ether);
        // token2 has zero balance, should emit no event

        token.transfer(user1, 100 ether);

        uint256 burnAmount = 50 ether;

        address[] memory tokens = _sortAddresses(address(token1), address(token2));

        vm.prank(user1);
        // Only expect one event (for token1)
        vm.recordLogs();
        token.burnAndClaim(burnAmount, tokens);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        uint256 tokenClaimedCount = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (
                logs[i].topics[0]
                    == keccak256("TokenClaimed(address,address,uint256,uint256)")
            ) {
                tokenClaimedCount++;
            }
        }
        assertEq(tokenClaimedCount, 1, "Should only emit one TokenClaimed event");
    }

    // ==================== Helper Functions ====================

    function _sortAddresses(address a, address b)
        private
        pure
        returns (address[] memory)
    {
        address[] memory sorted = new address[](2);
        if (uint160(a) < uint160(b)) {
            sorted[0] = a;
            sorted[1] = b;
        } else {
            sorted[0] = b;
            sorted[1] = a;
        }
        return sorted;
    }

    function _sortAddresses(address a, address b, address c)
        private
        pure
        returns (address[] memory)
    {
        address[] memory addrs = new address[](3);
        addrs[0] = a;
        addrs[1] = b;
        addrs[2] = c;
        return _sortAddressArray(addrs);
    }

    function _sortAddressArray(address[] memory addrs)
        private
        pure
        returns (address[] memory)
    {
        uint256 length = addrs.length;
        for (uint256 i = 0; i < length - 1; i++) {
            for (uint256 j = 0; j < length - i - 1; j++) {
                if (uint160(addrs[j]) > uint160(addrs[j + 1])) {
                    address temp = addrs[j];
                    addrs[j] = addrs[j + 1];
                    addrs[j + 1] = temp;
                }
            }
        }
        return addrs;
    }
}
