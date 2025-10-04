import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const functions = {
    calculateBuyAmount: viewFun("0x03ff40fb", "calculateBuyAmount(uint256,uint256)", {"tokenId": p.uint256, "amountIn": p.uint256}, p.uint256),
    calculateCostBetween: viewFun("0xa1c5f322", "calculateCostBetween(uint256,uint256,uint256)", {"tokenId": p.uint256, "fromTokens": p.uint256, "toTokens": p.uint256}, p.uint256),
    calculateSellAmount: viewFun("0xebff160b", "calculateSellAmount(uint256,uint256)", {"tokenId": p.uint256, "amountIn": p.uint256}, p.uint256),
    canGraduate: viewFun("0x24a2fb98", "canGraduate(uint256)", {"tokenId": p.uint256}, {"eligible": p.bool, "reason": p.string}),
    factory: viewFun("0xc45a0155", "factory()", {}, p.address),
    getBondingCurveState: viewFun("0x2bf971f2", "getBondingCurveState(uint256)", {"tokenId": p.uint256}, {"totalPairingTokensCollected": p.uint256, "tokensPurchased": p.uint256, "availableTokens": p.uint256}),
    getBondingCurveStateBatch: viewFun("0xdfdb3fc9", "getBondingCurveStateBatch(uint256[])", {"tokenIds": p.array(p.uint256)}, {"totalPairingTokensCollected": p.array(p.uint256), "tokensPurchased": p.array(p.uint256), "availableTokens": p.array(p.uint256)}),
    getClaimableRewards: viewFun("0xab60df90", "getClaimableRewards(uint256,address)", {"tokenId": p.uint256, "user": p.address}, {"purchasedAmount": p.uint256, "bonusAmount": p.uint256, "agentRewardAmount": p.uint256, "totalClaimable": p.uint256, "claimed": p.bool, "claimable": p.bool}),
    getClaimableRewardsBatch: viewFun("0x2a2b6d82", "getClaimableRewardsBatch(uint256[],address)", {"tokenIds": p.array(p.uint256), "user": p.address}, {"purchasedAmounts": p.array(p.uint256), "bonusAmounts": p.array(p.uint256), "agentRewardAmounts": p.array(p.uint256), "totalClaimables": p.array(p.uint256), "hasClaimedArray": p.array(p.bool), "claimableArray": p.array(p.bool)}),
    getCurrentPrice: viewFun("0xc55d0f56", "getCurrentPrice(uint256)", {"tokenId": p.uint256}, p.uint256),
    getCurrentPricesBatch: viewFun("0x0cd7bf96", "getCurrentPricesBatch(uint256[])", {"tokenIds": p.array(p.uint256)}, p.array(p.uint256)),
    getGraduationProgress: viewFun("0x81b279d6", "getGraduationProgress(uint256)", {"tokenId": p.uint256}, {"tokensPurchasedPercent": p.uint256, "currentAgentDeposited": p.uint256, "agentRequired": p.uint256}),
    getGraduationTimestamp: viewFun("0xc307f045", "getGraduationTimestamp(uint256)", {"tokenId": p.uint256}, p.uint256),
    getMetadata: viewFun("0x546fec3f", "getMetadata(uint256,bytes32[])", {"tokenId": p.uint256, "keys": p.array(p.bytes32)}, p.array(p.string)),
    getPairingConfig: viewFun("0xe258a455", "getPairingConfig(address)", {"token": p.address}, {"enabled": p.bool, "mintCost": p.uint256, "pricingMultiplier": p.uint256}),
    getPersonaBatch: viewFun("0x32afcfad", "getPersonaBatch(uint256[])", {"tokenIds": p.array(p.uint256)}, {"erc20Tokens": p.array(p.address), "graduatedStatus": p.array(p.bool)}),
    getPreGraduationState: viewFun("0xfc2198e8", "getPreGraduationState(uint256)", {"tokenId": p.uint256}, {"totalPairingTokensCollected": p.uint256, "tokensPurchased": p.uint256, "totalAgentDeposited": p.uint256}),
    getTokenDistribution: viewFun("0x40b869e5", "getTokenDistribution(uint256)", {"tokenId": p.uint256}, {"liquidityAmount": p.uint256, "bondingSupplyAmount": p.uint256, "amicaAmount": p.uint256, "agentRewardsAmount": p.uint256}),
    getTotalAgentDeposited: viewFun("0xa18794df", "getTotalAgentDeposited(uint256)", {"tokenId": p.uint256}, p.uint256),
    getUserAgentDeposit: viewFun("0xbc069632", "getUserAgentDeposit(uint256,address)", {"tokenId": p.uint256, "user": p.address}, p.uint256),
    getUserBondingBalance: viewFun("0xb433d860", "getUserBondingBalance(uint256,address)", {"tokenId": p.uint256, "user": p.address}, p.uint256),
    getUserBondingBalancesBatch: viewFun("0x0c57f5af", "getUserBondingBalancesBatch(uint256[],address)", {"tokenIds": p.array(p.uint256), "user": p.address}, p.array(p.uint256)),
    isClaimAllowed: viewFun("0x7c06b6db", "isClaimAllowed(uint256)", {"tokenId": p.uint256}, {"allowed": p.bool, "timeRemaining": p.uint256}),
    isPairingTokenEnabled: viewFun("0xbc5fccc7", "isPairingTokenEnabled(address)", {"token": p.address}, p.bool),
}

