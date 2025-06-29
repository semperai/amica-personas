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

    // Events - Update to match what BurnAndClaimBase actually emits
    event TokenClaimed(
        address indexed user,
        address indexed claimedToken,
        uint256 amountBurned,
        uint256 amountClaimed
    );

    event Transfer(address indexed from, address indexed to, uint256 value);

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

        // Distribute some AMICA tokens to users for testing
        vm.startPrank(owner);
        amicaToken.transfer(user1, 10_000_000 ether); // 10M to user1
        amicaToken.transfer(user2, 10_000_000 ether); // 10M to user2
        amicaToken.transfer(user3, 10_000_000 ether); // 10M to user3
        vm.stopPrank();
    }

    // Deployment Tests
    function test_Deployment_NameAndSymbol() public view {
        assertEq(amicaToken.name(), "Amica");
        assertEq(amicaToken.symbol(), "AMICA");
    }

    function test_Deployment_TotalSupply() public view {
        assertEq(amicaToken.totalSupply(), TOTAL_SUPPLY);
    }

    function test_Deployment_Owner() public view {
        assertEq(amicaToken.owner(), owner);
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

    // Burn and Claim Tests
    function test_BurnAndClaim_Success() public {
        // Setup by sending tokens directly to contract
        _setupTokenBalances();

        uint256 userBalance = amicaToken.balanceOf(user1);
        uint256 burnAmount = 1_000 ether;
        uint256 totalSupply = amicaToken.totalSupply();

        // Calculate expected amounts
        uint256 expectedUsdc = (100_000 ether * burnAmount) / totalSupply;
        uint256 expectedWeth = (1_000 ether * burnAmount) / totalSupply;
        uint256 expectedDai = (500_000 ether * burnAmount) / totalSupply;

        // Create sorted token array
        address[] memory tokens =
            _sortTokens(address(usdc), address(weth), address(dai));

        // Expect individual TokenClaimed events for each token
        // First expect the burn transfer event
        vm.expectEmit(true, true, true, true);
        emit Transfer(user1, address(0), burnAmount);

        // Then expect TokenClaimed events in the order of sorted tokens
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 expectedAmount;
            if (tokens[i] == address(usdc)) {
                expectedAmount = expectedUsdc;
            } else if (tokens[i] == address(weth)) {
                expectedAmount = expectedWeth;
            } else if (tokens[i] == address(dai)) {
                expectedAmount = expectedDai;
            }

            vm.expectEmit(true, true, true, true);
            emit TokenClaimed(user1, tokens[i], burnAmount, expectedAmount);
        }

        vm.prank(user1);
        amicaToken.burnAndClaim(burnAmount, tokens);

        // Check token balances
        assertApproxEqAbs(
            usdc.balanceOf(user1), 100_000 ether + expectedUsdc, 1
        );
        assertApproxEqAbs(weth.balanceOf(user1), 1_000 ether + expectedWeth, 1);
        assertApproxEqAbs(dai.balanceOf(user1), 100_000 ether + expectedDai, 1);

        // Check AMICA balance
        assertEq(amicaToken.balanceOf(user1), userBalance - burnAmount);
    }

    function test_BurnAndClaim_SpecificTokensOnly() public {
        _setupTokenBalances();

        uint256 burnAmount = 500 ether;
        uint256 initialUsdcBalance = usdc.balanceOf(user1);
        uint256 initialWethBalance = weth.balanceOf(user1);
        uint256 initialDaiBalance = dai.balanceOf(user1);

        // Only claim USDC and WETH - must be sorted
        address[] memory tokens = _sortTokens(address(usdc), address(weth));

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

        uint256 initialSupply = amicaToken.totalSupply();
        uint256 burnAmount = 1_000 ether;

        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);

        vm.prank(user1);
        amicaToken.burnAndClaim(burnAmount, tokens);

        assertEq(amicaToken.totalSupply(), initialSupply - burnAmount);
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

    function test_BurnAndClaim_AllowsClaimingAmica() public {
        _setupTokenBalances();

        // Send some AMICA to the contract itself
        vm.prank(owner);
        amicaToken.transfer(address(amicaToken), 1_000_000 ether);

        uint256 burnAmount = 1_000 ether;
        uint256 initialAmicaBalance = amicaToken.balanceOf(user1);

        address[] memory tokens = new address[](1);
        tokens[0] = address(amicaToken);

        vm.prank(user1);
        amicaToken.burnAndClaim(burnAmount, tokens);

        // User should have received some AMICA back (minus what was burned)
        assertGt(amicaToken.balanceOf(user1), initialAmicaBalance - burnAmount);
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

        // Create intentionally unsorted tokens
        address[] memory unsortedTokens = new address[](2);
        // Put them in descending order (should be ascending)
        if (uint160(address(usdc)) < uint160(address(weth))) {
            unsortedTokens[0] = address(weth);
            unsortedTokens[1] = address(usdc);
        } else {
            unsortedTokens[0] = address(usdc);
            unsortedTokens[1] = address(weth);
        }

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
        address[] memory validTokens = _sortTokens(address(dai), address(usdc));

        vm.prank(user1);
        amicaToken.burnAndClaim(burnAmount, validTokens);

        // Verify both tokens were claimed
        assertGt(usdc.balanceOf(user1), 100_000 ether);
        assertGt(dai.balanceOf(user1), 100_000 ether);
    }

    function test_BurnAndClaim_HighBurnPercentage() public {
        _setupTokenBalances();

        // First, let's check the actual owner balance
        uint256 ownerBalance = amicaToken.balanceOf(owner);

        // The owner should have received the total supply minus what was distributed
        // Let's ensure owner has enough tokens by transferring more if needed
        if (ownerBalance < 900_000_000 ether) {
            // Transfer tokens from users back to owner
            vm.prank(user1);
            amicaToken.transfer(owner, amicaToken.balanceOf(user1));
            vm.prank(user2);
            amicaToken.transfer(owner, amicaToken.balanceOf(user2));
            vm.prank(user3);
            amicaToken.transfer(owner, amicaToken.balanceOf(user3));

            // Update owner balance
            ownerBalance = amicaToken.balanceOf(owner);
        }

        // Now burn most of owner's tokens
        uint256 burnAmount = ownerBalance - 1_000_000 ether; // Keep 1M for testing

        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);

        uint256 totalSupply = amicaToken.totalSupply();
        uint256 usdcInContract = usdc.balanceOf(address(amicaToken));
        uint256 expectedUsdc = (usdcInContract * burnAmount) / totalSupply;
        uint256 initialOwnerUsdc = usdc.balanceOf(owner);

        vm.prank(owner);
        amicaToken.burnAndClaim(burnAmount, tokens);

        // Owner should receive the expected USDC amount
        assertApproxEqAbs(
            usdc.balanceOf(owner), initialOwnerUsdc + expectedUsdc, 1
        );

        // Total supply should be significantly reduced
        // After burning most of the owner's tokens, supply should be much less than 100M
        assertLt(amicaToken.totalSupply(), 100_000_000 ether);
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
        uint256 totalSupply = amicaToken.totalSupply();

        address[] memory tokens =
            _sortTokens(address(usdc), address(weth), address(dai));

        uint256[] memory amounts =
            amicaToken.previewBurnAndClaim(burnAmount, tokens);

        // Calculate expected amounts
        uint256 expectedUsdc = (100_000 ether * burnAmount) / totalSupply;
        uint256 expectedWeth = (1_000 ether * burnAmount) / totalSupply;
        uint256 expectedDai = (500_000 ether * burnAmount) / totalSupply;

        // Check amounts match expected based on sorted order
        for (uint256 i = 0; i < 3; i++) {
            if (tokens[i] == address(usdc)) {
                assertEq(amounts[i], expectedUsdc);
            } else if (tokens[i] == address(weth)) {
                assertEq(amounts[i], expectedWeth);
            } else if (tokens[i] == address(dai)) {
                assertEq(amounts[i], expectedDai);
            }
        }
    }

    function test_PreviewBurnAndClaim_ZeroAmount() public {
        _setupTokenBalances();

        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);

        uint256[] memory amounts = amicaToken.previewBurnAndClaim(0, tokens);
        assertEq(amounts[0], 0);
    }

    function test_PreviewBurnAndClaim_ZeroSupply() public {
        // Setup tokens in contract first
        _setupTokenBalances();

        // We need to burn all the supply
        // First, let's collect all tokens to one account

        // Have users send their tokens to owner
        uint256 user1Bal = amicaToken.balanceOf(user1);
        uint256 user2Bal = amicaToken.balanceOf(user2);
        uint256 user3Bal = amicaToken.balanceOf(user3);

        if (user1Bal > 0) {
            vm.prank(user1);
            amicaToken.transfer(owner, user1Bal);
        }
        if (user2Bal > 0) {
            vm.prank(user2);
            amicaToken.transfer(owner, user2Bal);
        }
        if (user3Bal > 0) {
            vm.prank(user3);
            amicaToken.transfer(owner, user3Bal);
        }

        // Check if test contract has any balance
        uint256 testContractBal = amicaToken.balanceOf(address(this));
        if (testContractBal > 0) {
            amicaToken.transfer(owner, testContractBal);
        }

        // Now burn ALL tokens until supply is 0
        address[] memory burnTokens = new address[](1);
        burnTokens[0] = address(usdc);

        // Keep burning until total supply is 0
        while (amicaToken.totalSupply() > 0) {
            uint256 ownerBalance = amicaToken.balanceOf(owner);
            if (ownerBalance > 0) {
                vm.prank(owner);
                amicaToken.burnAndClaim(ownerBalance, burnTokens);
            } else {
                // Find who has tokens and transfer to owner
                for (uint256 i = 0; i < 4; i++) {
                    address user = i == 0
                        ? user1
                        : (i == 1 ? user2 : (i == 2 ? user3 : address(this)));
                    uint256 bal = amicaToken.balanceOf(user);
                    if (bal > 0) {
                        if (user == address(this)) {
                            amicaToken.transfer(owner, bal);
                        } else {
                            vm.prank(user);
                            amicaToken.transfer(owner, bal);
                        }
                        break;
                    }
                }
            }
        }

        // Verify supply is now 0
        assertEq(amicaToken.totalSupply(), 0);

        // Now preview should return 0 for any amount when supply is 0
        address[] memory tokens = new address[](1);
        tokens[0] = address(weth);

        uint256[] memory amounts =
            amicaToken.previewBurnAndClaim(1_000 ether, tokens);
        assertEq(amounts.length, 1);
        assertEq(amounts[0], 0);
    }

    function test_PreviewBurnAndClaim_IncludesAmicaToken() public {
        _setupTokenBalances();

        // Send AMICA to itself
        vm.prank(owner);
        amicaToken.transfer(address(amicaToken), 100_000 ether);

        address[] memory tokens =
            _sortTokens(address(amicaToken), address(usdc));

        uint256[] memory amounts =
            amicaToken.previewBurnAndClaim(1_000 ether, tokens);

        // Both should have values
        assertGt(amounts[0], 0);
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

    function _sortTokens(address a, address b)
        internal
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

    function _sortTokens(address a, address b, address c)
        internal
        pure
        returns (address[] memory)
    {
        address[] memory tokens = new address[](3);
        tokens[0] = a;
        tokens[1] = b;
        tokens[2] = c;

        // Simple bubble sort
        for (uint256 i = 0; i < 3; i++) {
            for (uint256 j = 0; j < 2 - i; j++) {
                if (uint160(tokens[j]) > uint160(tokens[j + 1])) {
                    address temp = tokens[j];
                    tokens[j] = tokens[j + 1];
                    tokens[j + 1] = temp;
                }
            }
        }

        return tokens;
    }

    // Fuzz Tests
    function testFuzz_BurnAndClaim_ProportionalRewards(uint256 burnAmount)
        public
    {
        _setupTokenBalances();

        uint256 userBalance = amicaToken.balanceOf(user1);
        burnAmount = bound(burnAmount, 1, userBalance);

        uint256 totalSupply = amicaToken.totalSupply();
        uint256 usdcBalance = usdc.balanceOf(address(amicaToken));

        address[] memory tokens = new address[](1);
        tokens[0] = address(usdc);

        // Calculate expected amount
        uint256 expectedUsdc = (usdcBalance * burnAmount) / totalSupply;

        // If the expected amount rounds to 0, the contract will revert
        if (expectedUsdc == 0) {
            vm.expectRevert(abi.encodeWithSignature("NoTokensToClaim()"));
            vm.prank(user1);
            amicaToken.burnAndClaim(burnAmount, tokens);
        } else {
            uint256 initialUsdcBalance = usdc.balanceOf(user1);

            vm.prank(user1);
            amicaToken.burnAndClaim(burnAmount, tokens);

            assertEq(usdc.balanceOf(user1), initialUsdcBalance + expectedUsdc);
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

            // Preview should match actual exactly
            assertEq(actualReceived, previewAmounts[0]);
        }
    }
}
