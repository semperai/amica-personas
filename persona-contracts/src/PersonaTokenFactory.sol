// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";


interface IAmicaToken {
    function deposit(address token, uint256 amount) external;
}

interface IPersonaToken {
    function initialize(string memory name, string memory symbol, uint256 supply, address owner) external;
}

/**
 * @notice Consolidated error for invalid inputs
 * @param code Error code: 0=Token, 1=Amount, 2=Recipient, 3=Name, 4=Symbol, 5=Metadata, 6=Configuration, 7=Index, 8=Share, 9=Multiplier, 10=NonRegisteredDomain, 11=AlreadyRegisteredDomain, 12=Address
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
 * @param code Error code: 0=NotOwner, 1=NotEnabled, 2=AlreadyGraduated, 3=NotGraduated, 4=TradingOnUniswap, 5=ExpiredDeadline, 6=NoAgentToken, 7=PairExists, 8=FeeTooHigh, 9=NoTokens, 10=FeeRange, 11=Unauthorized
 */
error NotAllowed(uint8 code);

/**
 * @title PersonaTokenFactory
 * @author Amica Protocol
 * @notice Factory contract for creating and managing persona tokens with bonding curves and Uniswap V4 integration
 * @dev Implements ERC721 for persona ownership, with each NFT controlling an ERC20 token
 */
