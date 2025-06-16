// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * @title IAmicaToken
 * @notice Interface for interacting with the AMICA token contract
 */
interface IAmicaToken {
    /**
     * @notice Deposit tokens into the AMICA protocol
     * @param token The token address to deposit
     * @param amount The amount of tokens to deposit
     */
    function deposit(address token, uint256 amount) external;
}

/**
 * @title IPersonaToken
 * @notice Interface for persona ERC20 tokens created by this factory
 */
interface IPersonaToken {
    /**
     * @notice Initialize a new persona token
     * @param name The token name
     * @param symbol The token symbol
     * @param supply The total supply to mint
     * @param owner The initial owner of all tokens
     */
    function initialize(string memory name, string memory symbol, uint256 supply, address owner) external;
    
    /**
     * @notice Set the graduation status of the persona token
     * @param status True if graduated, false otherwise
     */
    function setGraduationStatus(bool status) external;
}

// ============================================================================
// ERRORS
// ============================================================================

/**
 * @notice Thrown when an invalid token address is provided
 */
error InvalidToken();

/**
 * @notice Thrown when an invalid amount (e.g., zero) is provided
 */
error InvalidAmount();

/**
 * @notice Thrown when an invalid recipient address is provided
 */
error InvalidRecipient();

/**
 * @notice Thrown when persona name is invalid (empty or too long)
 */
error InvalidName();

/**
 * @notice Thrown when persona symbol is invalid (empty or too long)
 */
error InvalidSymbol();

/**
 * @notice Thrown when metadata arrays have mismatched lengths
 */
error InvalidMetadata();

/**
 * @notice Thrown when attempting to use a disabled pairing token
 */
error TokenNotEnabled();

/**
 * @notice Thrown when user has insufficient pairing token balance
 */
error InsufficientPairingToken();

/**
 * @notice Thrown when a token transfer fails
 */
error TransferFailed();

/**
 * @notice Thrown when attempting to trade after Uniswap pair creation
 */
error TradingOnUniswap();

/**
 * @notice Thrown when output amount is less than minimum specified
 */
error InsufficientOutput();

/**
 * @notice Thrown when transaction deadline has passed
 */
error TransactionExpired();

/**
 * @notice Thrown when caller is not the token owner
 */
error NotTokenOwner();

/**
 * @notice Thrown when fee percentage exceeds maximum allowed
 */
error FeeTooHigh();

/**
 * @notice Thrown when share percentage exceeds 100%
 */
error InvalidShare();

/**
 * @notice Thrown when fee range configuration is invalid
 */
error InvalidFeeRange();

/**
 * @notice Thrown when multiplier exceeds maximum allowed value
 */
error InvalidMultiplier();

/**
 * @notice Thrown when persona has no associated agent token
 */
error NoAgentToken();

/**
 * @notice Thrown when persona has already graduated
 */
error AlreadyGraduated();

/**
 * @notice Thrown when persona has not graduated yet
 */
error NotGraduated();

/**
 * @notice Thrown when user has no tokens to withdraw
 */
error NoTokensToWithdraw();

/**
 * @notice Thrown when user has no deposits to withdraw
 */
error NoDepositsToWithdraw();

/**
 * @notice Thrown when user has no deposits to claim rewards for
 */
error NoDepositsToClaim();

/**
 * @notice Thrown when insufficient liquidity for swap
 */
error InsufficientLiquidity();

/**
 * @notice Thrown when insufficient agent tokens deposited for graduation
 */
error InsufficientAgentTokens();

/**
 * @notice Thrown when attempting to create an already existing pair
 */
error PairAlreadyCreated();

/**
 * @notice Thrown when configuration parameters are invalid
 */
error InvalidConfiguration();

/**
 * @notice Thrown when array index is out of bounds
 */
error InvalidIndex();

/**
 * @notice Thrown when payment transfer fails
 */
error PaymentFailed();

/**
 * @notice Thrown when setting minimum agent tokens without agent token
 */
error CannotSetMinWithoutAgent();

/**
 * @title PersonaTokenFactory
 * @author [Your Name/Organization]
 * @notice Factory contract for creating persona NFTs with associated ERC20 tokens and optional agent token integration
 * @dev Implements a bonding curve mechanism for initial token distribution and automatic Uniswap pair creation upon graduation
 * @custom:security-contact security@example.com
 */
