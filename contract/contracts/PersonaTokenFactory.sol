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

interface IAmicaToken {
    function deposit(address token, uint256 amount) external;
}

interface IERC20Implementation {
    function initialize(string memory name, string memory symbol, uint256 supply, address owner) external;
}

/**
 * @title PersonaTokenFactory
 * @notice Factory for creating persona NFTs with associated ERC20 tokens and optional agent token integration
 */
contract PersonaTokenFactory is ERC721Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    using Strings for uint256;

    // ============================================================================
    // CONSTANTS
    // ============================================================================

    // Token distribution constants
    uint256 public constant PERSONA_TOKEN_SUPPLY = 1_000_000_000 ether;

    // Distribution without agent token (33/33/33)
    uint256 public constant STANDARD_LIQUIDITY_AMOUNT = 333_333_333 ether;
    uint256 public constant STANDARD_BONDING_AMOUNT = 333_333_333 ether;
    uint256 public constant STANDARD_AMICA_AMOUNT = 333_333_334 ether;

    // Distribution with agent token (1/3, 2/9, 2/9, 2/9)
    uint256 public constant AGENT_LIQUIDITY_AMOUNT = 333_333_333 ether;
    uint256 public constant AGENT_BONDING_AMOUNT = 222_222_222 ether;
    uint256 public constant AGENT_AMICA_AMOUNT = 222_222_222 ether;
    uint256 public constant AGENT_REWARDS_AMOUNT = 222_222_223 ether;

    // Other constants
    string private constant TOKEN_SUFFIX = ".amica";
    uint256 private constant BASIS_POINTS = 10000;
    uint256 public constant SNAPSHOT_DELAY = 100; // 100 blocks delay for AMICA balance snapshot

    // ============================================================================
    // STRUCTS
    // ============================================================================

    struct PersonaData {
        string name;
        string symbol;
        address erc20Token;
        address pairToken;
        address agentToken;           // Optional associated agent token
        bool pairCreated;
        uint256 createdAt;
        uint256 totalAgentDeposited;  // Total agent tokens deposited
        uint256 minAgentTokens;       // Minimum agent tokens required for graduation
        mapping(string => string) metadata;
    }

    struct PairingConfig {
        bool enabled;
        uint256 mintCost;
        uint256 graduationThreshold;
    }

    struct TokenPurchase {
        uint256 totalDeposited;
        uint256 tokensSold;
    }

    struct UserPurchase {
        uint256 amount;
        uint256 timestamp;
        bool withdrawn;
    }

    struct AgentDeposit {
        uint256 amount;
        uint256 timestamp;
        bool withdrawn;
    }

    struct TradingFeeConfig {
        uint256 feePercentage;    // Fee percentage (basis points, e.g., 100 = 1%)
        uint256 creatorShare;      // Creator's share of fees (basis points, e.g., 5000 = 50%)
    }

    struct FeeReductionConfig {
        uint256 minAmicaForReduction;      // Minimum AMICA to start fee reduction
        uint256 maxAmicaForReduction;      // AMICA amount for maximum fee reduction
        uint256 minReductionMultiplier;    // Fee multiplier at minimum AMICA (e.g., 9000 = 0.9 = 90%)
        uint256 maxReductionMultiplier;    // Fee multiplier at maximum AMICA (e.g., 0 = 0%)
    }

    struct UserSnapshot {
        uint256 currentBalance;      // Currently active snapshot balance
        uint256 currentBlock;        // Block when current snapshot was taken
        uint256 pendingBalance;      // Pending snapshot balance (if any)
        uint256 pendingBlock;        // Block when pending snapshot was taken
    }

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    // Core protocol contracts
    IERC20 public amicaToken;
    IUniswapV2Factory public uniswapFactory;
    IUniswapV2Router02 public uniswapRouter;
    address public erc20Implementation;

    // Token tracking
    uint256 private _currentTokenId;

    // Mappings for persona data
    mapping(uint256 => PersonaData) public personas;
    mapping(uint256 => TokenPurchase) public purchases;
    mapping(uint256 => mapping(address => UserPurchase[])) public userpurchases;

    // Agent token deposits
    mapping(uint256 => mapping(address => AgentDeposit[])) public agentDeposits;
    mapping(address => bool) public approvedAgentTokens;  // Whitelist of agent tokens

    // Staking rewards contract (deployed separately)
    address public stakingRewards;

    // Configuration mappings
    mapping(address => PairingConfig) public pairingConfigs;
    TradingFeeConfig public tradingFeeConfig;
    FeeReductionConfig public feeReductionConfig;

    // User snapshots for AMICA balance
    mapping(address => UserSnapshot) public userSnapshots;

    // Gap for future upgrades
    uint256[50] private __gap;

    // ============================================================================
    // EVENTS
    // ============================================================================

    event PersonaCreated(
        uint256 indexed tokenId,
        address indexed creator,
        address indexed erc20Token,
        string name,
        string symbol
    );
    event PairingConfigUpdated(address indexed token);
    event MetadataUpdated(uint256 indexed tokenId, string indexed key);
    event TokensPurchased(uint256 indexed tokenId, address indexed buyer, uint256 amountSpent, uint256 tokensReceived);
    event LiquidityPairCreated(uint256 indexed tokenId, address indexed pair, uint256 liquidity);
    event TradingFeeConfigUpdated(uint256 feePercentage, uint256 creatorShare);
    event TokensWithdrawn(uint256 indexed tokenId, address indexed user, uint256 amount);
    event TradingFeesCollected(uint256 indexed tokenId, uint256 totalFees, uint256 creatorFees, uint256 amicaFees);
    event FeeReductionConfigUpdated(
        uint256 minAmicaForReduction,
        uint256 maxAmicaForReduction,
        uint256 minReductionMultiplier,
        uint256 maxReductionMultiplier
    );
    event SnapshotUpdated(address indexed user, uint256 snapshotBalance, uint256 blockNumber);
    event AgentTokenAssociated(uint256 indexed tokenId, address indexed agentToken);
    event AgentTokensDeposited(uint256 indexed tokenId, address indexed depositor, uint256 amount);
    event AgentTokensWithdrawn(uint256 indexed tokenId, address indexed depositor, uint256 amount);
    event AgentRewardsDistributed(uint256 indexed tokenId, address indexed recipient, uint256 personaTokens, uint256 agentShare);
    event StakingRewardsSet(address indexed stakingRewards);

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

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

        require(amicaToken_ != address(0), "Invalid AMICA token");
        require(uniswapFactory_ != address(0), "Invalid factory");
        require(uniswapRouter_ != address(0), "Invalid router");
        require(erc20Implementation_ != address(0), "Invalid implementation");

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

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Configure pairing token parameters
     */
    function configurePairingToken(
        address token,
        uint256 mintCost,
        uint256 graduationThreshold
    ) external onlyOwner {
        require(token != address(0), "Invalid token");

        pairingConfigs[token] = PairingConfig({
            enabled: true,
            mintCost: mintCost,
            graduationThreshold: graduationThreshold
        });

        emit PairingConfigUpdated(token);
    }

    /**
     * @notice Disable a pairing token
     */
    function disablePairingToken(address token) external onlyOwner {
        pairingConfigs[token].enabled = false;
        emit PairingConfigUpdated(token);
    }

    /**
     * @notice Configure trading fee parameters
     */
    function configureTradingFees(
        uint256 feePercentage,
        uint256 creatorShare
    ) external onlyOwner {
        require(feePercentage <= 1000, "Fee too high"); // Max 10%
        require(creatorShare <= BASIS_POINTS, "Invalid creator share");

        tradingFeeConfig.feePercentage = feePercentage;
        tradingFeeConfig.creatorShare = creatorShare;

        emit TradingFeeConfigUpdated(feePercentage, creatorShare);
    }

    /**
     * @notice Configure fee reduction parameters based on AMICA holdings
     */
    function configureFeeReduction(
        uint256 minAmicaForReduction,
        uint256 maxAmicaForReduction,
        uint256 minReductionMultiplier,
        uint256 maxReductionMultiplier
    ) external onlyOwner {
        require(minAmicaForReduction < maxAmicaForReduction, "Invalid AMICA range");
        require(minReductionMultiplier <= BASIS_POINTS, "Invalid min multiplier");
        require(maxReductionMultiplier <= minReductionMultiplier, "Invalid max multiplier");

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
     * @notice Approve an agent token for use in the system
     */
    function approveAgentToken(address token, bool approved) external onlyOwner {
        approvedAgentTokens[token] = approved;
    }

    /**
     * @notice Set the staking rewards contract
     */
    function setStakingRewards(address _stakingRewards) external onlyOwner {
        stakingRewards = _stakingRewards;
        emit StakingRewardsSet(_stakingRewards);
    }

    // ============================================================================
    // CORE FUNCTIONS - PERSONA CREATION
    // ============================================================================

    /**
     * @notice Create a new persona with associated ERC20 token and optional agent token
     * @param initialBuyAmount Optional amount to buy on the bonding curve at launch
     * @param agentToken Optional agent token address (can be address(0))
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
        // Validate agent token if provided
        if (agentToken != address(0)) {
            require(approvedAgentTokens[agentToken], "Agent token not approved");
        } else {
            require(minAgentTokens == 0, "Cannot set min agent tokens without agent token");
        }


        // Validations
        PairingConfig memory config = pairingConfigs[pairingToken];
        require(config.enabled, "Pairing token not enabled");
        require(bytes(name).length > 0 && bytes(name).length <= 32, "Invalid name length");
        require(bytes(symbol).length > 0 && bytes(symbol).length <= 10, "Invalid symbol length");
        require(metadataKeys.length == metadataValues.length, "Metadata mismatch");

        // Take payment in the pairing token
        uint256 totalPayment = config.mintCost + initialBuyAmount;
        require(IERC20(pairingToken).balanceOf(msg.sender) >= totalPayment, "Insufficient balance");
        require(
            IERC20(pairingToken).transferFrom(msg.sender, address(this), totalPayment),
            "Payment failed"
        );

        // Mint NFT
        uint256 tokenId = _currentTokenId++;
        _safeMint(msg.sender, tokenId);

        // Deploy ERC20 token
        address erc20Token = Clones.clone(erc20Implementation);
        IERC20Implementation(erc20Token).initialize(
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
     * @notice Swap exact tokens for persona tokens (similar to Uniswap)
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
     */
    function _swapExactTokensForTokensInternal(
        uint256 tokenId,
        uint256 amountIn,
        uint256 amountOutMin,
        address to,
        uint256 deadline,
        bool isInternal
    ) private returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "Transaction expired");
        require(to != address(0), "Invalid recipient");

        PersonaData storage persona = personas[tokenId];
        require(!persona.pairCreated, "Trading already on Uniswap");
        require(persona.erc20Token != address(0), "Invalid token");

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

        require(amountOut >= amountOutMin, "Insufficient output amount");
        require(amountOut <= getAvailableTokens(tokenId), "Insufficient liquidity");

        // Only transfer tokens if this is NOT an internal call
        if (!isInternal) {
            require(
                IERC20(persona.pairToken).transferFrom(msg.sender, address(this), amountIn),
                "Transfer failed"
            );
        }

        // Handle fees if any
        if (feeAmount > 0) {
            _distributeTradingFees(tokenId, feeAmount);
        }

        // Update state
        purchase.totalDeposited += amountInAfterFee;
        purchase.tokensSold += amountOut;

        // Store purchase info for lock
        userpurchases[tokenId][to].push(UserPurchase({
            amount: amountOut,
            timestamp: block.timestamp,
            withdrawn: false
        }));

        // Transfer persona tokens to recipient
        require(
            IERC20(persona.erc20Token).transfer(to, amountOut),
            "Token transfer failed"
        );

        emit TokensPurchased(tokenId, to, amountIn, amountOut);

        // Check if ready to create pair
        if (purchase.totalDeposited >= pairingConfigs[persona.pairToken].graduationThreshold) {
            _createLiquidityPair(tokenId);
        }
    }

    /**
     * @notice Withdraw unlocked tokens
     */
    function withdrawTokens(uint256 tokenId) external nonReentrant whenNotPaused {
        PersonaData storage persona = personas[tokenId];
        require(persona.erc20Token != address(0), "Invalid token");

        UserPurchase[] storage purchasesLocal = userpurchases[tokenId][msg.sender];
        uint256 totalToWithdraw = 0;

        for (uint256 i = 0; i < purchasesLocal.length; i++) {
            if (!purchasesLocal[i].withdrawn && persona.pairCreated) {
                totalToWithdraw += purchasesLocal[i].amount;
                purchasesLocal[i].withdrawn = true;
            }
        }

        require(totalToWithdraw > 0, "No tokens to withdraw");

        // Transfer tokens
        require(
            IERC20(persona.erc20Token).transfer(msg.sender, totalToWithdraw),
            "Transfer failed"
        );

        emit TokensWithdrawn(tokenId, msg.sender, totalToWithdraw);
    }

    // ============================================================================
    // AGENT TOKEN FUNCTIONS
    // ============================================================================

    /**
     * @notice Deposit agent tokens during bonding phase
     * @dev Users can withdraw before graduation, but get persona token rewards after
     */
    function depositAgentTokens(uint256 tokenId, uint256 amount) external nonReentrant whenNotPaused {
        PersonaData storage persona = personas[tokenId];
        require(persona.agentToken != address(0), "No agent token associated");
        require(!persona.pairCreated, "Already graduated");
        require(amount > 0, "Invalid amount");

        // Transfer agent tokens from user
        require(
            IERC20(persona.agentToken).transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        // Record deposit
        agentDeposits[tokenId][msg.sender].push(AgentDeposit({
            amount: amount,
            timestamp: block.timestamp,
            withdrawn: false
        }));

        persona.totalAgentDeposited += amount;

        emit AgentTokensDeposited(tokenId, msg.sender, amount);
    }

    /**
     * @notice Withdraw agent tokens before graduation
     */
    function withdrawAgentTokens(uint256 tokenId) external nonReentrant whenNotPaused {
        PersonaData storage persona = personas[tokenId];
        require(!persona.pairCreated, "Already graduated");

        AgentDeposit[] storage deposits = agentDeposits[tokenId][msg.sender];
        uint256 totalToWithdraw = 0;

        for (uint256 i = 0; i < deposits.length; i++) {
            if (!deposits[i].withdrawn) {
                totalToWithdraw += deposits[i].amount;
                deposits[i].withdrawn = true;
            }
        }

        require(totalToWithdraw > 0, "No tokens to withdraw");

        persona.totalAgentDeposited -= totalToWithdraw;

        // Return agent tokens
        require(
            IERC20(persona.agentToken).transfer(msg.sender, totalToWithdraw),
            "Transfer failed"
        );

        emit AgentTokensWithdrawn(tokenId, msg.sender, totalToWithdraw);
    }

    /**
     * @notice Claim persona token rewards after graduation (for agent depositors)
     */
    function claimAgentRewards(uint256 tokenId) external nonReentrant {
        PersonaData storage persona = personas[tokenId];
        require(persona.pairCreated, "Not graduated yet");
        require(persona.agentToken != address(0), "No agent token");

        AgentDeposit[] storage deposits = agentDeposits[tokenId][msg.sender];
        uint256 userAgentAmount = 0;

        // Calculate user's total non-withdrawn deposits
        for (uint256 i = 0; i < deposits.length; i++) {
            if (!deposits[i].withdrawn) {
                userAgentAmount += deposits[i].amount;
                deposits[i].withdrawn = true;  // Mark as claimed
            }
        }

        require(userAgentAmount > 0, "No deposits to claim");

        // Calculate pro-rata share of persona tokens
        uint256 personaReward = 0;
        if (persona.totalAgentDeposited > 0) {
            personaReward = (AGENT_REWARDS_AMOUNT * userAgentAmount) / persona.totalAgentDeposited;
        }

        if (personaReward > 0) {
            require(
                IERC20(persona.erc20Token).transfer(msg.sender, personaReward),
                "Persona transfer failed"
            );
        }

        emit AgentRewardsDistributed(tokenId, msg.sender, personaReward, userAgentAmount);
    }

    // ============================================================================
    // METADATA FUNCTIONS
    // ============================================================================

    /**
     * @notice Update persona metadata
     */
    function updateMetadata(
        uint256 tokenId,
        string[] memory keys,
        string[] memory values
    ) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(keys.length == values.length, "Key-value mismatch");

        for (uint256 i = 0; i < keys.length; i++) {
            personas[tokenId].metadata[keys[i]] = values[i];
            emit MetadataUpdated(tokenId, keys[i]);
        }
    }

    /**
     * @notice Override tokenURI for custom metadata
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

    // ============================================================================
    // FEE MANAGEMENT FUNCTIONS
    // ============================================================================

    /**
     * @notice Update user's AMICA balance snapshot
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
     * @notice Calculate effective fee percentage based on user's AMICA holdings
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
     * @notice Check if a persona is eligible for graduation
     * @param tokenId The persona token ID
     * @return eligible Whether the persona can graduate
     * @return reason If not eligible, the reason why
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
     * @notice Get persona details
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
     * @notice Get persona metadata
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
     * @notice Get user purchases for a persona
     */
    function getUserPurchases(uint256 tokenId, address user)
        external
        view
        returns (UserPurchase[] memory)
    {
        return userpurchases[tokenId][user];
    }

    /**
     * @notice Get user's agent token deposits
     */
    function getUserAgentDeposits(uint256 tokenId, address user)
        external
        view
        returns (AgentDeposit[] memory)
    {
        return agentDeposits[tokenId][user];
    }

    /**
     * @notice Get available tokens for sale
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
     * @notice Get effective AMICA balance for fee calculation
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
     * @notice Get detailed fee information for a user
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
     * @notice Get token distribution for a persona
     * @param tokenId The persona token ID
     * @return liquidityAmount Amount allocated for liquidity
     * @return bondingAmount Amount allocated for bonding curve
     * @return amicaAmount Amount allocated for AMICA deposit
     * @return agentRewardsAmount Amount allocated for agent depositors (0 if no agent token)
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
     * @notice Calculate expected agent rewards for a user
     */
    function calculateAgentRewards(uint256 tokenId, address user)
        external
        view
        returns (uint256 personaReward, uint256 agentAmount)
    {
        PersonaData storage persona = personas[tokenId];

        AgentDeposit[] storage deposits = agentDeposits[tokenId][user];
        for (uint256 i = 0; i < deposits.length; i++) {
            if (!deposits[i].withdrawn) {
                agentAmount += deposits[i].amount;
            }
        }

        if (persona.totalAgentDeposited > 0 && agentAmount > 0) {
            personaReward = (AGENT_REWARDS_AMOUNT * agentAmount) / persona.totalAgentDeposited;
        }
    }

    function amicaBalanceSnapshot(address user) external view returns (uint256) {
        UserSnapshot storage snapshot = userSnapshots[user];
        if (snapshot.pendingBlock > 0) {
            return snapshot.pendingBalance;
        }
        return snapshot.currentBalance;
    }

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
     * @param amountIn Input amount (after fees if applicable)
     * @param reserveSold Amount already sold
     * @param reserveTotal Total reserve amount
     */
    function _calculateAmountOut(
        uint256 amountIn,
        uint256 reserveSold,
        uint256 reserveTotal
    ) internal pure returns (uint256) {
        require(amountIn > 0, "Insufficient input amount");
        require(reserveTotal > reserveSold, "Insufficient reserve");

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
     * @notice Get a quote for swapping tokens
     * @param tokenId The persona token ID
     * @param amountIn Input amount in pairing tokens
     * @return amountOut Output amount in persona tokens (after fees)
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
     * @notice Get a quote for swapping tokens with specific user's fee reduction
     * @param tokenId The persona token ID
     * @param amountIn Input amount in pairing tokens
     * @param user The user address to calculate fees for
     * @return amountOut Output amount in persona tokens (after reduced fees)
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
     * @notice Public wrapper for bonding curve calculation (for testing/UI)
     * @param amountIn Input amount (no fees applied)
     * @param reserveSold Amount already sold
     * @param reserveTotal Total reserve amount
     */
    function calculateAmountOut(
        uint256 amountIn,
        uint256 reserveSold,
        uint256 reserveTotal
    ) external pure returns (uint256) {
        return _calculateAmountOut(amountIn, reserveSold, reserveTotal);
    }

    // In previewSwapWithFee, it already uses the user-specific fee calculation correctly:
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
     */
    function _createLiquidityPair(uint256 tokenId) private {
        PersonaData storage persona = personas[tokenId];
        require(!persona.pairCreated, "Pair already created");

        if (persona.agentToken != address(0) && persona.minAgentTokens > 0) {
            require(
                persona.totalAgentDeposited >= persona.minAgentTokens,
                "Insufficient agent tokens deposited"
            );
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

        // 3. Create liquidity pair
        uint256 pairingTokenForLiquidity = purchase.totalDeposited;

        // Approve router
        IERC20(erc20Token).approve(address(uniswapRouter), liquidityAmount);
        IERC20(persona.pairToken).approve(address(uniswapRouter), pairingTokenForLiquidity);

        // Create pair if needed
        address pairAddress = uniswapFactory.getPair(erc20Token, persona.pairToken);
        if (pairAddress == address(0x0)) {
            uniswapFactory.createPair(erc20Token, persona.pairToken);
            pairAddress = uniswapFactory.getPair(erc20Token, persona.pairToken);
        }

        // Add liquidity
        (, , uint256 liquidity) = uniswapRouter.addLiquidity(
            erc20Token,
            persona.pairToken,
            liquidityAmount,
            pairingTokenForLiquidity,
            0,
            0,
            address(this), // LP tokens go to contract
            block.timestamp + 300
        );

        persona.pairCreated = true;

        emit LiquidityPairCreated(tokenId, pairAddress, liquidity);
    }
}