contract PersonaTokenFactory is ERC721Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable {
    using Strings for uint256;
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;

    /// @notice Total supply for each persona token (1 billion with 18 decimals)
    uint256 public constant PERSONA_TOKEN_SUPPLY = 1_000_000_000 ether;
    
    /// @dev Simplified to just two base amounts instead of 7 constants
    uint256 private constant THIRD_SUPPLY = 333_333_333 ether;
    uint256 private constant NINTH_SUPPLY = 222_222_222 ether;
    
    /// @notice V4 tick spacing for standard pools
    int24 public constant TICK_SPACING = 60;

    /// @notice Initial price sqrt ratio for 1:1 pools
    uint160 public constant SQRT_RATIO_1_1 = 79228162514264337593543950336;

    /**
     * @notice Core data for each persona
     * @param name Display name of the persona
     * @param symbol Token symbol for the persona
     * @param token Address of the persona's ERC20 token
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
        address token;
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
     * @param mintCost Cost to mint a persona with this token
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
    
    /**
     * @notice Emitted when a new persona is created
     * @param tokenId NFT token ID of the persona
     * @param domain Domain of the persona
     * @param token Address of the persona's ERC20 token
     */
    event PersonaCreated(
        uint256 indexed tokenId,
        bytes32 indexed domain,
        address indexed token
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
     */
    function initialize(
        address amicaToken_,
        address poolManager_,
        address positionManager_,
        address dynamicFeeHook_,
        address personaTokenImplementation_
    ) public initializer {
        __ERC721_init("Amica Persona", "PERSONA");
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();

        if (
            amicaToken_ == address(0) ||
            poolManager_ == address(0) ||
            positionManager_ == address(0) ||
            dynamicFeeHook_ == address(0) ||
            personaTokenImplementation_ == address(0)
        ) revert Invalid(12);

        amicaToken = IERC20(amicaToken_);
        poolManager = IPoolManager(poolManager_);
        positionManager = IPositionManager(positionManager_);
        dynamicFeeHook = dynamicFeeHook_;
        personaTokenImplementation = personaTokenImplementation_;

        pairingConfigs[amicaToken_] = PairingConfig({
            enabled: true,
            mintCost: 1000 ether,
            graduationThreshold: 1_000_000 ether
        });

    }

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

        address token = Clones.clone(personaTokenImplementation);
        IPersonaToken(token).initialize(
            string.concat(name, ".amica"),
            string.concat(symbol, ".amica"),
            PERSONA_TOKEN_SUPPLY,
            address(this)
        );

        PersonaData storage persona = personas[tokenId];
        persona.name = name;
        persona.symbol = symbol;
        persona.token = token;
        persona.pairToken = pairingToken;
        persona.agentToken = agentToken;
        persona.createdAt = block.timestamp;
        persona.minAgentTokens = minAgentTokens;

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
        if (persona.token == address(0)) revert Invalid(0);

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
        if (persona.token == address(0)) revert Invalid(0);

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
        if (persona.token == address(0)) revert Invalid(0);
        
        // Can only withdraw after graduation
        if (!persona.pairCreated) revert NotAllowed(3); // 3 = NotGraduated

        uint256 totalToWithdraw = userPurchases[tokenId][msg.sender];
        if (totalToWithdraw == 0) revert NotAllowed(9);
        userPurchases[tokenId][msg.sender] = 0;

        if (!IERC20(persona.token).transfer(msg.sender, totalToWithdraw)) revert Failed(0);

        emit TokensWithdrawn(tokenId, msg.sender, totalToWithdraw);
    }

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
            if (!IERC20(persona.token).transfer(msg.sender, personaReward)) revert Failed(0);
        }

        emit AgentRewardsDistributed(tokenId, msg.sender, personaReward, userAgentAmount);
    }

    /**
     * @notice Collects accumulated fees from pools (integrated from UniswapV4Manager)
     * @param nftTokenId NFT token ID
     * @param to Address to receive the fees
     * @return amount0 Amount of token0 collected
     * @return amount1 Amount of token1 collected
     */
    function collectFees(uint256 nftTokenId, address to) external nonReentrant returns (uint256 amount0, uint256 amount1) {
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
            uint8(Actions.DECREASE_LIQUIDITY),
            uint8(Actions.TAKE_PAIR)
        );

        bytes[] memory params = new bytes[](2);

        // DECREASE_LIQUIDITY with 0 liquidity to collect only fees
        params[0] = abi.encode(persona.poolId, 0, 0, 0, "");

        // TAKE_PAIR to withdraw collected fees
        params[1] = abi.encode(
            poolKey.currency0,
            poolKey.currency1,
            to
        );

        uint256 deadline = block.timestamp + 60; // 1 minute deadline
        uint256 valueToPass = poolKey.currency0.isAddressZero() ? 0 : 0; // Handle native ETH if needed

        // Execute fee collection through position manager
        positionManager.modifyLiquidities{value: valueToPass}(
            abi.encode(actions, params),
            deadline
        );

        // Calculate collected amounts
        amount0 = _getBalance(poolKey.currency0, to) - balance0before;
        amount1 = _getBalance(poolKey.currency1, to) - balance1before;

        emit FeesCollected(nftTokenId, persona.poolId, amount0, amount1);
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
            '","token":"',
            Strings.toHexString(uint160(persona.token), 20),
            '"}'
        ));
    }

    /**
     * @notice Gets available tokens in bonding curve
     * @param tokenId ID of the persona
     * @return Amount of tokens still available for purchase
     */
    function getAvailableTokens(uint256 tokenId) public view returns (uint256) {
        PersonaData storage persona = personas[tokenId];
        if (persona.pairCreated || persona.token == address(0)) return 0;
        
        TokenAmounts memory amounts = _getTokenAmounts(persona.agentToken != address(0));
        uint256 sold = purchases[tokenId].tokensSold;
        
        return sold >= amounts.bonding ? 0 : amounts.bonding - sold;
    }

    /**
      * @notice Creates Uniswap V4 pool for the persona
      * @param tokenId ID of the persona
      * @dev Initializes the pool and adds initial liquidity
      */
    function _createV4Pool(uint256 tokenId) private {
        PersonaData storage persona = personas[tokenId];
        if (persona.pairCreated) revert NotAllowed(7);

        if (persona.agentToken != address(0) && persona.minAgentTokens > 0) {
            if (persona.totalAgentDeposited < persona.minAgentTokens) revert Insufficient(3);
        }

        TokenPurchase storage purchase = purchases[tokenId];
        address token = persona.token;

        TokenAmounts memory amounts = _getTokenAmounts(persona.agentToken != address(0));

        // Send tokens to AMICA protocol
        IERC20(token).approve(address(amicaToken), amounts.amica);
        IAmicaToken(address(amicaToken)).deposit(token, amounts.amica);

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

        // Initialize pool using internal function
        (PoolId poolId, PoolKey memory poolKey) = _initializePool(
            token,
            persona.pairToken,
            SQRT_RATIO_1_1
        );
        persona.poolId = poolId;

        // Approve poolManager for liquidity
        IERC20(token).approve(address(poolManager), personaTokensForMainPool);
        IERC20(persona.pairToken).approve(address(poolManager), pairingTokenForLiquidity);

        bool zeroForOne = uint160(token) < uint160(persona.pairToken);
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

        emit V4PoolCreated(tokenId, persona.poolId, personaTokensForMainPool);
    }

    /**
     * @notice Creates agent pool for a persona
     * @param tokenId ID of the persona
     * @param personaTokenAmount Amount of persona tokens to provide
     * @dev Initializes the agent pool and adds initial liquidity
     */
    function _createAgentPersonaPool(uint256 tokenId, uint256 personaTokenAmount) private {
        PersonaData storage persona = personas[tokenId];
        
        bool personaIsToken0 = uint160(persona.token) < uint160(persona.agentToken);
        uint160 initialPrice = _getAgentPoolInitialPrice(personaIsToken0);
        
        // Initialize pool
        (PoolId agentPoolId, PoolKey memory poolKey) = _initializePool(
            persona.token,
            persona.agentToken,
            initialPrice
        );
        persona.agentPoolId = agentPoolId;

        // Add liquidity directly to poolManager
        IERC20(persona.token).approve(address(poolManager), personaTokenAmount);
        
        (int24 tickLower, int24 tickUpper) = _getTickRangeForSingleSided(
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
     * @notice Internal pool initialization
     * @param token0 First token address
     * @param token1 Second token address
     * @param initialPrice Initial sqrt price
     * @return poolId The pool ID
     * @return poolKey The pool key needed for liquidity operations
     */
    function _initializePool(
        address token0,
        address token1,
        uint160 initialPrice
    ) private returns (PoolId poolId, PoolKey memory poolKey) {
        // Sort tokens
        Currency currency0;
        Currency currency1;

        if (uint160(token0) < uint160(token1)) {
            currency0 = Currency.wrap(token0);
            currency1 = Currency.wrap(token1);
        } else {
            currency0 = Currency.wrap(token1);
            currency1 = Currency.wrap(token0);
        }

        // Create pool key with dynamic fee
        poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(dynamicFeeHook)
        });

        // Initialize pool
        poolManager.initialize(poolKey, initialPrice);
        
        // Get pool ID
        poolId = poolKey.toId();

        return (poolId, poolKey);
    }

    /**
     * @notice Helper to get pool key for a persona
     * @param persona Persona data
     * @return poolKey The pool key
     */
    function _getPoolKey(PersonaData storage persona) private view returns (PoolKey memory poolKey) {
        Currency currency0;
        Currency currency1;

        if (uint160(persona.token) < uint160(persona.pairToken)) {
            currency0 = Currency.wrap(persona.token);
            currency1 = Currency.wrap(persona.pairToken);
        } else {
            currency0 = Currency.wrap(persona.pairToken);
            currency1 = Currency.wrap(persona.token);
        }

        poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(dynamicFeeHook)
        });
    }

    /**
     * @notice Helper to get token balance
     * @param currency The currency to check
     * @param account The account to check
     * @return balance The balance
     */
    function _getBalance(Currency currency, address account) private view returns (uint256) {
        if (currency.isAddressZero()) {
            return account.balance;
        } else {
            return IERC20(Currency.unwrap(currency)).balanceOf(account);
        }
    }

    /**
     * @notice Get initial price for agent pool
     * @param personaIsToken0 Whether persona token is token0
     * @return initialPrice The initial sqrt price
     */
    function _getAgentPoolInitialPrice(bool personaIsToken0) private pure returns (uint160) {
        // Price ratio of 10:1 (agent:persona)
        if (personaIsToken0) {
            // persona is token0, agent is token1
            // Price = agent/persona = 10/1 = 10
            // sqrtPrice = sqrt(10) * 2^96
            return 250541478223274320632946051840; // sqrt(10) * 2^96
        } else {
            // agent is token0, persona is token1
            // Price = persona/agent = 1/10 = 0.1
            // sqrtPrice = sqrt(0.1) * 2^96
            return 25054147822327432063294605184; // sqrt(0.1) * 2^96
        }
    }

    /**
     * @notice Get tick range for single-sided liquidity
     * @param sqrtPriceX96 Current sqrt price
     * @param personaIsToken0 Whether persona token is token0
     * @return tickLower Lower tick
     * @return tickUpper Upper tick
     */
    function _getTickRangeForSingleSided(
        uint160 sqrtPriceX96,
        bool personaIsToken0
    ) private pure returns (int24 tickLower, int24 tickUpper) {
        int24 currentTick = TickMath.getTickAtSqrtPrice(sqrtPriceX96);
        
        // Round to nearest tick spacing
        currentTick = (currentTick / TICK_SPACING) * TICK_SPACING;
        
        if (personaIsToken0) {
            // Provide liquidity above current price (persona token only)
            tickLower = currentTick + TICK_SPACING;
            tickUpper = 887200; // Max tick
        } else {
            // Provide liquidity below current price (persona token only)
            tickLower = -887200; // Min tick
            tickUpper = currentTick - TICK_SPACING;
        }
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
