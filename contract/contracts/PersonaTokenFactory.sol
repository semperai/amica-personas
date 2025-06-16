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

interface IPersonaToken {
    function initialize(string memory name, string memory symbol, uint256 supply, address owner) external;
    function setGraduationStatus(bool status) external;
}

// ============================================================================
// CONSOLIDATED ERRORS (Optimization #2)
// ============================================================================

/**
 * @notice Consolidated error for invalid inputs
 * @param code Error code: 0=Token, 1=Amount, 2=Recipient, 3=Name, 4=Symbol, 5=Metadata, 6=Configuration, 7=Index, 8=Share, 9=Multiplier
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
 * @notice Optimized factory contract with reduced deployment gas
 */
contract PersonaTokenFactory is ERC721Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    using Strings for uint256;

    // ============================================================================
    // OPTIMIZED CONSTANTS (Optimization #8)
    // ============================================================================

    uint256 public constant PERSONA_TOKEN_SUPPLY = 1_000_000_000 ether;
    
    // Simplified to just two base amounts instead of 7 constants
    uint256 private constant THIRD_SUPPLY = 333_333_333 ether;
    uint256 private constant NINTH_SUPPLY = 222_222_222 ether;
    
    uint256 private constant BASIS_POINTS = 10000;
    uint256 public constant SNAPSHOT_DELAY = 100;

    // ============================================================================
    // STRUCTS
    // ============================================================================

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

    struct PairingConfig {
        bool enabled;
        uint256 mintCost;
        uint256 graduationThreshold;
    }

    struct TokenPurchase {
        uint256 totalDeposited;
        uint256 tokensSold;
    }

    struct TradingFeeConfig {
        uint256 feePercentage;
        uint256 creatorShare;
    }

    struct FeeReductionConfig {
        uint256 minAmicaForReduction;
        uint256 maxAmicaForReduction;
        uint256 minReductionMultiplier;
        uint256 maxReductionMultiplier;
    }

    struct UserSnapshot {
        uint256 currentBalance;
        uint256 currentBlock;
        uint256 pendingBalance;
        uint256 pendingBlock;
    }

    // Optimization #1: Struct for token amounts
    struct TokenAmounts {
        uint256 liquidity;
        uint256 bonding;
        uint256 amica;
        uint256 agentRewards;
    }

    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    IERC20 public amicaToken;
    IUniswapV2Factory public uniswapFactory;
    IUniswapV2Router02 public uniswapRouter;
    address public erc20Implementation;
    
    uint256 private _currentTokenId;
    
    mapping(uint256 => PersonaData) public personas;
    mapping(uint256 => TokenPurchase) public purchases;
    mapping(uint256 => mapping(address => uint256)) public userPurchases;
    mapping(uint256 => mapping(address => uint256)) public agentDeposits;
    
    address public stakingRewards;
    
    mapping(address => PairingConfig) public pairingConfigs;
    TradingFeeConfig public tradingFeeConfig;
    FeeReductionConfig public feeReductionConfig;
    mapping(address => UserSnapshot) public userSnapshots;

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

        if (
            amicaToken_ == address(0) ||
            uniswapFactory_ == address(0) ||
            uniswapRouter_ == address(0) ||
            erc20Implementation_ == address(0)
        ) revert Invalid(0); // Invalid token

        amicaToken = IERC20(amicaToken_);
        uniswapFactory = IUniswapV2Factory(uniswapFactory_);
        uniswapRouter = IUniswapV2Router02(uniswapRouter_);
        erc20Implementation = erc20Implementation_;

        pairingConfigs[amicaToken_] = PairingConfig({
            enabled: true,
            mintCost: 1000 ether,
            graduationThreshold: 1_000_000 ether
        });

        tradingFeeConfig = TradingFeeConfig({
            feePercentage: 100,
            creatorShare: 5000
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

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function configurePairingToken(
        address token,
        uint256 mintCost,
        uint256 graduationThreshold
    ) external onlyOwner {
        if (token == address(0)) revert Invalid(0);

        pairingConfigs[token] = PairingConfig({
            enabled: true,
            mintCost: mintCost,
            graduationThreshold: graduationThreshold
        });

        emit PairingConfigUpdated(token);
    }

    function disablePairingToken(address token) external onlyOwner {
        pairingConfigs[token].enabled = false;
        emit PairingConfigUpdated(token);
    }

    function configureTradingFees(
        uint256 feePercentage,
        uint256 creatorShare
    ) external onlyOwner {
        if (feePercentage > 1000) revert NotAllowed(8); // Fee too high
        if (creatorShare > BASIS_POINTS) revert Invalid(8); // Invalid share

        tradingFeeConfig.feePercentage = feePercentage;
        tradingFeeConfig.creatorShare = creatorShare;

        emit TradingFeeConfigUpdated(feePercentage, creatorShare);
    }

    function configureFeeReduction(
        uint256 minAmicaForReduction,
        uint256 maxAmicaForReduction,
        uint256 minReductionMultiplier,
        uint256 maxReductionMultiplier
    ) external onlyOwner {
        if (minAmicaForReduction >= maxAmicaForReduction) revert NotAllowed(10); // Invalid fee range
        if (minReductionMultiplier > BASIS_POINTS) revert Invalid(9); // Invalid multiplier
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

    function setStakingRewards(address _stakingRewards) external onlyOwner {
        stakingRewards = _stakingRewards;
        emit StakingRewardsSet(_stakingRewards);
    }

    // ============================================================================
    // CORE FUNCTIONS - PERSONA CREATION
    // ============================================================================

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
        if (agentToken == address(0) && minAgentTokens != 0) revert Invalid(6); // Invalid configuration

        PairingConfig memory config = pairingConfigs[pairingToken];
        if (!config.enabled) revert NotAllowed(1); // Token not enabled
        if (bytes(name).length == 0 || bytes(name).length > 32) revert Invalid(3);
        if (bytes(symbol).length == 0 || bytes(symbol).length > 10) revert Invalid(4);
        if (metadataKeys.length != metadataValues.length) revert Invalid(5);

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

        for (uint256 i = 0; i < metadataKeys.length; i++) {
            persona.metadata[metadataKeys[i]] = metadataValues[i];
            emit MetadataUpdated(tokenId, metadataKeys[i]);
        }

        emit PersonaCreated(tokenId, msg.sender, erc20Token, name, symbol);

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

    function swapExactTokensForTokens(
        uint256 tokenId,
        uint256 amountIn,
        uint256 amountOutMin,
        address to,
        uint256 deadline
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        return _swapExactTokensForTokensInternal(tokenId, amountIn, amountOutMin, to, deadline, false);
    }

    function _swapExactTokensForTokensInternal(
        uint256 tokenId,
        uint256 amountIn,
        uint256 amountOutMin,
        address to,
        uint256 deadline,
        bool isInternal
    ) private returns (uint256 amountOut) {
        if (block.timestamp > deadline) revert NotAllowed(5); // Expired deadline
        if (to == address(0)) revert Invalid(2); // Invalid recipient

        PersonaData storage persona = personas[tokenId];
        if (persona.pairCreated) revert NotAllowed(4); // Trading on Uniswap
        if (persona.erc20Token == address(0)) revert Invalid(0);

        TokenPurchase storage purchase = purchases[tokenId];

        _checkAndUpdateSnapshot(msg.sender);

        uint256 effectiveFeePercentage = getEffectiveFeePercentage(msg.sender);
        uint256 feeAmount = (amountIn * effectiveFeePercentage) / BASIS_POINTS;
        uint256 amountInAfterFee = amountIn - feeAmount;

        // Use optimized token amount getter
        TokenAmounts memory amounts = _getTokenAmounts(persona.agentToken != address(0));

        amountOut = _calculateAmountOut(
            amountInAfterFee,
            purchase.tokensSold,
            amounts.bonding
        );

        if (amountOut < amountOutMin) revert Insufficient(1);
        if (amountOut > amounts.bonding - purchase.tokensSold) revert Insufficient(2);

        if (!isInternal) {
            if (!IERC20(persona.pairToken).transferFrom(msg.sender, address(this), amountIn)) revert Failed(0);
        }

        if (feeAmount > 0) {
            _distributeTradingFees(tokenId, feeAmount);
        }

        purchase.totalDeposited += amountInAfterFee;
        purchase.tokensSold += amountOut;
        userPurchases[tokenId][to] += amountOut;

        if (!IERC20(persona.erc20Token).transfer(to, amountOut)) revert Failed(0);

        emit TokensPurchased(tokenId, to, amountIn, amountOut);

        if (purchase.totalDeposited >= pairingConfigs[persona.pairToken].graduationThreshold) {
            _createLiquidityPair(tokenId);
        }
    }

    function withdrawTokens(uint256 tokenId) external nonReentrant whenNotPaused {
        PersonaData storage persona = personas[tokenId];
        if (persona.erc20Token == address(0)) revert Invalid(0);

        uint256 totalToWithdraw = userPurchases[tokenId][msg.sender];
        if (totalToWithdraw == 0) revert NotAllowed(9); // No tokens to withdraw
        userPurchases[tokenId][msg.sender] = 0;

        if (!IERC20(persona.erc20Token).transfer(msg.sender, totalToWithdraw)) revert Failed(0);

        emit TokensWithdrawn(tokenId, msg.sender, totalToWithdraw);
    }

    // ============================================================================
    // AGENT TOKEN FUNCTIONS
    // ============================================================================

    function depositAgentTokens(uint256 tokenId, uint256 amount) external nonReentrant whenNotPaused {
        PersonaData storage persona = personas[tokenId];
        if (persona.agentToken == address(0)) revert NotAllowed(6); // No agent token
        if (persona.pairCreated) revert NotAllowed(2); // Already graduated
        if (amount == 0) revert Invalid(1);

        if (!IERC20(persona.agentToken).transferFrom(msg.sender, address(this), amount)) revert Failed(0);

        agentDeposits[tokenId][msg.sender] += amount;
        persona.totalAgentDeposited += amount;

        emit AgentTokensDeposited(tokenId, msg.sender, amount);
    }

    function withdrawAgentTokens(uint256 tokenId, uint256 amount) external nonReentrant whenNotPaused {
        PersonaData storage persona = personas[tokenId];
        if (persona.pairCreated) revert NotAllowed(2); // Already graduated

        if (agentDeposits[tokenId][msg.sender] < amount) revert Insufficient(4); // Insufficient balance

        agentDeposits[tokenId][msg.sender] -= amount;
        persona.totalAgentDeposited -= amount;

        if (!IERC20(persona.agentToken).transfer(msg.sender, amount)) revert Failed(0);

        emit AgentTokensWithdrawn(tokenId, msg.sender, amount);
    }

    function claimAgentRewards(uint256 tokenId) external nonReentrant {
        PersonaData storage persona = personas[tokenId];
        if (!persona.pairCreated) revert NotAllowed(3); // Not graduated
        if (persona.agentToken == address(0)) revert NotAllowed(6); // No agent token

        uint256 userAgentAmount = agentDeposits[tokenId][msg.sender];
        if (userAgentAmount == 0) revert NotAllowed(9); // No deposits to claim
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

    function updateMetadata(
        uint256 tokenId,
        string[] memory keys,
        string[] memory values
    ) external {
        if (ownerOf(tokenId) != msg.sender) revert NotAllowed(0); // Not owner
        if (keys.length != values.length) revert Invalid(5);

        for (uint256 i = 0; i < keys.length; i++) {
            personas[tokenId].metadata[keys[i]] = values[i];
            emit MetadataUpdated(tokenId, keys[i]);
        }
    }

    // ============================================================================
    // FEE MANAGEMENT FUNCTIONS
    // ============================================================================

    function updateAmicaSnapshot() external {
        uint256 currentBalance = amicaToken.balanceOf(msg.sender);
        if (currentBalance < feeReductionConfig.minAmicaForReduction) revert Insufficient(4);

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

    function getEffectiveFeePercentage(address user) public view returns (uint256) {
        uint256 effectiveBalance = getEffectiveAmicaBalance(user);

        if (effectiveBalance < feeReductionConfig.minAmicaForReduction) {
            return tradingFeeConfig.feePercentage;
        }

        if (effectiveBalance >= feeReductionConfig.maxAmicaForReduction) {
            return (tradingFeeConfig.feePercentage * feeReductionConfig.maxReductionMultiplier) / BASIS_POINTS;
        }

        uint256 range = feeReductionConfig.maxAmicaForReduction - feeReductionConfig.minAmicaForReduction;
        uint256 userPosition = effectiveBalance - feeReductionConfig.minAmicaForReduction;
        uint256 progress = (userPosition * 1e18) / range;
        uint256 exponentialProgress = (progress * progress) / 1e18;
        uint256 multiplierRange = feeReductionConfig.minReductionMultiplier - feeReductionConfig.maxReductionMultiplier;
        uint256 reduction = (multiplierRange * exponentialProgress) / 1e18;
        uint256 effectiveMultiplier = feeReductionConfig.minReductionMultiplier - reduction;

        return (tradingFeeConfig.feePercentage * effectiveMultiplier) / BASIS_POINTS;
    }

    // ============================================================================
    // MINIMAL VIEW FUNCTIONS (Most moved to separate viewer contract)
    // ============================================================================

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

    // Required for viewer contract
    function getMetadataValue(uint256 tokenId, string memory key) external view returns (string memory) {
        return personas[tokenId].metadata[key];
    }

    // Keep these minimal functions that are used internally
    function getAvailableTokens(uint256 tokenId) public view returns (uint256) {
        PersonaData storage persona = personas[tokenId];
        if (persona.pairCreated || persona.erc20Token == address(0)) return 0;
        
        TokenAmounts memory amounts = _getTokenAmounts(persona.agentToken != address(0));
        uint256 sold = purchases[tokenId].tokensSold;
        
        return sold >= amounts.bonding ? 0 : amounts.bonding - sold;
    }

    function getEffectiveAmicaBalance(address user) public view returns (uint256) {
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
        return currentBalance < activeBalance ? currentBalance : activeBalance;
    }

    // Keep getAmountOut as it's used by the viewer contract
    function getAmountOut(uint256 tokenId, uint256 amountIn) external view returns (uint256) {
        TokenPurchase storage purchase = purchases[tokenId];
        PersonaData storage persona = personas[tokenId];

        TokenAmounts memory amounts = _getTokenAmounts(persona.agentToken != address(0));
        
        uint256 feeAmount = (amountIn * tradingFeeConfig.feePercentage) / BASIS_POINTS;
        uint256 amountInAfterFee = amountIn - feeAmount;

        return _calculateAmountOut(amountInAfterFee, purchase.tokensSold, amounts.bonding);
    }

    // ============================================================================
    // INTERNAL FUNCTIONS
    // ============================================================================

    function _checkAndUpdateSnapshot(address user) internal {
        UserSnapshot storage snapshot = userSnapshots[user];

        if (snapshot.pendingBlock > 0 && block.number >= snapshot.pendingBlock + SNAPSHOT_DELAY) {
            snapshot.currentBalance = snapshot.pendingBalance;
            snapshot.currentBlock = snapshot.pendingBlock;
            snapshot.pendingBalance = 0;
            snapshot.pendingBlock = 0;
        }

        if (snapshot.currentBlock == 0 && snapshot.pendingBlock == 0) {
            uint256 balance = amicaToken.balanceOf(user);
            if (balance >= feeReductionConfig.minAmicaForReduction) {
                snapshot.pendingBalance = balance;
                snapshot.pendingBlock = block.number;
                emit SnapshotUpdated(user, balance, block.number);
            }
        }
    }

    function _distributeTradingFees(uint256 tokenId, uint256 feeAmount) private {
        PersonaData storage persona = personas[tokenId];

        uint256 creatorFees = (feeAmount * tradingFeeConfig.creatorShare) / BASIS_POINTS;
        uint256 amicaFees = feeAmount - creatorFees;

        if (creatorFees > 0) {
            IERC20(persona.pairToken).transfer(ownerOf(tokenId), creatorFees);
        }

        emit TradingFeesCollected(tokenId, feeAmount, creatorFees, amicaFees);
    }

    function _createLiquidityPair(uint256 tokenId) private {
        PersonaData storage persona = personas[tokenId];
        if (persona.pairCreated) revert NotAllowed(7); // Pair already exists

        if (persona.agentToken != address(0) && persona.minAgentTokens > 0) {
            if (persona.totalAgentDeposited < persona.minAgentTokens) revert Insufficient(3);
        }

        TokenPurchase storage purchase = purchases[tokenId];
        address erc20Token = persona.erc20Token;

        // Use optimized token amounts
        TokenAmounts memory amounts = _getTokenAmounts(persona.agentToken != address(0));

        IERC20(erc20Token).approve(address(amicaToken), amounts.amica);
        IAmicaToken(address(amicaToken)).deposit(erc20Token, amounts.amica);

        if (persona.agentToken != address(0) && persona.totalAgentDeposited > 0) {
            IERC20(persona.agentToken).approve(address(amicaToken), persona.totalAgentDeposited);
            IAmicaToken(address(amicaToken)).deposit(persona.agentToken, persona.totalAgentDeposited);
        }

        uint256 pairingTokenForLiquidity = purchase.totalDeposited;

        IERC20(erc20Token).approve(address(uniswapRouter), amounts.liquidity);
        IERC20(persona.pairToken).approve(address(uniswapRouter), pairingTokenForLiquidity);

        address pairAddress = uniswapFactory.getPair(erc20Token, persona.pairToken);
        if (pairAddress == address(0)) {
            uniswapFactory.createPair(erc20Token, persona.pairToken);
            pairAddress = uniswapFactory.getPair(erc20Token, persona.pairToken);
        }

        uint256 minLiquidityAmount = (amounts.liquidity * 95) / 100;
        uint256 minPairingTokenAmount = (pairingTokenForLiquidity * 95) / 100;

        (, , uint256 liquidity) = uniswapRouter.addLiquidity(
            erc20Token,
            persona.pairToken,
            amounts.liquidity,
            pairingTokenForLiquidity,
            minLiquidityAmount,
            minPairingTokenAmount,
            address(this),
            block.timestamp + 300
        );

        persona.pairCreated = true;
        IPersonaToken(erc20Token).setGraduationStatus(true);

        emit LiquidityPairCreated(tokenId, pairAddress, liquidity);
    }

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

        amountOut = amountOut * 99 / 100;

        return amountOut;
    }
}
