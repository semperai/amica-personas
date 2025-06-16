// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PersonaTokenFactory.sol";

/**
 * @title PersonaFactoryViewer
 * @notice Separate contract for all view/read functions to reduce main factory deployment cost
 * @dev Deploy this separately after deploying the main factory contract
 */
contract PersonaFactoryViewer {
    
    // ============================================================================
    // STORAGE
    // ============================================================================
    
    PersonaTokenFactory public immutable factory;
    
    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================
    
    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = PersonaTokenFactory(_factory);
    }
    
    // ============================================================================
    // PERSONA INFORMATION
    // ============================================================================
    
    /**
     * @notice Gets core persona information
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
        (name, symbol, erc20Token, pairToken, , pairCreated, createdAt, , minAgentTokens) = factory.personas(tokenId);
        return (name, symbol, erc20Token, pairToken, pairCreated, createdAt, minAgentTokens);
    }
    
    /**
     * @notice Gets extended persona information including agent token data
     */
    function getPersonaExtended(uint256 tokenId)
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
            uint256 minAgentTokens
        )
    {
        (name, symbol, erc20Token, pairToken, agentToken, pairCreated, createdAt, totalAgentDeposited, minAgentTokens) = factory.personas(tokenId);
        return (name, symbol, erc20Token, pairToken, agentToken, pairCreated, createdAt, totalAgentDeposited, minAgentTokens);
    }
    
    /**
     * @notice Gets persona metadata values
     */
    function getMetadata(uint256 tokenId, string[] memory keys)
        external
        view
        returns (string[] memory)
    {
        string[] memory values = new string[](keys.length);
        
        for (uint256 i = 0; i < keys.length; i++) {
            // Note: This requires a public getter for metadata in main contract
            values[i] = factory.getMetadataValue(tokenId, keys[i]);
        }
        
        return values;
    }
    
    // ============================================================================
    // TRADING INFORMATION
    // ============================================================================
    
    /**
     * @notice Gets token distribution allocations for a persona
     */
    function getTokenDistribution(uint256 tokenId) external view returns (
        uint256 liquidityAmount,
        uint256 bondingAmount,
        uint256 amicaAmount,
        uint256 agentRewardsAmount
    ) {
        (, , , , address agentToken, , , , ) = factory.personas(tokenId);
        
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
     */
    function getUserPurchase(uint256 tokenId, address user)
        external
        view
        returns (uint256)
    {
        return factory.userPurchases(tokenId, user);
    }
    
    /**
     * @notice Preview swap including fee calculations
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
        uint256 effectiveFeePercentage = factory.getEffectiveFeePercentage(user);
        feeAmount = (amountIn * effectiveFeePercentage) / 10000;
        amountInAfterFee = amountIn - feeAmount;
        
        // Calculate output directly without using getAmountOut (which applies base fee)
        (uint256 totalDeposited, uint256 tokensSold) = factory.purchases(tokenId);
        (, , , , address agentToken, , , , ) = factory.personas(tokenId);
        
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
        
        expectedOutput = amountOut; 
    }
    
    /**
     * @notice Gets expected output with user-specific fee reduction
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
        (uint256 totalDeposited, uint256 tokensSold) = factory.purchases(tokenId);
        (, , , , address agentToken, , , , ) = factory.personas(tokenId);
        
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
    
    // ============================================================================
    // GRADUATION STATUS
    // ============================================================================
    
    /**
     * @notice Checks if a persona can graduate
     */
    function canGraduate(uint256 tokenId) external view returns (bool eligible, string memory reason) {
        (, , , address pairToken, address agentToken, bool pairCreated, , uint256 totalAgentDeposited, uint256 minAgentTokens) = factory.personas(tokenId);
        
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
     */
    function getGraduationProgress(uint256 tokenId)
        external
        view
        returns (
            uint256 currentDeposited,
            uint256 thresholdRequired,
            uint256 percentComplete,
            uint256 currentAgentDeposited,
            uint256 agentRequired
        )
    {
        (, , , address pairToken, address agentToken, , , uint256 totalAgentDeposited, uint256 minAgentTokens) = factory.personas(tokenId);
        (currentDeposited, ) = factory.purchases(tokenId);
        (, , thresholdRequired) = factory.pairingConfigs(pairToken);
        
        percentComplete = thresholdRequired > 0 ? (currentDeposited * 100) / thresholdRequired : 0;
        currentAgentDeposited = totalAgentDeposited;
        agentRequired = minAgentTokens;
    }
    
    // ============================================================================
    // AGENT TOKEN FUNCTIONS
    // ============================================================================
    
    /**
     * @notice Calculates expected agent rewards for a user
     */
    function calculateAgentRewards(uint256 tokenId, address user)
        external
        view
        returns (uint256 personaReward, uint256 agentAmount)
    {
        (, , , , address agentToken, , , uint256 totalAgentDeposited, ) = factory.personas(tokenId);
        
        agentAmount = factory.agentDeposits(tokenId, user);
        
        if (totalAgentDeposited > 0 && agentAmount > 0 && agentToken != address(0)) {
            personaReward = (222_222_223 ether * agentAmount) / totalAgentDeposited;
        }
    }
    
    /**
     * @notice Gets user's agent token deposit
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
     * @notice Gets detailed fee information for a user
     */
    function getUserFeeInfo(address user) external view returns (
        uint256 currentBalance,
        uint256 snapshotBalance,
        uint256 effectiveBalance,
        uint256 snapshotBlock,
        bool isEligible,
        uint256 blocksUntilEligible,
        uint256 baseFeePercentage,
        uint256 effectiveFeePercentage,
        uint256 discountPercentage
    ) {
        IERC20 amicaToken = factory.amicaToken();
        currentBalance = amicaToken.balanceOf(user);
        effectiveBalance = factory.getEffectiveAmicaBalance(user);
        
        (uint256 currentBal, uint256 currentBlk, uint256 pendingBal, uint256 pendingBlk) = factory.userSnapshots(user);
        
        // Determine which snapshot is active/pending
        if (pendingBlk > 0 && block.number >= pendingBlk + factory.SNAPSHOT_DELAY()) {
            snapshotBalance = pendingBal;
            snapshotBlock = pendingBlk;
            isEligible = true;
            blocksUntilEligible = 0;
        } else if (currentBlk > 0 && block.number >= currentBlk + factory.SNAPSHOT_DELAY()) {
            snapshotBalance = currentBal;
            snapshotBlock = currentBlk;
            isEligible = true;
            blocksUntilEligible = 0;
        } else if (pendingBlk > 0) {
            snapshotBalance = pendingBal;
            snapshotBlock = pendingBlk;
            isEligible = false;
            blocksUntilEligible = (pendingBlk + factory.SNAPSHOT_DELAY()) - block.number;
        } else if (currentBlk > 0) {
            snapshotBalance = currentBal;
            snapshotBlock = currentBlk;
            isEligible = false;
            blocksUntilEligible = (currentBlk + factory.SNAPSHOT_DELAY()) - block.number;
        } else {
            snapshotBalance = 0;
            snapshotBlock = 0;
            isEligible = false;
            blocksUntilEligible = factory.SNAPSHOT_DELAY();
        }
        
        (baseFeePercentage, ) = factory.tradingFeeConfig();
        effectiveFeePercentage = factory.getEffectiveFeePercentage(user);
        
        if (baseFeePercentage > 0) {
            discountPercentage = ((baseFeePercentage - effectiveFeePercentage) * 10000) / baseFeePercentage;
        } else {
            discountPercentage = 0;
        }
    }
    
    /**
     * @notice Gets fee reduction configuration
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
     */
    function isPairingTokenEnabled(address token) external view returns (bool) {
        (bool enabled, , ) = factory.pairingConfigs(token);
        return enabled;
    }
    
    // ============================================================================
    // BATCH GETTERS
    // ============================================================================
    
    /**
     * @notice Gets multiple personas in one call
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
            (string memory name, , address erc20Token, , , bool pairCreated, , , ) = factory.personas(tokenIds[i]);
            names[i] = name;
            erc20Tokens[i] = erc20Token;
            graduated[i] = pairCreated;
        }
    }
    
    /**
     * @notice Gets purchase info for multiple token IDs
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
}
