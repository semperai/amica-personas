// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721EnumerableUpgradeable} from
    "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import {OwnableUpgradeable} from
    "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from
    "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {
    Currency, CurrencyLibrary
} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IPositionManager} from
    "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {IBondingCurve} from "./interfaces/IBondingCurve.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

interface IPersonaToken {
    function initialize(
        string memory name,
        string memory symbol,
        uint256 supply,
        address owner
    ) external;
}

/**
 * @notice Consolidated error for invalid inputs
 * @param code Error code: 0=Token, 1=Amount, 2=Recipient, 3=Name, 4=Symbol, 5=Metadata, 6=Configuration, 7=Index, 8=Share, 9=Multiplier, 10=NonRegisteredDomain, 11=AlreadyRegisteredDomain, 12=Address, 13=DomainFormat, 14=AlreadyClaimed
 */
error Invalid(uint8 code);

/**
 * @notice Consolidated error for insufficient resources
 * @param code Error code: 0=PairingToken, 1=Output, 2=Liquidity, 3=AgentTokens, 4=Balance
 */
error Insufficient(uint8 code);

/**
 * @notice Consolidated error for failed operations
 * @param code Error code: 0=Transfer, 1=Payment
 */
error Failed(uint8 code);

/**
 * @notice Consolidated error for permission/state issues
 * @param code Error code: 0=NotOwner, 1=NotEnabled, 2=AlreadyGraduated, 3=NotGraduated, 4=TradingOnUniswap, 5=ExpiredDeadline, 6=NoAgentToken, 7=PairExists, 8=FeeTooHigh, 9=NoTokens, 10=FeeRange, 11=Unauthorized, 12=ClaimTooEarly
 */
error NotAllowed(uint8 code);

/**
 * @title PersonaTokenFactory
 * @author Amica Protocol
 * @notice Factory contract for creating and managing persona tokens with bonding curves and Uniswap V4 integration
 * @dev Implements ERC721 with Enumerable and URIStorage extensions for persona ownership
 */
