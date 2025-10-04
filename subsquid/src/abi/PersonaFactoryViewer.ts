import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const functions = {
    calculateAgentRewards: viewFun("0x8d837eff", "calculateAgentRewards(uint256,address)", {"tokenId": p.uint256, "user": p.address}, {"personaReward": p.uint256, "agentAmount": p.uint256}),
    calculateBuyPriceImpact: viewFun("0xa0972d0b", "calculateBuyPriceImpact(uint256,uint256)", {"tokenId": p.uint256, "amountIn": p.uint256}, p.uint256),
    calculateSellPriceImpact: viewFun("0xcfdad396", "calculateSellPriceImpact(uint256,uint256)", {"tokenId": p.uint256, "amountIn": p.uint256}, p.uint256),
    canGraduate: viewFun("0x24a2fb98", "canGraduate(uint256)", {"tokenId": p.uint256}, {"eligible": p.bool, "reason": p.string}),
    factory: viewFun("0xc45a0155", "factory()", {}, p.address),
    getAmountOutForSellForUser: viewFun("0x2978a78e", "getAmountOutForSellForUser(uint256,uint256,address)", {"tokenId": p.uint256, "amountIn": p.uint256, "user": p.address}, p.uint256),
    getAmountOutForUser: viewFun("0xe4dbb8cb", "getAmountOutForUser(uint256,uint256,address)", {"tokenId": p.uint256, "amountIn": p.uint256, "user": p.address}, p.uint256),
    getFeeReductionConfig: viewFun("0x2396c95f", "getFeeReductionConfig()", {}, {"minAmicaForReduction": p.uint256, "maxAmicaForReduction": p.uint256, "minReductionMultiplier": p.uint256, "maxReductionMultiplier": p.uint256}),
    getGraduationProgress: viewFun("0x81b279d6", "getGraduationProgress(uint256)", {"tokenId": p.uint256}, {"currentDeposited": p.uint256, "thresholdRequired": p.uint256, "percentComplete": p.uint256, "currentAgentDeposited": p.uint256, "agentRequired": p.uint256}),
    getMetadata: viewFun("0x67e2274c", "getMetadata(uint256,string[])", {"tokenId": p.uint256, "keys": p.array(p.string)}, p.array(p.string)),
    getPairingConfig: viewFun("0xe258a455", "getPairingConfig(address)", {"token": p.address}, {"enabled": p.bool, "mintCost": p.uint256, "graduationThreshold": p.uint256}),
    getPersona: viewFun("0x14f9dc8b", "getPersona(uint256)", {"tokenId": p.uint256}, {"name": p.string, "symbol": p.string, "erc20Token": p.address, "pairToken": p.address, "pairCreated": p.bool, "createdAt": p.uint256, "minAgentTokens": p.uint256}),
    getPersonaBatch: viewFun("0x32afcfad", "getPersonaBatch(uint256[])", {"tokenIds": p.array(p.uint256)}, {"names": p.array(p.string), "erc20Tokens": p.array(p.address), "graduated": p.array(p.bool)}),
    getPersonaExtended: viewFun("0x097a3d67", "getPersonaExtended(uint256)", {"tokenId": p.uint256}, {"name": p.string, "symbol": p.string, "erc20Token": p.address, "pairToken": p.address, "agentToken": p.address, "pairCreated": p.bool, "createdAt": p.uint256, "totalAgentDeposited": p.uint256, "minAgentTokens": p.uint256}),
    getPurchaseInfo: viewFun("0x58875049", "getPurchaseInfo(uint256)", {"tokenId": p.uint256}, {"totalDeposited": p.uint256, "tokensSold": p.uint256, "availableTokens": p.uint256}),
    getPurchaseInfoBatch: viewFun("0xb8a6aeef", "getPurchaseInfoBatch(uint256[])", {"tokenIds": p.array(p.uint256)}, {"totalDeposited": p.array(p.uint256), "tokensSold": p.array(p.uint256), "availableTokens": p.array(p.uint256)}),
    getTokenDistribution: viewFun("0x40b869e5", "getTokenDistribution(uint256)", {"tokenId": p.uint256}, {"liquidityAmount": p.uint256, "bondingAmount": p.uint256, "amicaAmount": p.uint256, "agentRewardsAmount": p.uint256}),
    getUserAgentDeposit: viewFun("0xbc069632", "getUserAgentDeposit(uint256,address)", {"tokenId": p.uint256, "user": p.address}, p.uint256),
    getUserBalancesBatch: viewFun("0x26e362f7", "getUserBalancesBatch(uint256[],address)", {"tokenIds": p.array(p.uint256), "user": p.address}, p.array(p.uint256)),
    getUserFeeInfo: viewFun("0xf278d74b", "getUserFeeInfo(address)", {"user": p.address}, {"currentBalance": p.uint256, "snapshotBalance": p.uint256, "effectiveBalance": p.uint256, "snapshotBlock": p.uint256, "isEligible": p.bool, "blocksUntilEligible": p.uint256, "baseFeePercentage": p.uint256, "effectiveFeePercentage": p.uint256, "discountPercentage": p.uint256}),
    getUserPurchase: viewFun("0x04692d5f", "getUserPurchase(uint256,address)", {"tokenId": p.uint256, "user": p.address}, p.uint256),
    isPairingTokenEnabled: viewFun("0xbc5fccc7", "isPairingTokenEnabled(address)", {"token": p.address}, p.bool),
    previewBuyWithFee: viewFun("0x3acb26a1", "previewBuyWithFee(uint256,uint256,address)", {"tokenId": p.uint256, "amountIn": p.uint256, "user": p.address}, {"feeAmount": p.uint256, "amountInAfterFee": p.uint256, "expectedOutput": p.uint256}),
    previewSellWithFee: viewFun("0x7856dcc1", "previewSellWithFee(uint256,uint256,address)", {"tokenId": p.uint256, "amountIn": p.uint256, "user": p.address}, {"expectedOutput": p.uint256, "feeAmount": p.uint256, "amountOutAfterFee": p.uint256}),
    previewSwapWithFee: viewFun("0x3abd7acf", "previewSwapWithFee(uint256,uint256,address)", {"tokenId": p.uint256, "amountIn": p.uint256, "user": p.address}, {"feeAmount": p.uint256, "amountInAfterFee": p.uint256, "expectedOutput": p.uint256}),
}

