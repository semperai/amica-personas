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

    IERC20 public amicaToken;
    IUniswapV2Factory public uniswapFactory;
    IUniswapV2Router public uniswapRouter;
    address public erc20Implementation;

    // State variables
    uint256 private _currentTokenId;
    mapping(uint256 => PersonaData) private _personas;
    mapping(uint256 => TokenPurchase) private _purchases;
    mapping(address => PairingConfig) public pairingConfigs;

    // Constants
    uint256 public constant PERSONA_TOKEN_SUPPLY = 1_000_000_000 ether;
    uint256 public constant LIQUIDITY_TOKEN_AMOUNT = 600_000_000 ether;  // 60% for liquidity
    string private constant TOKEN_SUFFIX = ".amica";

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
     */
    function createPersona(
        address pairingToken,
        string memory name,
        string memory symbol,
        string[] memory metadataKeys,
        string[] memory metadataValues
    ) external nonReentrant returns (uint256) {
        // Validations
        PairingConfig memory config = pairingConfigs[pairingToken];
        require(config.enabled, "Pairing token not enabled");
        require(bytes(name).length > 0 && bytes(name).length <= 32, "Invalid name length");
        require(bytes(symbol).length > 0 && bytes(symbol).length <= 10, "Invalid symbol length");
        require(metadataKeys.length == metadataValues.length, "Metadata mismatch");

        // Take payment in the pairing token - check balance first
        require(IERC20(pairingToken).balanceOf(msg.sender) >= config.mintCost, "Insufficient balance");
        require(
            IERC20(pairingToken).transferFrom(msg.sender, address(this), config.mintCost),
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
     * @notice Swap exact tokens for persona tokens (similar to Uniswap)
     * @param tokenId The persona token ID
     * @param amountIn Amount of pairing tokens to spend
     * @param amountOutMin Minimum persona tokens to receive
     * @param to Recipient address
     * @param deadline Transaction deadline
     */
    function swapExactTokensForTokens(
        uint256 tokenId,
        uint256 amountIn,
        uint256 amountOutMin,
        address to,
        uint256 deadline
    ) external nonReentrant returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "Transaction expired");
        require(to != address(0), "Invalid recipient");
        
        PersonaData storage persona = _personas[tokenId];
        require(!persona.pairCreated, "Trading already on Uniswap");
        require(persona.erc20Token != address(0), "Invalid token");

        TokenPurchase storage purchase = _purchases[tokenId];

        // Calculate tokens out using Bancor formula
        amountOut = getAmountOut(
            amountIn,
            purchase.tokensSold,
            getAvailableTokens(tokenId) + purchase.tokensSold
        );

        require(amountOut >= amountOutMin, "Insufficient output amount");
        require(amountOut <= getAvailableTokens(tokenId), "Insufficient liquidity");

        // Take payment in the pairing token
        require(
            IERC20(persona.pairToken).transferFrom(msg.sender, address(this), amountIn),
            "Transfer failed"
        );

        // Update state
        purchase.totalDeposited += amountIn;
        purchase.tokensSold += amountOut;

        // Transfer tokens
        require(
            IERC20(persona.erc20Token).transfer(to, amountOut),
            "Transfer failed"
        );

        emit TokensPurchased(tokenId, to, amountIn, amountOut);

        // Check if ready to create pair
        if (purchase.totalDeposited >= pairingConfigs[persona.pairToken].graduationThreshold) {
            _createLiquidityPair(tokenId);
        }
    }

    /**
     * @notice Calculate output amount using Bancor-style bonding curve
     * @param amountIn Input amount of AMICA
     * @param reserveSold Amount of tokens already sold
     * @param reserveTotal Total tokens available for bonding curve
     */
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveSold,
        uint256 reserveTotal
    ) public pure returns (uint256) {
        require(amountIn > 0, "Insufficient input amount");
        require(reserveTotal > reserveSold, "Insufficient reserve");
        
        // Bancor-inspired formula with virtual reserves
        // This creates a gradual price increase as more tokens are sold
        
        // Virtual reserves to prevent extreme price movements
        uint256 virtualAmicaReserve = 100_000 ether; // Virtual AMICA reserve
        uint256 virtualTokenReserve = reserveTotal / 10; // 10% of total as virtual reserve
        
        // Current reserves
        uint256 currentTokenReserve = virtualTokenReserve + (reserveTotal - reserveSold);
        uint256 currentAmicaReserve = virtualAmicaReserve + (reserveSold * virtualAmicaReserve / virtualTokenReserve);
        
        // Calculate output using constant product formula: x * y = k
        // amountOut = currentTokenReserve - (k / (currentAmicaReserve + amountIn))
        uint256 k = currentTokenReserve * currentAmicaReserve;
        uint256 newAmicaReserve = currentAmicaReserve + amountIn;
        uint256 newTokenReserve = k / newAmicaReserve;
        uint256 amountOut = currentTokenReserve - newTokenReserve;
        
        // Apply a 1% fee
        amountOut = amountOut * 99 / 100;
        
        return amountOut;
    }

    /**
     * @notice Get a quote for swapping AMICA for tokens
     */
    function getAmountOut(uint256 tokenId, uint256 amountIn) external view returns (uint256) {
        TokenPurchase storage purchase = _purchases[tokenId];
        uint256 totalAvailable = getAvailableTokens(tokenId) + purchase.tokensSold;
        return getAmountOut(amountIn, purchase.tokensSold, totalAvailable);
    }

    /**
     * @notice Legacy function for backwards compatibility
     */
    function calculateTokensOut(uint256 currentDeposited, uint256 amountIn, uint256 graduationThreshold)
        public
        pure
        returns (uint256)
    {
        // Approximate the Bancor formula output for legacy compatibility
        // This is a simplified calculation and may not match exactly
        uint256 totalSupply = 110_000_000 ether; // Approximate available tokens
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
        if (persona.erc20Token == address(0)) return 0; // Persona doesn't exist

        // Calculate total tokens available for bonding curve
        // Total supply - AMICA deposit - liquidity reserve
        uint256 amicaDeposit = pairingConfigs[persona.pairToken].amicaDepositAmount;
        
        // Ensure we don't underflow
        if (PERSONA_TOKEN_SUPPLY < amicaDeposit + LIQUIDITY_TOKEN_AMOUNT) {
            return 0;
        }
        
        uint256 totalForBonding = PERSONA_TOKEN_SUPPLY - amicaDeposit - LIQUIDITY_TOKEN_AMOUNT;
        
        // Subtract already sold tokens
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

        PairingConfig memory config = pairingConfigs[persona.pairToken];
        TokenPurchase storage purchase = _purchases[tokenId];

        address erc20Token = persona.erc20Token;
        uint256 pairingTokenForLiquidity = purchase.totalDeposited - config.graduationThreshold;

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
            0, // Accept any amount
            0, // Accept any amount
            ownerOf(tokenId),
            block.timestamp + 300
        );

        // Send graduation reward to NFT owner (in pairing token)
        require(
            IERC20(persona.pairToken).transfer(ownerOf(tokenId), config.graduationThreshold),
            "Reward transfer failed"
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
        // TODO this should provide the image from some website
        _requireOwned(tokenId);

        PersonaData storage persona = _personas[tokenId];

        // Return basic JSON metadata with properly quoted tokenId
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
