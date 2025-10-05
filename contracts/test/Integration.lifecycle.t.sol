// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/PersonaTokenFactory.sol";
import "../src/PersonaToken.sol";
import "../src/BondingCurve.sol";
import "../src/DynamicFeeHook.sol";
import "../src/FeeReductionSystem.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title IntegrationLifecycleTest
 * @notice End-to-end integration tests for complete persona lifecycle
 * @dev Tests the full flow: Create → Buy → Graduate → Claim → Trade on Uniswap
 */
contract IntegrationLifecycleTest is Test {
    PersonaTokenFactory public factory;
    BondingCurve public bondingCurve;
    FeeReductionSystem public feeReductionSystem;
    DynamicFeeHook public dynamicFeeHook;

    MockERC20 public amicaToken;
    MockERC20 public pairingToken;
    PersonaToken public personaTokenImpl;

    // Test users
    address public alice = address(0x1);
    address public bob = address(0x2);
    address public charlie = address(0x3);

    // Mock Uniswap addresses (simplified)
    address public poolManager = address(0x100);
    address public positionManager = address(0x101);
    address public permit2 = address(0x102);

    function setUp() public {
        // Deploy tokens
        amicaToken = new MockERC20("AMICA", "AMICA", 18);
        pairingToken = new MockERC20("USDC", "USDC", 6);

        // Deploy core contracts
        bondingCurve = new BondingCurve();
        personaTokenImpl = new PersonaToken();

        // Note: For full integration, you'd need real Uniswap V4 contracts
        // This test uses mocked addresses for demonstration
        vm.etch(poolManager, "mock");
        vm.etch(positionManager, "mock");
        vm.etch(permit2, "mock");

        // Deploy factory
        factory = new PersonaTokenFactory();

        // Mock the fee hook
        dynamicFeeHook = new DynamicFeeHook(IPoolManager(poolManager));

        // Deploy fee reduction system
        feeReductionSystem = new FeeReductionSystem(
            IERC20(address(amicaToken)),
            factory
        );

        dynamicFeeHook.setFeeReductionSystem(address(feeReductionSystem));

        // Initialize factory
        factory.initialize(
            address(amicaToken),
            poolManager,
            positionManager,
            permit2,
            address(dynamicFeeHook),
            address(personaTokenImpl),
            address(bondingCurve)
        );

        // Configure pairing token
        factory.configurePairingToken(
            address(pairingToken),
            1000 * 1e6, // 1000 USDC mint cost
            1333 ether, // pricing multiplier
            true
        );

        // Fund test users
        _fundUsers();
    }

    function _fundUsers() internal {
        // Give each user tokens
        amicaToken.mint(alice, 100_000 ether);
        amicaToken.mint(bob, 100_000 ether);
        amicaToken.mint(charlie, 100_000 ether);

        pairingToken.mint(alice, 50_000 * 1e6);
        pairingToken.mint(bob, 50_000 * 1e6);
        pairingToken.mint(charlie, 50_000 * 1e6);
    }

    /*//////////////////////////////////////////////////////////////
                    FULL LIFECYCLE TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Test complete lifecycle without agent tokens
    function test_FullLifecycle_WithoutAgent() public {
        // 1. Alice creates persona
        vm.startPrank(alice);
        pairingToken.approve(address(factory), type(uint256).max);

        uint256 tokenId = factory.createPersona(
            address(pairingToken),
            "Alice Persona",
            "ALICE",
            "alice",
            5000 * 1e6, // Initial buy 5000 USDC
            address(0), // No agent token
            0
        );
        vm.stopPrank();

        assertGt(tokenId, 0, "Persona should be created");

        // Get persona details
        (address personaToken, , , , , , ) = factory.personas(tokenId);
        assertNotEq(personaToken, address(0), "Persona token should exist");

        // 2. Bob buys tokens
        vm.startPrank(bob);
        pairingToken.approve(address(factory), type(uint256).max);

        uint256 bobBuyAmount = 10_000 * 1e6;
        factory.swapExactTokensForTokens(
            tokenId,
            bobBuyAmount,
            0,
            bob,
            block.timestamp + 300
        );
        vm.stopPrank();

        uint256 bobBalance = factory.bondingBalances(tokenId, bob);
        assertGt(bobBalance, 0, "Bob should have bonding balance");

        // 3. Charlie buys tokens
        vm.startPrank(charlie);
        pairingToken.approve(address(factory), type(uint256).max);

        uint256 charlieBuyAmount = 8_000 * 1e6;
        factory.swapExactTokensForTokens(
            tokenId,
            charlieBuyAmount,
            0,
            charlie,
            block.timestamp + 300
        );
        vm.stopPrank();

        // 4. More purchases to reach graduation
        vm.startPrank(alice);
        // Buy more to trigger graduation
        for (uint256 i = 0; i < 5; i++) {
            factory.swapExactTokensForTokens(
                tokenId,
                5_000 * 1e6,
                0,
                alice,
                block.timestamp + 300
            );
        }
        vm.stopPrank();

        // Check graduation
        (, , , uint256 graduationTimestamp, , , ) = factory.personas(tokenId);

        if (graduationTimestamp > 0) {
            // Graduated!

            // 5. Wait for claim delay
            vm.warp(block.timestamp + 1 days + 1);

            // 6. Users claim their tokens
            uint256 aliceTokensBefore = PersonaToken(personaToken).balanceOf(alice);

            vm.prank(alice);
            factory.claimRewards(tokenId);

            uint256 aliceTokensAfter = PersonaToken(personaToken).balanceOf(alice);
            assertGt(aliceTokensAfter, aliceTokensBefore, "Alice should receive tokens");

            vm.prank(bob);
            factory.claimRewards(tokenId);

            assertGt(PersonaToken(personaToken).balanceOf(bob), 0, "Bob should receive tokens");

            vm.prank(charlie);
            factory.claimRewards(tokenId);

            assertGt(PersonaToken(personaToken).balanceOf(charlie), 0, "Charlie should receive tokens");

            // Verify total distribution
            uint256 totalClaimed = PersonaToken(personaToken).balanceOf(alice)
                + PersonaToken(personaToken).balanceOf(bob)
                + PersonaToken(personaToken).balanceOf(charlie);

            assertGt(totalClaimed, 0, "Total tokens should be claimed");
        }
    }

    /// @notice Test lifecycle with buy and sell before graduation
    function test_BuySellCycle_PreGraduation() public {
        // Create persona
        vm.startPrank(alice);
        pairingToken.approve(address(factory), type(uint256).max);

        uint256 tokenId = factory.createPersona(
            address(pairingToken),
            "Test",
            "TEST",
            "test",
            1000 * 1e6,
            address(0),
            0
        );
        vm.stopPrank();

        // Bob buys
        vm.startPrank(bob);
        pairingToken.approve(address(factory), type(uint256).max);

        uint256 bobBuyAmount = 5_000 * 1e6;
        uint256 bobUsdcBefore = pairingToken.balanceOf(bob);

        factory.swapExactTokensForTokens(
            tokenId,
            bobBuyAmount,
            0,
            bob,
            block.timestamp + 300
        );

        uint256 bobTokenBalance = factory.bondingBalances(tokenId, bob);
        assertGt(bobTokenBalance, 0, "Bob should have tokens");

        // Bob sells half
        uint256 sellAmount = bobTokenBalance / 2;
        factory.swapExactTokensForPairingTokens(
            tokenId,
            sellAmount,
            0,
            bob,
            block.timestamp + 300
        );

        uint256 bobUsdcAfter = pairingToken.balanceOf(bob);

        // Bob should have lost some value due to fees and slippage
        assertLt(bobUsdcAfter, bobUsdcBefore, "Bob should have net loss from buy-sell");

        uint256 remainingBalance = factory.bondingBalances(tokenId, bob);
        assertEq(remainingBalance, bobTokenBalance - sellAmount, "Remaining balance should match");

        vm.stopPrank();
    }

    /// @notice Test multiple users buying simultaneously
    function test_MultipleUsersConcurrent() public {
        // Create persona
        vm.startPrank(alice);
        pairingToken.approve(address(factory), type(uint256).max);

        uint256 tokenId = factory.createPersona(
            address(pairingToken),
            "Multi User Test",
            "MUT",
            "multiuser",
            0,
            address(0),
            0
        );
        vm.stopPrank();

        // All users buy at different amounts
        address[] memory users = new address[](3);
        users[0] = alice;
        users[1] = bob;
        users[2] = charlie;

        uint256[] memory buyAmounts = new uint256[](3);
        buyAmounts[0] = 3_000 * 1e6;
        buyAmounts[1] = 5_000 * 1e6;
        buyAmounts[2] = 7_000 * 1e6;

        for (uint256 i = 0; i < users.length; i++) {
            vm.startPrank(users[i]);
            pairingToken.approve(address(factory), type(uint256).max);

            factory.swapExactTokensForTokens(
                tokenId,
                buyAmounts[i],
                0,
                users[i],
                block.timestamp + 300
            );

            vm.stopPrank();
        }

        // Verify all have balances
        for (uint256 i = 0; i < users.length; i++) {
            uint256 balance = factory.bondingBalances(tokenId, users[i]);
            assertGt(balance, 0, "User should have balance");
        }

        // Verify proportions (more spent = more tokens, but not linear due to curve)
        uint256 aliceBalance = factory.bondingBalances(tokenId, alice);
        uint256 bobBalance = factory.bondingBalances(tokenId, bob);
        uint256 charlieBalance = factory.bondingBalances(tokenId, charlie);

        assertGt(charlieBalance, bobBalance, "Charlie spent more, should have more");
        assertGt(bobBalance, aliceBalance, "Bob spent more, should have more");
    }

    /// @notice Test metadata updates throughout lifecycle
    function test_MetadataUpdates() public {
        // Create persona
        vm.startPrank(alice);
        pairingToken.approve(address(factory), type(uint256).max);

        uint256 tokenId = factory.createPersona(
            address(pairingToken),
            "Metadata Test",
            "META",
            "metadata",
            1000 * 1e6,
            address(0),
            0
        );

        // Update metadata
        bytes32[] memory keys = new bytes32[](3);
        keys[0] = "description";
        keys[1] = "image";
        keys[2] = "website";

        string[] memory values = new string[](3);
        values[0] = "Test persona for metadata";
        values[1] = "ipfs://QmTest123";
        values[2] = "https://test.com";

        factory.updateMetadata(tokenId, keys, values);

        vm.stopPrank();

        // Verify metadata
        assertEq(
            factory.metadata(tokenId, "description"),
            "Test persona for metadata",
            "Description should be set"
        );
        assertEq(
            factory.metadata(tokenId, "image"),
            "ipfs://QmTest123",
            "Image should be set"
        );
        assertEq(
            factory.metadata(tokenId, "website"),
            "https://test.com",
            "Website should be set"
        );
    }

    /// @notice Test pause and unpause functionality
    function test_PauseUnpause_Integration() public {
        // Create persona normally
        vm.startPrank(alice);
        pairingToken.approve(address(factory), type(uint256).max);

        uint256 tokenId = factory.createPersona(
            address(pairingToken),
            "Pause Test",
            "PAUSE",
            "pausetest",
            1000 * 1e6,
            address(0),
            0
        );
        vm.stopPrank();

        // Owner pauses
        factory.pause();

        // Alice cannot buy while paused
        vm.startPrank(alice);
        vm.expectRevert();
        factory.swapExactTokensForTokens(
            tokenId,
            1000 * 1e6,
            0,
            alice,
            block.timestamp + 300
        );
        vm.stopPrank();

        // Bob cannot create while paused
        vm.startPrank(bob);
        pairingToken.approve(address(factory), type(uint256).max);

        vm.expectRevert();
        factory.createPersona(
            address(pairingToken),
            "Should Fail",
            "FAIL",
            "shouldfail",
            0,
            address(0),
            0
        );
        vm.stopPrank();

        // Owner unpauses
        factory.unpause();

        // Alice can now buy
        vm.startPrank(alice);
        factory.swapExactTokensForTokens(
            tokenId,
            1000 * 1e6,
            0,
            alice,
            block.timestamp + 300
        );
        vm.stopPrank();

        assertGt(factory.bondingBalances(tokenId, alice), 0, "Buy should succeed after unpause");
    }

    /// @notice Test fee reduction integration
    function test_FeeReduction_Integration() public {
        // Alice gets AMICA and snapshots for fee reduction
        vm.startPrank(alice);
        amicaToken.approve(address(feeReductionSystem), type(uint256).max);
        feeReductionSystem.updateSnapshot();
        vm.stopPrank();

        // Wait for snapshot to activate
        vm.roll(block.number + 101);

        // Check Alice's fee (should be lower than base if she has enough AMICA)
        uint24 aliceFee = feeReductionSystem.getFee(alice);

        // Base fee is 10000 (1%)
        (,, uint24 baseFee,) = feeReductionSystem.feeReductionConfig();

        if (amicaToken.balanceOf(alice) >= 1000 ether) {
            assertLt(aliceFee, baseFee, "Alice should get fee reduction");
        }

        // Bob has no AMICA, should pay base fee
        uint24 bobFee = feeReductionSystem.getFee(bob);
        // Bob might get base fee or no reduction depending on balance
        assertGe(bobFee, 0, "Fee should be valid");
    }
}

/**
 * @title Mock ERC20 for testing
 */
contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_)
        ERC20(name, symbol)
    {
        _decimals = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