contract PersonaTokenFactory is ERC721Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    using Strings for uint256;

    // ============================================================================
    // CONSTANTS
    // ============================================================================

    /**
     * @notice Total supply of each persona token (1 billion)
     */
    uint256 public constant PERSONA_TOKEN_SUPPLY = 1_000_000_000 ether;

    /**
     * @notice Standard liquidity allocation without agent token (1/3)
     */
    uint256 public constant STANDARD_LIQUIDITY_AMOUNT = 333_333_333 ether;
    
    /**
     * @notice Standard bonding curve allocation without agent token (1/3)
     */
    uint256 public constant STANDARD_BONDING_AMOUNT = 333_333_333 ether;
    
    /**
     * @notice Standard AMICA deposit allocation without agent token (1/3)
     */
    uint256 public constant STANDARD_AMICA_AMOUNT = 333_333_334 ether;

    /**
     * @notice Liquidity allocation with agent token (1/3)
     */
    uint256 public constant AGENT_LIQUIDITY_AMOUNT = 333_333_333 ether;
    
    /**
     * @notice Bonding curve allocation with agent token (2/9)
     */
    uint256 public constant AGENT_BONDING_AMOUNT = 222_222_222 ether;
    
    /**
     * @notice AMICA deposit allocation with agent token (2/9)
     */
    uint256 public constant AGENT_AMICA_AMOUNT = 222_222_222 ether;
    
    /**
     * @notice Agent depositor rewards allocation (2/9)
     */
    uint256 public constant AGENT_REWARDS_AMOUNT = 222_222_223 ether;

    /**
     * @notice Suffix appended to all persona token names
     */
    string private constant TOKEN_SUFFIX = ".amica";
    
    /**
     * @notice Basis points constant for percentage calculations
     */
    uint256 private constant BASIS_POINTS = 10000;
    
    /**
     * @notice Block delay before AMICA snapshot becomes active
     * @dev Prevents flash loan exploits for fee reduction
     */
    uint256 public constant SNAPSHOT_DELAY = 100;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    /**
     * @notice Stores all data associated with a persona NFT
     * @param name Display name of the persona
     * @param symbol Token symbol for the associated ERC20
     * @param erc20Token Address of the deployed ERC20 token
     * @param pairToken Address of the pairing token used for trading
     * @param agentToken Optional agent token address for enhanced rewards
     * @param pairCreated Whether Uniswap pair has been created (graduated)
     * @param createdAt Timestamp of persona creation
     * @param totalAgentDeposited Total amount of agent tokens deposited
     * @param minAgentTokens Minimum agent tokens required for graduation
     * @param metadata Key-value pairs of additional metadata
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
        mapping(string => string) metadata;
    }

    /**
     * @notice Configuration for each pairing token
     * @param enabled Whether this token can be used for new personas
     * @param mintCost Cost in pairing tokens to create a persona
     * @param graduationThreshold Amount needed to graduate to Uniswap
     */
    struct PairingConfig {
        bool enabled;
        uint256 mintCost;
        uint256 graduationThreshold;
    }

    /**
     * @notice Tracks token purchases during bonding phase
     * @param totalDeposited Total pairing tokens deposited
     * @param tokensSold Total persona tokens sold
     */
    struct TokenPurchase {
        uint256 totalDeposited;
        uint256 tokensSold;
    }

    /**
     * @notice Trading fee configuration
     * @param feePercentage Fee percentage in basis points (100 = 1%)
     * @param creatorShare Creator's share of fees in basis points
     */
    struct TradingFeeConfig {
        uint256 feePercentage;
        uint256 creatorShare;
    }

    /**
     * @notice Fee reduction based on AMICA holdings
     * @param minAmicaForReduction Minimum AMICA for fee reduction eligibility
     * @param maxAmicaForReduction AMICA amount for maximum fee reduction
     * @param minReductionMultiplier Fee multiplier at minimum AMICA (e.g., 9000 = 90%)
     * @param maxReductionMultiplier Fee multiplier at maximum AMICA (e.g., 0 = 0%)
     */
    struct FeeReductionConfig {
        uint256 minAmicaForReduction;
        uint256 maxAmicaForReduction;
        uint256 minReductionMultiplier;
        uint256 maxReductionMultiplier;
    }

    /**
     * @notice Tracks user's AMICA balance snapshots for fee reduction
     * @param currentBalance Active snapshot balance
     * @param currentBlock Block number of current snapshot
     * @param pendingBalance Pending snapshot balance (awaiting delay)
     * @param pendingBlock Block number of pending snapshot
     */
    struct UserSnapshot {
        uint256 currentBalance;
        uint256 currentBlock;
        uint256 pendingBalance;
        uint256 pendingBlock;
    }

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /**
     * @notice AMICA token contract
     * @dev Used for fee reduction calculations and token deposits
     */
    IERC20 public amicaToken;
    
    /**
     * @notice Uniswap V2 factory contract
     * @dev Used to create liquidity pairs upon graduation
     */
    IUniswapV2Factory public uniswapFactory;
    
    /**
     * @notice Uniswap V2 router contract
     * @dev Used to add liquidity upon graduation
     */
    IUniswapV2Router02 public uniswapRouter;
    
    /**
     * @notice Implementation contract for persona ERC20 tokens
     * @dev Cloned for each new persona token
     */
    address public erc20Implementation;

    /**
     * @notice Counter for persona token IDs
     * @dev Incremented for each new persona
     */
    uint256 private _currentTokenId;

    /**
     * @notice Maps token ID to persona data
     * @dev Primary storage for all persona information
     */
    mapping(uint256 => PersonaData) public personas;
    
    /**
     * @notice Maps token ID to purchase information
     * @dev Tracks bonding curve progress
     */
    mapping(uint256 => TokenPurchase) public purchases;
    
    /**
     * @notice Maps token ID and user to purchase amount
     * @dev Used for tracking user allocations
     */
    mapping(uint256 => mapping(address => uint256)) public userPurchases;
    
    /**
     * @notice Maps token ID and user to agent token deposits
     * @dev Tracks agent token contributions for rewards
     */
    mapping(uint256 => mapping(address => uint256)) public agentDeposits;

    /**
     * @notice Staking rewards contract address
     * @dev Optional integration for additional rewards
     */
    address public stakingRewards;

    /**
     * @notice Configuration for each pairing token
     * @dev Maps token address to its configuration
     */
    mapping(address => PairingConfig) public pairingConfigs;
    
    /**
     * @notice Global trading fee configuration
     * @dev Applied to all trades on the bonding curve
     */
    TradingFeeConfig public tradingFeeConfig;
    
    /**
     * @notice Fee reduction configuration based on AMICA holdings
     * @dev Exponential curve for fee discounts
     */
    FeeReductionConfig public feeReductionConfig;

    /**
     * @notice User AMICA balance snapshots
     * @dev Used to prevent flash loan exploits for fee reduction
     */
    mapping(address => UserSnapshot) public userSnapshots;

    // Gap for future upgrades
    uint256[50] private __gap;

    // ============================================================================
    // EVENTS
    // ============================================================================

    /**
     * @notice Emitted when a new persona is created
     * @param tokenId The ID of the newly minted persona NFT
     * @param creator The address that created the persona
     * @param erc20Token The address of the associated ERC20 token
     * @param name The name of the persona
     * @param symbol The symbol of the persona token
     */
    event PersonaCreated(
        uint256 indexed tokenId,
        address indexed creator,
        address indexed erc20Token,
        string name,
        string symbol
    );
    
    /**
     * @notice Emitted when pairing token configuration is updated
     * @param token The pairing token address that was updated
     */
    event PairingConfigUpdated(address indexed token);
    
    /**
     * @notice Emitted when persona metadata is updated
     * @param tokenId The persona token ID
     * @param key The metadata key that was updated
     */
    event MetadataUpdated(uint256 indexed tokenId, string indexed key);
    
    /**
     * @notice Emitted when tokens are purchased on the bonding curve
     * @param tokenId The persona token ID
     * @param buyer The address that purchased tokens
     * @param amountSpent Amount of pairing tokens spent
     * @param tokensReceived Amount of persona tokens received
     */
    event TokensPurchased(uint256 indexed tokenId, address indexed buyer, uint256 amountSpent, uint256 tokensReceived);
    
    /**
     * @notice Emitted when Uniswap liquidity pair is created
     * @param tokenId The persona token ID
     * @param pair The Uniswap pair address
     * @param liquidity The amount of LP tokens minted
     */
    event LiquidityPairCreated(uint256 indexed tokenId, address indexed pair, uint256 liquidity);
    
    /**
     * @notice Emitted when trading fee configuration is updated
     * @param feePercentage New fee percentage in basis points
     * @param creatorShare New creator share in basis points
     */
    event TradingFeeConfigUpdated(uint256 feePercentage, uint256 creatorShare);
    
    /**
     * @notice Emitted when user withdraws purchased tokens
     * @param tokenId The persona token ID
     * @param user The user withdrawing tokens
     * @param amount The amount withdrawn
     */
    event TokensWithdrawn(uint256 indexed tokenId, address indexed user, uint256 amount);
    
    /**
     * @notice Emitted when trading fees are collected and distributed
     * @param tokenId The persona token ID
     * @param totalFees Total fees collected
     * @param creatorFees Fees sent to creator
     * @param amicaFees Fees retained for AMICA
     */
    event TradingFeesCollected(uint256 indexed tokenId, uint256 totalFees, uint256 creatorFees, uint256 amicaFees);
    
    /**
     * @notice Emitted when fee reduction configuration is updated
     * @param minAmicaForReduction New minimum AMICA for reduction
     * @param maxAmicaForReduction New maximum AMICA for full reduction
     * @param minReductionMultiplier New minimum reduction multiplier
     * @param maxReductionMultiplier New maximum reduction multiplier
     */
    event FeeReductionConfigUpdated(
        uint256 minAmicaForReduction,
        uint256 maxAmicaForReduction,
        uint256 minReductionMultiplier,
        uint256 maxReductionMultiplier
    );
    
    /**
     * @notice Emitted when user's AMICA balance snapshot is updated
     * @param user The user whose snapshot was updated
     * @param snapshotBalance The snapshot balance
     * @param blockNumber The block number of the snapshot
     */
    event SnapshotUpdated(address indexed user, uint256 snapshotBalance, uint256 blockNumber);
    
    /**
     * @notice Emitted when agent token is associated with persona
     * @param tokenId The persona token ID
     * @param agentToken The associated agent token address
     */
    event AgentTokenAssociated(uint256 indexed tokenId, address indexed agentToken);
    
    /**
     * @notice Emitted when agent tokens are deposited
     * @param tokenId The persona token ID
     * @param depositor The address depositing tokens
     * @param amount The amount deposited
     */
    event AgentTokensDeposited(uint256 indexed tokenId, address indexed depositor, uint256 amount);
    
    /**
     * @notice Emitted when agent tokens are withdrawn
     * @param tokenId The persona token ID
     * @param depositor The address withdrawing tokens
     * @param amount The amount withdrawn
     */
    event AgentTokensWithdrawn(uint256 indexed tokenId, address indexed depositor, uint256 amount);
    
    /**
     * @notice Emitted when agent rewards are distributed
     * @param tokenId The persona token ID
     * @param recipient The recipient of rewards
     * @param personaTokens Amount of persona tokens received
     * @param agentShare Amount of agent tokens that were deposited
     */
    event AgentRewardsDistributed(uint256 indexed tokenId, address indexed recipient, uint256 personaTokens, uint256 agentShare);
    
    /**
     * @notice Emitted when staking rewards contract is set
     * @param stakingRewards The staking rewards contract address
     */
    event StakingRewardsSet(address indexed stakingRewards);

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the factory contract
     * @dev Can only be called once during deployment
     * @param amicaToken_ Address of the AMICA token contract
     * @param uniswapFactory_ Address of Uniswap V2 factory
     * @param uniswapRouter_ Address of Uniswap V2 router
     * @param erc20Implementation_ Address of persona token implementation
     * @custom:requirement All addresses must be non-zero
     * @custom:emits Sets up default AMICA pairing configuration
     */
    function initialize(
        address amicaToken_,
        address uniswapFactory_,
        address uniswapRouter_,
        address erc20Implementation_
    ) public initializer {
        __ERC721_init("Amica Persona", "PERSONA");
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();

        if (
            amicaToken_ == address(0) ||
            uniswapFactory_ == address(0) ||
            uniswapRouter_ == address(0) ||
            erc20Implementation_ == address(0)
        ) revert InvalidToken();

        amicaToken = IERC20(amicaToken_);
        uniswapFactory = IUniswapV2Factory(uniswapFactory_);
        uniswapRouter = IUniswapV2Router02(uniswapRouter_);
        erc20Implementation = erc20Implementation_;

        // Initialize default pairing config for AMICA
        pairingConfigs[amicaToken_] = PairingConfig({
            enabled: true,
            mintCost: 1000 ether,
            graduationThreshold: 1_000_000 ether
        });

        // Initialize trading fee config (1% fee, 50/50 split)
        tradingFeeConfig = TradingFeeConfig({
            feePercentage: 100,    // 1%
            creatorShare: 5000     // 50%
        });

        // Initialize fee reduction config
        feeReductionConfig = FeeReductionConfig({
            minAmicaForReduction: 1000 ether,
            maxAmicaForReduction: 1_000_000 ether,
            minReductionMultiplier: 9000,  // 90% of base fee (10% discount)
            maxReductionMultiplier: 0       // 0% of base fee (100% discount)
        });
    }

    // ============================================================================
    // ADMIN FUNCTIONS
    // ============================================================================

    /**
     * @notice Pauses all contract operations
     * @dev Only callable by owner, affects minting and trading
     * @custom:access Restricted to owner
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resumes all contract operations
     * @dev Only callable by owner
     * @custom:access Restricted to owner
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Configures a pairing token for persona creation
     * @dev Enables a token and sets its minting cost and graduation threshold
     * @param token The token address to configure
     * @param mintCost Cost in tokens to create a persona
     * @param graduationThreshold Amount needed to graduate to Uniswap
     * @custom:access Restricted to owner
     * @custom:emits PairingConfigUpdated
     */
    function configurePairingToken(
        address token,
        uint256 mintCost,
        uint256 graduationThreshold
    ) external onlyOwner {
        if (token == address(0)) revert InvalidToken();

        pairingConfigs[token] = PairingConfig({
            enabled: true,
            mintCost: mintCost,
            graduationThreshold: graduationThreshold
        });

        emit PairingConfigUpdated(token);
    }

    /**
     * @notice Disables a pairing token
     * @dev Prevents new personas from being created with this token
     * @param token The token address to disable
     * @custom:access Restricted to owner
     * @custom:emits PairingConfigUpdated
     */
    function disablePairingToken(address token) external onlyOwner {
        pairingConfigs[token].enabled = false;
        emit PairingConfigUpdated(token);
    }

    /**
     * @notice Updates trading fee configuration
     * @dev Sets the fee percentage and creator/protocol split
     * @param feePercentage Fee in basis points (max 1000 = 10%)
     * @param creatorShare Creator's share in basis points (max 10000 = 100%)
     * @custom:access Restricted to owner
     * @custom:emits TradingFeeConfigUpdated
     */
    function configureTradingFees(
        uint256 feePercentage,
        uint256 creatorShare
    ) external onlyOwner {
        if (feePercentage > 1000) revert FeeTooHigh();
        if (creatorShare > BASIS_POINTS) revert InvalidShare();

        tradingFeeConfig.feePercentage = feePercentage;
        tradingFeeConfig.creatorShare = creatorShare;

        emit TradingFeeConfigUpdated(feePercentage, creatorShare);
    }

    /**
     * @notice Configures AMICA-based fee reduction parameters
     * @dev Sets up exponential curve for fee discounts based on AMICA holdings
     * @param minAmicaForReduction Minimum AMICA to start receiving discounts
     * @param maxAmicaForReduction AMICA amount for maximum discount
     * @param minReductionMultiplier Multiplier at minimum (e.g., 9000 = 10% discount)
     * @param maxReductionMultiplier Multiplier at maximum (e.g., 0 = 100% discount)
     * @custom:access Restricted to owner
     * @custom:emits FeeReductionConfigUpdated
     */
    function configureFeeReduction(
        uint256 minAmicaForReduction,
        uint256 maxAmicaForReduction,
        uint256 minReductionMultiplier,
        uint256 maxReductionMultiplier
    ) external onlyOwner {
        if (minAmicaForReduction >= maxAmicaForReduction) revert InvalidFeeRange();
        if (minReductionMultiplier > BASIS_POINTS) revert InvalidMultiplier();
        if (maxReductionMultiplier > minReductionMultiplier) revert InvalidMultiplier();

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

    /**
     * @notice Sets the staking rewards contract address
     * @dev Optional integration for additional reward mechanisms
     * @param _stakingRewards Address of the staking rewards contract
     * @custom:access Restricted to owner
     * @custom:emits StakingRewardsSet
     */
    function setStakingRewards(address _stakingRewards) external onlyOwner {
        stakingRewards = _stakingRewards;
        emit StakingRewardsSet(_stakingRewards);
    }

    // ============================================================================
    // CORE FUNCTIONS - PERSONA CREATION
    // ============================================================================

    /**
     * @notice Creates a new persona NFT with associated ERC20 token
     * @dev Mints NFT, deploys ERC20, and optionally handles initial purchase
     * @param pairingToken Token to use for payment and pairing
     * @param name Name of the persona (max 32 chars)
     * @param symbol Symbol for the ERC20 (max 10 chars)
     * @param metadataKeys Array of metadata keys
     * @param metadataValues Array of metadata values
     * @param initialBuyAmount Amount to buy on bonding curve immediately
     * @param agentToken Optional agent token for enhanced rewards
     * @param minAgentTokens Minimum agent tokens required for graduation
     * @return tokenId The ID of the newly created persona NFT
     * @custom:emits PersonaCreated
     * @custom:emits AgentTokenAssociated (if agent token provided)
     * @custom:emits TokensPurchased (if initial buy)
     */
    function createPersona(
        address pairingToken,
        string memory name,
        string memory symbol,
        string[] memory metadataKeys,
        string[] memory metadataValues,
        uint256 initialBuyAmount,
        address agentToken,
        uint256 minAgentTokens
    ) external nonReentrant whenNotPaused returns (uint256) {
        if (agentToken == address(0) && minAgentTokens != 0) revert CannotSetMinWithoutAgent();

        // Validations
        PairingConfig memory config = pairingConfigs[pairingToken];
        if (!config.enabled) revert TokenNotEnabled();
        if (bytes(name).length == 0 || bytes(name).length > 32) revert InvalidName();
        if (bytes(symbol).length == 0 || bytes(symbol).length > 10) revert InvalidSymbol();
        if (metadataKeys.length != metadataValues.length) revert InvalidMetadata();

        // Take payment in the pairing token
        uint256 totalPayment = config.mintCost + initialBuyAmount;
        if (IERC20(pairingToken).balanceOf(msg.sender) < totalPayment) revert InsufficientPairingToken();
        if (!IERC20(pairingToken).transferFrom(msg.sender, address(this), totalPayment)) revert PaymentFailed();

        // Mint NFT
        uint256 tokenId = _currentTokenId++;
        _safeMint(msg.sender, tokenId);

        // Deploy ERC20 token
        address erc20Token = Clones.clone(erc20Implementation);
        IPersonaToken(erc20Token).initialize(
            string(abi.encodePacked(name, TOKEN_SUFFIX)),
            string(abi.encodePacked(symbol, TOKEN_SUFFIX)),
            PERSONA_TOKEN_SUPPLY,
            address(this)
        );

        // Store persona data
        PersonaData storage persona = personas[tokenId];
        persona.name = name;
        persona.symbol = symbol;
        persona.erc20Token = erc20Token;
        persona.pairToken = pairingToken;
        persona.agentToken = agentToken;
        persona.createdAt = block.timestamp;
        persona.minAgentTokens = minAgentTokens;

        // Store metadata
        for (uint256 i = 0; i < metadataKeys.length; i++) {
            persona.metadata[metadataKeys[i]] = metadataValues[i];
            emit MetadataUpdated(tokenId, metadataKeys[i]);
        }

        emit PersonaCreated(tokenId, msg.sender, erc20Token, name, symbol);

        if (agentToken != address(0)) {
            emit AgentTokenAssociated(tokenId, agentToken);
        }

        // Handle initial buy if specified
        if (initialBuyAmount > 0) {
            _swapExactTokensForTokensInternal(
                tokenId,
                initialBuyAmount,
                0,
                msg.sender,
                block.timestamp + 300,
                true // Internal call, tokens already in contract
            );
        }

        return tokenId;
    }

    // ============================================================================
    // CORE FUNCTIONS - TRADING
    // ============================================================================

    /**
     * @notice Swaps pairing tokens for persona tokens on bonding curve
     * @dev Uses Bancor-style bonding curve with automatic fee application
     * @param tokenId The persona token ID to trade
     * @param amountIn Amount of pairing tokens to spend
     * @param amountOutMin Minimum persona tokens to receive
     * @param to Recipient of the persona tokens
     * @param deadline Transaction must complete before this timestamp
     * @return amountOut Amount of persona tokens received
     * @custom:emits TokensPurchased
     * @custom:emits TradingFeesCollected (if fees apply)
     * @custom:emits LiquidityPairCreated (if graduation threshold met)
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
     * @notice Internal swap implementation
     * @dev Handles both external swaps and internal initial buys
     * @param tokenId The persona token ID
     * @param amountIn Amount of pairing tokens
     * @param amountOutMin Minimum output amount
     * @param to Recipient address
     * @param deadline Transaction deadline
     * @param isInternal Whether this is an internal call (tokens already in contract)
     * @return amountOut Amount of persona tokens received
     */
    function _swapExactTokensForTokensInternal(
        uint256 tokenId,
        uint256 amountIn,
        uint256 amountOutMin,
        address to,
        uint256 deadline,
        bool isInternal
    ) private returns (uint256 amountOut) {
        if (block.timestamp > deadline) revert TransactionExpired();
        if (to == address(0)) revert InvalidRecipient();

        PersonaData storage persona = personas[tokenId];
        if (persona.pairCreated) revert TradingOnUniswap();
        if (persona.erc20Token == address(0)) revert InvalidToken();

        TokenPurchase storage purchase = purchases[tokenId];

        // Auto-snapshot if needed (won't apply to this trade due to delay)
        _checkAndUpdateSnapshot(msg.sender);

        // Calculate fees with AMICA holdings discount
        uint256 effectiveFeePercentage = getEffectiveFeePercentage(msg.sender);
        uint256 feeAmount = (amountIn * effectiveFeePercentage) / BASIS_POINTS;
        uint256 amountInAfterFee = amountIn - feeAmount;

        // Calculate tokens out using Bancor formula (after fees)
        uint256 bondingAmount = persona.agentToken != address(0) ?
            AGENT_BONDING_AMOUNT : STANDARD_BONDING_AMOUNT;

        amountOut = _calculateAmountOut(
            amountInAfterFee,
            purchase.tokensSold,
            bondingAmount
        );

        if (amountOut < amountOutMin) revert InsufficientOutput();
        if (amountOut > getAvailableTokens(tokenId)) revert InsufficientLiquidity();

        // Only transfer tokens if this is NOT an internal call
        if (!isInternal) {
            if (!isInternal && !IERC20(persona.pairToken).transferFrom(msg.sender, address(this), amountIn)) revert TransferFailed();
        }

        // Handle fees if any
        if (feeAmount > 0) {
            _distributeTradingFees(tokenId, feeAmount);
        }

        // Update state
        purchase.totalDeposited += amountInAfterFee;
        purchase.tokensSold += amountOut;

        // Store purchase info for lock
        userPurchases[tokenId][to] += amountOut;

        // Transfer persona tokens to recipient
        if (!IERC20(persona.erc20Token).transfer(to, amountOut)) revert TransferFailed();

        emit TokensPurchased(tokenId, to, amountIn, amountOut);

        // Check if ready to create pair
        if (purchase.totalDeposited >= pairingConfigs[persona.pairToken].graduationThreshold) {
            _createLiquidityPair(tokenId);
        }
    }

    /**
     * @notice Withdraws purchased persona tokens
     * @dev Allows users to claim their purchased tokens
     * @param tokenId The persona token ID
     * @custom:emits TokensWithdrawn
     */
    function withdrawTokens(uint256 tokenId) external nonReentrant whenNotPaused {
        PersonaData storage persona = personas[tokenId];
        if (persona.erc20Token == address(0)) revert InvalidToken();

        uint256 totalToWithdraw = userPurchases[tokenId][msg.sender];
        if (totalToWithdraw == 0) revert NoTokensToWithdraw();
        userPurchases[tokenId][msg.sender] = 0; // Reset user's purchase

        // Transfer tokens
        if (!IERC20(persona.erc20Token).transfer(msg.sender, totalToWithdraw)) revert TransferFailed();

        emit TokensWithdrawn(tokenId, msg.sender, totalToWithdraw);
    }

    // ============================================================================
    // AGENT TOKEN FUNCTIONS
    // ============================================================================

    /**
     * @notice Deposits agent tokens for a persona
     * @dev Can only be done before graduation, deposits earn rewards after
     * @param tokenId The persona token ID
     * @param amount Amount of agent tokens to deposit
     * @custom:emits AgentTokensDeposited
     */
    function depositAgentTokens(uint256 tokenId, uint256 amount) external nonReentrant whenNotPaused {
        PersonaData storage persona = personas[tokenId];
        if (persona.agentToken == address(0)) revert NoAgentToken();
        if (persona.pairCreated) revert AlreadyGraduated();
        if (amount == 0) revert InvalidAmount();

        // Transfer agent tokens from user
        if (!IERC20(persona.agentToken).transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        // Record deposit
        agentDeposits[tokenId][msg.sender] += amount;
        persona.totalAgentDeposited += amount;

        emit AgentTokensDeposited(tokenId, msg.sender, amount);
    }

    /**
     * @notice Withdraws deposited agent tokens before graduation
     * @dev Not available after graduation, use claimAgentRewards instead
     * @param tokenId The persona token ID
     * @param amount Amount to withdraw
     * @custom:emits AgentTokensWithdrawn
     */
    function withdrawAgentTokens(uint256 tokenId, uint256 amount) external nonReentrant whenNotPaused {
        PersonaData storage persona = personas[tokenId];
        if (persona.pairCreated) revert AlreadyGraduated();

        if (agentDeposits[tokenId][msg.sender] < amount) revert NoDepositsToWithdraw();

        agentDeposits[tokenId][msg.sender] -= amount;
        persona.totalAgentDeposited -= amount;

        // Return agent tokens
        if (!IERC20(persona.agentToken).transfer(msg.sender, amount)) revert TransferFailed();

        emit AgentTokensWithdrawn(tokenId, msg.sender, amount);
    }

    /**
     * @notice Claims persona token rewards for agent token deposits
     * @dev Only available after graduation, distributes pro-rata share
     * @param tokenId The persona token ID
     * @custom:emits AgentRewardsDistributed
     */
    function claimAgentRewards(uint256 tokenId) external nonReentrant {
        PersonaData storage persona = personas[tokenId];
        if (!persona.pairCreated) revert NotGraduated();
        if (persona.agentToken == address(0)) revert NoAgentToken();

        uint256 userAgentAmount = agentDeposits[tokenId][msg.sender];
        if (userAgentAmount == 0) revert NoDepositsToClaim();
        agentDeposits[tokenId][msg.sender] = 0; // Reset user's agent deposit

        // Calculate pro-rata share of persona tokens
        uint256 personaReward = 0;
        if (persona.totalAgentDeposited > 0) {
            personaReward = (AGENT_REWARDS_AMOUNT * userAgentAmount) / persona.totalAgentDeposited;
        }

        if (personaReward > 0) {
            if (personaReward > 0 && !IERC20(persona.erc20Token).transfer(msg.sender, personaReward)) revert TransferFailed();
        }

        emit AgentRewardsDistributed(tokenId, msg.sender, personaReward, userAgentAmount);
    }

    // ============================================================================
    // METADATA FUNCTIONS
    // ============================================================================

    /**
     * @notice Updates metadata for a persona
     * @dev Only callable by the NFT owner
     * @param tokenId The persona token ID
     * @param keys Array of metadata keys to update
     * @param values Array of new values
     * @custom:access Restricted to NFT owner
     * @custom:emits MetadataUpdated (for each key)
     */
    function updateMetadata(
        uint256 tokenId,
        string[] memory keys,
        string[] memory values
    ) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (keys.length != values.length) revert InvalidMetadata();

        for (uint256 i = 0; i < keys.length; i++) {
            personas[tokenId].metadata[keys[i]] = values[i];
            emit MetadataUpdated(tokenId, keys[i]);
        }
    }

    // ============================================================================
    // FEE MANAGEMENT FUNCTIONS
    // ============================================================================

    /**
     * @notice Updates caller's AMICA balance snapshot for fee reduction
     * @dev Snapshot becomes active after SNAPSHOT_DELAY blocks
     * @custom:requirement Must have minimum AMICA balance
     * @custom:emits SnapshotUpdated
     */
    function updateAmicaSnapshot() external {
        uint256 currentBalance = amicaToken.balanceOf(msg.sender);
        require(currentBalance >= feeReductionConfig.minAmicaForReduction,
                "Insufficient AMICA balance");

        UserSnapshot storage snapshot = userSnapshots[msg.sender];

        // Check if pending snapshot can be promoted to current
        if (snapshot.pendingBlock > 0 && block.number >= snapshot.pendingBlock + SNAPSHOT_DELAY) {
            snapshot.currentBalance = snapshot.pendingBalance;
            snapshot.currentBlock = snapshot.pendingBlock;
            snapshot.pendingBalance = 0;
            snapshot.pendingBlock = 0;
        }

        // Set new pending snapshot
        snapshot.pendingBalance = currentBalance;
        snapshot.pendingBlock = block.number;

        emit SnapshotUpdated(msg.sender, currentBalance, block.number);
    }

    /**
     * @notice Calculates effective fee percentage for a user
     * @dev Applies exponential curve based on AMICA holdings
     * @param user The user address to check
     * @return effectiveFeePercentage Fee percentage in basis points
     */
    function getEffectiveFeePercentage(address user) public view returns (uint256) {
        uint256 effectiveBalance = getEffectiveAmicaBalance(user);

        // If no effective balance, return full fee
        if (effectiveBalance < feeReductionConfig.minAmicaForReduction) {
            return tradingFeeConfig.feePercentage;
        }

        // If user has maximum or more, return minimum fee
        if (effectiveBalance >= feeReductionConfig.maxAmicaForReduction) {
            return (tradingFeeConfig.feePercentage * feeReductionConfig.maxReductionMultiplier) / BASIS_POINTS;
        }

        // Calculate exponential scaling between min and max
        uint256 range = feeReductionConfig.maxAmicaForReduction - feeReductionConfig.minAmicaForReduction;
        uint256 userPosition = effectiveBalance - feeReductionConfig.minAmicaForReduction;

        // Calculate progress ratio (0 to 1 scaled to 1e18)
        uint256 progress = (userPosition * 1e18) / range;

        // Apply exponential curve: progress^2
        uint256 exponentialProgress = (progress * progress) / 1e18;

        // Interpolate between min and max reduction multipliers
        uint256 multiplierRange = feeReductionConfig.minReductionMultiplier - feeReductionConfig.maxReductionMultiplier;
        uint256 reduction = (multiplierRange * exponentialProgress) / 1e18;
        uint256 effectiveMultiplier = feeReductionConfig.minReductionMultiplier - reduction;

        // Calculate final fee
        return (tradingFeeConfig.feePercentage * effectiveMultiplier) / BASIS_POINTS;
    }

    // ============================================================================
    // VIEW FUNCTIONS - GETTERS
    // ============================================================================

    /**
     * @notice Returns metadata URI for a persona NFT
     * @dev Overrides ERC721 tokenURI with custom JSON metadata
     * @param tokenId The persona token ID
     * @return uri JSON-encoded metadata string
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
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

    /**
     * @notice Checks if a persona has graduated to Uniswap
     * @param tokenId The persona token ID
     * @return bool True if Uniswap pair has been created
     */
    function hasGraduated(uint256 tokenId) external view returns (bool) {
        return personas[tokenId].pairCreated;
    }

    /**
     * @notice Checks if a persona can graduate
     * @param tokenId The persona token ID
     * @return eligible Whether graduation is possible
     * @return reason If not eligible, explains why
     */
    function canGraduate(uint256 tokenId) external view returns (bool eligible, string memory reason) {
        PersonaData storage persona = personas[tokenId];

        if (persona.pairCreated) {
            return (false, "Already graduated");
        }

        TokenPurchase storage purchase = purchases[tokenId];
        if (purchase.totalDeposited < pairingConfigs[persona.pairToken].graduationThreshold) {
            return (false, "Below graduation threshold");
        }

        if (persona.agentToken != address(0) && persona.minAgentTokens > 0) {
            if (persona.totalAgentDeposited < persona.minAgentTokens) {
                return (false, "Insufficient agent tokens deposited");
            }
        }

        return (true, "");
    }

    /**
     * @notice Gets core persona information
     * @param tokenId The persona token ID
     * @return name Persona name
     * @return symbol Token symbol
     * @return erc20Token Address of ERC20 token
     * @return pairToken Address of pairing token
     * @return pairCreated Whether graduated
     * @return createdAt Creation timestamp
     * @return minAgentTokens Minimum agent tokens for graduation
     */
    function getPersona(uint256 tokenId)
        external
        view
        returns (
            string memory name,
            string memory symbol,
            address erc20Token,
            address pairToken,
            bool pairCreated,
            uint256 createdAt,
            uint256 minAgentTokens
        )
    {
        PersonaData storage persona = personas[tokenId];
        return (
            persona.name,
            persona.symbol,
            persona.erc20Token,
            persona.pairToken,
            persona.pairCreated,
            persona.createdAt,
            persona.minAgentTokens
        );
    }

    /**
     * @notice Gets persona metadata values
     * @param tokenId The persona token ID
     * @param keys Array of metadata keys to retrieve
     * @return values Array of metadata values
     */
    function getMetadata(uint256 tokenId, string[] memory keys)
        external
        view
        returns (string[] memory)
    {
        string[] memory values = new string[](keys.length);

        for (uint256 i = 0; i < keys.length; i++) {
            values[i] = personas[tokenId].metadata[keys[i]];
        }

        return values;
    }

    /**
     * @notice Gets available tokens for purchase on bonding curve
     * @param tokenId The persona token ID
     * @return availableTokens Amount still available for purchase
     */
    function getAvailableTokens(uint256 tokenId) public view returns (uint256) {
        PersonaData storage persona = personas[tokenId];
        if (persona.pairCreated) return 0;
        if (persona.erc20Token == address(0)) return 0;

        uint256 bondingAmount = persona.agentToken != address(0) ?
            AGENT_BONDING_AMOUNT : STANDARD_BONDING_AMOUNT;

        uint256 sold = purchases[tokenId].tokensSold;
        if (sold >= bondingAmount) {
            return 0;
        }

        return bondingAmount - sold;
    }

    /**
     * @notice Gets user's effective AMICA balance for fee calculation
     * @dev Returns minimum of snapshot and current balance
     * @param user The user address
     * @return effectiveBalance AMICA balance used for fee reduction
     */
    function getEffectiveAmicaBalance(address user) public view returns (uint256) {
        UserSnapshot storage snapshot = userSnapshots[user];

        // First check if pending snapshot should be promoted
        uint256 activeBalance;
        uint256 activeBlock;

        if (snapshot.pendingBlock > 0 && block.number >= snapshot.pendingBlock + SNAPSHOT_DELAY) {
            // Pending snapshot is now active
            activeBalance = snapshot.pendingBalance;
            activeBlock = snapshot.pendingBlock;
        } else if (snapshot.currentBlock > 0 && block.number >= snapshot.currentBlock + SNAPSHOT_DELAY) {
            // Use current snapshot
            activeBalance = snapshot.currentBalance;
            activeBlock = snapshot.currentBlock;
        } else {
            // No valid snapshot
            return 0;
        }

        // Return minimum of snapshot and current balance
        uint256 currentBalance = amicaToken.balanceOf(user);
        return currentBalance < activeBalance ? currentBalance : activeBalance;
    }

    /**
     * @notice Gets detailed fee information for a user
     * @param user The user address
     * @return currentBalance Current AMICA balance
     * @return snapshotBalance Snapshot AMICA balance
     * @return effectiveBalance Effective balance for fees
     * @return snapshotBlock_ Block of snapshot
     * @return isEligible Whether eligible for fee reduction
     * @return blocksUntilEligible Blocks until snapshot active
     * @return baseFeePercentage Base fee before reduction
     * @return effectiveFeePercentage Actual fee after reduction
     * @return discountPercentage Discount percentage (0-10000)
     */
    function getUserFeeInfo(address user) external view returns (
        uint256 currentBalance,
        uint256 snapshotBalance,
        uint256 effectiveBalance,
        uint256 snapshotBlock_,
        bool isEligible,
        uint256 blocksUntilEligible,
        uint256 baseFeePercentage,
        uint256 effectiveFeePercentage,
        uint256 discountPercentage
    ) {
        currentBalance = amicaToken.balanceOf(user);
        effectiveBalance = getEffectiveAmicaBalance(user);

        UserSnapshot storage snapshot = userSnapshots[user];

        // Determine which snapshot is active/pending
        if (snapshot.pendingBlock > 0 && block.number >= snapshot.pendingBlock + SNAPSHOT_DELAY) {
            // Pending is now active
            snapshotBalance = snapshot.pendingBalance;
            snapshotBlock_ = snapshot.pendingBlock;
            isEligible = true;
            blocksUntilEligible = 0;
        } else if (snapshot.currentBlock > 0 && block.number >= snapshot.currentBlock + SNAPSHOT_DELAY) {
            // Current is active
            snapshotBalance = snapshot.currentBalance;
            snapshotBlock_ = snapshot.currentBlock;
            isEligible = true;
            blocksUntilEligible = 0;
        } else if (snapshot.pendingBlock > 0) {
            // Pending exists but not active yet
            snapshotBalance = snapshot.pendingBalance;
            snapshotBlock_ = snapshot.pendingBlock;
            isEligible = false;
            blocksUntilEligible = (snapshot.pendingBlock + SNAPSHOT_DELAY) - block.number;
        } else if (snapshot.currentBlock > 0) {
            // Current exists but not active yet (shouldn't happen in practice)
            snapshotBalance = snapshot.currentBalance;
            snapshotBlock_ = snapshot.currentBlock;
            isEligible = false;
            blocksUntilEligible = (snapshot.currentBlock + SNAPSHOT_DELAY) - block.number;
        } else {
            // No snapshot
            snapshotBalance = 0;
            snapshotBlock_ = 0;
            isEligible = false;
            blocksUntilEligible = SNAPSHOT_DELAY;
        }

        baseFeePercentage = tradingFeeConfig.feePercentage;
        effectiveFeePercentage = getEffectiveFeePercentage(user);

        if (baseFeePercentage > 0) {
            discountPercentage = ((baseFeePercentage - effectiveFeePercentage) * BASIS_POINTS) / baseFeePercentage;
        } else {
            discountPercentage = 0;
        }
    }

    /**
     * @notice Gets token distribution allocations for a persona
     * @param tokenId The persona token ID
     * @return liquidityAmount Tokens for Uniswap liquidity
     * @return bondingAmount Tokens for bonding curve
     * @return amicaAmount Tokens for AMICA deposit
     * @return agentRewardsAmount Tokens for agent depositors
     */
    function getTokenDistribution(uint256 tokenId) external view returns (
        uint256 liquidityAmount,
        uint256 bondingAmount,
        uint256 amicaAmount,
        uint256 agentRewardsAmount
    ) {
        PersonaData storage persona = personas[tokenId];

        if (persona.agentToken != address(0)) {
            // With agent token: 1/3, 2/9, 2/9, 2/9
            liquidityAmount = AGENT_LIQUIDITY_AMOUNT;
            bondingAmount = AGENT_BONDING_AMOUNT;
            amicaAmount = AGENT_AMICA_AMOUNT;
            agentRewardsAmount = AGENT_REWARDS_AMOUNT;
        } else {
            // Without agent token: 1/3, 1/3, 1/3, 0
            liquidityAmount = STANDARD_LIQUIDITY_AMOUNT;
            bondingAmount = STANDARD_BONDING_AMOUNT;
            amicaAmount = STANDARD_AMICA_AMOUNT;
            agentRewardsAmount = 0;
        }
    }

    /**
     * @notice Calculates expected agent rewards for a user
     * @param tokenId The persona token ID
     * @param user The user address
     * @return personaReward Expected persona tokens
     * @return agentAmount User's agent token deposit
     */
    function calculateAgentRewards(uint256 tokenId, address user)
        external
        view
        returns (uint256 personaReward, uint256 agentAmount)
    {
        PersonaData storage persona = personas[tokenId];

        agentAmount = agentDeposits[tokenId][user];

        if (persona.totalAgentDeposited > 0 && agentAmount > 0) {
            personaReward = (AGENT_REWARDS_AMOUNT * agentAmount) / persona.totalAgentDeposited;
        }
    }

    /**
     * @notice Gets user's AMICA balance snapshot
     * @param user The user address
     * @return balance The snapshot balance (pending or current)
     */
    function amicaBalanceSnapshot(address user) external view returns (uint256) {
        UserSnapshot storage snapshot = userSnapshots[user];
        if (snapshot.pendingBlock > 0) {
            return snapshot.pendingBalance;
        }
        return snapshot.currentBalance;
    }

    /**
     * @notice Gets user's snapshot block number
     * @param user The user address
     * @return blockNumber The snapshot block (pending or current)
     */
    function snapshotBlock(address user) external view returns (uint256) {
        UserSnapshot storage snapshot = userSnapshots[user];
        if (snapshot.pendingBlock > 0) {
            return snapshot.pendingBlock;
        }
        return snapshot.currentBlock;
    }

    // ============================================================================
    // VIEW FUNCTIONS - CALCULATIONS
    // ============================================================================

    /**
     * @notice Internal function to calculate output amount using Bancor-style bonding curve
     * @dev Uses virtual reserves for price stability
     * @param amountIn Input amount (after fees if applicable)
     * @param reserveSold Amount already sold
     * @param reserveTotal Total reserve amount
     * @return amountOut Expected output from curve calculation
     */
    function _calculateAmountOut(
        uint256 amountIn,
        uint256 reserveSold,
        uint256 reserveTotal
    ) internal pure returns (uint256) {
        if (amountIn == 0) revert InvalidAmount();
        if (reserveTotal <= reserveSold) revert InsufficientLiquidity();

        // Bancor-inspired formula with virtual reserves
        uint256 virtualAmicaReserve = 100_000 ether;
        uint256 virtualTokenReserve = reserveTotal / 10;

        uint256 currentTokenReserve = virtualTokenReserve + (reserveTotal - reserveSold);
        uint256 currentAmicaReserve = virtualAmicaReserve + (reserveSold * virtualAmicaReserve / virtualTokenReserve);

        uint256 k = currentTokenReserve * currentAmicaReserve;
        uint256 newAmicaReserve = currentAmicaReserve + amountIn;
        uint256 newTokenReserve = k / newAmicaReserve;
        uint256 amountOut = currentTokenReserve - newTokenReserve;

        // Apply a 1% fee
        amountOut = amountOut * 99 / 100;

        return amountOut;
    }

    /**
     * @notice Gets expected output for a token swap
     * @dev Uses default fee without user-specific reductions
     * @param tokenId The persona token ID
     * @param amountIn Input amount in pairing tokens
     * @return amountOut Expected persona tokens (after fees)
     */
    function getAmountOut(uint256 tokenId, uint256 amountIn) external view returns (uint256) {
        TokenPurchase storage purchase = purchases[tokenId];
        PersonaData storage persona = personas[tokenId];

        uint256 bondingAmount = persona.agentToken != address(0) ?
            AGENT_BONDING_AMOUNT : STANDARD_BONDING_AMOUNT;

        // Apply trading fee to input (using default fee without user context)
        uint256 feeAmount = (amountIn * tradingFeeConfig.feePercentage) / BASIS_POINTS;
        uint256 amountInAfterFee = amountIn - feeAmount;

        return _calculateAmountOut(amountInAfterFee, purchase.tokensSold, bondingAmount);
    }

    /**
     * @notice Gets expected output with user-specific fee reduction
     * @dev Applies AMICA-based fee discounts
     * @param tokenId The persona token ID
     * @param amountIn Input amount in pairing tokens
     * @param user The user address for fee calculation
     * @return amountOut Expected persona tokens (after reduced fees)
     */
    function getAmountOutForUser(
        uint256 tokenId,
        uint256 amountIn,
        address user
    ) external view returns (uint256) {
        TokenPurchase storage purchase = purchases[tokenId];
        PersonaData storage persona = personas[tokenId];

        uint256 bondingAmount = persona.agentToken != address(0) ?
            AGENT_BONDING_AMOUNT : STANDARD_BONDING_AMOUNT;

        // Calculate user-specific fee with AMICA holdings discount
        uint256 effectiveFeePercentage = getEffectiveFeePercentage(user);
        uint256 feeAmount = (amountIn * effectiveFeePercentage) / BASIS_POINTS;
        uint256 amountInAfterFee = amountIn - feeAmount;

        return _calculateAmountOut(amountInAfterFee, purchase.tokensSold, bondingAmount);
    }

    /**
     * @notice Public bonding curve calculation function
     * @dev Exposed for testing and UI integration
     * @param amountIn Input amount (no fees applied)
     * @param reserveSold Tokens already sold
     * @param reserveTotal Total reserve amount
     * @return amountOut Expected output from bonding curve
     */
    function calculateAmountOut(
        uint256 amountIn,
        uint256 reserveSold,
        uint256 reserveTotal
    ) external pure returns (uint256) {
        return _calculateAmountOut(amountIn, reserveSold, reserveTotal);
    }

    /**
     * @notice Preview swap including fee calculations
     * @dev Useful for UI to show fee breakdown
     * @param tokenId The persona token ID
     * @param amountIn Input amount
     * @param user The user address
     * @return feeAmount Fee to be charged
     * @return amountInAfterFee Amount after fee deduction
     * @return expectedOutput Expected persona tokens
     */
    function previewSwapWithFee(
        uint256 tokenId,
        uint256 amountIn,
        address user
    ) external view returns (
        uint256 feeAmount,
        uint256 amountInAfterFee,
        uint256 expectedOutput
    ) {
        uint256 effectiveFeePercentage = getEffectiveFeePercentage(user);
        feeAmount = (amountIn * effectiveFeePercentage) / BASIS_POINTS;
        amountInAfterFee = amountIn - feeAmount;

        TokenPurchase storage purchase = purchases[tokenId];
        PersonaData storage persona = personas[tokenId];

        uint256 bondingAmount = persona.agentToken != address(0) ?
            AGENT_BONDING_AMOUNT : STANDARD_BONDING_AMOUNT;

        expectedOutput = _calculateAmountOut(
            amountInAfterFee,
            purchase.tokensSold,
            bondingAmount
        );
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    /**
     * @notice Check and potentially create snapshot for fee reduction
     * @dev Creates pending snapshot if user has none and meets minimum balance
     * @param user The user address to check
     */
    function _checkAndUpdateSnapshot(address user) internal {
        UserSnapshot storage snapshot = userSnapshots[user];

        // Check if pending snapshot should be promoted
        if (snapshot.pendingBlock > 0 && block.number >= snapshot.pendingBlock + SNAPSHOT_DELAY) {
            snapshot.currentBalance = snapshot.pendingBalance;
            snapshot.currentBlock = snapshot.pendingBlock;
            snapshot.pendingBalance = 0;
            snapshot.pendingBlock = 0;
        }

        // If user has no snapshot (neither current nor pending) and has enough AMICA, create one
        if (snapshot.currentBlock == 0 && snapshot.pendingBlock == 0) {
            uint256 balance = amicaToken.balanceOf(user);
            if (balance >= feeReductionConfig.minAmicaForReduction) {
                snapshot.pendingBalance = balance;
                snapshot.pendingBlock = block.number;
                emit SnapshotUpdated(user, balance, block.number);
            }
        }
    }

    /**
     * @notice Distribute trading fees between creator and AMICA
     * @dev Splits fees according to configuration, creator portion sent immediately
     * @param tokenId The persona token ID
     * @param feeAmount Total fee amount to distribute
     */
    function _distributeTradingFees(uint256 tokenId, uint256 feeAmount) private {
        PersonaData storage persona = personas[tokenId];

        uint256 creatorFees = (feeAmount * tradingFeeConfig.creatorShare) / BASIS_POINTS;
        uint256 amicaFees = feeAmount - creatorFees;

        // Send creator's share
        if (creatorFees > 0) {
            IERC20(persona.pairToken).transfer(ownerOf(tokenId), creatorFees);
        }

        // AMICA's share stays in contract for now
        // It will be used for liquidity if graduation happens

        emit TradingFeesCollected(tokenId, feeAmount, creatorFees, amicaFees);
    }

    /**
     * @notice Create Uniswap pair when graduation threshold is met
     * @dev Handles token distributions, liquidity creation, and graduation status
     * @param tokenId The persona token ID
     */
    function _createLiquidityPair(uint256 tokenId) private {
        PersonaData storage persona = personas[tokenId];
        if (persona.pairCreated) revert PairAlreadyCreated();

        if (persona.agentToken != address(0) && persona.minAgentTokens > 0) {
            if (persona.totalAgentDeposited < persona.minAgentTokens) revert InsufficientAgentTokens();
        }

        TokenPurchase storage purchase = purchases[tokenId];
        address erc20Token = persona.erc20Token;

        // Determine amounts based on whether agent token is present
        uint256 liquidityAmount = persona.agentToken != address(0) ?
            AGENT_LIQUIDITY_AMOUNT : STANDARD_LIQUIDITY_AMOUNT;
        uint256 amicaAmount = persona.agentToken != address(0) ?
            AGENT_AMICA_AMOUNT : STANDARD_AMICA_AMOUNT;

        // 1. Deposit to AMICA contract
        IERC20(erc20Token).approve(address(amicaToken), amicaAmount);
        IAmicaToken(address(amicaToken)).deposit(erc20Token, amicaAmount);

        // 2. If agent tokens were deposited, send them to AMICA too
        if (persona.agentToken != address(0) && persona.totalAgentDeposited > 0) {
            IERC20(persona.agentToken).approve(address(amicaToken), persona.totalAgentDeposited);
            IAmicaToken(address(amicaToken)).deposit(persona.agentToken, persona.totalAgentDeposited);
        }

        // 3. Create liquidity pair with slippage protection
        uint256 pairingTokenForLiquidity = purchase.totalDeposited;

        // Approve router
        IERC20(erc20Token).approve(address(uniswapRouter), liquidityAmount);
        IERC20(persona.pairToken).approve(address(uniswapRouter), pairingTokenForLiquidity);

        // Create pair if needed
        address pairAddress = uniswapFactory.getPair(erc20Token, persona.pairToken);
        if (pairAddress == address(0)) {
            uniswapFactory.createPair(erc20Token, persona.pairToken);
            pairAddress = uniswapFactory.getPair(erc20Token, persona.pairToken);
        }

        // Calculate minimum amounts (95% of expected to allow for some slippage)
        uint256 minLiquidityAmount = (liquidityAmount * 95) / 100;
        uint256 minPairingTokenAmount = (pairingTokenForLiquidity * 95) / 100;

        // Add liquidity with slippage protection
        (, , uint256 liquidity) = uniswapRouter.addLiquidity(
            erc20Token,
            persona.pairToken,
            liquidityAmount,
            pairingTokenForLiquidity,
            minLiquidityAmount,          // Changed from 0
            minPairingTokenAmount,        // Changed from 0
            address(this), // LP tokens go to contract
            block.timestamp + 300
        );

        // Mark as graduated
        persona.pairCreated = true;

        // Set graduation status on the persona token contract
        IPersonaToken(erc20Token).setGraduationStatus(true);

        emit LiquidityPairCreated(tokenId, pairAddress, liquidity);
    }

}