export class Contract extends ContractBase {

    calculateBuyAmount(tokenId: CalculateBuyAmountParams["tokenId"], amountIn: CalculateBuyAmountParams["amountIn"]) {
        return this.eth_call(functions.calculateBuyAmount, {tokenId, amountIn})
    }

    calculateCostBetween(tokenId: CalculateCostBetweenParams["tokenId"], fromTokens: CalculateCostBetweenParams["fromTokens"], toTokens: CalculateCostBetweenParams["toTokens"]) {
        return this.eth_call(functions.calculateCostBetween, {tokenId, fromTokens, toTokens})
    }

    calculateSellAmount(tokenId: CalculateSellAmountParams["tokenId"], amountIn: CalculateSellAmountParams["amountIn"]) {
        return this.eth_call(functions.calculateSellAmount, {tokenId, amountIn})
    }

    canGraduate(tokenId: CanGraduateParams["tokenId"]) {
        return this.eth_call(functions.canGraduate, {tokenId})
    }

    factory() {
        return this.eth_call(functions.factory, {})
    }

    getBondingCurveState(tokenId: GetBondingCurveStateParams["tokenId"]) {
        return this.eth_call(functions.getBondingCurveState, {tokenId})
    }

    getBondingCurveStateBatch(tokenIds: GetBondingCurveStateBatchParams["tokenIds"]) {
        return this.eth_call(functions.getBondingCurveStateBatch, {tokenIds})
    }

    getClaimableRewards(tokenId: GetClaimableRewardsParams["tokenId"], user: GetClaimableRewardsParams["user"]) {
        return this.eth_call(functions.getClaimableRewards, {tokenId, user})
    }

    getClaimableRewardsBatch(tokenIds: GetClaimableRewardsBatchParams["tokenIds"], user: GetClaimableRewardsBatchParams["user"]) {
        return this.eth_call(functions.getClaimableRewardsBatch, {tokenIds, user})
    }

    getCurrentPrice(tokenId: GetCurrentPriceParams["tokenId"]) {
        return this.eth_call(functions.getCurrentPrice, {tokenId})
    }

    getCurrentPricesBatch(tokenIds: GetCurrentPricesBatchParams["tokenIds"]) {
        return this.eth_call(functions.getCurrentPricesBatch, {tokenIds})
    }

    getGraduationProgress(tokenId: GetGraduationProgressParams["tokenId"]) {
        return this.eth_call(functions.getGraduationProgress, {tokenId})
    }

    getGraduationTimestamp(tokenId: GetGraduationTimestampParams["tokenId"]) {
        return this.eth_call(functions.getGraduationTimestamp, {tokenId})
    }

    getMetadata(tokenId: GetMetadataParams["tokenId"], keys: GetMetadataParams["keys"]) {
        return this.eth_call(functions.getMetadata, {tokenId, keys})
    }

    getPairingConfig(token: GetPairingConfigParams["token"]) {
        return this.eth_call(functions.getPairingConfig, {token})
    }

    getPersonaBatch(tokenIds: GetPersonaBatchParams["tokenIds"]) {
        return this.eth_call(functions.getPersonaBatch, {tokenIds})
    }

    getPreGraduationState(tokenId: GetPreGraduationStateParams["tokenId"]) {
        return this.eth_call(functions.getPreGraduationState, {tokenId})
    }

    getTokenDistribution(tokenId: GetTokenDistributionParams["tokenId"]) {
        return this.eth_call(functions.getTokenDistribution, {tokenId})
    }

    getTotalAgentDeposited(tokenId: GetTotalAgentDepositedParams["tokenId"]) {
        return this.eth_call(functions.getTotalAgentDeposited, {tokenId})
    }

    getUserAgentDeposit(tokenId: GetUserAgentDepositParams["tokenId"], user: GetUserAgentDepositParams["user"]) {
        return this.eth_call(functions.getUserAgentDeposit, {tokenId, user})
    }

    getUserBondingBalance(tokenId: GetUserBondingBalanceParams["tokenId"], user: GetUserBondingBalanceParams["user"]) {
        return this.eth_call(functions.getUserBondingBalance, {tokenId, user})
    }

    getUserBondingBalancesBatch(tokenIds: GetUserBondingBalancesBatchParams["tokenIds"], user: GetUserBondingBalancesBatchParams["user"]) {
        return this.eth_call(functions.getUserBondingBalancesBatch, {tokenIds, user})
    }

    isClaimAllowed(tokenId: IsClaimAllowedParams["tokenId"]) {
        return this.eth_call(functions.isClaimAllowed, {tokenId})
    }

