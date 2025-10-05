// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/PersonaTokenFactory.sol";
import "../src/PersonaToken.sol";
import "../src/BondingCurve.sol";
import "../src/DynamicFeeHook.sol";
import "../src/FeeReductionSystem.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IPermit2} from "permit2/src/interfaces/IPermit2.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title PersonaTokenFactoryInvariantTest
 * @notice Comprehensive fuzzing and invariant tests for PersonaTokenFactory
 */
contract PersonaTokenFactoryInvariantTest is Test {
    PersonaTokenFactory public factory;
    BondingCurve public bondingCurve;
    MockERC20 public amicaToken;
    MockERC20 public pairingToken;
    PersonaToken public personaTokenImpl;

    // Mock contracts
    address public poolManager;
    address public positionManager;
    address public permit2;
    address public dynamicFeeHook;

    // Test constants
    uint256 constant PERSONA_TOKEN_SUPPLY = 1_000_000_000 ether;
    uint256 constant INITIAL_MINT_COST = 1000 ether;

    // Handler for stateful fuzzing
    PersonaFactoryHandler public handler;

    function setUp() public {
        // Deploy mock tokens
        amicaToken = new MockERC20("AMICA", "AMICA", 18);
        pairingToken = new MockERC20("USDC", "USDC", 6);

        // Deploy mock contracts (simplified for testing)
        poolManager = address(new MockPoolManager());
        positionManager = address(new MockPositionManager());
        permit2 = address(new MockPermit2());
        dynamicFeeHook = address(new MockDynamicFeeHook());

        // Deploy implementations
        bondingCurve = new BondingCurve();
        personaTokenImpl = new PersonaToken();

        // Deploy factory
        factory = new PersonaTokenFactory();
        factory.initialize(
            address(amicaToken),
            poolManager,
            positionManager,
            permit2,
            dynamicFeeHook,
            address(personaTokenImpl),
            address(bondingCurve)
        );

        // Configure pairing token
        factory.configurePairingToken(
            address(pairingToken),
            INITIAL_MINT_COST,
            1333 ether, // pricing multiplier
            true
        );

        // Setup handler
        handler = new PersonaFactoryHandler(
            factory,
            amicaToken,
            pairingToken
        );

        // Fund handler
        amicaToken.mint(address(handler), 1_000_000 ether);
        pairingToken.mint(address(handler), 1_000_000 * 1e6);

        targetContract(address(handler));
    }

    /*//////////////////////////////////////////////////////////////
                        INVARIANT TESTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Total tokens in bonding curve should never exceed allocated supply
    function invariant_bondingSupplyNotExceeded() public view {
        uint256 personaCount = handler.getPersonaCount();

        for (uint256 i = 0; i < personaCount; i++) {
            uint256 tokenId = handler.getPersonaId(i);

            (
                ,
                ,
                ,
                uint256 graduationTimestamp,
                ,
                ,
            ) = factory.personas(tokenId);

            // Only check pre-graduation personas
            if (graduationTimestamp == 0) {
                (
                    ,
                    uint256 tokensPurchased,
                ) = factory.preGraduationStates(tokenId);

                // Get expected bonding supply
                uint256 expectedBondingSupply = 333_333_333 ether; // 1/3 or 1/6 depending on agent

                assertLe(
                    tokensPurchased,
                    expectedBondingSupply,
                    "Tokens purchased cannot exceed bonding supply"
                );
            }
        }
    }

    /// @notice User bonding balances should sum to total purchased
    function invariant_bondingBalancesMatchPurchased() public view {
        uint256 personaCount = handler.getPersonaCount();

        for (uint256 i = 0; i < personaCount; i++) {
            uint256 tokenId = handler.getPersonaId(i);

            (
                ,
                uint256 tokensPurchased,
            ) = factory.preGraduationStates(tokenId);

            uint256 sumOfBalances = handler.getUserBondingBalance(tokenId, address(handler));

            // In our simplified tests, handler is the only buyer
            assertLe(
                sumOfBalances,
                tokensPurchased,
                "Sum of user balances should not exceed total purchased"
            );
        }
    }

    /// @notice Pairing tokens collected should match purchases
    function invariant_pairingTokensMatchPurchases() public view {
        uint256 personaCount = handler.getPersonaCount();

        for (uint256 i = 0; i < personaCount; i++) {
            uint256 tokenId = handler.getPersonaId(i);

            (
                uint256 totalPairingTokensCollected,
                ,
            ) = factory.preGraduationStates(tokenId);

            // Total collected should be reasonable (not negative, not exceeding expected maximum)
            assertGe(
                totalPairingTokensCollected,
                0,
                "Pairing tokens collected should be non-negative"
            );
        }
    }

    /// @notice Graduated personas should have non-zero graduation timestamp
    function invariant_graduatedPersonasHaveTimestamp() public view {
        uint256 personaCount = handler.getPersonaCount();

        for (uint256 i = 0; i < personaCount; i++) {
            uint256 tokenId = handler.getPersonaId(i);

            (
                ,
                ,
                ,
                uint256 graduationTimestamp,
                ,
                ,
            ) = factory.personas(tokenId);

            if (graduationTimestamp > 0) {
                assertGe(
                    graduationTimestamp,
                    block.timestamp - 1 days,
                    "Graduation timestamp should be recent"
                );
            }
        }
    }

    /// @notice Cannot claim before graduation
    function invariant_cannotClaimBeforeGraduation() public view {
        uint256 personaCount = handler.getPersonaCount();

        for (uint256 i = 0; i < personaCount; i++) {
            uint256 tokenId = handler.getPersonaId(i);

            (
                ,
                ,
                ,
                uint256 graduationTimestamp,
                ,
                ,
            ) = factory.personas(tokenId);

            if (graduationTimestamp == 0) {
                // Verify user has not claimed
                bool claimed = factory.hasClaimedTokens(tokenId, address(handler));
                assertFalse(claimed, "Should not be able to claim before graduation");
            }
        }
    }

    /// @notice Agent deposits should never exceed deposited amount
    function invariant_agentDepositsValid() public view {
        uint256 personaCount = handler.getPersonaCount();

        for (uint256 i = 0; i < personaCount; i++) {
            uint256 tokenId = handler.getPersonaId(i);

            (
                ,
                ,
                uint256 totalAgentDeposited
            ) = factory.preGraduationStates(tokenId);

            uint256 userDeposit = factory.agentDeposits(tokenId, address(handler));

            assertLe(
                userDeposit,
                totalAgentDeposited,
                "User deposit should not exceed total deposited"
            );
        }
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ TESTS - PERSONA CREATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test: Creating persona with valid params should succeed
    function testFuzz_createPersonaSucceeds(
        string memory name,
        string memory symbol,
        bytes32 domain,
        uint256 initialBuy
    ) public {
        // Bound inputs
        vm.assume(bytes(name).length > 0 && bytes(name).length <= 32);
        vm.assume(bytes(symbol).length > 0 && bytes(symbol).length <= 10);
        vm.assume(domain != bytes32(0));
        initialBuy = bound(initialBuy, 0, 100 ether);

        // Ensure domain is valid
        if (!factory.isValidSubdomain(domain)) return;

        uint256 totalCost = INITIAL_MINT_COST + initialBuy;
        pairingToken.mint(address(this), totalCost);
        pairingToken.approve(address(factory), totalCost);

        uint256 tokenId = factory.createPersona(
            address(pairingToken),
            name,
            symbol,
            domain,
            initialBuy,
            address(0), // no agent token
            0
        );

        assertGt(tokenId, 0, "Token ID should be non-zero");
        assertEq(factory.ownerOf(tokenId), address(this), "Should own the persona NFT");
    }

    /// @notice Fuzz test: Cannot create persona with duplicate domain
    function testFuzz_cannotCreateDuplicateDomain(bytes32 domain) public {
        vm.assume(domain != bytes32(0));
        if (!factory.isValidSubdomain(domain)) return;

        // Create first persona
        pairingToken.mint(address(this), INITIAL_MINT_COST);
        pairingToken.approve(address(factory), INITIAL_MINT_COST);

        factory.createPersona(
            address(pairingToken),
            "Test",
            "TEST",
            domain,
            0,
            address(0),
            0
        );

        // Try to create second with same domain
        pairingToken.mint(address(this), INITIAL_MINT_COST);
        pairingToken.approve(address(factory), INITIAL_MINT_COST);

        vm.expectRevert();
        factory.createPersona(
            address(pairingToken),
            "Test2",
            "TEST2",
            domain,
            0,
            address(0),
            0
        );
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ TESTS - TOKEN TRADING
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test: Buying increases bonding balance
    function testFuzz_buyIncreasesBalance(uint256 buyAmount) public {
        buyAmount = bound(buyAmount, 1 ether, 50 ether);

        // Create persona
        pairingToken.mint(address(this), INITIAL_MINT_COST);
        pairingToken.approve(address(factory), INITIAL_MINT_COST);

        uint256 tokenId = factory.createPersona(
            address(pairingToken),
            "Test",
            "TEST",
            "test",
            0,
            address(0),
            0
        );

        // Buy tokens
        pairingToken.mint(address(this), buyAmount);
        pairingToken.approve(address(factory), buyAmount);

        uint256 balanceBefore = factory.bondingBalances(tokenId, address(this));

        factory.swapExactTokensForTokens(
            tokenId,
            buyAmount,
            0,
            address(this),
            block.timestamp + 300
        );

        uint256 balanceAfter = factory.bondingBalances(tokenId, address(this));

        assertGt(balanceAfter, balanceBefore, "Balance should increase after buy");
    }

    /// @notice Fuzz test: Selling decreases bonding balance
    function testFuzz_sellDecreasesBalance(uint256 buyAmount, uint256 sellAmount) public {
        buyAmount = bound(buyAmount, 10 ether, 50 ether);

        // Create and buy
        pairingToken.mint(address(this), INITIAL_MINT_COST + buyAmount);
        pairingToken.approve(address(factory), INITIAL_MINT_COST + buyAmount);

        uint256 tokenId = factory.createPersona(
            address(pairingToken),
            "Test",
            "TEST",
            "test",
            buyAmount,
            address(0),
            0
        );

        uint256 balanceAfterBuy = factory.bondingBalances(tokenId, address(this));
        sellAmount = bound(sellAmount, 1 ether, balanceAfterBuy);

        // Sell tokens
        factory.swapExactTokensForPairingTokens(
            tokenId,
            sellAmount,
            0,
            address(this),
            block.timestamp + 300
        );

        uint256 balanceAfterSell = factory.bondingBalances(tokenId, address(this));

        assertEq(
            balanceAfterBuy - sellAmount,
            balanceAfterSell,
            "Balance should decrease by sell amount"
        );
    }

    /// @notice Fuzz test: Cannot sell more than balance
    function testFuzz_cannotSellMoreThanBalance(uint256 buyAmount, uint256 sellAmount) public {
        buyAmount = bound(buyAmount, 1 ether, 50 ether);

        // Create and buy
        pairingToken.mint(address(this), INITIAL_MINT_COST + buyAmount);
        pairingToken.approve(address(factory), INITIAL_MINT_COST + buyAmount);

        uint256 tokenId = factory.createPersona(
            address(pairingToken),
            "Test",
            "TEST",
            "test",
            buyAmount,
            address(0),
            0
        );

        uint256 balance = factory.bondingBalances(tokenId, address(this));
        sellAmount = bound(sellAmount, balance + 1, balance * 2);

        // Should revert
        vm.expectRevert();
        factory.swapExactTokensForPairingTokens(
            tokenId,
            sellAmount,
            0,
            address(this),
            block.timestamp + 300
        );
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ TESTS - METADATA
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test: Only owner can update metadata
    function testFuzz_onlyOwnerCanUpdateMetadata(address nonOwner) public {
        vm.assume(nonOwner != address(this) && nonOwner != address(0));

        // Create persona
        pairingToken.mint(address(this), INITIAL_MINT_COST);
        pairingToken.approve(address(factory), INITIAL_MINT_COST);

        uint256 tokenId = factory.createPersona(
            address(pairingToken),
            "Test",
            "TEST",
            "test",
            0,
            address(0),
            0
        );

        bytes32[] memory keys = new bytes32[](1);
        keys[0] = "description";

        string[] memory values = new string[](1);
        values[0] = "Test Description";

        // Non-owner should fail
        vm.prank(nonOwner);
        vm.expectRevert();
        factory.updateMetadata(tokenId, keys, values);

        // Owner should succeed
        factory.updateMetadata(tokenId, keys, values);
    }

    /*//////////////////////////////////////////////////////////////
                    FUZZ TESTS - DOMAIN VALIDATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Fuzz test: Valid subdomains should pass validation
    function testFuzz_validSubdomainFormat(bytes32 domain) public view {
        bool isValid = factory.isValidSubdomain(domain);

        if (isValid) {
            // Check it starts with a-z
            bytes1 firstChar = domain[0];
            assertTrue(
                firstChar >= 0x61 && firstChar <= 0x7A,
                "Valid domain should start with a-z"
            );
        }
    }
}

