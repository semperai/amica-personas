// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// ============================================================================
// INTERFACES
// ============================================================================

interface IUniswapV2Factory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IUniswapV2Router {
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint amountADesired,
        uint amountBDesired,
        uint amountAMin,
        uint amountBMin,
        address to,
        uint deadline
    ) external returns (uint amountA, uint amountB, uint liquidity);
}

interface IAmicaToken {
    function deposit(address token, uint256 amount) external;
}

interface IERC20Implementation {
    function initialize(string memory name, string memory symbol, uint256 supply, address owner) external;
}

/**
 * @title PersonaTokenFactory
 * @notice Factory for creating persona NFTs with associated ERC20 tokens
 * @dev Updated to use 33/33/33 split: 1/3 to AMICA on graduation, 1/3 to bonding curve, 1/3 for liquidity
 */
contract PersonaTokenFactory is ERC721Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using Strings for uint256;

    // ============================================================================
    // CONSTANTS
    // ============================================================================

    // Token distribution constants (33/33/33 split)
    uint256 public constant PERSONA_TOKEN_SUPPLY = 1_000_000_000 ether;
    uint256 public constant AMICA_DEPOSIT_AMOUNT = 333_333_333 ether;     // 1/3 for AMICA (on graduation)
    uint256 public constant BONDING_CURVE_AMOUNT = 333_333_333 ether;    // 1/3 for bonding curve
    uint256 public constant LIQUIDITY_TOKEN_AMOUNT = 333_333_334 ether;  // 1/3 for liquidity (+ rounding)

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
        bool pairCreated;
        uint256 createdAt;
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

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    // Core protocol contracts
    IERC20 public amicaToken;
    IUniswapV2Factory public uniswapFactory;
    IUniswapV2Router public uniswapRouter;
    address public erc20Implementation;

    // Token tracking
    uint256 private _currentTokenId;

    // Mappings for persona data
    mapping(uint256 => PersonaData) public personas;
    mapping(uint256 => TokenPurchase) public purchases;
    mapping(uint256 => mapping(address => UserPurchase[])) public userpurchases;

    // Configuration mappings
    mapping(address => PairingConfig) public pairingConfigs;
    TradingFeeConfig public tradingFeeConfig;
    FeeReductionConfig public feeReductionConfig;

    // AMICA snapshot system
    mapping(address => uint256) public amicaBalanceSnapshot;
    mapping(address => uint256) public snapshotBlock;

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

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    function initialize(
        address amicaToken_,
        address uniswapFactory_,
        address uniswapRouter_,
        address erc20Implementation_
    ) public initializer {
        __ERC721_init("Amica Persona", "PERSONA");
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();

        require(amicaToken_ != address(0), "Invalid AMICA token");
        require(uniswapFactory_ != address(0), "Invalid factory");
        require(uniswapRouter_ != address(0), "Invalid router");
        require(erc20Implementation_ != address(0), "Invalid implementation");

        amicaToken = IERC20(amicaToken_);
        uniswapFactory = IUniswapV2Factory(uniswapFactory_);
        uniswapRouter = IUniswapV2Router(uniswapRouter_);
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

    // ============================================================================
    // CORE FUNCTIONS - PERSONA CREATION
    // ============================================================================

    /**
     * @notice Create a new persona with associated ERC20 token
     * @param initialBuyAmount Optional amount to buy on the bonding curve at launch
     */
    function createPersona(
        address pairingToken,
        string memory name,
        string memory symbol,
        string[] memory metadataKeys,
        string[] memory metadataValues,
        uint256 initialBuyAmount
    ) external nonReentrant returns (uint256) {
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
        persona.createdAt = block.timestamp;

        // Store metadata
        for (uint256 i = 0; i < metadataKeys.length; i++) {
            persona.metadata[metadataKeys[i]] = metadataValues[i];
            emit MetadataUpdated(tokenId, metadataKeys[i]);
        }

        emit PersonaCreated(tokenId, msg.sender, erc20Token, name, symbol);

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
    ) external nonReentrant returns (uint256 amountOut) {
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
        amountOut = getAmountOut(
            amountInAfterFee,
            purchase.tokensSold,
            BONDING_CURVE_AMOUNT
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
    function withdrawTokens(uint256 tokenId) external nonReentrant {
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

        amicaBalanceSnapshot[msg.sender] = currentBalance;
        snapshotBlock[msg.sender] = block.number;

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
            uint256 createdAt
        )
    {
        PersonaData storage persona = personas[tokenId];
        return (
            persona.name,
            persona.symbol,
            persona.erc20Token,
            persona.pairToken,
            persona.pairCreated,
            persona.createdAt
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
    function getUserpurchases(uint256 tokenId, address user)
        external
        view
        returns (UserPurchase[] memory)
    {
        return userpurchases[tokenId][user];
    }

    /**
     * @notice Get available tokens for sale
     */
    function getAvailableTokens(uint256 tokenId) public view returns (uint256) {
        PersonaData storage persona = personas[tokenId];
        if (persona.pairCreated) return 0;
        if (persona.erc20Token == address(0)) return 0;

        uint256 sold = purchases[tokenId].tokensSold;
        if (sold >= BONDING_CURVE_AMOUNT) {
            return 0;
        }

        return BONDING_CURVE_AMOUNT - sold;
    }

    /**
     * @notice Get effective AMICA balance for fee calculation
     */
    function getEffectiveAmicaBalance(address user) public view returns (uint256) {
        // Check if user has a valid snapshot
        if (snapshotBlock[user] == 0 ||
            block.number < snapshotBlock[user] + SNAPSHOT_DELAY) {
            return 0; // No valid snapshot or still in delay period
        }

        uint256 currentBalance = amicaToken.balanceOf(user);
        uint256 snapshotBalance = amicaBalanceSnapshot[user];

        // Return minimum of snapshot and current balance
        return currentBalance < snapshotBalance ? currentBalance : snapshotBalance;
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
        snapshotBalance = amicaBalanceSnapshot[user];
        effectiveBalance = getEffectiveAmicaBalance(user);
        snapshotBlock_ = snapshotBlock[user];

        if (snapshotBlock_ > 0 && block.number >= snapshotBlock_ + SNAPSHOT_DELAY) {
            isEligible = true;
            blocksUntilEligible = 0;
        } else if (snapshotBlock_ > 0) {
            isEligible = false;
            blocksUntilEligible = (snapshotBlock_ + SNAPSHOT_DELAY) - block.number;
        } else {
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

    // ============================================================================
    // VIEW FUNCTIONS - CALCULATIONS
    // ============================================================================

    /**
     * @notice Calculate output amount using Bancor-style bonding curve
     */
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveSold,
        uint256 reserveTotal
    ) public pure returns (uint256) {
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
     */
    function getAmountOut(uint256 tokenId, uint256 amountIn) external view returns (uint256) {
        TokenPurchase storage purchase = purchases[tokenId];

        // Apply trading fee to input
        uint256 feeAmount = (amountIn * tradingFeeConfig.feePercentage) / BASIS_POINTS;
        uint256 amountInAfterFee = amountIn - feeAmount;

        return getAmountOut(amountInAfterFee, purchase.tokensSold, BONDING_CURVE_AMOUNT);
    }

    /**
     * @notice Preview fee for a specific trade
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
        expectedOutput = getAmountOut(
            amountInAfterFee,
            purchase.tokensSold,
            BONDING_CURVE_AMOUNT
        );
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    /**
     * @notice Check and potentially create snapshot for fee reduction
     */
    function _checkAndUpdateSnapshot(address user) internal {
        // If user has no snapshot and has enough AMICA, create one
        if (snapshotBlock[user] == 0) {
            uint256 balance = amicaToken.balanceOf(user);
            if (balance >= feeReductionConfig.minAmicaForReduction) {
                amicaBalanceSnapshot[user] = balance;
                snapshotBlock[user] = block.number;
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

        TokenPurchase storage purchase = purchases[tokenId];

        address erc20Token = persona.erc20Token;

        // Now deposit tokens to AMICA contract (on graduation)
        IERC20(erc20Token).approve(address(amicaToken), AMICA_DEPOSIT_AMOUNT);
        IAmicaToken(address(amicaToken)).deposit(erc20Token, AMICA_DEPOSIT_AMOUNT);

        // All pairing tokens go to liquidity (no graduation reward to creator)
        uint256 pairingTokenForLiquidity = purchase.totalDeposited;

        // Approve router for both tokens
        IERC20(erc20Token).approve(address(uniswapRouter), LIQUIDITY_TOKEN_AMOUNT);
        IERC20(persona.pairToken).approve(address(uniswapRouter), pairingTokenForLiquidity);

        // Create pair if needed
        if (uniswapFactory.getPair(erc20Token, persona.pairToken) == address(0)) {
            uniswapFactory.createPair(erc20Token, persona.pairToken);
        }

        // Add liquidity
        (, , uint256 liquidity) = uniswapRouter.addLiquidity(
            erc20Token,
            persona.pairToken,
            LIQUIDITY_TOKEN_AMOUNT,
            pairingTokenForLiquidity,
            0,
            0,
            address(this), // LP tokens go to contract
            block.timestamp + 300
        );

        persona.pairCreated = true;

        emit LiquidityPairCreated(
            tokenId,
            uniswapFactory.getPair(erc20Token, persona.pairToken),
            liquidity
        );
    }
}
