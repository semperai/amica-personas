// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;


import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";

// ============================================================================
// INTERFACES
// ============================================================================

interface IAmicaToken {
    function deposit(address token, uint256 amount) external;
}

interface IPersonaToken {
    function initialize(string memory name, string memory symbol, uint256 supply, address owner) external;
    function setGraduationStatus(bool status) external;
}

interface IAmicaFeeReductionHook {
    function distributeFeesForNFT(uint256 nftTokenId) external;
    function getAccumulatedFees(PoolId poolId) external view returns (uint256);
    function registerPool(PoolId poolId, uint256 nftTokenId) external; // ADD THIS LINE
}

interface IUniswapV4Handler {
    function initializePool(address token0, address token1, uint24 fee, uint160 initialPrice, uint256 nftTokenId)
        external returns (PoolId poolId, PoolKey memory poolKey);
    function getTickRangeForSingleSided(uint160 sqrtPriceX96, bool personaIsToken0)
        external pure returns (int24 tickLower, int24 tickUpper);
    function getAgentPoolInitialPrice(bool personaIsToken0) external pure returns (uint160);
}

// ============================================================================
// CONSOLIDATED ERRORS
// ============================================================================

/**
 * @notice Consolidated error for invalid inputs
 * @param code Error code: 0=Token, 1=Amount, 2=Recipient, 3=Name, 4=Symbol, 5=Metadata, 6=Configuration, 7=Index, 8=Share, 9=Multiplier, 10=NonRegisteredDomain, 11=AlreadyRegisteredDomain
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
 * @param code Error code: 0=NotOwner, 1=NotEnabled, 2=AlreadyGraduated, 3=NotGraduated, 4=TradingOnUniswap, 5=ExpiredDeadline, 6=NoAgentToken, 7=PairExists, 8=FeeTooHigh, 9=NoTokens, 10=FeeRange
 */
error NotAllowed(uint8 code);

/**
 * @title PersonaTokenFactory
 * @author Amica Protocol
 * @notice Factory contract for creating and managing persona tokens with bonding curves
 * @dev Implements ERC721 for persona ownership, with each NFT controlling an ERC20 token
 */
