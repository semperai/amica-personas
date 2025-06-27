// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PersonaTokenFactory} from "./PersonaTokenFactory.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {IBondingCurve} from "./interfaces/IBondingCurve.sol";

/**
 * @title PersonaFactoryViewer
 * @author Amica Protocol
 * @notice Separate contract for all view/read functions to reduce main factory deployment cost
 * @dev Deploy this separately after deploying the main factory contract
 */
contract PersonaFactoryViewer {
    /// @notice Reference to the main factory contract
    PersonaTokenFactory public immutable factory;

    /// @notice Precision for calculations
    uint256 private constant PRECISION = 1e18;

    /**
     * @notice Initializes the viewer with factory address
     * @param _factory Address of the PersonaTokenFactory contract
     */
    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = PersonaTokenFactory(_factory);
    }

    /**
     * @notice Gets persona metadata values
     * @param tokenId ID of the persona
     * @param keys Array of metadata keys to retrieve
     * @return Array of metadata values
     */
    function getMetadata(uint256 tokenId, bytes32[] memory keys)
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

    /**
     * @notice Gets token distribution allocations for a persona
     * @param tokenId ID of the persona
     * @return liquidityAmount Tokens allocated for Uniswap liquidity
     * @return bondingSupplyAmount Tokens available in bonding curve
     * @return amicaAmount Tokens sent to AMICA protocol
     * @return agentStakerRewardsAmount Tokens reserved for agent stakers
     */
    function getTokenDistribution(uint256 tokenId)
        external
        view
        returns (
            uint256 liquidityAmount,
            uint256 bondingSupplyAmount,
            uint256 amicaAmount,
            uint256 agentStakerRewardsAmount
        )
    {
        (,, address agentToken,,,,,) = factory.personas(tokenId);

        if (agentToken != address(0)) {
            // With agent token: 1/3, 2/9, 2/9, 2/9
            liquidityAmount = 333_333_333 ether;
            bondingSupplyAmount = 222_222_222 ether;
            amicaAmount = 222_222_222 ether;
            agentStakerRewardsAmount = 222_222_223 ether;
        } else {
            // Without agent token: 1/3, 1/3, 1/3, 0
            liquidityAmount = 333_333_333 ether;
            bondingSupplyAmount = 333_333_333 ether;
            amicaAmount = 333_333_334 ether;
            agentStakerRewardsAmount = 0;
        }
    }

    /**
     * @notice Gets current bonding curve state
     * @param tokenId ID of the persona
     * @return totalPairingTokensCollected Total pairing tokens collected
     * @return tokensPurchased Total persona tokens purchased
     * @return availableTokens Remaining tokens in bonding curve
     */
    function getBondingCurveState(uint256 tokenId)
        external
        view
        returns (
            uint256 totalPairingTokensCollected,
            uint256 tokensPurchased,
            uint256 availableTokens
        )
    {
        (totalPairingTokensCollected, tokensPurchased) =
            factory.bondingStates(tokenId);

        // Calculate available tokens
        (address token,, address agentToken, bool graduated,,,,) =
            factory.personas(tokenId);
        if (graduated || token == address(0)) {
            availableTokens = 0;
        } else {
            uint256 bondingSupplyAmount =
                agentToken != address(0) ? 222_222_222 ether : 333_333_333 ether;
            availableTokens = tokensPurchased >= bondingSupplyAmount
                ? 0
                : bondingSupplyAmount - tokensPurchased;
        }

        return (totalPairingTokensCollected, tokensPurchased, availableTokens);
    }

    /**
     * @notice Gets user's bonding balance for a persona
     * @param tokenId ID of the persona
     * @param user User address
     * @return Amount of persona tokens in bonding curve
     */
    function getUserBondingBalance(uint256 tokenId, address user)
        external
        view
        returns (uint256)
    {
        return factory.bondingBalances(tokenId, user);
    }

    /**
     * @notice Gets the current price on the bonding curve
     * @param tokenId ID of the persona
     * @return price Current price multiplier (scaled by 1e18)
     */
    function getCurrentPrice(uint256 tokenId)
        public
        view
        returns (uint256 price)
    {
        (
            address token,
            address pairToken,
            address agentToken,
            bool graduated,
            ,
            ,
            ,
        ) = factory.personas(tokenId);
        if (graduated || token == address(0)) return 0;

        (, uint256 tokensPurchased) = factory.bondingStates(tokenId);

        // Get token distribution to determine bonding supply
        uint256 bondingSupplyAmount =
            agentToken != address(0) ? 222_222_222 ether : 333_333_333 ether;

        // Get bonding curve contract and calculate current price
        IBondingCurve bondingCurve = factory.bondingCurve();
        uint256 basePrice =
            bondingCurve.getCurrentPrice(tokensPurchased, bondingSupplyAmount);

        // Apply multiplier from pairing config
        (,, uint256 pricingMultiplier) = factory.pairingConfigs(pairToken);
        return (basePrice * pricingMultiplier) / PRECISION;
    }

    /**
     * @notice Checks if a persona can graduate
     * @param tokenId ID of the persona
     * @return eligible Whether graduation is possible
     * @return reason Reason if not eligible
     */
    function canGraduate(uint256 tokenId)
        external
        view
        returns (bool eligible, string memory reason)
    {
        (
            ,
            ,
            address agentToken,
            bool graduated,
            uint256 totalAgentDeposited,
            uint256 agentTokenThreshold,
            ,
        ) = factory.personas(tokenId);

        if (graduated) {
            return (false, "Already graduated");
        }

        (, uint256 tokensPurchased) = factory.bondingStates(tokenId);
        uint256 bondingSupplyAmount =
            agentToken != address(0) ? 222_222_222 ether : 333_333_333 ether;
        uint256 graduationThreshold = (bondingSupplyAmount * 85) / 100; // 85% threshold

        if (tokensPurchased < graduationThreshold) {
            return (false, "Below 85% tokens sold");
        }

        if (agentToken != address(0) && agentTokenThreshold > 0) {
            if (totalAgentDeposited < agentTokenThreshold) {
                return (false, "Insufficient agent tokens deposited");
            }
        }

        return (true, "");
    }

    /**
     * @notice Gets graduation progress
     * @param tokenId ID of the persona
     * @return tokensPurchasedPercent Percentage of bonding tokens purchased (0-100)
     * @return currentAgentDeposited Current agent tokens deposited
     * @return agentRequired Required agent tokens
     */
    function getGraduationProgress(uint256 tokenId)
        external
        view
        returns (
            uint256 tokensPurchasedPercent,
            uint256 currentAgentDeposited,
            uint256 agentRequired
        )
    {
        (
            ,
            ,
            address agentToken,
            ,
            uint256 totalAgentDeposited,
            uint256 agentTokenThreshold,
            ,
        ) = factory.personas(tokenId);
        (, uint256 tokensPurchased) = factory.bondingStates(tokenId);

        uint256 bondingSupplyAmount =
            agentToken != address(0) ? 222_222_222 ether : 333_333_333 ether;
        tokensPurchasedPercent = bondingSupplyAmount > 0
            ? (tokensPurchased * 100) / bondingSupplyAmount
            : 0;
        if (tokensPurchasedPercent > 100) tokensPurchasedPercent = 100;

        currentAgentDeposited = totalAgentDeposited;
        agentRequired = agentTokenThreshold;
    }

    /**
     * @notice Gets all claimable rewards for a user
     * @param tokenId ID of the persona
     * @param user User address
     * @return purchasedAmount Amount from purchases
     * @return bonusAmount Amount from unsold tokens
     * @return agentRewardAmount Amount from agent staking
     * @return totalClaimable Total claimable amount
     * @return claimed Whether the user has already claimed
     */
    function getClaimableRewards(uint256 tokenId, address user)
        external
        view
        returns (
            uint256 purchasedAmount,
            uint256 bonusAmount,
            uint256 agentRewardAmount,
            uint256 totalClaimable,
            bool claimed
        )
    {
        return factory.getClaimableRewards(tokenId, user);
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

    /**
     * @notice Gets pairing token configuration
     * @param token Token address
     * @return enabled Whether token is enabled
     * @return mintCost Cost to mint persona
     * @return pricingMultiplier Multiplier for bonding curve pricing
     */
    function getPairingConfig(address token)
        external
        view
        returns (bool enabled, uint256 mintCost, uint256 pricingMultiplier)
    {
        return factory.pairingConfigs(token);
    }

    /**
     * @notice Checks if a pairing token is enabled
     * @param token Token address
     * @return Whether token is enabled
     */
    function isPairingTokenEnabled(address token)
        external
        view
        returns (bool)
    {
        (bool enabled,,) = factory.pairingConfigs(token);
        return enabled;
    }

    /**
     * @notice Calculates expected output for buying persona tokens
     * @param tokenId ID of the persona
     * @param amountIn Amount of pairing tokens to spend
     * @return amountOut Expected persona tokens to receive
     */
    function calculateBuyAmount(uint256 tokenId, uint256 amountIn)
        external
        view
        returns (uint256 amountOut)
    {
        (
            address token,
            address pairToken,
            address agentToken,
            bool graduated,
            ,
            ,
            ,
        ) = factory.personas(tokenId);
        if (graduated || token == address(0)) return 0;

        (, uint256 tokensPurchased) = factory.bondingStates(tokenId);
        uint256 bondingSupplyAmount =
            agentToken != address(0) ? 222_222_222 ether : 333_333_333 ether;

        // Apply multiplier to input
        (,, uint256 pricingMultiplier) = factory.pairingConfigs(pairToken);
        uint256 adjustedAmountIn = (amountIn * pricingMultiplier) / PRECISION;

        IBondingCurve bondingCurve = factory.bondingCurve();
        return bondingCurve.calculateAmountOut(
            adjustedAmountIn, tokensPurchased, bondingSupplyAmount
        );
    }

    /**
     * @notice Calculates expected output for selling persona tokens
     * @param tokenId ID of the persona
     * @param amountIn Amount of persona tokens to sell
     * @return amountOut Expected pairing tokens to receive
     */
    function calculateSellAmount(uint256 tokenId, uint256 amountIn)
        external
        view
        returns (uint256 amountOut)
    {
        (
            address token,
            address pairToken,
            address agentToken,
            bool graduated,
            ,
            ,
            ,
        ) = factory.personas(tokenId);
        if (graduated || token == address(0)) return 0;

        (, uint256 tokensPurchased) = factory.bondingStates(tokenId);
        uint256 bondingSupplyAmount =
            agentToken != address(0) ? 222_222_222 ether : 333_333_333 ether;

        IBondingCurve bondingCurve = factory.bondingCurve();
        uint256 baseAmountOut = bondingCurve.calculateAmountOutForSell(
            amountIn, tokensPurchased, bondingSupplyAmount
        );

        // Apply multiplier (reverse of buy)
        (,, uint256 pricingMultiplier) = factory.pairingConfigs(pairToken);
        return (baseAmountOut * PRECISION) / pricingMultiplier;
    }

    /**
     * @notice Calculates the cost to buy a specific amount of tokens
     * @param tokenId ID of the persona
     * @param fromTokens Starting point (tokens already sold)
     * @param toTokens Ending point (tokens to be sold)
     * @return cost The cost in pairing tokens
     */
    function calculateCostBetween(
        uint256 tokenId,
        uint256 fromTokens,
        uint256 toTokens
    ) external view returns (uint256 cost) {
        (
            address token,
            address pairToken,
            address agentToken,
            bool graduated,
            ,
            ,
            ,
        ) = factory.personas(tokenId);
        if (graduated || token == address(0)) return 0;

        uint256 bondingSupplyAmount =
            agentToken != address(0) ? 222_222_222 ether : 333_333_333 ether;

        IBondingCurve bondingCurve = factory.bondingCurve();
        uint256 baseCost = bondingCurve.calculateCostBetween(
            fromTokens, toTokens, bondingSupplyAmount
        );

        // Apply multiplier
        (,, uint256 pricingMultiplier) = factory.pairingConfigs(pairToken);
        return (baseCost * pricingMultiplier) / PRECISION;
    }

    /**
     * @notice Gets multiple personas in one call
     * @param tokenIds Array of token IDs
     * @return erc20Tokens Array of ERC20 addresses
     * @return graduatedStatus Array of graduation status
     */
    function getPersonaBatch(uint256[] calldata tokenIds)
        external
        view
        returns (address[] memory erc20Tokens, bool[] memory graduatedStatus)
    {
        uint256 length = tokenIds.length;
        erc20Tokens = new address[](length);
        graduatedStatus = new bool[](length);

        for (uint256 i = 0; i < length; i++) {
            (address erc20Token,,, bool _graduated,,,,) =
                factory.personas(tokenIds[i]);
            erc20Tokens[i] = erc20Token;
            graduatedStatus[i] = _graduated;
        }
    }

    /**
     * @notice Gets bonding curve state for multiple token IDs
     * @param tokenIds Array of token IDs
     * @return totalPairingTokensCollected Array of total pairing tokens collected
     * @return tokensPurchased Array of tokens purchased
     * @return availableTokens Array of available tokens
     */
    function getBondingCurveStateBatch(uint256[] calldata tokenIds)
        external
        view
        returns (
            uint256[] memory totalPairingTokensCollected,
            uint256[] memory tokensPurchased,
            uint256[] memory availableTokens
        )
    {
        uint256 length = tokenIds.length;
        totalPairingTokensCollected = new uint256[](length);
        tokensPurchased = new uint256[](length);
        availableTokens = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            (totalPairingTokensCollected[i], tokensPurchased[i]) =
                factory.bondingStates(tokenIds[i]);

            // Calculate available tokens inline
            (address token,, address agentToken, bool graduated,,,,) =
                factory.personas(tokenIds[i]);
            if (graduated || token == address(0)) {
                availableTokens[i] = 0;
            } else {
                uint256 bondingSupplyAmount = agentToken != address(0)
                    ? 222_222_222 ether
                    : 333_333_333 ether;
                availableTokens[i] = tokensPurchased[i] >= bondingSupplyAmount
                    ? 0
                    : bondingSupplyAmount - tokensPurchased[i];
            }
        }
    }

    /**
     * @notice Gets user bonding balances for multiple personas
     * @param tokenIds Array of token IDs
     * @param user User address
     * @return balances Array of user bonding balances
     */
    function getUserBondingBalancesBatch(
        uint256[] calldata tokenIds,
        address user
    ) external view returns (uint256[] memory balances) {
        uint256 length = tokenIds.length;
        balances = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            balances[i] = factory.bondingBalances(tokenIds[i], user);
        }
    }

    /**
     * @notice Gets current prices for multiple personas
     * @param tokenIds Array of token IDs
     * @return prices Array of current prices (scaled by 1e18)
     */
    function getCurrentPricesBatch(uint256[] calldata tokenIds)
        external
        view
        returns (uint256[] memory prices)
    {
        uint256 length = tokenIds.length;
        prices = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            prices[i] = getCurrentPrice(tokenIds[i]);
        }
    }

    /**
     * @notice Gets claimable rewards for multiple personas
     * @param tokenIds Array of token IDs
     * @param user User address
     * @return purchasedAmounts Array of purchased amounts
     * @return bonusAmounts Array of bonus amounts
     * @return agentRewardAmounts Array of agent reward amounts
     * @return totalClaimables Array of total claimable amounts
     * @return hasClaimedArray Array of claim status
     */
    function getClaimableRewardsBatch(uint256[] calldata tokenIds, address user)
        external
        view
        returns (
            uint256[] memory purchasedAmounts,
            uint256[] memory bonusAmounts,
            uint256[] memory agentRewardAmounts,
            uint256[] memory totalClaimables,
            bool[] memory hasClaimedArray
        )
    {
        uint256 length = tokenIds.length;
        purchasedAmounts = new uint256[](length);
        bonusAmounts = new uint256[](length);
        agentRewardAmounts = new uint256[](length);
        totalClaimables = new uint256[](length);
        hasClaimedArray = new bool[](length);

        for (uint256 i = 0; i < length; i++) {
            (
                purchasedAmounts[i],
                bonusAmounts[i],
                agentRewardAmounts[i],
                totalClaimables[i],
                hasClaimedArray[i]
            ) = factory.getClaimableRewards(tokenIds[i], user);
        }
    }
}
