// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PersonaTokenFactory} from "./PersonaTokenFactory.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";

/**
 * @title PersonaFactoryViewer
 * @author Amica Protocol
 * @notice Separate contract for all view/read functions to reduce main factory deployment cost
 * @dev Deploy this separately after deploying the main factory contract
 */
contract PersonaFactoryViewer {
    
    // ============================================================================
    // STORAGE
    // ============================================================================
    
    /// @notice Reference to the main factory contract
    PersonaTokenFactory public immutable factory;
    
    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================
    
    /**
     * @notice Initializes the viewer with factory address
     * @param _factory Address of the PersonaTokenFactory contract
     */
    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = PersonaTokenFactory(_factory);
    }
    
    // ============================================================================
    // PERSONA INFORMATION
    // ============================================================================
    
    /**
     * @notice Gets persona information
     * @param tokenId ID of the persona
     * @return name Persona name
     * @return symbol Persona token symbol
     * @return erc20Token Address of persona's ERC20 token
     * @return pairToken Address of pairing token
     * @return agentToken Address of agent token (if any)
     * @return pairCreated Whether Uniswap pair exists
     * @return createdAt Creation timestamp
     * @return totalAgentDeposited Total agent tokens deposited
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
            address agentToken,
            bool pairCreated,
            uint256 createdAt,
            uint256 totalAgentDeposited,
            uint256 minAgentTokens,
            PoolId poolId,
            PoolId agentPoolId
        )
    {
        (name, symbol, erc20Token, pairToken, agentToken, pairCreated, createdAt, totalAgentDeposited, minAgentTokens, poolId, agentPoolId) = factory.personas(tokenId);
        return (name, symbol, erc20Token, pairToken, agentToken, pairCreated, createdAt, totalAgentDeposited, minAgentTokens, poolId, agentPoolId);
    }
    
    /**
     * @notice Gets persona metadata values
     * @param tokenId ID of the persona
     * @param keys Array of metadata keys to retrieve
     * @return Array of metadata values
     */
    function getMetadata(uint256 tokenId, string[] memory keys)
        external
        view
        returns (string[] memory)
    {
        string[] memory values = new string[](keys.length);
        
        for (uint256 i = 0; i < keys.length; i++) {
            values[i] = factory.metadata(tokenId, keys[i]);
        }
        
        return values;
    }
    
    // ============================================================================
    // TRADING INFORMATION
    // ============================================================================
    
    /**
     * @notice Gets token distribution allocations for a persona
     * @param tokenId ID of the persona
     * @return liquidityAmount Tokens allocated for Uniswap liquidity
     * @return bondingAmount Tokens available in bonding curve
     * @return amicaAmount Tokens sent to AMICA protocol
     * @return agentRewardsAmount Tokens reserved for agent stakers
     */
    function getTokenDistribution(uint256 tokenId) external view returns (
        uint256 liquidityAmount,
        uint256 bondingAmount,
        uint256 amicaAmount,
        uint256 agentRewardsAmount
    ) {
        (, , , , address agentToken, , , , , , ) = factory.personas(tokenId);
        
        if (agentToken != address(0)) {
            // With agent token: 1/3, 2/9, 2/9, 2/9
            liquidityAmount = 333_333_333 ether;
            bondingAmount = 222_222_222 ether;
            amicaAmount = 222_222_222 ether;
            agentRewardsAmount = 222_222_223 ether;
        } else {
            // Without agent token: 1/3, 1/3, 1/3, 0
            liquidityAmount = 333_333_333 ether;
            bondingAmount = 333_333_333 ether;
            amicaAmount = 333_333_334 ether;
            agentRewardsAmount = 0;
        }
    }
    
    /**
     * @notice Gets current purchase information
     * @param tokenId ID of the persona
     * @return totalDeposited Total pairing tokens deposited
     * @return tokensSold Total persona tokens sold
     * @return availableTokens Remaining tokens in bonding curve
     */
    function getPurchaseInfo(uint256 tokenId)
        external
        view
        returns (
            uint256 totalDeposited,
            uint256 tokensSold,
            uint256 availableTokens
        )
    {
        (totalDeposited, tokensSold) = factory.purchases(tokenId);
        availableTokens = factory.getAvailableTokens(tokenId);
        return (totalDeposited, tokensSold, availableTokens);
    }
    
    /**
     * @notice Gets user's purchase amount for a persona
     * @param tokenId ID of the persona
     * @param user User address
     * @return Amount of persona tokens purchased
     */
    function getUserPurchase(uint256 tokenId, address user)
        external
        view
        returns (uint256)
    {
        return factory.userPurchases(tokenId, user);
    }
    
    /**
     * @notice Preview swap for buying including fee calculations
     * @param tokenId ID of the persona
     * @param amountIn Amount of pairing tokens to spend
     * @param user User address (for fee calculation)
     * @return feeAmount Fee amount in pairing tokens
     * @return amountInAfterFee Input amount after fees
     * @return expectedOutput Expected persona tokens to receive
     */
    function previewBuyWithFee(
        uint256 tokenId,
        uint256 amountIn,
        address user
    ) external view returns (
        uint256 feeAmount,
        uint256 amountInAfterFee,
        uint256 expectedOutput
    ) {
        uint256 effectiveFeePercentage = factory.getEffectiveFeePercentage(user);
        feeAmount = (amountIn * effectiveFeePercentage) / 10000;
        amountInAfterFee = amountIn - feeAmount;
        
        // Calculate output directly without using getAmountOut (which applies base fee)
        (, uint256 tokensSold) = factory.purchases(tokenId);
        (, , , , address agentToken, , , , , , ) = factory.personas(tokenId);
        
        // Get token distribution
        uint256 bondingAmount;
        if (agentToken != address(0)) {
            bondingAmount = 222_222_222 ether; // 2/9 with agent
        } else {
            bondingAmount = 333_333_333 ether; // 1/3 without agent
        }
        
        // Calculate using the same formula as _calculateAmountOut
        uint256 virtualAmicaReserve = 100_000 ether;
        uint256 virtualTokenReserve = bondingAmount / 10;
        
        uint256 currentTokenReserve = virtualTokenReserve + (bondingAmount - tokensSold);
        uint256 currentAmicaReserve = virtualAmicaReserve + (tokensSold * virtualAmicaReserve / virtualTokenReserve);
        
        uint256 k = currentTokenReserve * currentAmicaReserve;
        uint256 newAmicaReserve = currentAmicaReserve + amountInAfterFee;
        uint256 newTokenReserve = k / newAmicaReserve;
        uint256 amountOut = currentTokenReserve - newTokenReserve;
        
        expectedOutput = amountOut * 99 / 100; // 1% slippage protection
    }
    
    /**
     * @notice Alias for previewBuyWithFee for backwards compatibility
     * @param tokenId ID of the persona
     * @param amountIn Amount of pairing tokens to spend
     * @param user User address (for fee calculation)
     * @return feeAmount Fee amount in pairing tokens
     * @return amountInAfterFee Input amount after fees
     * @return expectedOutput Expected persona tokens to receive
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
        return this.previewBuyWithFee(tokenId, amountIn, user);
    }
    
    /**
     * @notice Preview swap for selling including fee calculations
     * @param tokenId ID of the persona
     * @param amountIn Amount of persona tokens to sell
     * @param user User address (for fee calculation)
     * @return expectedOutput Expected pairing tokens before fees
     * @return feeAmount Fee amount in pairing tokens
     * @return amountOutAfterFee Pairing tokens to receive after fees
     */
    function previewSellWithFee(
        uint256 tokenId,
        uint256 amountIn,
        address user
    ) external view returns (
        uint256 expectedOutput,
        uint256 feeAmount,
        uint256 amountOutAfterFee
    ) {
        // Get expected output before fees
        expectedOutput = factory.getAmountOutForSell(tokenId, amountIn);
        
        // Calculate fees
        uint256 effectiveFeePercentage = factory.getEffectiveFeePercentage(user);
        feeAmount = (expectedOutput * effectiveFeePercentage) / 10000;
        amountOutAfterFee = expectedOutput - feeAmount;
    }
    
    /**
     * @notice Gets expected output with user-specific fee reduction for buying
     * @param tokenId ID of the persona
     * @param amountIn Amount of pairing tokens
     * @param user User address
     * @return Expected persona tokens after fees
     */
    function getAmountOutForUser(
        uint256 tokenId,
        uint256 amountIn,
        address user
    ) external view returns (uint256) {
        uint256 effectiveFeePercentage = factory.getEffectiveFeePercentage(user);
        uint256 feeAmount = (amountIn * effectiveFeePercentage) / 10000;
        uint256 amountInAfterFee = amountIn - feeAmount;
        
        // Calculate output directly without using getAmountOut (which applies base fee)
        (, uint256 tokensSold) = factory.purchases(tokenId);
        (, , , , address agentToken, , , , , , ) = factory.personas(tokenId);
        
        // Get token distribution
        uint256 bondingAmount;
        if (agentToken != address(0)) {
            bondingAmount = 222_222_222 ether; // 2/9 with agent
        } else {
            bondingAmount = 333_333_333 ether; // 1/3 without agent
        }
        
        // Calculate using the same formula as _calculateAmountOut
        uint256 virtualAmicaReserve = 100_000 ether;
        uint256 virtualTokenReserve = bondingAmount / 10;
        
        uint256 currentTokenReserve = virtualTokenReserve + (bondingAmount - tokensSold);
        uint256 currentAmicaReserve = virtualAmicaReserve + (tokensSold * virtualAmicaReserve / virtualTokenReserve);
        
        uint256 k = currentTokenReserve * currentAmicaReserve;
        uint256 newAmicaReserve = currentAmicaReserve + amountInAfterFee;
        uint256 newTokenReserve = k / newAmicaReserve;
        uint256 amountOut = currentTokenReserve - newTokenReserve;
        
        return amountOut * 99 / 100; // Apply 1% slippage protection
    }
    
    /**
     * @notice Gets expected output with user-specific fee reduction for selling
     * @param tokenId ID of the persona
     * @param amountIn Amount of persona tokens to sell
     * @param user User address
     * @return Expected pairing tokens after fees
     */
    function getAmountOutForSellForUser(
        uint256 tokenId,
        uint256 amountIn,
        address user
    ) external view returns (uint256) {
        // Get output before fees
        uint256 amountOut = factory.getAmountOutForSell(tokenId, amountIn);
        
        // Apply user-specific fees
        uint256 effectiveFeePercentage = factory.getEffectiveFeePercentage(user);
        uint256 feeAmount = (amountOut * effectiveFeePercentage) / 10000;
        
        return amountOut - feeAmount;
    }
    
    // ============================================================================
    // GRADUATION STATUS
    // ============================================================================
    
    /**
     * @notice Checks if a persona can graduate
     * @param tokenId ID of the persona
     * @return eligible Whether graduation is possible
     * @return reason Reason if not eligible
     */
    function canGraduate(uint256 tokenId) external view returns (bool eligible, string memory reason) {
        (, , , address pairToken, address agentToken, bool pairCreated, , uint256 totalAgentDeposited, uint256 minAgentTokens, , ) = factory.personas(tokenId);
        
        if (pairCreated) {
            return (false, "Already graduated");
        }
        
        (uint256 totalDeposited, ) = factory.purchases(tokenId);
        (, , uint256 graduationThreshold) = factory.pairingConfigs(pairToken);
        
        if (totalDeposited < graduationThreshold) {
            return (false, "Below graduation threshold");
        }
        
        if (agentToken != address(0) && minAgentTokens > 0) {
            if (totalAgentDeposited < minAgentTokens) {
                return (false, "Insufficient agent tokens deposited");
            }
        }
        
        return (true, "");
    }
    
    /**
     * @notice Gets graduation progress
     * @param tokenId ID of the persona
     * @return currentDeposited Current pairing tokens deposited
     * @return thresholdRequired Threshold for graduation
     * @return currentAgentDeposited Current agent tokens deposited
     * @return agentRequired Required agent tokens
     */
    function getGraduationProgress(uint256 tokenId)
        external
        view
        returns (
            uint256 currentDeposited,
            uint256 thresholdRequired,
            uint256 currentAgentDeposited,
            uint256 agentRequired
        )
    {
        (, , , address pairToken, , , , uint256 totalAgentDeposited, uint256 minAgentTokens, , ) = factory.personas(tokenId);
        (currentDeposited, ) = factory.purchases(tokenId);
        (, , thresholdRequired) = factory.pairingConfigs(pairToken);
        
        currentAgentDeposited = totalAgentDeposited;
        agentRequired = minAgentTokens;
    }
    
    // ============================================================================
    // AGENT TOKEN FUNCTIONS
    // ============================================================================
    
    /**
     * @notice Calculates expected agent rewards for a user
     * @param tokenId ID of the persona
     * @param user User address
     * @return personaReward Expected persona tokens as reward
     * @return agentAmount User's agent token deposit
     */
    function calculateAgentRewards(uint256 tokenId, address user)
        external
        view
        returns (uint256 personaReward, uint256 agentAmount)
    {
        (, , , , address agentToken, , , uint256 totalAgentDeposited, , , ) = factory.personas(tokenId);
        
        agentAmount = factory.agentDeposits(tokenId, user);
        
        if (totalAgentDeposited > 0 && agentAmount > 0 && agentToken != address(0)) {
            personaReward = (222_222_223 ether * agentAmount) / totalAgentDeposited;
        }
    }
    
    /**
     * @notice Gets user's agent token deposit
     * @param tokenId ID of the persona
     * @param user User address
     * @return Amount of agent tokens deposited
     */
    function getUserAgentDeposit(uint256 tokenId, address user)
        external
        view
        returns (uint256)
    {
        return factory.agentDeposits(tokenId, user);
    }
    
    // ============================================================================
    // FEE INFORMATION
    // ============================================================================
    
    /**
     * @notice Gets fee reduction configuration
     * @return minAmicaForReduction Minimum AMICA for reduction
     * @return maxAmicaForReduction AMICA for max reduction
     * @return minReductionMultiplier Min fee multiplier
     * @return maxReductionMultiplier Max fee multiplier
     */
    function getFeeReductionConfig() external view returns (
        uint256 minAmicaForReduction,
        uint256 maxAmicaForReduction,
        uint256 minReductionMultiplier,
        uint256 maxReductionMultiplier
    ) {
        return factory.feeReductionConfig();
    }
    
    // ============================================================================
    // PAIRING TOKEN INFORMATION
    // ============================================================================
    
    /**
     * @notice Gets pairing token configuration
     * @param token Token address
     * @return enabled Whether token is enabled
     * @return mintCost Cost to mint persona
     * @return graduationThreshold Threshold for graduation
     */
    function getPairingConfig(address token)
        external
        view
        returns (
            bool enabled,
            uint256 mintCost,
            uint256 graduationThreshold
        )
    {
        return factory.pairingConfigs(token);
    }
    
    /**
     * @notice Checks if a pairing token is enabled
     * @param token Token address
     * @return Whether token is enabled
     */
    function isPairingTokenEnabled(address token) external view returns (bool) {
        (bool enabled, , ) = factory.pairingConfigs(token);
        return enabled;
    }
    
    // ============================================================================
    // TRADING ANALYSIS
    // ============================================================================
    
    /**
     * @notice Calculates price impact for a buy
     * @param tokenId ID of the persona
     * @param amountIn Amount of pairing tokens
     * @return priceImpactBasisPoints Price impact in basis points
     */
    function calculateBuyPriceImpact(uint256 tokenId, uint256 amountIn) external view returns (uint256) {
        (, uint256 tokensSold) = factory.purchases(tokenId);
        (, , , , address agentToken, , , , , , ) = factory.personas(tokenId);
        
        uint256 bondingAmount = agentToken != address(0) ? 222_222_222 ether : 333_333_333 ether;
        
        // Calculate current price
        uint256 virtualAmicaReserve = 100_000 ether;
        uint256 virtualTokenReserve = bondingAmount / 10;
        uint256 currentTokenReserve = virtualTokenReserve + (bondingAmount - tokensSold);
        uint256 currentAmicaReserve = virtualAmicaReserve + (tokensSold * virtualAmicaReserve / virtualTokenReserve);
        uint256 currentPrice = (currentAmicaReserve * 1e18) / currentTokenReserve;
        
        // Calculate price after trade
        uint256 k = currentTokenReserve * currentAmicaReserve;
        uint256 newAmicaReserve = currentAmicaReserve + amountIn;
        uint256 newTokenReserve = k / newAmicaReserve;
        uint256 newPrice = (newAmicaReserve * 1e18) / newTokenReserve;
        
        // Calculate impact
        uint256 priceIncrease = newPrice - currentPrice;
        return (priceIncrease * 10000) / currentPrice;
    }
    
    /**
     * @notice Calculates price impact for a sell
     * @param tokenId ID of the persona
     * @param amountIn Amount of persona tokens
     * @return priceImpactBasisPoints Price impact in basis points (negative)
     */
    function calculateSellPriceImpact(uint256 tokenId, uint256 amountIn) external view returns (uint256) {
        (, uint256 tokensSold) = factory.purchases(tokenId);
        (, , , , address agentToken, , , , , , ) = factory.personas(tokenId);
        
        uint256 bondingAmount = agentToken != address(0) ? 222_222_222 ether : 333_333_333 ether;
        
        // Calculate current price
        uint256 virtualAmicaReserve = 100_000 ether;
        uint256 virtualTokenReserve = bondingAmount / 10;
        uint256 currentTokenReserve = virtualTokenReserve + (bondingAmount - tokensSold);
        uint256 currentAmicaReserve = virtualAmicaReserve + (tokensSold * virtualAmicaReserve / virtualTokenReserve);
        uint256 currentPrice = (currentAmicaReserve * 1e18) / currentTokenReserve;
        
        // Calculate price after trade
        uint256 newTokenReserve = currentTokenReserve + amountIn;
        uint256 k = currentTokenReserve * currentAmicaReserve;
        uint256 newAmicaReserve = k / newTokenReserve;
        uint256 newPrice = (newAmicaReserve * 1e18) / newTokenReserve;
        
        // Calculate impact (will be negative)
        uint256 priceDecrease = currentPrice - newPrice;
        return (priceDecrease * 10000) / currentPrice;
    }
    
    // ============================================================================
    // BATCH GETTERS
    // ============================================================================
    
    /**
     * @notice Gets multiple personas in one call
     * @param tokenIds Array of token IDs
     * @return names Array of persona names
     * @return erc20Tokens Array of ERC20 addresses
     * @return graduated Array of graduation status
     */
    function getPersonaBatch(uint256[] calldata tokenIds)
        external
        view
        returns (
            string[] memory names,
            address[] memory erc20Tokens,
            bool[] memory graduated
        )
    {
        uint256 length = tokenIds.length;
        names = new string[](length);
        erc20Tokens = new address[](length);
        graduated = new bool[](length);
        
        for (uint256 i = 0; i < length; i++) {
            (string memory name, , address erc20Token, , , bool pairCreated, , , , ,  ) = factory.personas(tokenIds[i]);
            names[i] = name;
            erc20Tokens[i] = erc20Token;
            graduated[i] = pairCreated;
        }
    }
    
    /**
     * @notice Gets purchase info for multiple token IDs
     * @param tokenIds Array of token IDs
     * @return totalDeposited Array of total deposits
     * @return tokensSold Array of tokens sold
     * @return availableTokens Array of available tokens
     */
    function getPurchaseInfoBatch(uint256[] calldata tokenIds)
        external
        view
        returns (
            uint256[] memory totalDeposited,
            uint256[] memory tokensSold,
            uint256[] memory availableTokens
        )
    {
        uint256 length = tokenIds.length;
        totalDeposited = new uint256[](length);
        tokensSold = new uint256[](length);
        availableTokens = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            (totalDeposited[i], tokensSold[i]) = factory.purchases(tokenIds[i]);
            availableTokens[i] = factory.getAvailableTokens(tokenIds[i]);
        }
    }
    
    /**
     * @notice Gets user balances for multiple personas
     * @param tokenIds Array of token IDs
     * @param user User address
     * @return balances Array of user balances
     */
    function getUserBalancesBatch(uint256[] calldata tokenIds, address user)
        external
        view
        returns (uint256[] memory balances)
    {
        uint256 length = tokenIds.length;
        balances = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            balances[i] = factory.userPurchases(tokenIds[i], user);
        }
    }
}