export class Contract extends ContractBase {

    calculateAgentRewards(tokenId: CalculateAgentRewardsParams["tokenId"], user: CalculateAgentRewardsParams["user"]) {
        return this.eth_call(functions.calculateAgentRewards, {tokenId, user})
    }

    calculateBuyPriceImpact(tokenId: CalculateBuyPriceImpactParams["tokenId"], amountIn: CalculateBuyPriceImpactParams["amountIn"]) {
        return this.eth_call(functions.calculateBuyPriceImpact, {tokenId, amountIn})
    }

    calculateSellPriceImpact(tokenId: CalculateSellPriceImpactParams["tokenId"], amountIn: CalculateSellPriceImpactParams["amountIn"]) {
        return this.eth_call(functions.calculateSellPriceImpact, {tokenId, amountIn})
    }

    canGraduate(tokenId: CanGraduateParams["tokenId"]) {
        return this.eth_call(functions.canGraduate, {tokenId})
    }

    factory() {
        return this.eth_call(functions.factory, {})
    }

    getAmountOutForSellForUser(tokenId: GetAmountOutForSellForUserParams["tokenId"], amountIn: GetAmountOutForSellForUserParams["amountIn"], user: GetAmountOutForSellForUserParams["user"]) {
        return this.eth_call(functions.getAmountOutForSellForUser, {tokenId, amountIn, user})
    }

    getAmountOutForUser(tokenId: GetAmountOutForUserParams["tokenId"], amountIn: GetAmountOutForUserParams["amountIn"], user: GetAmountOutForUserParams["user"]) {
        return this.eth_call(functions.getAmountOutForUser, {tokenId, amountIn, user})
    }

    getFeeReductionConfig() {
        return this.eth_call(functions.getFeeReductionConfig, {})
    }

    getGraduationProgress(tokenId: GetGraduationProgressParams["tokenId"]) {
        return this.eth_call(functions.getGraduationProgress, {tokenId})
    }