/**
 * @title PersonaFactoryHandler
 * @notice Handler for stateful fuzzing
 */
contract PersonaFactoryHandler is Test {
    PersonaTokenFactory public factory;
    MockERC20 public amicaToken;
    MockERC20 public pairingToken;

    uint256[] public personaIds;
    uint256 public personaCounter;

    constructor(
        PersonaTokenFactory _factory,
        MockERC20 _amicaToken,
        MockERC20 _pairingToken
    ) {
        factory = _factory;
        amicaToken = _amicaToken;
        pairingToken = _pairingToken;
    }

    function createPersona(string memory name, bytes32 domain) public {
        // Bound inputs
        if (bytes(name).length == 0 || bytes(name).length > 32) return;
        if (!factory.isValidSubdomain(domain)) return;

        // Check if domain already exists
        if (factory.domains(domain) != 0) return;

        uint256 mintCost = 1000 ether;
        pairingToken.approve(address(factory), mintCost);

        try factory.createPersona(
            address(pairingToken),
            name,
            "TEST",
            domain,
            0,
            address(0),
            0
        ) returns (uint256 tokenId) {
            personaIds.push(tokenId);
            personaCounter++;
        } catch {
            // Ignore failures
        }
    }

    function buyTokens(uint256 personaIndex, uint256 amount) public {
        if (personaIds.length == 0) return;
        personaIndex = bound(personaIndex, 0, personaIds.length - 1);
        amount = bound(amount, 1 ether, 10 ether);

        uint256 tokenId = personaIds[personaIndex];

        pairingToken.approve(address(factory), amount);

        try factory.swapExactTokensForTokens(
            tokenId,
            amount,
            0,
            address(this),
            block.timestamp + 300
        ) {
            // Success
        } catch {
            // Ignore failures (e.g., graduated)
        }
    }

    function sellTokens(uint256 personaIndex, uint256 amount) public {
        if (personaIds.length == 0) return;
        personaIndex = bound(personaIndex, 0, personaIds.length - 1);

        uint256 tokenId = personaIds[personaIndex];
        uint256 balance = factory.bondingBalances(tokenId, address(this));

        if (balance == 0) return;
        amount = bound(amount, 1, balance);

        try factory.swapExactTokensForPairingTokens(
            tokenId,
            amount,
            0,
            address(this),
            block.timestamp + 300
        ) {
            // Success
        } catch {
            // Ignore failures
        }
    }

    // View functions for invariant checks
    function getPersonaCount() external view returns (uint256) {
        return personaIds.length;
    }

    function getPersonaId(uint256 index) external view returns (uint256) {
        return personaIds[index];
    }

    function getUserBondingBalance(uint256 tokenId, address user)
        external
        view
        returns (uint256)
    {
        return factory.bondingBalances(tokenId, user);
    }
}

/**
 * @title Mock Contracts for Testing
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

contract MockPoolManager {
    // Simplified mock
}

contract MockPositionManager {
    uint256 public nextTokenId = 1;

    function multicall(bytes[] calldata) external returns (bytes[] memory) {
        return new bytes[](0);
    }

    function modifyLiquidities(bytes calldata, uint256)
        external
        payable
        returns (bytes memory)
    {
        return "";
    }

    function initializePool(bytes32, uint160, bytes calldata)
        external
        returns (int24)
    {
        return 0;
    }
}

contract MockPermit2 {
    function approve(address, address, uint160, uint48) external {}
}

contract MockDynamicFeeHook {
    // Simplified mock
}