contract PersonaTokenFactory is ERC721Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    using Strings for uint256;
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;

    // ============================================================================
    // OPTIMIZED CONSTANTS (Optimization #8)
    // ============================================================================

    /// @notice Total supply for each persona token (1 billion with 18 decimals)
    uint256 public constant PERSONA_TOKEN_SUPPLY = 1_000_000_000 ether;
    
    /// @dev Simplified to just two base amounts instead of 7 constants
    uint256 private constant THIRD_SUPPLY = 333_333_333 ether;
    uint256 private constant NINTH_SUPPLY = 222_222_222 ether;
    
    /// @notice Basis points constant for percentage calculations
    uint256 private constant BASIS_POINTS = 10000;
    
    /// @notice Number of blocks to wait before snapshot becomes active
    uint256 public constant SNAPSHOT_DELAY = 100;

    /// @notice Trading fee percentage for uniswap pools
    uint256 public constant TRADING_FEE_PERCENTAGE = 100; 

    /// @notice V4 tick spacing for standard pools
    int24 private constant TICK_SPACING = 60;

    /// @notice Initial price sqrt ratio for 1:1 pools
    uint160 private constant SQRT_RATIO_1_1 = 79228162514264337593543950336;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    /**
     * @notice Core data for each persona
     * @param name Display name of the persona
     * @param symbol Token symbol for the persona
     * @param erc20Token Address of the persona's ERC20 token
     * @param pairToken Address of the token paired for bonding/liquidity
     * @param agentToken Optional token for agent staking
     * @param pairCreated Whether Uniswap pair has been created (graduated)
     * @param createdAt Timestamp of persona creation
     * @param totalAgentDeposited Total amount of agent tokens deposited
     * @param minAgentTokens Minimum agent tokens required for graduation
     * @param metadata Key-value metadata storage
     * @param poolId Uniswap V4 pool ID for persona/pairToken
     * @param agentPoolId Uniswap V4 pool ID for persona/agentToken (if exists)
     */
    struct PersonaData {
        string name;
        string symbol;
        address erc20Token;
        address pairToken;
        address agentToken;
        bool pairCreated;
        uint256 createdAt;
        uint256 totalAgentDeposited;
        uint256 minAgentTokens;
        PoolId poolId;
        PoolId agentPoolId;
    }

    /**
     * @notice Configuration for pairing tokens
     * @param enabled Whether this token can be used for creating personas
     * @param mintCost Cost in pairing tokens to mint a persona
     * @param graduationThreshold Amount needed to create Uniswap pair
     */
    struct PairingConfig {
        bool enabled;
        uint256 mintCost;
        uint256 graduationThreshold;
    }

    /**
     * @notice Tracks bonding curve state
     * @param totalDeposited Total pairing tokens deposited
     * @param tokensSold Total persona tokens sold through bonding curve
     */
    struct TokenPurchase {
        uint256 totalDeposited;
        uint256 tokensSold;
    }

    /**
     * @notice Fee reduction based on AMICA holdings
     * @param minAmicaForReduction Minimum AMICA to qualify for reduction
     * @param maxAmicaForReduction AMICA amount for maximum reduction
     * @param minReductionMultiplier Fee multiplier at minimum threshold
     * @param maxReductionMultiplier Fee multiplier at maximum threshold
     */
    struct FeeReductionConfig {
        uint256 minAmicaForReduction;
        uint256 maxAmicaForReduction;
        uint256 minReductionMultiplier;
        uint256 maxReductionMultiplier;
    }

    /**
     * @notice User's AMICA balance snapshot for fee reduction
     * @param currentBalance Active snapshot balance
     * @param currentBlock Block number of active snapshot
     * @param pendingBalance Pending snapshot balance
     * @param pendingBlock Block number of pending snapshot
     */
    struct UserSnapshot {
        uint256 currentBalance;
        uint256 currentBlock;
        uint256 pendingBalance;
        uint256 pendingBlock;
    }

    /**
     * @notice Token distribution amounts
     * @param liquidity Amount for Uniswap liquidity
     * @param bonding Amount available in bonding curve
     * @param amica Amount sent to AMICA protocol
     * @param agentRewards Amount reserved for agent buyers
     */
    struct TokenAmounts {
        uint256 liquidity;
        uint256 bonding;
        uint256 amica;
        uint256 agentRewards;
    }

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice AMICA token contract
    IERC20 public amicaToken;

    /// @notice Uniswap V4 PoolManager contract
    IPoolManager public poolManager;

    /// @notice Uniswap V4 pool manager contract
    IUniswapV4Handler public uniswapHandler;

    /// @notice Address of the AMICA fee reduction hook
    address public amicaFeeReductionHook;
    
    /// @notice Implementation contract for persona ERC20 tokens
    address public erc20Implementation;
    
    /// @dev Current token ID counter
    uint256 private _currentTokenId;
    
    /// @notice Mapping from token ID to persona data
    mapping(uint256 => PersonaData) public personas;

    /// @notice Mapping from token ID to metadata list
    mapping(uint256 => mapping(string => string)) public metadata;

    /// @notice So we can check if a domain is registered / unique
    mapping(bytes32 => uint256) public domains;
    
    /// @notice Mapping from token ID to purchase state
    mapping(uint256 => TokenPurchase) public purchases;
    
    /// @notice Mapping from token ID to user address to tokens purchased
    mapping(uint256 => mapping(address => uint256)) public userPurchases;
    
    /// @notice Mapping from token ID to user address to agent tokens deposited
    mapping(uint256 => mapping(address => uint256)) public agentDeposits;
    
    /// @notice Configuration for each pairing token
    mapping(address => PairingConfig) public pairingConfigs;
    
    /// @notice Global fee reduction configuration
    FeeReductionConfig public feeReductionConfig;
    
    /// @notice User snapshots for fee reduction
    mapping(address => UserSnapshot) public userSnapshots;

    /// @dev Storage gap for upgradeable contracts
    uint256[50] private __gap;

    // ============================================================================
    // EVENTS
    // ============================================================================

    /**
     * @notice Emitted when a new persona is created
     * @param tokenId NFT token ID of the persona
     * @param domain Domain of the persona
     * @param erc20Token Address of the persona's ERC20 token
     */
    event PersonaCreated(
        uint256 indexed tokenId,
        bytes32 indexed domain,
        address indexed erc20Token
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
    event MetadataUpdated(uint256 indexed tokenId, string indexed key);

    /**
     * @notice Emitted when tokens are purchased through bonding curve
     * @param tokenId Persona token ID
     * @param buyer Address that purchased tokens
     * @param amountSpent Amount of pairing tokens spent
     * @param tokensReceived Amount of persona tokens received
     */
    event TokensPurchased(uint256 indexed tokenId, address indexed buyer, uint256 amountSpent, uint256 tokensReceived);

    /**
     * @notice Emitted when tokens are sold through bonding curve
     * @param tokenId Persona token ID
     * @param seller Address that sold tokens
     * @param tokensSold Amount of persona tokens sold
     * @param amountReceived Amount of pairing tokens received
     */
    event TokensSold(uint256 indexed tokenId, address indexed seller, uint256 tokensSold, uint256 amountReceived);

    /**
     * @notice Emitted when tokens are withdrawn
     * @param tokenId Persona token ID
     * @param user User address
     * @param amount Amount withdrawn
     */
    event TokensWithdrawn(uint256 indexed tokenId, address indexed user, uint256 amount);

    /**
     * @notice Emitted when fee reduction configuration is updated
     */
    event FeeReductionConfigUpdated(
        uint256 minAmicaForReduction,
        uint256 maxAmicaForReduction,
        uint256 minReductionMultiplier,
        uint256 maxReductionMultiplier
    );

    /**
     * @notice Emitted when user's AMICA snapshot is updated
     * @param user User address
     * @param snapshotBalance Balance being snapshotted
     * @param blockNumber Block number of snapshot
     */
    event SnapshotUpdated(address indexed user, uint256 snapshotBalance, uint256 blockNumber);

    /**
     * @notice Emitted when agent token is associated with persona
     * @param tokenId Persona token ID
     * @param agentToken Address of agent token
     */
    event AgentTokenAssociated(uint256 indexed tokenId, address indexed agentToken);

    /**
     * @notice Emitted when agent tokens are deposited
     * @param tokenId Persona token ID
     * @param depositor Address depositing tokens
     * @param amount Amount deposited
     */
    event AgentTokensDeposited(uint256 indexed tokenId, address indexed depositor, uint256 amount);

    /**
     * @notice Emitted when agent tokens are withdrawn
     * @param tokenId Persona token ID
     * @param depositor Address withdrawing tokens
     * @param amount Amount withdrawn
     */
    event AgentTokensWithdrawn(uint256 indexed tokenId, address indexed depositor, uint256 amount);

    /**
     * @notice Emitted when agent rewards are distributed
     * @param tokenId Persona token ID
     * @param recipient Address receiving rewards
     * @param personaTokens Amount of persona tokens distributed
     * @param agentShare Amount of agent tokens returned
     */
    event AgentRewardsDistributed(uint256 indexed tokenId, address indexed recipient, uint256 personaTokens, uint256 agentShare);

    /**
     * @notice Emitted when V4 pool is created for a persona
     * @param tokenId Persona token ID
     * @param poolId V4 pool ID
     * @param liquidity Initial liquidity amount
     */
    event V4PoolCreated(
        uint256 indexed tokenId,
        PoolId indexed poolId,
        uint256 liquidity
    );

    /**
     * @notice Emitted when V4 agent pool is created for a persona
     * @param tokenId Persona token ID
     * @param agentPoolId V4 agent pool ID
     * @param personaTokenAmount Amount of persona tokens provided
     * @param initialPrice Initial price ratio (sqrtPriceX96)
     */
    event V4AgentPoolCreated(
        uint256 indexed tokenId,
        PoolId indexed agentPoolId,
        uint256 personaTokenAmount,
        uint160 initialPrice
    );

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the factory contract
     * @param amicaToken_ Address of AMICA token
     * @param poolManager_ Address of Uniswap V4 PoolManager
     * @param uniswapHandler_ Address of Uniswap V4 handler
     * @param erc20Implementation_ Address of persona token implementation
     */
    function initialize(
        address amicaToken_,
        address poolManager_,
        address uniswapHandler_,
        address erc20Implementation_
    ) public initializer {
        __ERC721_init("Amica Persona", "PERSONA");
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();

        if (
            amicaToken_ == address(0) ||
            poolManager_ == address(0) ||
            uniswapHandler_ == address(0) ||
            erc20Implementation_ == address(0)
        ) revert Invalid(0);

        amicaToken = IERC20(amicaToken_);
        poolManager = IPoolManager(poolManager_);
        uniswapHandler = IUniswapV4Handler(uniswapHandler_);
        erc20Implementation = erc20Implementation_;

        pairingConfigs[amicaToken_] = PairingConfig({
            enabled: true,
            mintCost: 1000 ether,
            graduationThreshold: 1_000_000 ether
        });

        feeReductionConfig = FeeReductionConfig({
            minAmicaForReduction: 1000 ether,
            maxAmicaForReduction: 1_000_000 ether,
            minReductionMultiplier: 9000,
            maxReductionMultiplier: 0
        });
    }

    // ============================================================================
    // OPTIMIZATION #1: Token Amount Calculation
    // ============================================================================

    /**
     * @notice Get token distribution amounts based on agent token presence
     * @param hasAgent Whether the persona has an agent token
     * @return amounts TokenAmounts struct with all distributions
     */
    function _getTokenAmounts(bool hasAgent) private pure returns (TokenAmounts memory amounts) {
        if (hasAgent) {
            amounts.liquidity = THIRD_SUPPLY;        // 1/3
            amounts.bonding = NINTH_SUPPLY;          // 2/9
            amounts.amica = NINTH_SUPPLY;            // 2/9
            amounts.agentRewards = NINTH_SUPPLY + 1 ether; // 2/9 + rounding
        } else {
            amounts.liquidity = THIRD_SUPPLY;        // 1/3
            amounts.bonding = THIRD_SUPPLY;          // 1/3
            amounts.amica = THIRD_SUPPLY + 1 ether;  // 1/3 + rounding
            amounts.agentRewards = 0;
        }
    }

    // ============================================================================
    // ADMIN FUNCTIONS
    // ============================================================================

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
     * @param graduationThreshold Amount needed for graduation
     * @dev Only callable by owner
     */
    function configurePairingToken(
        address token,
        uint256 mintCost,
        uint256 graduationThreshold,
        bool enabled
    ) external onlyOwner {
        if (token == address(0)) revert Invalid(0);

        pairingConfigs[token] = PairingConfig({
            enabled: enabled,
            mintCost: mintCost,
            graduationThreshold: graduationThreshold
        });

        emit PairingConfigUpdated(token);
    }

    /**
     * @notice Configures fee reduction based on AMICA holdings
     * @param minAmicaForReduction Minimum AMICA for fee reduction
     * @param maxAmicaForReduction AMICA for maximum fee reduction
     * @param minReductionMultiplier Fee multiplier at minimum (in basis points)
     * @param maxReductionMultiplier Fee multiplier at maximum (in basis points)
     * @dev Only callable by owner
     */
    function configureFeeReduction(
        uint256 minAmicaForReduction,
        uint256 maxAmicaForReduction,
        uint256 minReductionMultiplier,
        uint256 maxReductionMultiplier
    ) external onlyOwner {
        if (minAmicaForReduction >= maxAmicaForReduction) revert NotAllowed(10);
        if (minReductionMultiplier > BASIS_POINTS) revert Invalid(9);
        if (maxReductionMultiplier > minReductionMultiplier) revert Invalid(9);

        feeReductionConfig = FeeReductionConfig({
            minAmicaForReduction: minAmicaForReduction,
            maxAmicaForReduction: maxAmicaForReduction,
            minReductionMultiplier: minReductionMultiplier,
            maxReductionMultiplier: maxReductionMultiplier
        });

        emit FeeReductionConfigUpdated(
            minAmicaForReduction,
            maxAmicaForReduction,
            minReductionMultiplier,
            maxReductionMultiplier
        );
    }

    // ============================================================================
    // CORE FUNCTIONS - PERSONA CREATION
    // ============================================================================

    /**
     * @notice Creates a new persona with optional initial purchase
     * @param pairingToken Token to use for pairing/bonding
     * @param name Name of the persona (max 32 chars)
     * @param symbol Symbol of the persona token (max 10 chars)
     * @param initialBuyAmount Amount to spend on initial token purchase
     * @param agentToken Optional agent token for staking
     * @param minAgentTokens Minimum agent tokens required for graduation
     * @return tokenId The ID of the created persona NFT
     */
    function createPersona(
        address pairingToken,
        string memory name,
        string memory symbol,
        bytes32 domain,
        uint256 initialBuyAmount,
        address agentToken,
        uint256 minAgentTokens
    ) external nonReentrant whenNotPaused returns (uint256) {
        if (agentToken == address(0) && minAgentTokens != 0) revert Invalid(6);

        PairingConfig memory config = pairingConfigs[pairingToken];
        if (!config.enabled) revert NotAllowed(1);
        if (bytes(name).length == 0 || bytes(name).length > 32) revert Invalid(3);
        if (bytes(symbol).length == 0 || bytes(symbol).length > 10) revert Invalid(4);

        if (domain == bytes32(0)) revert Invalid(10);
        if (domains[domain] != 0) revert Invalid(11);


        uint256 totalPayment = config.mintCost + initialBuyAmount;
        if (IERC20(pairingToken).balanceOf(msg.sender) < totalPayment) revert Insufficient(0);
        if (!IERC20(pairingToken).transferFrom(msg.sender, address(this), totalPayment)) revert Failed(1);

        uint256 tokenId = _currentTokenId++;
        _safeMint(msg.sender, tokenId);

        address erc20Token = Clones.clone(erc20Implementation);
        IPersonaToken(erc20Token).initialize(
            string.concat(name, ".amica"),
            string.concat(symbol, ".amica"),
            PERSONA_TOKEN_SUPPLY,
            address(this)
        );

        PersonaData storage persona = personas[tokenId];
        persona.name = name;
        persona.symbol = symbol;
        persona.erc20Token = erc20Token;
        persona.pairToken = pairingToken;
        persona.agentToken = agentToken;
        persona.createdAt = block.timestamp;
        persona.minAgentTokens = minAgentTokens;

         // Register domain
        domains[domain] = tokenId;

        emit PersonaCreated(tokenId, domain, erc20Token);

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

    // ============================================================================
    // CORE FUNCTIONS - TRADING
    // ============================================================================

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
        return _swapExactTokensForTokensInternal(tokenId, amountIn, amountOutMin, to, deadline, false);
    }

    /**
     * @notice Sells persona tokens for pairing tokens
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
        if (persona.pairCreated) revert NotAllowed(4);
        if (persona.erc20Token == address(0)) revert Invalid(0);

        TokenPurchase storage purchase = purchases[tokenId];

        // Check user has enough tokens
        uint256 userBalance = userPurchases[tokenId][msg.sender];
        if (userBalance < amountIn) revert Insufficient(4);

        // Calculate output using bonding curve
        TokenAmounts memory amounts = _getTokenAmounts(persona.agentToken != address(0));
        amountOut = _calculateAmountOutForSell(
            amountIn,
            purchase.tokensSold,
            amounts.bonding,
            purchase.totalDeposited
        );

        if (amountOut < amountOutMin) revert Insufficient(1);

        // Update state
        purchase.tokensSold -= amountIn;
        purchase.totalDeposited -= amountOut;
        userPurchases[tokenId][msg.sender] -= amountIn;

        // Transfer pairing tokens to user
        if (!IERC20(persona.pairToken).transfer(to, amountOut)) revert Failed(0);

        emit TokensSold(tokenId, msg.sender, amountIn, amountOut);

        return amountOut;
    }

    /**
     * @notice Internal function for buying tokens
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
        if (persona.pairCreated) revert NotAllowed(4);
        if (persona.erc20Token == address(0)) revert Invalid(0);

        TokenPurchase storage purchase = purchases[tokenId];

        TokenAmounts memory amounts = _getTokenAmounts(persona.agentToken != address(0));

        amountOut = _calculateAmountOut(
            amountIn,
            purchase.tokensSold,
            amounts.bonding
        );

        if (amountOut < amountOutMin) revert Insufficient(1);
        if (amountOut > amounts.bonding - purchase.tokensSold) revert Insufficient(2);

        if (!isInternal) {
            if (!IERC20(persona.pairToken).transferFrom(msg.sender, address(this), amountIn)) revert Failed(0);
        }

        purchase.totalDeposited += amountIn;
        purchase.tokensSold += amountOut;
        userPurchases[tokenId][to] += amountOut;

        // Don't transfer tokens - they stay in contract until withdrawn or sold back
        emit TokensPurchased(tokenId, to, amountIn, amountOut);

        if (purchase.totalDeposited >= pairingConfigs[persona.pairToken].graduationThreshold) {
            _createV4Pool(tokenId);
        }
    }

    /**
     * @notice Withdraws purchased tokens after graduation
     * @param tokenId ID of the persona
     * @dev Only available after graduation to Uniswap
     */
    function withdrawTokens(uint256 tokenId) external nonReentrant whenNotPaused {
        PersonaData storage persona = personas[tokenId];
        if (persona.erc20Token == address(0)) revert Invalid(0);
        
        // Can only withdraw after graduation
        if (!persona.pairCreated) revert NotAllowed(3); // 3 = NotGraduated

        uint256 totalToWithdraw = userPurchases[tokenId][msg.sender];
        if (totalToWithdraw == 0) revert NotAllowed(9);
        userPurchases[tokenId][msg.sender] = 0;

        if (!IERC20(persona.erc20Token).transfer(msg.sender, totalToWithdraw)) revert Failed(0);

        emit TokensWithdrawn(tokenId, msg.sender, totalToWithdraw);
    }

    // ============================================================================
    // AGENT TOKEN FUNCTIONS
    // ============================================================================

    /**
     * @notice Deposits agent tokens for a persona
     * @param tokenId ID of the persona
     * @param amount Amount of agent tokens to deposit
     * @dev Agent tokens are locked until graduation
     */
    function depositAgentTokens(uint256 tokenId, uint256 amount) external nonReentrant whenNotPaused {
        PersonaData storage persona = personas[tokenId];
        if (persona.agentToken == address(0)) revert NotAllowed(6);
        if (persona.pairCreated) revert NotAllowed(2);
        if (amount == 0) revert Invalid(1);

        if (!IERC20(persona.agentToken).transferFrom(msg.sender, address(this), amount)) revert Failed(0);

        agentDeposits[tokenId][msg.sender] += amount;
        persona.totalAgentDeposited += amount;

        emit AgentTokensDeposited(tokenId, msg.sender, amount);
    }

    /**
     * @notice Withdraws agent tokens before graduation
     * @param tokenId ID of the persona
     * @param amount Amount of agent tokens to withdraw
     * @dev Only available before graduation
     */
    function withdrawAgentTokens(uint256 tokenId, uint256 amount) external nonReentrant whenNotPaused {
        PersonaData storage persona = personas[tokenId];
        if (persona.pairCreated) revert NotAllowed(2);

        if (agentDeposits[tokenId][msg.sender] < amount) revert Insufficient(4);

        agentDeposits[tokenId][msg.sender] -= amount;
        persona.totalAgentDeposited -= amount;

        if (!IERC20(persona.agentToken).transfer(msg.sender, amount)) revert Failed(0);

        emit AgentTokensWithdrawn(tokenId, msg.sender, amount);
    }

    /**
     * @notice Claims agent rewards after graduation
     * @param tokenId ID of the persona
     * @dev Distributes persona tokens proportional to agent token deposits
     */
    function claimAgentRewards(uint256 tokenId) external nonReentrant {
        PersonaData storage persona = personas[tokenId];
        if (!persona.pairCreated) revert NotAllowed(3);
        if (persona.agentToken == address(0)) revert NotAllowed(6);

        uint256 userAgentAmount = agentDeposits[tokenId][msg.sender];
        if (userAgentAmount == 0) revert NotAllowed(9);
        agentDeposits[tokenId][msg.sender] = 0;

        uint256 personaReward = 0;
        if (persona.totalAgentDeposited > 0) {
            TokenAmounts memory amounts = _getTokenAmounts(true);
            personaReward = (amounts.agentRewards * userAgentAmount) / persona.totalAgentDeposited;
        }

        if (personaReward > 0) {
            if (!IERC20(persona.erc20Token).transfer(msg.sender, personaReward)) revert Failed(0);
        }

        emit AgentRewardsDistributed(tokenId, msg.sender, personaReward, userAgentAmount);
    }

    // ============================================================================
    // METADATA FUNCTIONS
    // ============================================================================

    /**
     * @notice Updates metadata for a persona
     * @param tokenId ID of the persona
     * @param keys Array of metadata keys to update
     * @param values Array of new values
     * @dev Only callable by persona owner
     */
    function updateMetadata(
        uint256 tokenId,
        string[] memory keys,
        string[] memory values
    ) external {
        if (ownerOf(tokenId) != msg.sender) revert NotAllowed(0);
        if (keys.length != values.length) revert Invalid(5);

        for (uint256 i = 0; i < keys.length; i++) {
            metadata[tokenId][keys[i]] = values[i];
            emit MetadataUpdated(tokenId, keys[i]);
        }
    }

    /**
     * @notice Returns metadata URI for a persona NFT
     * @param tokenId ID of the persona
     * @return JSON metadata URI
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);

        PersonaData storage persona = personas[tokenId];

        return string(abi.encodePacked(
            'data:application/json;utf8,{"name":"',
            persona.name,
            '","symbol":"',
            persona.symbol,
            '","tokenId":"',
            tokenId.toString(),
            '","erc20Token":"',
            Strings.toHexString(uint160(persona.erc20Token), 20),
            '"}'
        ));
    }

    // ============================================================================
    // FEE MANAGEMENT FUNCTIONS
    // ============================================================================

    /**
     * @notice Updates user's AMICA balance snapshot for fee reduction
     * @dev Should be called periodically by user to update their snapshot
     * @dev Snapshot becomes active after SNAPSHOT_DELAY blocks
     */
    function updateAmicaSnapshot() external {
        uint256 currentBalance = amicaToken.balanceOf(msg.sender);
        if (currentBalance < feeReductionConfig.minAmicaForReduction) {
            // If below minimum, reset snapshot
            userSnapshots[msg.sender] = UserSnapshot({
                currentBalance: 0,
                currentBlock: block.number,
                pendingBalance: 0,
                pendingBlock: 0
            });
            return;
        }

        UserSnapshot storage snapshot = userSnapshots[msg.sender];

        if (snapshot.pendingBlock > 0 && block.number >= snapshot.pendingBlock + SNAPSHOT_DELAY) {
            snapshot.currentBalance = snapshot.pendingBalance;
            snapshot.currentBlock = snapshot.pendingBlock;
            snapshot.pendingBalance = 0;
            snapshot.pendingBlock = 0;
        }

        snapshot.pendingBalance = currentBalance;
        snapshot.pendingBlock = block.number;

        emit SnapshotUpdated(msg.sender, currentBalance, block.number);
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    /**
     * @notice Calculates effective fee percentage for a user
     * @param user Address to check
     * @return Effective fee percentage in basis points
     */
    function getEffectiveFeePercentage(address user) public view returns (uint256) {
        UserSnapshot storage snapshot = userSnapshots[user];

        uint256 activeBalance;
        uint256 activeBlock;

        if (snapshot.pendingBlock > 0 && block.number >= snapshot.pendingBlock + SNAPSHOT_DELAY) {
            activeBalance = snapshot.pendingBalance;
            activeBlock = snapshot.pendingBlock;
        } else if (snapshot.currentBlock > 0 && block.number >= snapshot.currentBlock + SNAPSHOT_DELAY) {
            activeBalance = snapshot.currentBalance;
            activeBlock = snapshot.currentBlock;
        } else {
            return 0;
        }

        uint256 currentBalance = amicaToken.balanceOf(user);
        uint256 effectiveBalance = currentBalance < activeBalance ? currentBalance : activeBalance;

        if (effectiveBalance < feeReductionConfig.minAmicaForReduction) {
            return TRADING_FEE_PERCENTAGE;
        }

        if (effectiveBalance >= feeReductionConfig.maxAmicaForReduction) {
            return (TRADING_FEE_PERCENTAGE * feeReductionConfig.maxReductionMultiplier) / BASIS_POINTS;
        }

        uint256 range = feeReductionConfig.maxAmicaForReduction - feeReductionConfig.minAmicaForReduction;
        uint256 userPosition = effectiveBalance - feeReductionConfig.minAmicaForReduction;
        uint256 progress = (userPosition * 1e18) / range;
        uint256 exponentialProgress = (progress * progress) / 1e18;
        uint256 multiplierRange = feeReductionConfig.minReductionMultiplier - feeReductionConfig.maxReductionMultiplier;
        uint256 reduction = (multiplierRange * exponentialProgress) / 1e18;
        uint256 effectiveMultiplier = feeReductionConfig.minReductionMultiplier - reduction;

        return (TRADING_FEE_PERCENTAGE * effectiveMultiplier) / BASIS_POINTS;
    }

    /**
     * @notice Gets available tokens in bonding curve
     * @param tokenId ID of the persona
     * @return Amount of tokens still available for purchase
     */
    function getAvailableTokens(uint256 tokenId) public view returns (uint256) {
        PersonaData storage persona = personas[tokenId];
        if (persona.pairCreated || persona.erc20Token == address(0)) return 0;
        
        TokenAmounts memory amounts = _getTokenAmounts(persona.agentToken != address(0));
        uint256 sold = purchases[tokenId].tokensSold;
        
        return sold >= amounts.bonding ? 0 : amounts.bonding - sold;
    }

    /**
     * @notice Calculates output for buying tokens
     * @param tokenId ID of the persona
     * @param amountIn Amount of pairing tokens
     * @return Expected persona tokens out (with base fee applied)
     */
    function getAmountOut(uint256 tokenId, uint256 amountIn) external view returns (uint256) {
        TokenPurchase storage purchase = purchases[tokenId];
        PersonaData storage persona = personas[tokenId];

        TokenAmounts memory amounts = _getTokenAmounts(persona.agentToken != address(0));
        
        return _calculateAmountOut(amountIn, purchase.tokensSold, amounts.bonding);
    }

    /**
     * @notice Calculates output for selling tokens
     * @param tokenId ID of the persona
     * @param amountIn Amount of persona tokens to sell
     * @return Expected pairing tokens out (before fees)
     */
    function getAmountOutForSell(uint256 tokenId, uint256 amountIn) external view returns (uint256) {
        TokenPurchase storage purchase = purchases[tokenId];
        PersonaData storage persona = personas[tokenId];

        TokenAmounts memory amounts = _getTokenAmounts(persona.agentToken != address(0));
        
        return _calculateAmountOutForSell(amountIn, purchase.tokensSold, amounts.bonding, purchase.totalDeposited);
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    function _createV4Pool(uint256 tokenId) private {
        PersonaData storage persona = personas[tokenId];
        if (persona.pairCreated) revert NotAllowed(7);

        if (persona.agentToken != address(0) && persona.minAgentTokens > 0) {
            if (persona.totalAgentDeposited < persona.minAgentTokens) revert Insufficient(3);
        }

        TokenPurchase storage purchase = purchases[tokenId];
        address erc20Token = persona.erc20Token;

        TokenAmounts memory amounts = _getTokenAmounts(persona.agentToken != address(0));

        // Send tokens to AMICA protocol
        IERC20(erc20Token).approve(address(amicaToken), amounts.amica);
        IAmicaToken(address(amicaToken)).deposit(erc20Token, amounts.amica);

        if (persona.agentToken != address(0) && persona.totalAgentDeposited > 0) {
            IERC20(persona.agentToken).approve(address(amicaToken), persona.totalAgentDeposited);
            IAmicaToken(address(amicaToken)).deposit(persona.agentToken, persona.totalAgentDeposited);
        }

        uint256 pairingTokenForLiquidity = purchase.totalDeposited;
        uint256 personaTokensForMainPool = amounts.liquidity;
        uint256 personaTokensForAgentPool = 0;
        
        if (persona.agentToken != address(0)) {
            personaTokensForMainPool = amounts.liquidity / 2;
            personaTokensForAgentPool = amounts.liquidity - personaTokensForMainPool;
        }

        // Initialize pool through handler (no token approvals needed for handler)
        (PoolId poolId, PoolKey memory poolKey) = uniswapHandler.initializePool(
            erc20Token,
            persona.pairToken,
            3000, // 0.3% fee
            SQRT_RATIO_1_1, // 1:1 initial price
            tokenId
        );
        persona.poolId = poolId;

        // Approve poolManager for liquidity (not handler)
        IERC20(erc20Token).approve(address(poolManager), personaTokensForMainPool);
        IERC20(persona.pairToken).approve(address(poolManager), pairingTokenForLiquidity);

        bool zeroForOne = uint160(erc20Token) < uint160(persona.pairToken);
        uint256 liquidityAmount = zeroForOne ? personaTokensForMainPool : pairingTokenForLiquidity;

        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: -887200,
            tickUpper: 887200,
            liquidityDelta: int256(liquidityAmount),
            salt: bytes32(tokenId)
        });

        poolManager.modifyLiquidity(poolKey, params, abi.encode(tokenId));

        // Create agent pool if needed
        if (persona.agentToken != address(0) && personaTokensForAgentPool > 0) {
            _createAgentPersonaPool(tokenId, personaTokensForAgentPool);
        }

        persona.pairCreated = true;
        IPersonaToken(erc20Token).setGraduationStatus(true);

        emit V4PoolCreated(tokenId, persona.poolId, personaTokensForMainPool);
    }

    function _createAgentPersonaPool(uint256 tokenId, uint256 personaTokenAmount) private {
        PersonaData storage persona = personas[tokenId];
        
        bool personaIsToken0 = uint160(persona.erc20Token) < uint160(persona.agentToken);
        uint160 initialPrice = uniswapHandler.getAgentPoolInitialPrice(personaIsToken0);
        
        // Initialize pool
        (PoolId agentPoolId, PoolKey memory poolKey) = uniswapHandler.initializePool(
            persona.erc20Token,
            persona.agentToken,
            10000, // 1% fee
            initialPrice,
            tokenId
        );
        persona.agentPoolId = agentPoolId;
        
        // Add liquidity directly to poolManager
        IERC20(persona.erc20Token).approve(address(poolManager), personaTokenAmount);
        
        (int24 tickLower, int24 tickUpper) = uniswapHandler.getTickRangeForSingleSided(
            initialPrice,
            personaIsToken0
        );
        
        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidityDelta: int256(personaTokenAmount),
            salt: bytes32(tokenId)
        });
        
        poolManager.modifyLiquidity(poolKey, params, abi.encode(tokenId));
        
        emit V4AgentPoolCreated(tokenId, agentPoolId, personaTokenAmount, initialPrice);
    }

    /**
     * @notice Calculates token output for buying
     * @param amountIn Input amount after fees
     * @param reserveSold Tokens already sold
     * @param reserveTotal Total tokens in bonding curve
     * @return Token output amount
     */
    function _calculateAmountOut(
        uint256 amountIn,
        uint256 reserveSold,
        uint256 reserveTotal
    ) internal pure returns (uint256) {
        if (amountIn == 0) revert Invalid(1);
        if (reserveTotal <= reserveSold) revert Insufficient(2);

        uint256 virtualAmicaReserve = 100_000 ether;
        uint256 virtualTokenReserve = reserveTotal / 10;

        uint256 currentTokenReserve = virtualTokenReserve + (reserveTotal - reserveSold);
        uint256 currentAmicaReserve = virtualAmicaReserve + (reserveSold * virtualAmicaReserve / virtualTokenReserve);

        uint256 k = currentTokenReserve * currentAmicaReserve;
        uint256 newAmicaReserve = currentAmicaReserve + amountIn;
        uint256 newTokenReserve = k / newAmicaReserve;
        uint256 amountOut = currentTokenReserve - newTokenReserve;

        return amountOut;
    }

    /**
     * @notice Calculates pairing token output for selling
     * @param amountIn Persona tokens to sell
     * @param reserveSold Current tokens sold
     * @param reserveTotal Total tokens in bonding curve
     * @param totalDeposited Total pairing tokens deposited
     * @return Pairing token output amount
     */
    function _calculateAmountOutForSell(
        uint256 amountIn,
        uint256 reserveSold,
        uint256 reserveTotal,
        uint256 totalDeposited
    ) internal pure returns (uint256) {
        if (amountIn == 0) revert Invalid(1);
        if (amountIn > reserveSold) revert Insufficient(4);

        uint256 virtualAmicaReserve = 100_000 ether;
        uint256 virtualTokenReserve = reserveTotal / 10;

        // Current state after all purchases
        uint256 currentTokenReserve = virtualTokenReserve + (reserveTotal - reserveSold);
        uint256 currentAmicaReserve = virtualAmicaReserve + (reserveSold * virtualAmicaReserve / virtualTokenReserve);

        // State after selling tokens back
        uint256 newTokenReserve = currentTokenReserve + amountIn;
        uint256 k = currentTokenReserve * currentAmicaReserve;
        uint256 newAmicaReserve = k / newTokenReserve;
        
        uint256 amountOut = currentAmicaReserve - newAmicaReserve;

        // Ensure we don't exceed total deposited
        if (amountOut > totalDeposited) {
            amountOut = totalDeposited;
        }

        return amountOut;
    }
}