    getMetadata(tokenId: GetMetadataParams["tokenId"], keys: GetMetadataParams["keys"]) {
        return this.eth_call(functions.getMetadata, {tokenId, keys})
    }

    getPairingConfig(token: GetPairingConfigParams["token"]) {
        return this.eth_call(functions.getPairingConfig, {token})
    }

    getPersona(tokenId: GetPersonaParams["tokenId"]) {
        return this.eth_call(functions.getPersona, {tokenId})
    }

    getPersonaBatch(tokenIds: GetPersonaBatchParams["tokenIds"]) {
        return this.eth_call(functions.getPersonaBatch, {tokenIds})
    }

    getPersonaExtended(tokenId: GetPersonaExtendedParams["tokenId"]) {
        return this.eth_call(functions.getPersonaExtended, {tokenId})
    }

    getPurchaseInfo(tokenId: GetPurchaseInfoParams["tokenId"]) {
        return this.eth_call(functions.getPurchaseInfo, {tokenId})
    }

    getPurchaseInfoBatch(tokenIds: GetPurchaseInfoBatchParams["tokenIds"]) {
        return this.eth_call(functions.getPurchaseInfoBatch, {tokenIds})
    }

    getTokenDistribution(tokenId: GetTokenDistributionParams["tokenId"]) {
        return this.eth_call(functions.getTokenDistribution, {tokenId})
    }

    getUserAgentDeposit(tokenId: GetUserAgentDepositParams["tokenId"], user: GetUserAgentDepositParams["user"]) {
        return this.eth_call(functions.getUserAgentDeposit, {tokenId, user})
    }

    getUserBalancesBatch(tokenIds: GetUserBalancesBatchParams["tokenIds"], user: GetUserBalancesBatchParams["user"]) {
        return this.eth_call(functions.getUserBalancesBatch, {tokenIds, user})
    }

    getUserFeeInfo(user: GetUserFeeInfoParams["user"]) {
        return this.eth_call(functions.getUserFeeInfo, {user})
    }

    getUserPurchase(tokenId: GetUserPurchaseParams["tokenId"], user: GetUserPurchaseParams["user"]) {
        return this.eth_call(functions.getUserPurchase, {tokenId, user})
    }

    isPairingTokenEnabled(token: IsPairingTokenEnabledParams["token"]) {
        return this.eth_call(functions.isPairingTokenEnabled, {token})
    }

    previewBuyWithFee(tokenId: PreviewBuyWithFeeParams["tokenId"], amountIn: PreviewBuyWithFeeParams["amountIn"], user: PreviewBuyWithFeeParams["user"]) {
        return this.eth_call(functions.previewBuyWithFee, {tokenId, amountIn, user})
    }

    previewSellWithFee(tokenId: PreviewSellWithFeeParams["tokenId"], amountIn: PreviewSellWithFeeParams["amountIn"], user: PreviewSellWithFeeParams["user"]) {
        return this.eth_call(functions.previewSellWithFee, {tokenId, amountIn, user})
    }

    previewSwapWithFee(tokenId: PreviewSwapWithFeeParams["tokenId"], amountIn: PreviewSwapWithFeeParams["amountIn"], user: PreviewSwapWithFeeParams["user"]) {
        return this.eth_call(functions.previewSwapWithFee, {tokenId, amountIn, user})
    }
}

/// Function types
export type CalculateAgentRewardsParams = FunctionArguments<typeof functions.calculateAgentRewards>
export type CalculateAgentRewardsReturn = FunctionReturn<typeof functions.calculateAgentRewards>

export type CalculateBuyPriceImpactParams = FunctionArguments<typeof functions.calculateBuyPriceImpact>
export type CalculateBuyPriceImpactReturn = FunctionReturn<typeof functions.calculateBuyPriceImpact>

export type CalculateSellPriceImpactParams = FunctionArguments<typeof functions.calculateSellPriceImpact>
export type CalculateSellPriceImpactReturn = FunctionReturn<typeof functions.calculateSellPriceImpact>

export type CanGraduateParams = FunctionArguments<typeof functions.canGraduate>
export type CanGraduateReturn = FunctionReturn<typeof functions.canGraduate>

