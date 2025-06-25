// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./shared/Fixtures.sol";
import {
    PersonaToken,
    InvalidOwner,
    InvalidSupply,
    InvalidBurnAmount,
    NoTokensSelected,
    TokensMustBeSortedAndUnique,
    NoSupply,
    InvalidTokenAddress,
    TransferFailed,
    NoTokensToClaim
} from "../src/PersonaToken.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

contract PersonaTokenTest is Fixtures {
    PersonaToken public testToken;

    MockERC20 public mockToken1;
    MockERC20 public mockToken2;
    MockERC20 public mockToken3;

    uint256 constant INITIAL_SUPPLY = 1_000_000_000 ether;

    function setUp() public override {
        super.setUp();

        // Clone the persona token implementation from Fixtures
        address cloneAddress = Clones.clone(address(personaToken));
        testToken = PersonaToken(cloneAddress);
        testToken.initialize("Test Token", "TEST", INITIAL_SUPPLY, address(this));

        // Deploy mock tokens for burn and claim tests
        mockToken1 = new MockERC20("Mock Token 1", "MOCK1", 18);
        mockToken2 = new MockERC20("Mock Token 2", "MOCK2", 18);
        mockToken3 = new MockERC20("Mock Token 3", "MOCK3", 18);

        // Mint mock tokens
        mockToken1.mint(address(this), 1_000_000 ether);
        mockToken2.mint(address(this), 1_000_000 ether);
        mockToken3.mint(address(this), 1_000_000 ether);
    }

    // ==================== Initialization Tests ====================

    function test_Initialize_Success() public {
        address cloneAddress = Clones.clone(address(personaToken));
        PersonaToken newToken = PersonaToken(cloneAddress);
        newToken.initialize("New Token", "NEW", 1000 ether, user1);

        assertEq(newToken.name(), "New Token");
        assertEq(newToken.symbol(), "NEW");
        assertEq(newToken.totalSupply(), 1000 ether);
        assertEq(newToken.balanceOf(user1), 1000 ether);
        assertEq(newToken.owner(), user1);
    }

    function test_Initialize_RevertZeroOwner() public {
        address cloneAddress = Clones.clone(address(personaToken));
        PersonaToken newToken = PersonaToken(cloneAddress);
        vm.expectRevert(InvalidOwner.selector);
        newToken.initialize("New Token", "NEW", 1000 ether, address(0));
    }

    function test_Initialize_RevertZeroSupply() public {
        address cloneAddress = Clones.clone(address(personaToken));
        PersonaToken newToken = PersonaToken(cloneAddress);
        vm.expectRevert(InvalidSupply.selector);
        newToken.initialize("New Token", "NEW", 0, user1);
    }

    function test_Initialize_RevertDoubleInitialization() public {
        address cloneAddress = Clones.clone(address(personaToken));
        PersonaToken newToken = PersonaToken(cloneAddress);
        newToken.initialize("New Token", "NEW", 1000 ether, user1);

        vm.expectRevert();
        newToken.initialize("Another Token", "ANOTHER", 2000 ether, user2);
    }

    function test_CirculatingSupply() public {
        assertEq(testToken.circulatingSupply(), INITIAL_SUPPLY);

        // Transfer some tokens
        testToken.transfer(user1, 1000 ether);
        assertEq(testToken.circulatingSupply(), INITIAL_SUPPLY);

        // Burn some tokens
        vm.prank(user1);
        testToken.burn(500 ether);
        assertEq(testToken.circulatingSupply(), INITIAL_SUPPLY - 500 ether);
    }

    // ==================== Burn and Claim Tests ====================

    function test_BurnAndClaim_SingleToken() public {
        // Send tokens to test token contract
        uint256 depositAmount = 1000 ether;
        mockToken1.transfer(address(testToken), depositAmount);

        // Give user1 some test tokens
        testToken.transfer(user1, 100 ether);

        uint256 burnAmount = 50 ether;
        uint256 expectedClaim = (depositAmount * burnAmount) / testToken.totalSupply();

        address[] memory tokens = new address[](1);
        tokens[0] = address(mockToken1);

        vm.prank(user1);
        vm.expectEmit(true, true, false, true);
        emit PersonaToken.TokensBurnedAndClaimed(user1, burnAmount, tokens, _toArray(expectedClaim));
        testToken.burnAndClaim(burnAmount, tokens);

        // Check balances
        assertEq(testToken.balanceOf(user1), 50 ether);
        assertEq(mockToken1.balanceOf(user1), expectedClaim);
        assertEq(mockToken1.balanceOf(address(testToken)), depositAmount - expectedClaim);
    }

    function test_BurnAndClaim_MultipleTokens() public {
        // Send multiple tokens to test token contract
        mockToken1.transfer(address(testToken), 1000 ether);
        mockToken2.transfer(address(testToken), 500 ether);
        mockToken3.transfer(address(testToken), 250 ether);

        // Give user1 some test tokens
        testToken.transfer(user1, 100 ether);

        uint256 burnAmount = 10 ether;

        // Sort tokens by address
        address[] memory tokens = _sortAddresses(address(mockToken1), address(mockToken2), address(mockToken3));

        vm.prank(user1);
        testToken.burnAndClaim(burnAmount, tokens);

        // Check user received proportional amounts
        assertGt(mockToken1.balanceOf(user1), 0);
        assertGt(mockToken2.balanceOf(user1), 0);
        assertGt(mockToken3.balanceOf(user1), 0);
    }

    function test_BurnAndClaim_OwnTokens() public {
        // Send test tokens to itself
        testToken.transfer(address(testToken), 500 ether);

        // Give user1 some test tokens
        testToken.transfer(user1, 100 ether);

        uint256 burnAmount = 50 ether;
        uint256 balanceBefore = testToken.balanceOf(user1);

        address[] memory tokens = new address[](1);
        tokens[0] = address(testToken);

        vm.prank(user1);
        testToken.burnAndClaim(burnAmount, tokens);

        // User should have received some tokens back (minus burned)
        assertGt(testToken.balanceOf(user1), balanceBefore - burnAmount);
    }

    function test_BurnAndClaim_RevertZeroBurnAmount() public {
        address[] memory tokens = new address[](1);
        tokens[0] = address(mockToken1);

        vm.expectRevert(InvalidBurnAmount.selector);
        testToken.burnAndClaim(0, tokens);
    }

    function test_BurnAndClaim_RevertNoTokensSelected() public {
        address[] memory tokens = new address[](0);

        vm.expectRevert(NoTokensSelected.selector);
        testToken.burnAndClaim(100 ether, tokens);
    }

    function test_BurnAndClaim_RevertUnsortedTokens() public {
        testToken.transfer(user1, 100 ether);

        address[] memory tokens = new address[](2);
        // Intentionally unsorted
        if (uint160(address(mockToken1)) < uint160(address(mockToken2))) {
            tokens[0] = address(mockToken2);
            tokens[1] = address(mockToken1);
        } else {
            tokens[0] = address(mockToken1);
            tokens[1] = address(mockToken2);
        }

        vm.prank(user1);
        vm.expectRevert(TokensMustBeSortedAndUnique.selector);
        testToken.burnAndClaim(50 ether, tokens);
    }

    function test_BurnAndClaim_RevertDuplicateTokens() public {
        testToken.transfer(user1, 100 ether);

        address[] memory tokens = new address[](2);
        tokens[0] = address(mockToken1);
        tokens[1] = address(mockToken1);

        vm.prank(user1);
        vm.expectRevert(TokensMustBeSortedAndUnique.selector);
        testToken.burnAndClaim(50 ether, tokens);
    }

    function test_BurnAndClaim_RevertZeroAddressToken() public {
        testToken.transfer(user1, 100 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(0);

        vm.prank(user1);
        vm.expectRevert(InvalidTokenAddress.selector);
        testToken.burnAndClaim(50 ether, tokens);
    }

    function test_BurnAndClaim_RevertNoTokensToClaim() public {
        testToken.transfer(user1, 100 ether);

        // Don't send any tokens to the contract
        address[] memory tokens = new address[](1);
        tokens[0] = address(mockToken1);

        vm.prank(user1);
        vm.expectRevert(NoTokensToClaim.selector);
        testToken.burnAndClaim(50 ether, tokens);
    }

    function test_BurnAndClaim_RevertInsufficientBalance() public {
        testToken.transfer(user1, 50 ether);
        mockToken1.transfer(address(testToken), 1000 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(mockToken1);

        vm.prank(user1);
        vm.expectRevert(); // Will revert with ERC20InsufficientBalance
        testToken.burnAndClaim(100 ether, tokens);
    }

    function test_BurnAndClaim_RevertNoSupply() public {
        // Create a new token
        address cloneAddress = Clones.clone(address(personaToken));
        PersonaToken zeroSupplyToken = PersonaToken(cloneAddress);
        zeroSupplyToken.initialize("Zero Supply", "ZERO", 100 ether, address(this));

        // Burn all supply
        zeroSupplyToken.burn(100 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(mockToken1);

        vm.expectRevert(NoSupply.selector);
        zeroSupplyToken.burnAndClaim(1 ether, tokens);
    }

    // ==================== Preview Burn and Claim Tests ====================

    function test_PreviewBurnAndClaim_Accurate() public {
        // Send tokens to test token contract
        mockToken1.transfer(address(testToken), 1000 ether);
        mockToken2.transfer(address(testToken), 500 ether);

        testToken.transfer(user1, 100 ether);

        uint256 burnAmount = 50 ether;

        address[] memory tokens = _sortAddresses(address(mockToken1), address(mockToken2));

        // Get user's initial balances
        uint256 user1Mock1Before = mockToken1.balanceOf(user1);
        uint256 user1Mock2Before = mockToken2.balanceOf(user1);

        // Preview the burn
        uint256[] memory preview = testToken.previewBurnAndClaim(burnAmount, tokens);

        // Calculate expected amounts based on burn proportion
        uint256 totalSupply = testToken.totalSupply();

        // Find which token is first in sorted array
        if (tokens[0] == address(mockToken1)) {
            uint256 expectedMock1 = (1000 ether * burnAmount) / totalSupply;
            uint256 expectedMock2 = (500 ether * burnAmount) / totalSupply;
            assertEq(preview[0], expectedMock1, "Preview mock1 mismatch");
            assertEq(preview[1], expectedMock2, "Preview mock2 mismatch");
        } else {
            uint256 expectedMock1 = (1000 ether * burnAmount) / totalSupply;
            uint256 expectedMock2 = (500 ether * burnAmount) / totalSupply;
            assertEq(preview[0], expectedMock2, "Preview mock2 mismatch");
            assertEq(preview[1], expectedMock1, "Preview mock1 mismatch");
        }

        // Actually burn and claim
        vm.prank(user1);
        testToken.burnAndClaim(burnAmount, tokens);

        // Check actual amounts received match preview
        if (tokens[0] == address(mockToken1)) {
            assertEq(mockToken1.balanceOf(user1) - user1Mock1Before, preview[0], "Actual mock1 != preview");
            assertEq(mockToken2.balanceOf(user1) - user1Mock2Before, preview[1], "Actual mock2 != preview");
        } else {
            assertEq(mockToken2.balanceOf(user1) - user1Mock2Before, preview[0], "Actual mock2 != preview");
            assertEq(mockToken1.balanceOf(user1) - user1Mock1Before, preview[1], "Actual mock1 != preview");
        }
    }

    function test_PreviewBurnAndClaim_ZeroForNoBalance() public {
        address[] memory tokens = new address[](1);
        tokens[0] = address(mockToken1);

        uint256[] memory preview = testToken.previewBurnAndClaim(100 ether, tokens);
        assertEq(preview[0], 0);
    }

    function test_PreviewBurnAndClaim_ZeroBurnAmount() public {
        mockToken1.transfer(address(testToken), 1000 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(mockToken1);

        uint256[] memory preview = testToken.previewBurnAndClaim(0, tokens);
        assertEq(preview[0], 0);
    }

    function test_PreviewBurnAndClaim_ZeroSupply() public {
        address cloneAddress = Clones.clone(address(personaToken));
        PersonaToken zeroSupplyToken = PersonaToken(cloneAddress);
        zeroSupplyToken.initialize("Zero Supply", "ZERO", 100 ether, address(this));
        zeroSupplyToken.burn(100 ether);

        mockToken1.transfer(address(zeroSupplyToken), 1000 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(mockToken1);

        uint256[] memory preview = zeroSupplyToken.previewBurnAndClaim(10 ether, tokens);
        assertEq(preview[0], 0);
    }

    // ==================== Edge Cases ====================

    function test_BurnAndClaim_VerySmallAmounts() public {
        // Send a large amount to ensure non-zero claims
        uint256 largeDeposit = 1_000_000 ether;
        mockToken1.transfer(address(testToken), largeDeposit);

        testToken.transfer(user1, 1000 ether);

        // Calculate minimum burn for at least 1 wei claim
        uint256 totalSupply = testToken.totalSupply();
        uint256 minBurnForClaim = (totalSupply / largeDeposit) + 1;

        address[] memory tokens = new address[](1);
        tokens[0] = address(mockToken1);

        vm.prank(user1);
        testToken.burnAndClaim(minBurnForClaim, tokens);

        assertGt(mockToken1.balanceOf(user1), 0);
    }

    function test_BurnAndClaim_EntireBalance() public {
        mockToken1.transfer(address(testToken), 1000 ether);

        uint256 userBalance = 100 ether;
        testToken.transfer(user1, userBalance);

        address[] memory tokens = new address[](1);
        tokens[0] = address(mockToken1);

        vm.prank(user1);
        testToken.burnAndClaim(userBalance, tokens);

        assertEq(testToken.balanceOf(user1), 0);
        assertGt(mockToken1.balanceOf(user1), 0);
    }

    function test_BurnAndClaim_MultipleUsersConcurrent() public {
        mockToken1.transfer(address(testToken), 10000 ether);

        testToken.transfer(user1, 100 ether);
        testToken.transfer(user2, 200 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(mockToken1);

        // Both users burn
        vm.prank(user1);
        testToken.burnAndClaim(50 ether, tokens);

        vm.prank(user2);
        testToken.burnAndClaim(100 ether, tokens);

        // Both should have received tokens
        assertGt(mockToken1.balanceOf(user1), 0);
        assertGt(mockToken1.balanceOf(user2), 0);
    }

    function test_BurnAndClaim_DifferentDecimals() public {
        // Deploy tokens with different decimals
        MockERC20 token6Decimals = new MockERC20("Six Decimals", "SIX", 6);
        MockERC20 token18Decimals = new MockERC20("Eighteen Decimals", "EIGHTEEN", 18);

        token6Decimals.mint(address(this), 1_000_000 * 10 ** 6);
        token18Decimals.mint(address(this), 1_000_000 ether);

        // Send to test token
        token6Decimals.transfer(address(testToken), 1000 * 10 ** 6);
        token18Decimals.transfer(address(testToken), 1000 ether);

        testToken.transfer(user1, 100 ether);

        address[] memory tokens = _sortAddresses(address(token6Decimals), address(token18Decimals));

        vm.prank(user1);
        testToken.burnAndClaim(50 ether, tokens);

        assertGt(token6Decimals.balanceOf(user1), 0);
        assertGt(token18Decimals.balanceOf(user1), 0);
    }

    function test_BurnAndClaim_ManyTokensAtOnce() public {
        MockERC20[] memory manyTokens = new MockERC20[](10);
        address[] memory tokenAddresses = new address[](10);

        // Deploy and setup 10 tokens
        for (uint256 i = 0; i < 10; i++) {
            manyTokens[i] = new MockERC20(
                string(abi.encodePacked("Token", vm.toString(i))), string(abi.encodePacked("TK", vm.toString(i))), 18
            );
            manyTokens[i].mint(address(this), 1_000_000 ether);
            manyTokens[i].transfer(address(testToken), (i + 1) * 100 ether);
            tokenAddresses[i] = address(manyTokens[i]);
        }

        // Sort addresses
        tokenAddresses = _sortAddressArray(tokenAddresses);

        testToken.transfer(user1, 100 ether);

        vm.prank(user1);
        testToken.burnAndClaim(50 ether, tokenAddresses);

        // Check all tokens were received
        for (uint256 i = 0; i < 10; i++) {
            assertGt(IERC20(tokenAddresses[i]).balanceOf(user1), 0);
        }
    }

    function test_BurnAndClaim_MaintainsInvariants() public {
        uint256 initialDeposit = 10000 ether;
        mockToken1.transfer(address(testToken), initialDeposit);

        testToken.transfer(user1, 300 ether);
        testToken.transfer(user2, 200 ether);
        testToken.transfer(user3, 100 ether);

        uint256 initialSupply = testToken.totalSupply();
        uint256 totalClaimed = 0;

        address[] memory tokens = new address[](1);
        tokens[0] = address(mockToken1);

        // Multiple burn cycles
        for (uint256 i = 0; i < 5; i++) {
            address user = i % 3 == 0 ? user1 : (i % 3 == 1 ? user2 : user3);
            uint256 userBalance = testToken.balanceOf(user);

            if (userBalance > 10 ether) {
                uint256 burnAmount = userBalance / 10;
                uint256 balanceBefore = mockToken1.balanceOf(user);

                vm.prank(user);
                testToken.burnAndClaim(burnAmount, tokens);

                totalClaimed += mockToken1.balanceOf(user) - balanceBefore;
            }
        }

        uint256 finalSupply = testToken.totalSupply();
        uint256 finalContractBalance = mockToken1.balanceOf(address(testToken));

        // Supply should have decreased
        assertLt(finalSupply, initialSupply);

        // Total tokens should be conserved
        assertEq(finalContractBalance + totalClaimed, initialDeposit);
    }

    // ==================== Reentrancy Test ====================

    function test_BurnAndClaim_NonReentrant() public {
        // This verifies the nonReentrant modifier is applied
        // We can't easily test actual reentrancy without a malicious contract
        // but we can verify normal execution works
        mockToken1.transfer(address(testToken), 1000 ether);
        testToken.transfer(user1, 100 ether);

        address[] memory tokens = new address[](1);
        tokens[0] = address(mockToken1);

        vm.prank(user1);
        testToken.burnAndClaim(50 ether, tokens);

        // Should complete without reverting
        assertGt(mockToken1.balanceOf(user1), 0);
    }

    // ==================== Helper Functions ====================

    function _sortAddresses(address a, address b) private pure returns (address[] memory) {
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

    function _sortAddresses(address a, address b, address c) private pure returns (address[] memory) {
        address[] memory addrs = new address[](3);
        addrs[0] = a;
        addrs[1] = b;
        addrs[2] = c;
        return _sortAddressArray(addrs);
    }

    function _sortAddressArray(address[] memory addrs) private pure returns (address[] memory) {
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

    function _toArray(uint256 value) private pure returns (uint256[] memory) {
        uint256[] memory array = new uint256[](1);
        array[0] = value;
        return array;
    }
}
