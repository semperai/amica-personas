// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

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
 */
contract PersonaTokenFactory is ERC721Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using Strings for uint256;

    // Structs
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
        uint256 amicaDepositAmount;
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

    IERC20 public amicaToken;
    IUniswapV2Factory public uniswapFactory;
    IUniswapV2Router public uniswapRouter;
    address public erc20Implementation;

    // State variables
    uint256 private _currentTokenId;
    mapping(uint256 => PersonaData) private _personas;
    mapping(uint256 => TokenPurchase) private _purchases;
    mapping(address => PairingConfig) public pairingConfigs;

    // New state variables for features
    mapping(uint256 => mapping(address => UserPurchase[])) private _userPurchases;
    TradingFeeConfig public tradingFeeConfig;
    uint256 public constant LOCK_DURATION = 7 days;

    // Constants
    uint256 public constant PERSONA_TOKEN_SUPPLY = 1_000_000_000 ether;
    uint256 public constant LIQUIDITY_TOKEN_AMOUNT = 600_000_000 ether;  // 60% for liquidity
    string private constant TOKEN_SUFFIX = ".amica";
    uint256 private constant BASIS_POINTS = 10000;

    // Events
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
            graduationThreshold: 1_000_000 ether,
            amicaDepositAmount: 100_000_000 ether  // 10% for AMICA deposit
        });

        // Initialize trading fee config (1% fee, 50/50 split)
        tradingFeeConfig = TradingFeeConfig({
            feePercentage: 100,    // 1%
            creatorShare: 5000     // 50%
        });
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
     * @notice Configure pairing token parameters
     */
    function configurePairingToken(
        address token,
        uint256 mintCost,
        uint256 graduationThreshold,
        uint256 amicaDepositAmount
    ) external onlyOwner {
        require(token != address(0), "Invalid token");

        pairingConfigs[token] = PairingConfig({
            enabled: true,
            mintCost: mintCost,
            graduationThreshold: graduationThreshold,
            amicaDepositAmount: amicaDepositAmount
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
        PersonaData storage persona = _personas[tokenId];
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

        // Always deposit tokens to AMICA contract (regardless of pairing token)
        IERC20(erc20Token).approve(address(amicaToken), config.amicaDepositAmount);
        IAmicaToken(address(amicaToken)).deposit(erc20Token, config.amicaDepositAmount);

        emit PersonaCreated(tokenId, msg.sender, erc20Token, name, symbol);

        // Handle initial buy if specified
        if (initialBuyAmount > 0) {
            _swapExactTokensForTokensInternal(
                tokenId,
                initialBuyAmount,
                0,
                msg.sender,
                block.timestamp + 300
            );
        }

        return tokenId;
    }

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
            _personas[tokenId].metadata[keys[i]] = values[i];
            emit MetadataUpdated(tokenId, keys[i]);
        }
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
            values[i] = _personas[tokenId].metadata[keys[i]];
        }

        return values;
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
            uint256 createdAt
        )
    {
        PersonaData storage persona = _personas[tokenId];
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
     * @notice Get user purchases for a persona
     */
    function getUserPurchases(uint256 tokenId, address user)
        external
        view
        returns (UserPurchase[] memory)
    {
        return _userPurchases[tokenId][user];
    }

    /**
     * @notice Withdraw unlocked tokens
     */
    function withdrawTokens(uint256 tokenId) external nonReentrant {
        PersonaData storage persona = _personas[tokenId];
        require(persona.erc20Token != address(0), "Invalid token");

        UserPurchase[] storage purchases = _userPurchases[tokenId][msg.sender];
        uint256 totalToWithdraw = 0;

        for (uint256 i = 0; i < purchases.length; i++) {
            if (!purchases[i].withdrawn &&
                (persona.pairCreated || block.timestamp >= persona.createdAt + LOCK_DURATION)) {
                totalToWithdraw += purchases[i].amount;
                purchases[i].withdrawn = true;
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
        return _swapExactTokensForTokensInternal(tokenId, amountIn, amountOutMin, to, deadline);
    }

    function _swapExactTokensForTokensInternal(
        uint256 tokenId,
        uint256 amountIn,
        uint256 amountOutMin,
        address to,
        uint256 deadline
    ) private returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "Transaction expired");
        require(to != address(0), "Invalid recipient");

        PersonaData storage persona = _personas[tokenId];
        require(!persona.pairCreated, "Trading already on Uniswap");
        require(persona.erc20Token != address(0), "Invalid token");

        TokenPurchase storage purchase = _purchases[tokenId];

        // Calculate fees
        uint256 feeAmount = (amountIn * tradingFeeConfig.feePercentage) / BASIS_POINTS;
        uint256 amountInAfterFee = amountIn - feeAmount;

        // Calculate tokens out using Bancor formula (after fees)
        amountOut = getAmountOut(
            amountInAfterFee,
            purchase.tokensSold,
            getAvailableTokens(tokenId) + purchase.tokensSold
        );

        require(amountOut >= amountOutMin, "Insufficient output amount");
        require(amountOut <= getAvailableTokens(tokenId), "Insufficient liquidity");

        // Take payment in the pairing token (full amount including fees)
        require(
            IERC20(persona.pairToken).transferFrom(msg.sender, address(this), amountIn),
            "Transfer failed"
        );

        // Handle fees if any
        if (feeAmount > 0) {
            _distributeTradingFees(tokenId, feeAmount);
        }

        // Update state
        purchase.totalDeposited += amountInAfterFee;
        purchase.tokensSold += amountOut;

        // Store purchase info for lock
        _userPurchases[tokenId][to].push(UserPurchase({
            amount: amountOut,
            timestamp: block.timestamp,
            withdrawn: false
        }));

        emit TokensPurchased(tokenId, to, amountIn, amountOut);

        // Check if ready to create pair
        if (purchase.totalDeposited >= pairingConfigs[persona.pairToken].graduationThreshold) {
            _createLiquidityPair(tokenId);
        }
    }

    /**
     * @notice Distribute trading fees between creator and AMICA
     */
    function _distributeTradingFees(uint256 tokenId, uint256 feeAmount) private {
        PersonaData storage persona = _personas[tokenId];

        uint256 creatorFees = (feeAmount * tradingFeeConfig.creatorShare) / BASIS_POINTS;
        uint256 amicaFees = feeAmount - creatorFees;

        // Send creator's share
        if (creatorFees > 0) {
            IERC20(persona.pairToken).transfer(ownerOf(tokenId), creatorFees);
        }

        // Deposit AMICA's share
        if (amicaFees > 0) {
            // If pairing token is AMICA, deposit directly
            if (persona.pairToken == address(amicaToken)) {
                // Need to approve from this contract to AMICA contract
                IERC20(persona.pairToken).approve(address(amicaToken), amicaFees);
                IAmicaToken(address(amicaToken)).deposit(persona.erc20Token, amicaFees);
            } else {
                // For other tokens, just hold them (could be extended to swap to AMICA first)
                // For now, send to AMICA treasury (the AMICA token contract)
                IERC20(persona.pairToken).transfer(address(amicaToken), amicaFees);
            }
        }

        emit TradingFeesCollected(tokenId, feeAmount, creatorFees, amicaFees);
    }


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
        TokenPurchase storage purchase = _purchases[tokenId];
        uint256 totalAvailable = getAvailableTokens(tokenId) + purchase.tokensSold;

        // Apply trading fee to input
        uint256 feeAmount = (amountIn * tradingFeeConfig.feePercentage) / BASIS_POINTS;
        uint256 amountInAfterFee = amountIn - feeAmount;

        return getAmountOut(amountInAfterFee, purchase.tokensSold, totalAvailable);
    }

    /**
     * @notice Legacy function for backwards compatibility
     */
    function calculateTokensOut(uint256 currentDeposited, uint256 amountIn, uint256 graduationThreshold)
        public
        pure
        returns (uint256)
    {
        uint256 totalSupply = 110_000_000 ether;
        uint256 soldRatio = currentDeposited * 1e18 / graduationThreshold;
        uint256 tokensSold = totalSupply * soldRatio / 1e18;

        return getAmountOut(amountIn, tokensSold, totalSupply);
    }

    /**
     * @notice Get available tokens for sale
     */
    function getAvailableTokens(uint256 tokenId) public view returns (uint256) {
        PersonaData storage persona = _personas[tokenId];
        if (persona.pairCreated) return 0;
        if (persona.erc20Token == address(0)) return 0;

        uint256 amicaDeposit = pairingConfigs[persona.pairToken].amicaDepositAmount;

        if (PERSONA_TOKEN_SUPPLY < amicaDeposit + LIQUIDITY_TOKEN_AMOUNT) {
            return 0;
        }

        uint256 totalForBonding = PERSONA_TOKEN_SUPPLY - amicaDeposit - LIQUIDITY_TOKEN_AMOUNT;

        uint256 sold = _purchases[tokenId].tokensSold;
        if (sold >= totalForBonding) {
            return 0;
        }

        return totalForBonding - sold;
    }

    /**
     * @notice Create Uniswap pair when graduation threshold is met
     */
    function _createLiquidityPair(uint256 tokenId) private {
        PersonaData storage persona = _personas[tokenId];
        require(!persona.pairCreated, "Pair already created");

        TokenPurchase storage purchase = _purchases[tokenId];

        address erc20Token = persona.erc20Token;

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

        PersonaData storage persona = _personas[tokenId];

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
}