contract PersonaTokenFactory is
    ERC721EnumerableUpgradeable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using Strings for uint256;
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;

    /// @notice Total supply for each persona token (1 billion with 18 decimals)
    uint256 private constant PERSONA_TOKEN_SUPPLY = 1_000_000_000 ether;

    /// @notice Token distribution fractions
    uint256 private constant THIRD_SUPPLY = 333_333_333 ether;
    uint256 private constant SIXTH_SUPPLY = 166_666_666 ether;

    /// @notice V4 tick spacing for standard pools
    int24 private constant TICK_SPACING = 60;

    /// @notice Precision for calculations
    uint256 private constant PRECISION = 1e18;

    /// @notice Graduation threshold - 85% of bonding tokens must be sold
    uint256 private constant GRADUATION_THRESHOLD_PERCENT = 85;

    /// @notice Time delay after graduation before claims can be made (24 hours)
    uint256 private constant CLAIM_DELAY = 1 days;

    /// @notice Slippage constants for PositionManager
    uint256 private constant MAX_SLIPPAGE_INCREASE = 5208; // 5208/10000 = ~52% increase allowance

    /**
     * @notice Core data for each persona
     * @param token Address of the persona's ERC20 token
     * @param pairToken Address of the token paired for bonding/liquidity
     * @param agentToken Optional token for agent staking
     * @param graduationTimestamp Timestamp when graduated (0 = not graduated)
     * @param agentTokenThreshold Agent token threshold required for graduation
     * @param poolId Uniswap V4 pool ID for persona/pairToken
     */
    struct PersonaData {
        address token;
        address pairToken;
        address agentToken;
        uint256 graduationTimestamp;
        uint256 agentTokenThreshold;
        PoolId poolId;
    }

    /**
     * @notice Configuration for pairing tokens
     * @param enabled Whether this token can be used for creating personas
     * @param mintCost Cost to mint a persona with this token
     * @param pricingMultiplier Multiplier that affects bonding curve pricing (1e18 = 1x)
     */
    struct PairingConfig {
        bool enabled;
        uint256 mintCost;
        uint256 pricingMultiplier;
    }

    /**
     * @notice Tracks all state before graduation
     * @param totalPairingTokensCollected Total pairing tokens collected through bonding curve
     * @param tokensPurchased Total persona tokens purchased through bonding curve
     * @param totalAgentDeposited Total amount of agent tokens deposited
     */
    struct PreGraduationState {
        uint256 totalPairingTokensCollected;
        uint256 tokensPurchased;
        uint256 totalAgentDeposited;
    }

    /**
     * @notice Token distribution amounts
     * @param liquidity Amount for Uniswap liquidity
     * @param bondingSupply Amount available in bonding curve
     * @param amica Amount sent to AMICA protocol
     * @param agentRewards Amount reserved for agent stakers
     */
    struct TokenAmounts {
        uint256 liquidity;
        uint256 bondingSupply;
        uint256 amica;
        uint256 agentRewards;
    }

    /// @notice Base URI for token metadata
    string public baseTokenURI;

    /// @notice AMICA token contract
    IERC20 public amicaToken;

    /// @notice Uniswap V4 PoolManager contract
    IPoolManager public poolManager;

    /// @notice Uniswap V4 PositionManager contract
    IPositionManager public positionManager;

    /// @notice Address of the fee reduction hook
    address public dynamicFeeHook;

    /// @notice Implementation contract for persona ERC20 tokens
    address public personaTokenImplementation;

    /// @notice Bonding curve implementation contract
    IBondingCurve public bondingCurve;

    /// @dev Current token ID counter
    uint256 private _currentTokenId;

    /// @notice Mapping from token ID to persona data
    mapping(uint256 => PersonaData) public personas;

    /// @notice Mapping from token ID to metadata map
    mapping(uint256 => mapping(bytes32 => string)) public metadata;

    /// @notice So we can check if a domain is registered / unique
    /// @dev references tokenId as index
    mapping(bytes32 => uint256) public domains;

    /// @notice Mapping from token ID to pre-graduation state
    mapping(uint256 => PreGraduationState) public preGraduationStates;

    /// @notice Mapping from token ID to user address to token balance in bonding curve
    mapping(uint256 => mapping(address => uint256)) public bondingBalances;

    /// @notice Mapping from token ID to user address to whether they claimed tokens
    mapping(uint256 => mapping(address => bool)) public hasClaimedTokens;

    /// @notice Mapping from token ID to user address to agent tokens deposited
    mapping(uint256 => mapping(address => uint256)) public agentDeposits;

    /// @notice Configuration for each pairing token
    mapping(address => PairingConfig) public pairingConfigs;

    /**
     * @notice Emitted when a new persona is created
     * @param tokenId NFT token ID of the persona
     * @param domain Domain of the persona
     * @param token Address of the persona's ERC20 token
     */
    event PersonaCreated(
        uint256 indexed tokenId, bytes32 indexed domain, address indexed token
    );

    /**
     * @notice Emitted when pairing configuration is updated
     * @param token Address of the pairing token
     */
    event PairingConfigUpdated(address indexed token);

    /**
     * @notice Emitted when persona metadata is updated
     * @param tokenId Persona token ID
     * @param key Metadata key that was updated
     */
    event MetadataUpdated(uint256 indexed tokenId, bytes32 indexed key);

    /**
     * @notice Emitted when tokens are purchased through bonding curve
     * @param tokenId Persona token ID
     * @param buyer Address that purchased tokens
     * @param amountSpent Amount of pairing tokens spent
     * @param tokensReceived Amount of persona tokens received
     */
    event TokensPurchased(
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 amountSpent,
        uint256 tokensReceived
    );

    /**
     * @notice Emitted when tokens are sold through bonding curve
     * @param tokenId Persona token ID
     * @param seller Address that sold tokens
     * @param tokensSold Amount of persona tokens sold
     * @param amountReceived Amount of pairing tokens received
     */
    event TokensSold(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 tokensSold,
        uint256 amountReceived
    );

    /**
     * @notice Emitted when tokens are claimed after graduation
     * @param tokenId Persona token ID
     * @param user User address
     * @param purchasedAmount Amount from purchases
     * @param bonusAmount Amount from unsold tokens
     * @param totalAmount Total amount claimed
     */
    event TokensClaimed(
        uint256 indexed tokenId,
        address indexed user,
        uint256 purchasedAmount,
        uint256 bonusAmount,
        uint256 totalAmount
    );

    /**
     * @notice Emitted when agent token is associated with persona
     * @param tokenId Persona token ID
     * @param agentToken Address of agent token
     */
    event AgentTokenAssociated(
        uint256 indexed tokenId, address indexed agentToken
    );

    /**
     * @notice Emitted when agent tokens are deposited
     * @param tokenId Persona token ID
     * @param depositor Address depositing tokens
     * @param amount Amount deposited in this transaction
     * @param newTotal New total agent tokens deposited
     */
    event AgentTokensDeposited(
        uint256 indexed tokenId,
        address indexed depositor,
        uint256 amount,
        uint256 newTotal
    );

    /**
     * @notice Emitted when agent tokens are withdrawn
     * @param tokenId Persona token ID
     * @param depositor Address withdrawing tokens
     * @param amount Amount withdrawn in this transaction
     * @param newTotal New total agent tokens deposited after withdrawal
     */
    event AgentTokensWithdrawn(
        uint256 indexed tokenId,
        address indexed depositor,
        uint256 amount,
        uint256 newTotal
    );

    /**
     * @notice Emitted when agent rewards are distributed
     * @param tokenId Persona token ID
     * @param recipient Address receiving rewards
     * @param personaTokens Amount of persona tokens distributed
     * @param agentShare Amount of agent tokens returned
     */
    event AgentRewardsDistributed(
        uint256 indexed tokenId,
        address indexed recipient,
        uint256 personaTokens,
        uint256 agentShare
    );

    /**
     * @notice Emitted when V4 pool is created for a persona
     * @param tokenId Persona token ID
     * @param poolId V4 pool ID
     * @param liquidity Initial liquidity amount
     */
    event V4PoolCreated(
        uint256 indexed tokenId, PoolId indexed poolId, uint256 liquidity
    );

    /**
     * @notice Emitted when fees are collected (from UniswapV4Manager)
     * @param nftTokenId NFT token ID
     * @param poolId Pool ID
     * @param amount0 Amount of token0 collected
     * @param amount1 Amount of token1 collected
     */
    event FeesCollected(
        uint256 indexed nftTokenId,
        PoolId poolId,
        uint256 amount0,
        uint256 amount1
    );

    /**
     * @notice Emitted when a persona graduates to Uniswap V4
     * @param tokenId Persona token ID
     * @param poolId Main pool ID (persona/pairToken)
     * @param totalDeposited Total pairing tokens collected
     * @param tokensSold Total persona tokens sold
     */
    event Graduated(
        uint256 indexed tokenId,
        PoolId indexed poolId,
        uint256 totalDeposited,
        uint256 tokensSold
    );

    /**
     * @notice Emitted when tokens are distributed during graduation
     * @param tokenId Persona token ID
     * @param toAmica Amount sent to AMICA protocol
     * @param toLiquidity Amount reserved for liquidity
     * @param toAgentRewards Amount reserved for agent rewards (0 if no agent)
     */
    event TokensDistributed(
        uint256 indexed tokenId,
        uint256 toAmica,
        uint256 toLiquidity,
        uint256 toAgentRewards
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the factory contract
     * @param amicaToken_ Address of AMICA token
     * @param poolManager_ Address of Uniswap V4 PoolManager
     * @param positionManager_ Address of Uniswap V4 PositionManager
     * @param dynamicFeeHook_ Address of fee reduction hook
     * @param personaTokenImplementation_ Address of persona token implementation
     * @param bondingCurve_ Address of bonding curve implementation
     */
    function initialize(
        address amicaToken_,
        address poolManager_,
        address positionManager_,
        address dynamicFeeHook_,
        address personaTokenImplementation_,
        address bondingCurve_
    ) public initializer {
        __ERC721_init("Amica Persona", "PERSONA");
        __ERC721Enumerable_init();
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();

        if (
            amicaToken_ == address(0) || poolManager_ == address(0)
                || positionManager_ == address(0) || dynamicFeeHook_ == address(0)
                || personaTokenImplementation_ == address(0)
                || bondingCurve_ == address(0)
        ) revert Invalid(12);

        amicaToken = IERC20(amicaToken_);
        poolManager = IPoolManager(poolManager_);
        positionManager = IPositionManager(positionManager_);
        dynamicFeeHook = dynamicFeeHook_;
        personaTokenImplementation = personaTokenImplementation_;
        bondingCurve = IBondingCurve(bondingCurve_);

        // enable amica token as a pairing token by default
        configurePairingToken(
            amicaToken_,
            1000 ether, // Initial mint cost
            370 ether, // Initial pricing multiplier (1.37x)
            true // Enabled by default
        );
    }

    /**
     * @notice Pauses all contract operations
     * @dev Only callable by owner
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses contract operations
     * @dev Only callable by owner
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Configures a pairing token
     * @param token Address of the token to configure
     * @param mintCost Cost to mint a persona with this token
     * @param pricingMultiplier Multiplier that affects bonding curve pricing (1e18 = 1x)
     * @dev Only callable by owner
     */
    function configurePairingToken(
        address token,
        uint256 mintCost,
        uint256 pricingMultiplier,
        bool enabled
    ) public onlyOwner {
        if (token == address(0)) revert Invalid(0);

        pairingConfigs[token] = PairingConfig({
            enabled: enabled,
            mintCost: mintCost,
            pricingMultiplier: pricingMultiplier
        });

        // allow unlimited approval for PositionManager (for creating pools)
        IERC20(token).approve(address(positionManager), type(uint256).max);

        emit PairingConfigUpdated(token);
    }

    /**
     * @notice Creates a new persona with optional initial purchase
     * @param pairingToken Token to use for pairing/bonding
     * @param name Name of the persona (max 32 chars)
     * @param symbol Symbol of the persona token (max 10 chars)
     * @param domain Domain of the persona
     * @param initialBuyAmount Amount to spend on initial token purchase
     * @param agentToken Optional agent token for staking
     * @param agentTokenThreshold Agent token threshold required for graduation
     * @return tokenId The ID of the created persona NFT
     */
    function createPersona(
        address pairingToken,
        string memory name,
        string memory symbol,
        bytes32 domain,
        uint256 initialBuyAmount,
        address agentToken,
        uint256 agentTokenThreshold
    ) external nonReentrant whenNotPaused returns (uint256) {
        if (agentToken == address(0) && agentTokenThreshold != 0) {
            revert Invalid(6);
        }

        PairingConfig memory config = pairingConfigs[pairingToken];
        if (!config.enabled) revert NotAllowed(1);
        if (bytes(name).length == 0 || bytes(name).length > 32) {
            revert Invalid(3);
        }
        if (bytes(symbol).length == 0 || bytes(symbol).length > 10) {
            revert Invalid(4);
        }

        if (domain == bytes32(0)) revert Invalid(10);
        if (!isValidSubdomain(domain)) revert Invalid(13);
        if (domains[domain] != 0) revert Invalid(11);

        uint256 totalPayment = config.mintCost + initialBuyAmount;
        if (IERC20(pairingToken).balanceOf(msg.sender) < totalPayment) {
            revert Insufficient(0);
        }
        if (
            !IERC20(pairingToken).transferFrom(
                msg.sender, address(this), totalPayment
            )
        ) revert Failed(1);

        uint256 tokenId = ++_currentTokenId;
        _mint(msg.sender, tokenId);

        address token = Clones.clone(personaTokenImplementation);
        IPersonaToken(token).initialize(
            string.concat(name, ".amica"),
            string.concat(symbol, ".amica"),
            PERSONA_TOKEN_SUPPLY,
            address(this)
        );

        // allow unlimited approval for PositionManager (for creating pool)
        IERC20(token).approve(address(positionManager), type(uint256).max);

        PersonaData storage persona = personas[tokenId];
        persona.token = token;
        persona.pairToken = pairingToken;
        persona.agentToken = agentToken;
        persona.agentTokenThreshold = agentTokenThreshold;

        // Register domain
        domains[domain] = tokenId;

        emit PersonaCreated(tokenId, domain, token);

        if (agentToken != address(0)) {
            emit AgentTokenAssociated(tokenId, agentToken);
        }

        if (initialBuyAmount > 0) {
            _swapExactTokensForTokensInternal(
                tokenId,
                initialBuyAmount,
                0,
                msg.sender,
                block.timestamp + 300,
                true
            );
        }

        return tokenId;
    }

    /**
     * @dev Validates a subdomain from bytes32
     * Requirements:
     * - Must start with a letter (a-z)
     * - Must end with a letter (a-z) or digit (0-9)
     * - Interior characters can be letters (a-z), numbers (0-9), or hyphens (-)
     * - Cannot start or end with a hyphen
     * - Must have at least 1 character
     * - Null bytes (0x00) mark the end of the string
     * @param subdomain The subdomain as bytes32 to validate
     * @return bool True if valid, false otherwise
     */
    function isValidSubdomain(bytes32 subdomain) public pure returns (bool) {
        // Find the actual length by looking for null terminator
        uint256 length = 0;
        for (uint256 i = 0; i < 32; i++) {
            if (subdomain[i] == 0x00) {
                break;
            }
            length++;
        }

        // Check if empty
        if (length == 0) {
            return false;
        }

        // Check first character - must be a letter (a-z)
        bytes1 firstChar = subdomain[0];
        if (!(firstChar >= 0x61 && firstChar <= 0x7A)) {
            return false;
        }

        // Check last character - must be a letter (a-z) or digit (0-9)
        bytes1 lastChar = subdomain[length - 1];
        if (
            !(
                (lastChar >= 0x61 && lastChar <= 0x7A)
                    || (lastChar >= 0x30 && lastChar <= 0x39)
            )
        ) {
            return false;
        }

        // Check all characters
        for (uint256 i = 0; i < length; i++) {
            bytes1 char = subdomain[i];

            // Check if character is valid:
            // - lowercase letters: 0x61-0x7A (a-z)
            // - numbers: 0x30-0x39 (0-9)
            // - hyphen: 0x2D (-)
            if (
                // a-z
                // 0-9
                !(
                    (char >= 0x61 && char <= 0x7A)
                        || (char >= 0x30 && char <= 0x39) || (char == 0x2D)
                ) // -
            ) {
                return false;
            }
        }

        return true;
    }

    /**
     * @notice Get token distribution amounts based on agent token presence
     * @param hasAgent Whether the persona has an agent token
     * @return amounts TokenAmounts struct with all distributions
     */
    function _getTokenAmounts(bool hasAgent)
        private
        pure
        returns (TokenAmounts memory amounts)
    {
        if (hasAgent) {
            amounts.liquidity = THIRD_SUPPLY; // 1/3
            amounts.bondingSupply = SIXTH_SUPPLY; // 1/6
            amounts.amica = THIRD_SUPPLY; // 1/3
            amounts.agentRewards = SIXTH_SUPPLY + 2 ether; // 1/6 + rounding
        } else {
            amounts.liquidity = THIRD_SUPPLY; // 1/3
            amounts.bondingSupply = THIRD_SUPPLY; // 1/3
            amounts.amica = THIRD_SUPPLY + 1 ether; // 1/3 + rounding
            amounts.agentRewards = 0;
        }
    }

    /**
     * @notice Buys persona tokens with pairing tokens
     * @param tokenId ID of the persona
     * @param amountIn Amount of pairing tokens to spend
     * @param amountOutMin Minimum persona tokens to receive
     * @param to Address to receive the tokens
     * @param deadline Transaction deadline
     * @return amountOut Amount of persona tokens received
     */
    function swapExactTokensForTokens(
        uint256 tokenId,
        uint256 amountIn,
        uint256 amountOutMin,
        address to,
        uint256 deadline
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        return _swapExactTokensForTokensInternal(
            tokenId, amountIn, amountOutMin, to, deadline, false
        );
    }

    /**
     * @notice Sells persona tokens for pairing tokens (only before graduation)
     * @param tokenId ID of the persona
     * @param amountIn Amount of persona tokens to sell
     * @param amountOutMin Minimum pairing tokens to receive
     * @param to Address to receive the pairing tokens
     * @param deadline Transaction deadline
     * @return amountOut Amount of pairing tokens received
     */
    function swapExactTokensForPairingTokens(
        uint256 tokenId,
        uint256 amountIn,
        uint256 amountOutMin,
        address to,
        uint256 deadline
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        if (block.timestamp > deadline) revert NotAllowed(5);
        if (to == address(0)) revert Invalid(2);
        if (amountIn == 0) revert Invalid(1);

        PersonaData storage persona = personas[tokenId];
        if (persona.graduationTimestamp > 0) revert NotAllowed(4);
        if (persona.token == address(0)) revert Invalid(0);

        PreGraduationState storage preGradState = preGraduationStates[tokenId];

        // Check user has enough tokens
        uint256 userBalance = bondingBalances[tokenId][msg.sender];
        if (userBalance < amountIn) revert Insufficient(4);

        // Calculate output using bonding curve
        TokenAmounts memory amounts =
            _getTokenAmounts(persona.agentToken != address(0));

        // Call external bonding curve contract
        amountOut = bondingCurve.calculateAmountOutForSell(
            amountIn, preGradState.tokensPurchased, amounts.bondingSupply
        );

        // Apply multiplier to the output amount (reverse of buy)
        PairingConfig memory config = pairingConfigs[persona.pairToken];
        amountOut = (amountOut * PRECISION) / config.pricingMultiplier;

        if (amountOut < amountOutMin) revert Insufficient(1);

        // Ensure we don't exceed total deposited
        if (amountOut > preGradState.totalPairingTokensCollected) {
            amountOut = preGradState.totalPairingTokensCollected;
        }

        // Update state
        preGradState.tokensPurchased -= amountIn;
        preGradState.totalPairingTokensCollected -= amountOut;
        bondingBalances[tokenId][msg.sender] -= amountIn;

        // Transfer pairing tokens to user
        if (!IERC20(persona.pairToken).transfer(to, amountOut)) {
            revert Failed(0);
        }

        emit TokensSold(tokenId, msg.sender, amountIn, amountOut);

        return amountOut;
    }

    /**
     * @notice FIXED: Internal function for buying tokens with proper graduation check
     * @dev Handles both initial purchase and regular purchases
     */
    function _swapExactTokensForTokensInternal(
        uint256 tokenId,
        uint256 amountIn,
        uint256 amountOutMin,
        address to,
        uint256 deadline,
        bool isInternal
    ) private returns (uint256 amountOut) {
        if (block.timestamp > deadline) revert NotAllowed(5);
        if (to == address(0)) revert Invalid(2);

        PersonaData storage persona = personas[tokenId];
        if (persona.graduationTimestamp > 0) revert NotAllowed(4);
        if (persona.token == address(0)) revert Invalid(0);

        PreGraduationState storage preGradState = preGraduationStates[tokenId];

        TokenAmounts memory amounts =
            _getTokenAmounts(persona.agentToken != address(0));

        // Apply multiplier to the input amount
        PairingConfig memory config = pairingConfigs[persona.pairToken];
        uint256 adjustedAmountIn =
            (amountIn * config.pricingMultiplier) / PRECISION;

        // Call external bonding curve contract with adjusted amount
        amountOut = bondingCurve.calculateAmountOut(
            adjustedAmountIn,
            preGradState.tokensPurchased,
            amounts.bondingSupply
        );

        if (amountOut < amountOutMin) revert Insufficient(1);
        if (amountOut > amounts.bondingSupply - preGradState.tokensPurchased) {
            revert Insufficient(2);
        }

        if (!isInternal) {
            if (
                !IERC20(persona.pairToken).transferFrom(
                    msg.sender, address(this), amountIn
                )
            ) revert Failed(0);
        }

        preGradState.totalPairingTokensCollected += amountIn;
        preGradState.tokensPurchased += amountOut;
        bondingBalances[tokenId][to] += amountOut;

        // Don't transfer tokens - they stay in contract until claimed after graduation
        emit TokensPurchased(tokenId, to, amountIn, amountOut);

        // FIXED: More precise graduation threshold calculation to avoid rounding issues
        uint256 graduationThreshold =
            (amounts.bondingSupply * GRADUATION_THRESHOLD_PERCENT + 50) / 100;
        bool tokenThresholdMet =
            preGradState.tokensPurchased >= graduationThreshold;

        // Check agent token requirement if applicable
        bool agentRequirementMet = true;
        if (persona.agentToken != address(0) && persona.agentTokenThreshold > 0)
        {
            agentRequirementMet =
                preGradState.totalAgentDeposited >= persona.agentTokenThreshold;
        }

        // Graduate if both requirements are met
        if (tokenThresholdMet && agentRequirementMet) {
            _graduate(tokenId);
        }
    }

    /**
     * @notice Gets all claimable rewards for a user
     * @param tokenId ID of the persona
     * @param user Address to check
     * @return purchasedAmount Amount from purchases
     * @return bonusAmount Amount from unsold tokens
     * @return agentRewardAmount Amount from agent staking
     * @return totalClaimable Total claimable amount
     * @return claimed Whether the user has already claimed tokens
     * @return claimable Whether claims are currently allowed (after delay)
     */
    function getClaimableRewards(uint256 tokenId, address user)
        public
        view
        returns (
            uint256 purchasedAmount,
            uint256 bonusAmount,
            uint256 agentRewardAmount,
            uint256 totalClaimable,
            bool claimed,
            bool claimable
        )
    {
        PersonaData storage persona = personas[tokenId];
        if (persona.graduationTimestamp == 0) return (0, 0, 0, 0, false, false);

        // Check if claim delay has passed
        claimable = block.timestamp >= persona.graduationTimestamp + CLAIM_DELAY;

        // Get token amounts once
        TokenAmounts memory amounts =
            _getTokenAmounts(persona.agentToken != address(0));

        // Check token claims
        purchasedAmount = bondingBalances[tokenId][user];
        claimed = hasClaimedTokens[tokenId][user];

        if (purchasedAmount > 0 && !claimed) {
            PreGraduationState storage preGradState =
                preGraduationStates[tokenId];
            uint256 unsoldTokens = amounts.bondingSupply
                > preGradState.tokensPurchased
                ? amounts.bondingSupply - preGradState.tokensPurchased
                : 0;

            if (unsoldTokens > 0 && preGradState.tokensPurchased > 0) {
                bonusAmount = (unsoldTokens * purchasedAmount)
                    / preGradState.tokensPurchased;
            }
        }

        // Check agent rewards
        uint256 userAgentAmount = agentDeposits[tokenId][user];
        if (persona.agentToken != address(0) && userAgentAmount > 0) {
            PreGraduationState storage preGradState =
                preGraduationStates[tokenId];
            if (preGradState.totalAgentDeposited > 0) {
                agentRewardAmount = (amounts.agentRewards * userAgentAmount)
                    / preGradState.totalAgentDeposited;
            }
        }

        totalClaimable = purchasedAmount + bonusAmount + agentRewardAmount;
    }

    /**
     * @notice Claims all rewards after graduation (purchased tokens + bonus + agent rewards)
     * @param tokenId ID of the persona
     * @dev Combines token claims and agent rewards into one transaction
     */
    function claimRewards(uint256 tokenId)
        external
        nonReentrant
        whenNotPaused
    {
        (
            uint256 purchasedAmount,
            uint256 bonusAmount,
            uint256 agentRewardAmount,
            uint256 totalClaimable,
            bool claimed,
            bool claimable
        ) = getClaimableRewards(tokenId, msg.sender);

        PersonaData storage persona = personas[tokenId];
        if (persona.token == address(0)) revert Invalid(0);

        // Can only claim after graduation
        if (persona.graduationTimestamp == 0) revert NotAllowed(3); // NotGraduated

        // Check claim delay
        if (!claimable) revert NotAllowed(12); // ClaimTooEarly

        // Check if already claimed tokens
        if (claimed) revert Invalid(14); // AlreadyClaimed

        // Require at least something to claim
        if (totalClaimable == 0) revert NotAllowed(9); // No tokens to claim

        // Update state for token claims
        if (purchasedAmount > 0) {
            hasClaimedTokens[tokenId][msg.sender] = true;
        }

        // Update state for agent deposits and return agent tokens
        uint256 userAgentAmount = agentDeposits[tokenId][msg.sender];
        if (persona.agentToken != address(0) && userAgentAmount > 0) {
            agentDeposits[tokenId][msg.sender] = 0;

            // Return agent tokens to user
            if (
                !IERC20(persona.agentToken).transfer(msg.sender, userAgentAmount)
            ) {
                revert Failed(0);
            }
        }

        // Transfer all persona tokens in one go
        if (!IERC20(persona.token).transfer(msg.sender, totalClaimable)) {
            revert Failed(0);
        }

        // Emit appropriate events
        if (purchasedAmount > 0) {
            emit TokensClaimed(
                tokenId,
                msg.sender,
                purchasedAmount,
                bonusAmount,
                purchasedAmount + bonusAmount
            );
        }
        if (agentRewardAmount > 0) {
            emit AgentRewardsDistributed(
                tokenId, msg.sender, agentRewardAmount, userAgentAmount
            );
        }
    }

    /**
     * @notice Deposits agent tokens for a persona
     * @param tokenId ID of the persona
     * @param amount Amount of agent tokens to deposit
     * @dev Agent tokens are locked until graduation
     */
    function depositAgentTokens(uint256 tokenId, uint256 amount)
        external
        nonReentrant
        whenNotPaused
    {
        PersonaData storage persona = personas[tokenId];
        if (persona.agentToken == address(0)) revert NotAllowed(6);
        if (persona.graduationTimestamp > 0) revert NotAllowed(2);
        if (amount == 0) revert Invalid(1);

        if (
            !IERC20(persona.agentToken).transferFrom(
                msg.sender, address(this), amount
            )
        ) revert Failed(0);

        agentDeposits[tokenId][msg.sender] += amount;

        PreGraduationState storage preGradState = preGraduationStates[tokenId];
        preGradState.totalAgentDeposited += amount;

        emit AgentTokensDeposited(
            tokenId, msg.sender, amount, preGradState.totalAgentDeposited
        );

        // Check if this deposit triggers graduation
        TokenAmounts memory amounts = _getTokenAmounts(true);
        uint256 graduationThreshold =
            (amounts.bondingSupply * GRADUATION_THRESHOLD_PERCENT + 50) / 100;
        bool tokenThresholdMet =
            preGradState.tokensPurchased >= graduationThreshold;

        if (
            tokenThresholdMet
                && preGradState.totalAgentDeposited >= persona.agentTokenThreshold
        ) {
            _graduate(tokenId);
        }
    }

    /**
     * @notice Withdraws agent tokens before graduation
     * @param tokenId ID of the persona
     * @param amount Amount of agent tokens to withdraw
     * @dev Only available before graduation
     */
    function withdrawAgentTokens(uint256 tokenId, uint256 amount)
        external
        nonReentrant
        whenNotPaused
    {
        PersonaData storage persona = personas[tokenId];
        if (persona.graduationTimestamp > 0) revert NotAllowed(2);

        if (agentDeposits[tokenId][msg.sender] < amount) revert Insufficient(4);

        agentDeposits[tokenId][msg.sender] -= amount;

        PreGraduationState storage preGradState = preGraduationStates[tokenId];
        preGradState.totalAgentDeposited -= amount;

        if (!IERC20(persona.agentToken).transfer(msg.sender, amount)) {
            revert Failed(0);
        }

        emit AgentTokensWithdrawn(
            tokenId, msg.sender, amount, preGradState.totalAgentDeposited
        );
    }

    /**
     * @notice Collects accumulated fees from pools using PositionManager
     * @param nftTokenId NFT token ID
     * @param to Address to receive the fees
     * @return amount0 Amount of token0 collected
     * @return amount1 Amount of token1 collected
     */
    function collectFees(uint256 nftTokenId, address to)
        external
        nonReentrant
        returns (uint256 amount0, uint256 amount1)
    {
        if (ownerOf(nftTokenId) != msg.sender) revert NotAllowed(11);

        PersonaData storage persona = personas[nftTokenId];
        if (PoolId.unwrap(persona.poolId) == bytes32(0)) revert NotAllowed(11);
        if (to == address(0)) revert Invalid(12);

        // Get pool key to determine currencies
        PoolKey memory poolKey = _getPoolKey(persona);

        // Get balances before
        uint256 balance0before = _getBalance(poolKey.currency0, to);
        uint256 balance1before = _getBalance(poolKey.currency1, to);

        // Prepare actions for fee collection
        bytes memory actions = abi.encodePacked(
            uint8(Actions.DECREASE_LIQUIDITY), uint8(Actions.TAKE_PAIR)
        );

        bytes[] memory params = new bytes[](2);

        // DECREASE_LIQUIDITY with 0 liquidity to collect only fees
        params[0] = abi.encode(persona.poolId, 0, 0, 0, "");

        // TAKE_PAIR to withdraw collected fees
        params[1] = abi.encode(poolKey.currency0, poolKey.currency1, to);

        uint256 deadline = block.timestamp + 60; // 1 minute deadline
        uint256 valueToPass = poolKey.currency0.isAddressZero() ? 0 : 0; // Handle native ETH if needed

        // Execute fee collection through position manager
        positionManager.modifyLiquidities{value: valueToPass}(
            abi.encode(actions, params), deadline
        );

        // Calculate collected amounts
        amount0 = _getBalance(poolKey.currency0, to) - balance0before;
        amount1 = _getBalance(poolKey.currency1, to) - balance1before;

        emit FeesCollected(nftTokenId, persona.poolId, amount0, amount1);
    }

    /**
     * @notice Helper to get token balance
     * @param currency The currency to check
     * @param account The account to check
     * @return balance The balance
     */
    function _getBalance(Currency currency, address account)
        private
        view
        returns (uint256)
    {
        if (currency.isAddressZero()) {
            return account.balance;
        } else {
            return IERC20(Currency.unwrap(currency)).balanceOf(account);
        }
    }

    /**
     * @notice Sets the base URI for token metadata
     * @param newBaseURI New base URI (e.g., "https://api.amica.com/metadata/")
     * @dev Only callable by owner
     */
    function setBaseURI(string memory newBaseURI) external onlyOwner {
        baseTokenURI = newBaseURI;
    }

    /**
     * @notice Returns the base URI for token metadata
     * @return The base URI string
     */
    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    /**
     * @notice Updates metadata for a persona
     * @param tokenId ID of the persona
     * @param keys Array of metadata keys to update
     * @param values Array of new values
     * @dev Only callable by persona owner
     */
    function updateMetadata(
        uint256 tokenId,
        bytes32[] memory keys,
        string[] memory values
    ) external {
        if (ownerOf(tokenId) != msg.sender) revert NotAllowed(0);
        if (keys.length != values.length) revert Invalid(5);

        for (uint256 i = 0; i < keys.length; i++) {
            metadata[tokenId][keys[i]] = values[i];
            emit MetadataUpdated(tokenId, keys[i]);
        }
    }

    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
        // else z = 0 (default value)
    }

    /**
     * @notice Creates liquidity pool using PositionManager
     * @param tokenId ID of the persona
     */
    function _createLiquidityPool(uint256 tokenId) private {
        PersonaData storage persona = personas[tokenId];
        PreGraduationState storage preGradState = preGraduationStates[tokenId];

        // Get pool key
        PoolKey memory poolKey = _getPoolKey(persona);

        // Calculate initial price based on token ratio
        uint160 initialPrice = _calculateInitialPrice(persona, preGradState);

        // Initialize pool
        poolManager.initialize(poolKey, initialPrice);

        // Store pool ID
        persona.poolId = poolKey.toId();

        // Add liquidity
        _addLiquidityThroughPositionManager(tokenId, poolKey, preGradState);
    }

    /**
     * @notice Calculate initial price for the pool with overflow protection
     */
    function _calculateInitialPrice(
        PersonaData storage persona,
        PreGraduationState storage preGradState
    ) private view returns (uint160) {
        // Get token amounts
        TokenAmounts memory amounts =
            _getTokenAmounts(persona.agentToken != address(0));
        uint256 personaTokens = amounts.liquidity;
        uint256 pairingTokens = preGradState.totalPairingTokensCollected;

        // Calculate price based on token ordering
        // Using a more overflow-safe calculation method
        if (uint160(persona.token) < uint160(persona.pairToken)) {
            // persona token is token0
            // price = sqrt(token1/token0) * 2^96
            // Rearranged to avoid overflow: sqrt(token1 * 2^192 / token0)
            uint256 ratio = (pairingTokens * 1e18) / personaTokens;
            // Now calculate sqrt(ratio) * 2^96 / sqrt(1e18)
            // sqrt(1e18) = 1e9, so we need sqrt(ratio) * 2^96 / 1e9
            uint256 sqrtRatio = sqrt(ratio);
            return uint160((sqrtRatio * (2 ** 96)) / 1e9);
        } else {
            // pairing token is token0
            // price = sqrt(token1/token0) * 2^96
            uint256 ratio = (personaTokens * 1e18) / pairingTokens;
            uint256 sqrtRatio = sqrt(ratio);
            return uint160((sqrtRatio * (2 ** 96)) / 1e9);
        }
    }

    function _addLiquidityThroughPositionManager(
        uint256 tokenId,
        PoolKey memory poolKey,
        PreGraduationState storage preGradState
    ) private {
        PersonaData storage persona = personas[tokenId];

        // Get amounts
        TokenAmounts memory amounts =
            _getTokenAmounts(persona.agentToken != address(0));
        uint256 personaTokens = amounts.liquidity;
        uint256 pairingTokens = preGradState.totalPairingTokensCollected;

        // Approve tokens to PositionManager
        // TODO move these approvals to createPersona and during the configPairingToken
    }

    function _executeLiquidityAddition(
        PoolKey memory poolKey,
        uint256 personaTokens,
        uint256 pairingTokens,
        bool token0IsPersona
    ) private {
        // Determine amounts based on token ordering
        uint256 amount0Desired = token0IsPersona ? personaTokens : pairingTokens;
        uint256 amount1Desired = token0IsPersona ? pairingTokens : personaTokens;

        // Full range position
        int24 tickLower = -887220;
        int24 tickUpper = 887220;

        // Build actions - single byte for MINT_POSITION
        bytes memory actions = abi.encodePacked(uint8(Actions.MINT_POSITION));

        // Build params array
        bytes[] memory params = new bytes[](1);
        params[0] = abi.encode(
            poolKey,
            tickLower,
            tickUpper,
            uint256(0), // liquidityDelta of 0 means use token amounts
            amount0Desired,
            amount1Desired,
            amount0Desired * 95 / 100, // amount0Min with 5% slippage
            amount1Desired * 95 / 100, // amount1Min with 5% slippage
            address(this), // recipient
            block.timestamp + 300, // deadline
            bytes("") // hookData
        );

        // Encode for modifyLiquidities: (bytes actions, bytes[] params)
        bytes memory unlockData = abi.encode(actions, params);

        // Call modifyLiquidities
        positionManager.modifyLiquidities{value: 0}(
            unlockData, block.timestamp + 300
        );
    }

    /**
     * @notice Builds liquidity parameters for PositionManager
     */
    function _buildLiquidityParams(
        PoolKey memory poolKey,
        uint256 amount0Max,
        uint256 amount1Max,
        uint256 tokenId
    ) private pure returns (bytes memory) {
        // Use INCREASE_LIQUIDITY action with full range position
        bytes memory actions = abi.encodePacked(
            uint8(Actions.INCREASE_LIQUIDITY), uint8(Actions.SETTLE_PAIR)
        );

        bytes[] memory params = new bytes[](2);

        // INCREASE_LIQUIDITY parameters
        // For full range: tickLower = MIN_TICK, tickUpper = MAX_TICK
        int24 tickLower = -887220; // Closest valid tick to MIN_TICK for tickSpacing 60
        int24 tickUpper = 887220; // Closest valid tick to MAX_TICK for tickSpacing 60

        params[0] = abi.encode(
            tokenId, // tokenId (position identifier)
            poolKey.toId(), // poolId
            tickLower, // tickLower
            tickUpper, // tickUpper
            uint256(0), // liquidityDelta (0 means use token amounts)
            amount0Max, // amount0Max
            amount1Max // amount1Max
        );

        // SETTLE_PAIR parameters
        params[1] = abi.encode(poolKey.currency0, poolKey.currency1);

        return abi.encode(actions, params);
    }

    /**
     * @notice Graduates the persona by creating Uniswap V4 pools and distributing tokens
     * @param tokenId ID of the persona
     * @dev Processes distributions, creates pools, and marks as graduated
     */
    function _graduate(uint256 tokenId) private {
        PersonaData storage persona = personas[tokenId];
        if (persona.graduationTimestamp > 0) revert NotAllowed(7);

        // Set graduation timestamp
        persona.graduationTimestamp = block.timestamp;

        // Process token distributions
        _processTokenDistributions(tokenId);

        // Create liquidity pool using PositionManager
        _createLiquidityPool(tokenId);

        PreGraduationState storage preGradState = preGraduationStates[tokenId];

        // Emit graduation event
        emit Graduated(
            tokenId,
            persona.poolId,
            preGradState.totalPairingTokensCollected,
            preGradState.tokensPurchased
        );
    }

    /**
     * @notice Process token distributions to AMICA and other recipients
     * @param tokenId ID of the persona
     */
    function _processTokenDistributions(uint256 tokenId) private {
        PersonaData storage persona = personas[tokenId];
        TokenAmounts memory amounts =
            _getTokenAmounts(persona.agentToken != address(0));

        // Send tokens to AMICA protocol
        IERC20(persona.token).transfer(address(amicaToken), amounts.amica);

        // If there are agent tokens, send them to persona token contract
        PreGraduationState storage preGradState = preGraduationStates[tokenId];
        if (
            persona.agentToken != address(0)
                && preGradState.totalAgentDeposited > 0
        ) {
            IERC20(persona.agentToken).transfer(
                persona.token, preGradState.totalAgentDeposited
            );
        }

        // Emit token distribution event
        emit TokensDistributed(
            tokenId, amounts.amica, amounts.liquidity, amounts.agentRewards
        );
    }

    /**
     * @notice Orders two currencies according to Uniswap V4 conventions
     * @param tokenA First token
     * @param tokenB Second token
     * @return currency0 The lower address currency
     * @return currency1 The higher address currency
     */
    function _orderCurrencies(address tokenA, address tokenB)
        private
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

    // Updated _getPoolKey using the helper
    function _getPoolKey(PersonaData storage persona)
        private
        view
        returns (PoolKey memory poolKey)
    {
        (Currency currency0, Currency currency1) =
            _orderCurrencies(persona.token, persona.pairToken);

        poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(dynamicFeeHook)
        });
    }
}