    isPairingTokenEnabled(token: IsPairingTokenEnabledParams["token"]) {
        return this.eth_call(functions.isPairingTokenEnabled, {token})
    }
}

/// Function types
export type CalculateBuyAmountParams = FunctionArguments<typeof functions.calculateBuyAmount>
export type CalculateBuyAmountReturn = FunctionReturn<typeof functions.calculateBuyAmount>

export type CalculateCostBetweenParams = FunctionArguments<typeof functions.calculateCostBetween>
export type CalculateCostBetweenReturn = FunctionReturn<typeof functions.calculateCostBetween>

export type CalculateSellAmountParams = FunctionArguments<typeof functions.calculateSellAmount>
export type CalculateSellAmountReturn = FunctionReturn<typeof functions.calculateSellAmount>

export type CanGraduateParams = FunctionArguments<typeof functions.canGraduate>
export type CanGraduateReturn = FunctionReturn<typeof functions.canGraduate>

export type FactoryParams = FunctionArguments<typeof functions.factory>
export type FactoryReturn = FunctionReturn<typeof functions.factory>

export type GetBondingCurveStateParams = FunctionArguments<typeof functions.getBondingCurveState>
export type GetBondingCurveStateReturn = FunctionReturn<typeof functions.getBondingCurveState>

export type GetBondingCurveStateBatchParams = FunctionArguments<typeof functions.getBondingCurveStateBatch>
export type GetBondingCurveStateBatchReturn = FunctionReturn<typeof functions.getBondingCurveStateBatch>

export type GetClaimableRewardsParams = FunctionArguments<typeof functions.getClaimableRewards>
export type GetClaimableRewardsReturn = FunctionReturn<typeof functions.getClaimableRewards>

export type GetClaimableRewardsBatchParams = FunctionArguments<typeof functions.getClaimableRewardsBatch>
export type GetClaimableRewardsBatchReturn = FunctionReturn<typeof functions.getClaimableRewardsBatch>

export type GetCurrentPriceParams = FunctionArguments<typeof functions.getCurrentPrice>
export type GetCurrentPriceReturn = FunctionReturn<typeof functions.getCurrentPrice>

export type GetCurrentPricesBatchParams = FunctionArguments<typeof functions.getCurrentPricesBatch>
export type GetCurrentPricesBatchReturn = FunctionReturn<typeof functions.getCurrentPricesBatch>

export type GetGraduationProgressParams = FunctionArguments<typeof functions.getGraduationProgress>
export type GetGraduationProgressReturn = FunctionReturn<typeof functions.getGraduationProgress>

export type GetGraduationTimestampParams = FunctionArguments<typeof functions.getGraduationTimestamp>
export type GetGraduationTimestampReturn = FunctionReturn<typeof functions.getGraduationTimestamp>

export type GetMetadataParams = FunctionArguments<typeof functions.getMetadata>
export type GetMetadataReturn = FunctionReturn<typeof functions.getMetadata>

export type GetPairingConfigParams = FunctionArguments<typeof functions.getPairingConfig>
export type GetPairingConfigReturn = FunctionReturn<typeof functions.getPairingConfig>

export type GetPersonaBatchParams = FunctionArguments<typeof functions.getPersonaBatch>
export type GetPersonaBatchReturn = FunctionReturn<typeof functions.getPersonaBatch>

export type GetPreGraduationStateParams = FunctionArguments<typeof functions.getPreGraduationState>
export type GetPreGraduationStateReturn = FunctionReturn<typeof functions.getPreGraduationState>

export type GetTokenDistributionParams = FunctionArguments<typeof functions.getTokenDistribution>
export type GetTokenDistributionReturn = FunctionReturn<typeof functions.getTokenDistribution>

export type GetTotalAgentDepositedParams = FunctionArguments<typeof functions.getTotalAgentDeposited>
export type GetTotalAgentDepositedReturn = FunctionReturn<typeof functions.getTotalAgentDeposited>

export type GetUserAgentDepositParams = FunctionArguments<typeof functions.getUserAgentDeposit>
export type GetUserAgentDepositReturn = FunctionReturn<typeof functions.getUserAgentDeposit>

export type GetUserBondingBalanceParams = FunctionArguments<typeof functions.getUserBondingBalance>
export type GetUserBondingBalanceReturn = FunctionReturn<typeof functions.getUserBondingBalance>

export type GetUserBondingBalancesBatchParams = FunctionArguments<typeof functions.getUserBondingBalancesBatch>
export type GetUserBondingBalancesBatchReturn = FunctionReturn<typeof functions.getUserBondingBalancesBatch>

export type IsClaimAllowedParams = FunctionArguments<typeof functions.isClaimAllowed>
export type IsClaimAllowedReturn = FunctionReturn<typeof functions.isClaimAllowed>

export type IsPairingTokenEnabledParams = FunctionArguments<typeof functions.isPairingTokenEnabled>
export type IsPairingTokenEnabledReturn = FunctionReturn<typeof functions.isPairingTokenEnabled>