export type FactoryParams = FunctionArguments<typeof functions.factory>
export type FactoryReturn = FunctionReturn<typeof functions.factory>

export type GetAmountOutForSellForUserParams = FunctionArguments<typeof functions.getAmountOutForSellForUser>
export type GetAmountOutForSellForUserReturn = FunctionReturn<typeof functions.getAmountOutForSellForUser>

export type GetAmountOutForUserParams = FunctionArguments<typeof functions.getAmountOutForUser>
export type GetAmountOutForUserReturn = FunctionReturn<typeof functions.getAmountOutForUser>

export type GetFeeReductionConfigParams = FunctionArguments<typeof functions.getFeeReductionConfig>
export type GetFeeReductionConfigReturn = FunctionReturn<typeof functions.getFeeReductionConfig>

export type GetGraduationProgressParams = FunctionArguments<typeof functions.getGraduationProgress>
export type GetGraduationProgressReturn = FunctionReturn<typeof functions.getGraduationProgress>

export type GetMetadataParams = FunctionArguments<typeof functions.getMetadata>
export type GetMetadataReturn = FunctionReturn<typeof functions.getMetadata>

export type GetPairingConfigParams = FunctionArguments<typeof functions.getPairingConfig>
export type GetPairingConfigReturn = FunctionReturn<typeof functions.getPairingConfig>

export type GetPersonaParams = FunctionArguments<typeof functions.getPersona>
export type GetPersonaReturn = FunctionReturn<typeof functions.getPersona>

export type GetPersonaBatchParams = FunctionArguments<typeof functions.getPersonaBatch>
export type GetPersonaBatchReturn = FunctionReturn<typeof functions.getPersonaBatch>

export type GetPersonaExtendedParams = FunctionArguments<typeof functions.getPersonaExtended>
export type GetPersonaExtendedReturn = FunctionReturn<typeof functions.getPersonaExtended>

export type GetPurchaseInfoParams = FunctionArguments<typeof functions.getPurchaseInfo>
export type GetPurchaseInfoReturn = FunctionReturn<typeof functions.getPurchaseInfo>

export type GetPurchaseInfoBatchParams = FunctionArguments<typeof functions.getPurchaseInfoBatch>
export type GetPurchaseInfoBatchReturn = FunctionReturn<typeof functions.getPurchaseInfoBatch>

export type GetTokenDistributionParams = FunctionArguments<typeof functions.getTokenDistribution>
export type GetTokenDistributionReturn = FunctionReturn<typeof functions.getTokenDistribution>

export type GetUserAgentDepositParams = FunctionArguments<typeof functions.getUserAgentDeposit>
export type GetUserAgentDepositReturn = FunctionReturn<typeof functions.getUserAgentDeposit>

export type GetUserBalancesBatchParams = FunctionArguments<typeof functions.getUserBalancesBatch>
export type GetUserBalancesBatchReturn = FunctionReturn<typeof functions.getUserBalancesBatch>

export type GetUserFeeInfoParams = FunctionArguments<typeof functions.getUserFeeInfo>
export type GetUserFeeInfoReturn = FunctionReturn<typeof functions.getUserFeeInfo>

export type GetUserPurchaseParams = FunctionArguments<typeof functions.getUserPurchase>
export type GetUserPurchaseReturn = FunctionReturn<typeof functions.getUserPurchase>

export type IsPairingTokenEnabledParams = FunctionArguments<typeof functions.isPairingTokenEnabled>
export type IsPairingTokenEnabledReturn = FunctionReturn<typeof functions.isPairingTokenEnabled>

export type PreviewBuyWithFeeParams = FunctionArguments<typeof functions.previewBuyWithFee>
export type PreviewBuyWithFeeReturn = FunctionReturn<typeof functions.previewBuyWithFee>

export type PreviewSellWithFeeParams = FunctionArguments<typeof functions.previewSellWithFee>
export type PreviewSellWithFeeReturn = FunctionReturn<typeof functions.previewSellWithFee>

export type PreviewSwapWithFeeParams = FunctionArguments<typeof functions.previewSwapWithFee>
export type PreviewSwapWithFeeReturn = FunctionReturn<typeof functions.previewSwapWithFee>

