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
    uint256 public constant LIQUIDITY_TOKEN_AMOUNT = 890_000_000 ether;
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
    event MetadataUpdated(uint256 indexed tokenId);
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
            amicaDepositAmount: 300_000_000 ether
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

        // Take payment
        require(
            amicaToken.transferFrom(msg.sender, address(this), config.mintCost),
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
        }

        // Deposit tokens to AMICA contract
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
        string[] memory key,
        string[] memory value
    ) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(key.length == value.length, "Key-value mismatch");

        for (uint256 i = 0; i < key.length; i++) {
            _personas[tokenId].metadata[key[i]] = value[i];
        }

        emit MetadataUpdated(tokenId);
    }

    /**
     * @notice Get persona metadata
     */
    function getMetadata(uint256 tokenId, string[] memory key)
        external
        view
        returns (string[] memory)
    {
        string[] memory values = new string[](key.length);

        for (uint256 i = 0; i < key.length; i++) {
            values[i] = _personas[tokenId].metadata[key[i]];
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
     * @notice Purchase persona tokens with AMICA (bonding curve)
     */
    function purchaseTokens(
        uint256 tokenId,
        uint256 amountToSpend,
        uint256 minTokensOut
    ) external nonReentrant {
        PersonaData storage persona = _personas[tokenId];
        require(!persona.pairCreated, "Trading already on Uniswap");
        require(persona.erc20Token != address(0), "Invalid token");

        TokenPurchase storage purchase = _purchases[tokenId];

        // Calculate tokens out based on bonding curve
        uint256 tokensOut = calculateTokensOut(
            purchase.totalDeposited,
            amountToSpend,
            pairingConfigs[persona.pairToken].graduationThreshold
        );

        require(tokensOut >= minTokensOut, "Slippage too high");
        require(tokensOut <= getAvailableTokens(tokenId), "Insufficient tokens");

        // Take payment
        require(
            amicaToken.transferFrom(msg.sender, address(this), amountToSpend),
            "Payment failed"
        );

        // Update state
        purchase.totalDeposited += amountToSpend;
        purchase.tokensSold += tokensOut;

        // Transfer tokens
        require(
            IERC20(persona.erc20Token).transfer(msg.sender, tokensOut),
            "Token transfer failed"
        );

        emit TokensPurchased(tokenId, msg.sender, amountToSpend, tokensOut);

        // Check if ready to create pair
        if (purchase.totalDeposited >= pairingConfigs[persona.pairToken].graduationThreshold) {
            _createLiquidityPair(tokenId);
        }
    }

    /**
     * @notice Calculate tokens out for a given AMICA input
     */
    function calculateTokensOut(uint256 currentDeposited, uint256 amountIn, uint256 graduationThreshold)
        public
        pure
        returns (uint256)
    {
        // Simple linear bonding curve for example
        // Price increases from 0.0001 to 0.001 AMICA per token
        uint256 startPrice = 0.0001 ether;
        uint256 endPrice = 0.001 ether;

        uint256 progress = (currentDeposited * 1e18) / graduationThreshold;
        uint256 currentPrice = startPrice + ((endPrice - startPrice) * progress) / 1e18;

        return (amountIn * 1e18) / currentPrice;
    }

    /**
     * @notice Get available tokens for sale
     */
    function getAvailableTokens(uint256 tokenId) public view returns (uint256) {
        PersonaData storage persona = _personas[tokenId];
        if (persona.pairCreated) return 0;

        uint256 totalForSale = PERSONA_TOKEN_SUPPLY -
                              pairingConfigs[persona.pairToken].amicaDepositAmount -
                              LIQUIDITY_TOKEN_AMOUNT;

        return totalForSale - _purchases[tokenId].tokensSold;
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
        uint256 amicaForLiquidity = purchase.totalDeposited - config.graduationThreshold;

        // Approve router
        IERC20(erc20Token).approve(address(uniswapRouter), LIQUIDITY_TOKEN_AMOUNT);
        amicaToken.approve(address(uniswapRouter), amicaForLiquidity);

        // Create pair if needed
        if (uniswapFactory.getPair(erc20Token, address(amicaToken)) == address(0)) {
            uniswapFactory.createPair(erc20Token, address(amicaToken));
        }

        // Add liquidity
        (, , uint256 liquidity) = uniswapRouter.addLiquidity(
            erc20Token,
            address(amicaToken),
            LIQUIDITY_TOKEN_AMOUNT,
            amicaForLiquidity,
            0, // Accept any amount
            0, // Accept any amount
            ownerOf(tokenId),
            block.timestamp + 300
        );

        // Send graduation reward to NFT owner
        require(
            amicaToken.transfer(ownerOf(tokenId), config.graduationThreshold),
            "Reward transfer failed"
        );

        persona.pairCreated = true;

        emit LiquidityPairCreated(
            tokenId,
            uniswapFactory.getPair(erc20Token, address(amicaToken)),
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

        // Return basic JSON metadata
        return string(abi.encodePacked(
            'data:application/json;utf8,{"name":"',
            persona.name,
            '","symbol":"',
            persona.symbol,
            '","tokenId":',
            tokenId.toString(),
            ',"erc20Token":"',
            Strings.toHexString(uint160(persona.erc20Token), 20),
            '"}'
        ));
    }
}
