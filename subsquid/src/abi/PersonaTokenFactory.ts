import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    AgentRewardsDistributed: event("0x4aa2bd79337992815870882383879dfd3324bea41d07cf5902d607e86c7b553f", "AgentRewardsDistributed(uint256,address,uint256,uint256)", {"tokenId": indexed(p.uint256), "recipient": indexed(p.address), "personaTokens": p.uint256, "agentShare": p.uint256}),
    AgentTokenAssociated: event("0x998080a81a66962becc86e7ea090fbb3e8115c73382c333481914dd98a2f59d9", "AgentTokenAssociated(uint256,address)", {"tokenId": indexed(p.uint256), "agentToken": indexed(p.address)}),
    AgentTokensDeposited: event("0x5036390d0bebc15295151328dd3df2fbed9e2d5cf727db37686a4000ec9d9699", "AgentTokensDeposited(uint256,address,uint256)", {"tokenId": indexed(p.uint256), "depositor": indexed(p.address), "amount": p.uint256}),
    AgentTokensWithdrawn: event("0xf3a47482e1a027d56c27fbd908b75cf1bd6ed781f7a0806a41f3d42434f19295", "AgentTokensWithdrawn(uint256,address,uint256)", {"tokenId": indexed(p.uint256), "depositor": indexed(p.address), "amount": p.uint256}),
    Approval: event("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925", "Approval(address,address,uint256)", {"owner": indexed(p.address), "approved": indexed(p.address), "tokenId": indexed(p.uint256)}),
    ApprovalForAll: event("0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31", "ApprovalForAll(address,address,bool)", {"owner": indexed(p.address), "operator": indexed(p.address), "approved": p.bool}),
    FeeReductionConfigUpdated: event("0xa2daa4a4edc8ee9df2db1806dda140b8d558879efd1e633021fdcabbf68d7838", "FeeReductionConfigUpdated(uint256,uint256,uint256,uint256)", {"minAmicaForReduction": p.uint256, "maxAmicaForReduction": p.uint256, "minReductionMultiplier": p.uint256, "maxReductionMultiplier": p.uint256}),
    Initialized: event("0xc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d2", "Initialized(uint64)", {"version": p.uint64}),
    LiquidityPairCreated: event("0x52a26a811ff75dad481e2e01479da2ac637ea661cc5c47ea5499e052bacc1a7d", "LiquidityPairCreated(uint256,address,uint256)", {"tokenId": indexed(p.uint256), "pair": indexed(p.address), "liquidity": p.uint256}),
    MetadataUpdated: event("0x459157ba24c7ab9878b165ef465fa6ae2ab42bcd8445f576be378768b0c47309", "MetadataUpdated(uint256,string)", {"tokenId": indexed(p.uint256), "key": indexed(p.string)}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    PairingConfigUpdated: event("0x3ef415ddef109a4c74a41439b8ff2815fb076ddae4762ad6b0a116ba1f4d64db", "PairingConfigUpdated(address)", {"token": indexed(p.address)}),
    Paused: event("0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258", "Paused(address)", {"account": p.address}),
    PersonaCreated: event("0x0d72c49b46492a26bd6fb8cc2036ef682bed420242c654743e7959ed3e41c92d", "PersonaCreated(uint256,address,address,string,string)", {"tokenId": indexed(p.uint256), "creator": indexed(p.address), "erc20Token": indexed(p.address), "name": p.string, "symbol": p.string}),
    SnapshotUpdated: event("0x749a895977946fbb427a7c3da0a86bf47a5d5a6046dcea26f5e23321fdb244be", "SnapshotUpdated(address,uint256,uint256)", {"user": indexed(p.address), "snapshotBalance": p.uint256, "blockNumber": p.uint256}),
    StakingRewardsSet: event("0xb63c81227c62f4cb3e2b1120e3afbf3a2ed5dd8b9d99b8bef7275b084e6a98cb", "StakingRewardsSet(address)", {"stakingRewards": indexed(p.address)}),
    TokensPurchased: event("0xe8d7e55108ae7ddb60173461d2950c7a8e22a7ac7f442825564fe84c8c6f9a38", "TokensPurchased(uint256,address,uint256,uint256)", {"tokenId": indexed(p.uint256), "buyer": indexed(p.address), "amountSpent": p.uint256, "tokensReceived": p.uint256}),
    TokensWithdrawn: event("0x3f5fbaf86658fdadee77f1d46e7f8a72424ad9839eda6a1dc6eb0a4228e4226e", "TokensWithdrawn(uint256,address,uint256)", {"tokenId": indexed(p.uint256), "user": indexed(p.address), "amount": p.uint256}),
    TradingFeeConfigUpdated: event("0xdbb509c9ebd3dc30f12604975cc125e88ea366056597246c0bc2c6775a90ba95", "TradingFeeConfigUpdated(uint256,uint256)", {"feePercentage": p.uint256, "creatorShare": p.uint256}),
    TradingFeesCollected: event("0x7682d218ad02c986ad8f6cb008444fb0206a3ff6017e45caeddecfdba3506e7e", "TradingFeesCollected(uint256,uint256,uint256,uint256)", {"tokenId": indexed(p.uint256), "totalFees": p.uint256, "creatorFees": p.uint256, "amicaFees": p.uint256}),
    Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "Transfer(address,address,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "tokenId": indexed(p.uint256)}),
    Unpaused: event("0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa", "Unpaused(address)", {"account": p.address}),
}

export const functions = {
    AGENT_AMICA_AMOUNT: viewFun("0x3d147991", "AGENT_AMICA_AMOUNT()", {}, p.uint256),
    AGENT_BONDING_AMOUNT: viewFun("0xfedb35b1", "AGENT_BONDING_AMOUNT()", {}, p.uint256),
    AGENT_LIQUIDITY_AMOUNT: viewFun("0x2134686a", "AGENT_LIQUIDITY_AMOUNT()", {}, p.uint256),
    AGENT_REWARDS_AMOUNT: viewFun("0x70f245ad", "AGENT_REWARDS_AMOUNT()", {}, p.uint256),
    PERSONA_TOKEN_SUPPLY: viewFun("0xcfb5c81e", "PERSONA_TOKEN_SUPPLY()", {}, p.uint256),
    SNAPSHOT_DELAY: viewFun("0xabb95227", "SNAPSHOT_DELAY()", {}, p.uint256),
    STANDARD_AMICA_AMOUNT: viewFun("0x29c8ac8a", "STANDARD_AMICA_AMOUNT()", {}, p.uint256),
    STANDARD_BONDING_AMOUNT: viewFun("0xa5f9b7e3", "STANDARD_BONDING_AMOUNT()", {}, p.uint256),
    STANDARD_LIQUIDITY_AMOUNT: viewFun("0x5db01e9b", "STANDARD_LIQUIDITY_AMOUNT()", {}, p.uint256),
    agentDeposits: viewFun("0xbcf2f19e", "agentDeposits(uint256,address,uint256)", {"_0": p.uint256, "_1": p.address, "_2": p.uint256}, {"amount": p.uint256, "timestamp": p.uint256, "withdrawn": p.bool}),
    amicaBalanceSnapshot: viewFun("0x86295e4e", "amicaBalanceSnapshot(address)", {"user": p.address}, p.uint256),
    amicaToken: viewFun("0xa04e401a", "amicaToken()", {}, p.address),
    approve: fun("0x095ea7b3", "approve(address,uint256)", {"to": p.address, "tokenId": p.uint256}, ),
    approveAgentToken: fun("0xb086d49e", "approveAgentToken(address,bool)", {"token": p.address, "approved": p.bool}, ),
    approvedAgentTokens: viewFun("0x20e20697", "approvedAgentTokens(address)", {"_0": p.address}, p.bool),
    balanceOf: viewFun("0x70a08231", "balanceOf(address)", {"owner": p.address}, p.uint256),
    calculateAgentRewards: viewFun("0x8d837eff", "calculateAgentRewards(uint256,address)", {"tokenId": p.uint256, "user": p.address}, {"personaReward": p.uint256, "agentAmount": p.uint256}),
    calculateAmountOut: viewFun("0x86935aa8", "calculateAmountOut(uint256,uint256,uint256)", {"amountIn": p.uint256, "reserveSold": p.uint256, "reserveTotal": p.uint256}, p.uint256),
    canGraduate: viewFun("0x24a2fb98", "canGraduate(uint256)", {"tokenId": p.uint256}, {"eligible": p.bool, "reason": p.string}),
    claimAgentRewards: fun("0xa70e3269", "claimAgentRewards(uint256)", {"tokenId": p.uint256}, ),
    configureFeeReduction: fun("0x6e7764f5", "configureFeeReduction(uint256,uint256,uint256,uint256)", {"minAmicaForReduction": p.uint256, "maxAmicaForReduction": p.uint256, "minReductionMultiplier": p.uint256, "maxReductionMultiplier": p.uint256}, ),
    configurePairingToken: fun("0x4bad2577", "configurePairingToken(address,uint256,uint256)", {"token": p.address, "mintCost": p.uint256, "graduationThreshold": p.uint256}, ),
    configureTradingFees: fun("0x28932082", "configureTradingFees(uint256,uint256)", {"feePercentage": p.uint256, "creatorShare": p.uint256}, ),
    createPersona: fun("0x1f0171c6", "createPersona(address,string,string,string[],string[],uint256,address,uint256)", {"pairingToken": p.address, "name": p.string, "symbol": p.string, "metadataKeys": p.array(p.string), "metadataValues": p.array(p.string), "initialBuyAmount": p.uint256, "agentToken": p.address, "minAgentTokens": p.uint256}, p.uint256),
    depositAgentTokens: fun("0xc24f88e3", "depositAgentTokens(uint256,uint256)", {"tokenId": p.uint256, "amount": p.uint256}, ),
    disablePairingToken: fun("0xd0537740", "disablePairingToken(address)", {"token": p.address}, ),
    erc20Implementation: viewFun("0x901be041", "erc20Implementation()", {}, p.address),
    feeReductionConfig: viewFun("0x1910a5e6", "feeReductionConfig()", {}, {"minAmicaForReduction": p.uint256, "maxAmicaForReduction": p.uint256, "minReductionMultiplier": p.uint256, "maxReductionMultiplier": p.uint256}),
    getAmountOut: viewFun("0x7cabb7cf", "getAmountOut(uint256,uint256)", {"tokenId": p.uint256, "amountIn": p.uint256}, p.uint256),
    getAmountOutForUser: viewFun("0xe4dbb8cb", "getAmountOutForUser(uint256,uint256,address)", {"tokenId": p.uint256, "amountIn": p.uint256, "user": p.address}, p.uint256),
    getApproved: viewFun("0x081812fc", "getApproved(uint256)", {"tokenId": p.uint256}, p.address),
    getAvailableTokens: viewFun("0x9187cb03", "getAvailableTokens(uint256)", {"tokenId": p.uint256}, p.uint256),
    getEffectiveAmicaBalance: viewFun("0xf829389b", "getEffectiveAmicaBalance(address)", {"user": p.address}, p.uint256),
    getEffectiveFeePercentage: viewFun("0x3878e905", "getEffectiveFeePercentage(address)", {"user": p.address}, p.uint256),
    getMetadata: viewFun("0x67e2274c", "getMetadata(uint256,string[])", {"tokenId": p.uint256, "keys": p.array(p.string)}, p.array(p.string)),
    getPersona: viewFun("0x14f9dc8b", "getPersona(uint256)", {"tokenId": p.uint256}, {"name": p.string, "symbol": p.string, "erc20Token": p.address, "pairToken": p.address, "pairCreated": p.bool, "createdAt": p.uint256, "minAgentTokens": p.uint256}),
    getTokenDistribution: viewFun("0x40b869e5", "getTokenDistribution(uint256)", {"tokenId": p.uint256}, {"liquidityAmount": p.uint256, "bondingAmount": p.uint256, "amicaAmount": p.uint256, "agentRewardsAmount": p.uint256}),
    getUserAgentDeposits: viewFun("0xb6589df9", "getUserAgentDeposits(uint256,address)", {"tokenId": p.uint256, "user": p.address}, p.array(p.struct({"amount": p.uint256, "timestamp": p.uint256, "withdrawn": p.bool}))),
    getUserFeeInfo: viewFun("0xf278d74b", "getUserFeeInfo(address)", {"user": p.address}, {"currentBalance": p.uint256, "snapshotBalance": p.uint256, "effectiveBalance": p.uint256, "snapshotBlock_": p.uint256, "isEligible": p.bool, "blocksUntilEligible": p.uint256, "baseFeePercentage": p.uint256, "effectiveFeePercentage": p.uint256, "discountPercentage": p.uint256}),
    getUserPurchases: viewFun("0x0939e918", "getUserPurchases(uint256,address)", {"tokenId": p.uint256, "user": p.address}, p.array(p.struct({"amount": p.uint256, "timestamp": p.uint256, "withdrawn": p.bool}))),
    initialize: fun("0xf8c8765e", "initialize(address,address,address,address)", {"amicaToken_": p.address, "uniswapFactory_": p.address, "uniswapRouter_": p.address, "erc20Implementation_": p.address}, ),
    isApprovedForAll: viewFun("0xe985e9c5", "isApprovedForAll(address,address)", {"owner": p.address, "operator": p.address}, p.bool),
    name: viewFun("0x06fdde03", "name()", {}, p.string),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    ownerOf: viewFun("0x6352211e", "ownerOf(uint256)", {"tokenId": p.uint256}, p.address),
    pairingConfigs: viewFun("0x2330cb31", "pairingConfigs(address)", {"_0": p.address}, {"enabled": p.bool, "mintCost": p.uint256, "graduationThreshold": p.uint256}),
    pause: fun("0x8456cb59", "pause()", {}, ),
    paused: viewFun("0x5c975abb", "paused()", {}, p.bool),
    personas: viewFun("0x40291e6a", "personas(uint256)", {"_0": p.uint256}, {"name": p.string, "symbol": p.string, "erc20Token": p.address, "pairToken": p.address, "agentToken": p.address, "pairCreated": p.bool, "createdAt": p.uint256, "totalAgentDeposited": p.uint256, "minAgentTokens": p.uint256}),
    previewSwapWithFee: viewFun("0x3abd7acf", "previewSwapWithFee(uint256,uint256,address)", {"tokenId": p.uint256, "amountIn": p.uint256, "user": p.address}, {"feeAmount": p.uint256, "amountInAfterFee": p.uint256, "expectedOutput": p.uint256}),
    purchases: viewFun("0x8392fe31", "purchases(uint256)", {"_0": p.uint256}, {"totalDeposited": p.uint256, "tokensSold": p.uint256}),
    renounceOwnership: fun("0x715018a6", "renounceOwnership()", {}, ),
    'safeTransferFrom(address,address,uint256)': fun("0x42842e0e", "safeTransferFrom(address,address,uint256)", {"from": p.address, "to": p.address, "tokenId": p.uint256}, ),
    'safeTransferFrom(address,address,uint256,bytes)': fun("0xb88d4fde", "safeTransferFrom(address,address,uint256,bytes)", {"from": p.address, "to": p.address, "tokenId": p.uint256, "data": p.bytes}, ),
    setApprovalForAll: fun("0xa22cb465", "setApprovalForAll(address,bool)", {"operator": p.address, "approved": p.bool}, ),
    setStakingRewards: fun("0x6fb83a57", "setStakingRewards(address)", {"_stakingRewards": p.address}, ),
    snapshotBlock: viewFun("0x6fde3a3e", "snapshotBlock(address)", {"user": p.address}, p.uint256),
    stakingRewards: viewFun("0x64b87a70", "stakingRewards()", {}, p.address),
    supportsInterface: viewFun("0x01ffc9a7", "supportsInterface(bytes4)", {"interfaceId": p.bytes4}, p.bool),
    swapExactTokensForTokens: fun("0xa936da68", "swapExactTokensForTokens(uint256,uint256,uint256,address,uint256)", {"tokenId": p.uint256, "amountIn": p.uint256, "amountOutMin": p.uint256, "to": p.address, "deadline": p.uint256}, p.uint256),
    symbol: viewFun("0x95d89b41", "symbol()", {}, p.string),
    tokenURI: viewFun("0xc87b56dd", "tokenURI(uint256)", {"tokenId": p.uint256}, p.string),
    tradingFeeConfig: viewFun("0xdf59ce0e", "tradingFeeConfig()", {}, {"feePercentage": p.uint256, "creatorShare": p.uint256}),
    transferFrom: fun("0x23b872dd", "transferFrom(address,address,uint256)", {"from": p.address, "to": p.address, "tokenId": p.uint256}, ),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    uniswapFactory: viewFun("0x8bdb2afa", "uniswapFactory()", {}, p.address),
    uniswapRouter: viewFun("0x735de9f7", "uniswapRouter()", {}, p.address),
    unpause: fun("0x3f4ba83a", "unpause()", {}, ),
    updateAmicaSnapshot: fun("0x121e2de6", "updateAmicaSnapshot()", {}, ),
    updateMetadata: fun("0xcaf54ab1", "updateMetadata(uint256,string[],string[])", {"tokenId": p.uint256, "keys": p.array(p.string), "values": p.array(p.string)}, ),
    userSnapshots: viewFun("0xc8a37bf1", "userSnapshots(address)", {"_0": p.address}, {"currentBalance": p.uint256, "currentBlock": p.uint256, "pendingBalance": p.uint256, "pendingBlock": p.uint256}),
    userpurchases: viewFun("0x7cc56ea5", "userpurchases(uint256,address,uint256)", {"_0": p.uint256, "_1": p.address, "_2": p.uint256}, {"amount": p.uint256, "timestamp": p.uint256, "withdrawn": p.bool}),
    withdrawAgentTokens: fun("0x6e1b4fce", "withdrawAgentTokens(uint256)", {"tokenId": p.uint256}, ),
    withdrawTokens: fun("0x315a095d", "withdrawTokens(uint256)", {"tokenId": p.uint256}, ),
}

export class Contract extends ContractBase {

    AGENT_AMICA_AMOUNT() {
        return this.eth_call(functions.AGENT_AMICA_AMOUNT, {})
    }

    AGENT_BONDING_AMOUNT() {
        return this.eth_call(functions.AGENT_BONDING_AMOUNT, {})
    }

    AGENT_LIQUIDITY_AMOUNT() {
        return this.eth_call(functions.AGENT_LIQUIDITY_AMOUNT, {})
    }

    AGENT_REWARDS_AMOUNT() {
        return this.eth_call(functions.AGENT_REWARDS_AMOUNT, {})
    }

    PERSONA_TOKEN_SUPPLY() {
        return this.eth_call(functions.PERSONA_TOKEN_SUPPLY, {})
    }

    SNAPSHOT_DELAY() {
        return this.eth_call(functions.SNAPSHOT_DELAY, {})
    }

    STANDARD_AMICA_AMOUNT() {
        return this.eth_call(functions.STANDARD_AMICA_AMOUNT, {})
    }

    STANDARD_BONDING_AMOUNT() {
        return this.eth_call(functions.STANDARD_BONDING_AMOUNT, {})
    }

    STANDARD_LIQUIDITY_AMOUNT() {
        return this.eth_call(functions.STANDARD_LIQUIDITY_AMOUNT, {})
    }

    agentDeposits(_0: AgentDepositsParams["_0"], _1: AgentDepositsParams["_1"], _2: AgentDepositsParams["_2"]) {
        return this.eth_call(functions.agentDeposits, {_0, _1, _2})
    }

    amicaBalanceSnapshot(user: AmicaBalanceSnapshotParams["user"]) {
        return this.eth_call(functions.amicaBalanceSnapshot, {user})
    }

    amicaToken() {
        return this.eth_call(functions.amicaToken, {})
    }

    approvedAgentTokens(_0: ApprovedAgentTokensParams["_0"]) {
        return this.eth_call(functions.approvedAgentTokens, {_0})
    }

    balanceOf(owner: BalanceOfParams["owner"]) {
        return this.eth_call(functions.balanceOf, {owner})
    }

    calculateAgentRewards(tokenId: CalculateAgentRewardsParams["tokenId"], user: CalculateAgentRewardsParams["user"]) {
        return this.eth_call(functions.calculateAgentRewards, {tokenId, user})
    }

    calculateAmountOut(amountIn: CalculateAmountOutParams["amountIn"], reserveSold: CalculateAmountOutParams["reserveSold"], reserveTotal: CalculateAmountOutParams["reserveTotal"]) {
        return this.eth_call(functions.calculateAmountOut, {amountIn, reserveSold, reserveTotal})
    }

    canGraduate(tokenId: CanGraduateParams["tokenId"]) {
        return this.eth_call(functions.canGraduate, {tokenId})
    }

    erc20Implementation() {
        return this.eth_call(functions.erc20Implementation, {})
    }

    feeReductionConfig() {
        return this.eth_call(functions.feeReductionConfig, {})
    }

    getAmountOut(tokenId: GetAmountOutParams["tokenId"], amountIn: GetAmountOutParams["amountIn"]) {
        return this.eth_call(functions.getAmountOut, {tokenId, amountIn})
    }

    getAmountOutForUser(tokenId: GetAmountOutForUserParams["tokenId"], amountIn: GetAmountOutForUserParams["amountIn"], user: GetAmountOutForUserParams["user"]) {
        return this.eth_call(functions.getAmountOutForUser, {tokenId, amountIn, user})
    }

    getApproved(tokenId: GetApprovedParams["tokenId"]) {
        return this.eth_call(functions.getApproved, {tokenId})
    }

    getAvailableTokens(tokenId: GetAvailableTokensParams["tokenId"]) {
        return this.eth_call(functions.getAvailableTokens, {tokenId})
    }

    getEffectiveAmicaBalance(user: GetEffectiveAmicaBalanceParams["user"]) {
        return this.eth_call(functions.getEffectiveAmicaBalance, {user})
    }

    getEffectiveFeePercentage(user: GetEffectiveFeePercentageParams["user"]) {
        return this.eth_call(functions.getEffectiveFeePercentage, {user})
    }

    getMetadata(tokenId: GetMetadataParams["tokenId"], keys: GetMetadataParams["keys"]) {
        return this.eth_call(functions.getMetadata, {tokenId, keys})
    }

    getPersona(tokenId: GetPersonaParams["tokenId"]) {
        return this.eth_call(functions.getPersona, {tokenId})
    }

    getTokenDistribution(tokenId: GetTokenDistributionParams["tokenId"]) {
        return this.eth_call(functions.getTokenDistribution, {tokenId})
    }

    getUserAgentDeposits(tokenId: GetUserAgentDepositsParams["tokenId"], user: GetUserAgentDepositsParams["user"]) {
        return this.eth_call(functions.getUserAgentDeposits, {tokenId, user})
    }

    getUserFeeInfo(user: GetUserFeeInfoParams["user"]) {
        return this.eth_call(functions.getUserFeeInfo, {user})
    }

    getUserPurchases(tokenId: GetUserPurchasesParams["tokenId"], user: GetUserPurchasesParams["user"]) {
        return this.eth_call(functions.getUserPurchases, {tokenId, user})
    }

    isApprovedForAll(owner: IsApprovedForAllParams["owner"], operator: IsApprovedForAllParams["operator"]) {
        return this.eth_call(functions.isApprovedForAll, {owner, operator})
    }

    name() {
        return this.eth_call(functions.name, {})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    ownerOf(tokenId: OwnerOfParams["tokenId"]) {
        return this.eth_call(functions.ownerOf, {tokenId})
    }

    pairingConfigs(_0: PairingConfigsParams["_0"]) {
        return this.eth_call(functions.pairingConfigs, {_0})
    }

    paused() {
        return this.eth_call(functions.paused, {})
    }

    personas(_0: PersonasParams["_0"]) {
        return this.eth_call(functions.personas, {_0})
    }

    previewSwapWithFee(tokenId: PreviewSwapWithFeeParams["tokenId"], amountIn: PreviewSwapWithFeeParams["amountIn"], user: PreviewSwapWithFeeParams["user"]) {
        return this.eth_call(functions.previewSwapWithFee, {tokenId, amountIn, user})
    }

    purchases(_0: PurchasesParams["_0"]) {
        return this.eth_call(functions.purchases, {_0})
    }

    snapshotBlock(user: SnapshotBlockParams["user"]) {
        return this.eth_call(functions.snapshotBlock, {user})
    }

    stakingRewards() {
        return this.eth_call(functions.stakingRewards, {})
    }

    supportsInterface(interfaceId: SupportsInterfaceParams["interfaceId"]) {
        return this.eth_call(functions.supportsInterface, {interfaceId})
    }

    symbol() {
        return this.eth_call(functions.symbol, {})
    }

    tokenURI(tokenId: TokenURIParams["tokenId"]) {
        return this.eth_call(functions.tokenURI, {tokenId})
    }

    tradingFeeConfig() {
        return this.eth_call(functions.tradingFeeConfig, {})
    }

    uniswapFactory() {
        return this.eth_call(functions.uniswapFactory, {})
    }

    uniswapRouter() {
        return this.eth_call(functions.uniswapRouter, {})
    }

    userSnapshots(_0: UserSnapshotsParams["_0"]) {
        return this.eth_call(functions.userSnapshots, {_0})
    }

    userpurchases(_0: UserpurchasesParams["_0"], _1: UserpurchasesParams["_1"], _2: UserpurchasesParams["_2"]) {
        return this.eth_call(functions.userpurchases, {_0, _1, _2})
    }
}

/// Event types
export type AgentRewardsDistributedEventArgs = EParams<typeof events.AgentRewardsDistributed>
export type AgentTokenAssociatedEventArgs = EParams<typeof events.AgentTokenAssociated>
export type AgentTokensDepositedEventArgs = EParams<typeof events.AgentTokensDeposited>
export type AgentTokensWithdrawnEventArgs = EParams<typeof events.AgentTokensWithdrawn>
export type ApprovalEventArgs = EParams<typeof events.Approval>
export type ApprovalForAllEventArgs = EParams<typeof events.ApprovalForAll>
export type FeeReductionConfigUpdatedEventArgs = EParams<typeof events.FeeReductionConfigUpdated>
export type InitializedEventArgs = EParams<typeof events.Initialized>
export type LiquidityPairCreatedEventArgs = EParams<typeof events.LiquidityPairCreated>
export type MetadataUpdatedEventArgs = EParams<typeof events.MetadataUpdated>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type PairingConfigUpdatedEventArgs = EParams<typeof events.PairingConfigUpdated>
export type PausedEventArgs = EParams<typeof events.Paused>
export type PersonaCreatedEventArgs = EParams<typeof events.PersonaCreated>
export type SnapshotUpdatedEventArgs = EParams<typeof events.SnapshotUpdated>
export type StakingRewardsSetEventArgs = EParams<typeof events.StakingRewardsSet>
export type TokensPurchasedEventArgs = EParams<typeof events.TokensPurchased>
export type TokensWithdrawnEventArgs = EParams<typeof events.TokensWithdrawn>
export type TradingFeeConfigUpdatedEventArgs = EParams<typeof events.TradingFeeConfigUpdated>
export type TradingFeesCollectedEventArgs = EParams<typeof events.TradingFeesCollected>
export type TransferEventArgs = EParams<typeof events.Transfer>
export type UnpausedEventArgs = EParams<typeof events.Unpaused>

/// Function types
export type AGENT_AMICA_AMOUNTParams = FunctionArguments<typeof functions.AGENT_AMICA_AMOUNT>
export type AGENT_AMICA_AMOUNTReturn = FunctionReturn<typeof functions.AGENT_AMICA_AMOUNT>

export type AGENT_BONDING_AMOUNTParams = FunctionArguments<typeof functions.AGENT_BONDING_AMOUNT>
export type AGENT_BONDING_AMOUNTReturn = FunctionReturn<typeof functions.AGENT_BONDING_AMOUNT>

export type AGENT_LIQUIDITY_AMOUNTParams = FunctionArguments<typeof functions.AGENT_LIQUIDITY_AMOUNT>
export type AGENT_LIQUIDITY_AMOUNTReturn = FunctionReturn<typeof functions.AGENT_LIQUIDITY_AMOUNT>

export type AGENT_REWARDS_AMOUNTParams = FunctionArguments<typeof functions.AGENT_REWARDS_AMOUNT>
export type AGENT_REWARDS_AMOUNTReturn = FunctionReturn<typeof functions.AGENT_REWARDS_AMOUNT>

export type PERSONA_TOKEN_SUPPLYParams = FunctionArguments<typeof functions.PERSONA_TOKEN_SUPPLY>
export type PERSONA_TOKEN_SUPPLYReturn = FunctionReturn<typeof functions.PERSONA_TOKEN_SUPPLY>

export type SNAPSHOT_DELAYParams = FunctionArguments<typeof functions.SNAPSHOT_DELAY>
export type SNAPSHOT_DELAYReturn = FunctionReturn<typeof functions.SNAPSHOT_DELAY>

export type STANDARD_AMICA_AMOUNTParams = FunctionArguments<typeof functions.STANDARD_AMICA_AMOUNT>
export type STANDARD_AMICA_AMOUNTReturn = FunctionReturn<typeof functions.STANDARD_AMICA_AMOUNT>

export type STANDARD_BONDING_AMOUNTParams = FunctionArguments<typeof functions.STANDARD_BONDING_AMOUNT>
export type STANDARD_BONDING_AMOUNTReturn = FunctionReturn<typeof functions.STANDARD_BONDING_AMOUNT>

export type STANDARD_LIQUIDITY_AMOUNTParams = FunctionArguments<typeof functions.STANDARD_LIQUIDITY_AMOUNT>
export type STANDARD_LIQUIDITY_AMOUNTReturn = FunctionReturn<typeof functions.STANDARD_LIQUIDITY_AMOUNT>

export type AgentDepositsParams = FunctionArguments<typeof functions.agentDeposits>
export type AgentDepositsReturn = FunctionReturn<typeof functions.agentDeposits>

export type AmicaBalanceSnapshotParams = FunctionArguments<typeof functions.amicaBalanceSnapshot>
export type AmicaBalanceSnapshotReturn = FunctionReturn<typeof functions.amicaBalanceSnapshot>

export type AmicaTokenParams = FunctionArguments<typeof functions.amicaToken>
export type AmicaTokenReturn = FunctionReturn<typeof functions.amicaToken>

export type ApproveParams = FunctionArguments<typeof functions.approve>
export type ApproveReturn = FunctionReturn<typeof functions.approve>

export type ApproveAgentTokenParams = FunctionArguments<typeof functions.approveAgentToken>
export type ApproveAgentTokenReturn = FunctionReturn<typeof functions.approveAgentToken>

export type ApprovedAgentTokensParams = FunctionArguments<typeof functions.approvedAgentTokens>
export type ApprovedAgentTokensReturn = FunctionReturn<typeof functions.approvedAgentTokens>

export type BalanceOfParams = FunctionArguments<typeof functions.balanceOf>
export type BalanceOfReturn = FunctionReturn<typeof functions.balanceOf>

export type CalculateAgentRewardsParams = FunctionArguments<typeof functions.calculateAgentRewards>
export type CalculateAgentRewardsReturn = FunctionReturn<typeof functions.calculateAgentRewards>

export type CalculateAmountOutParams = FunctionArguments<typeof functions.calculateAmountOut>
export type CalculateAmountOutReturn = FunctionReturn<typeof functions.calculateAmountOut>

export type CanGraduateParams = FunctionArguments<typeof functions.canGraduate>
export type CanGraduateReturn = FunctionReturn<typeof functions.canGraduate>

export type ClaimAgentRewardsParams = FunctionArguments<typeof functions.claimAgentRewards>
export type ClaimAgentRewardsReturn = FunctionReturn<typeof functions.claimAgentRewards>

export type ConfigureFeeReductionParams = FunctionArguments<typeof functions.configureFeeReduction>
export type ConfigureFeeReductionReturn = FunctionReturn<typeof functions.configureFeeReduction>

export type ConfigurePairingTokenParams = FunctionArguments<typeof functions.configurePairingToken>
export type ConfigurePairingTokenReturn = FunctionReturn<typeof functions.configurePairingToken>

export type ConfigureTradingFeesParams = FunctionArguments<typeof functions.configureTradingFees>
export type ConfigureTradingFeesReturn = FunctionReturn<typeof functions.configureTradingFees>

export type CreatePersonaParams = FunctionArguments<typeof functions.createPersona>
export type CreatePersonaReturn = FunctionReturn<typeof functions.createPersona>

export type DepositAgentTokensParams = FunctionArguments<typeof functions.depositAgentTokens>
export type DepositAgentTokensReturn = FunctionReturn<typeof functions.depositAgentTokens>

export type DisablePairingTokenParams = FunctionArguments<typeof functions.disablePairingToken>
export type DisablePairingTokenReturn = FunctionReturn<typeof functions.disablePairingToken>

export type Erc20ImplementationParams = FunctionArguments<typeof functions.erc20Implementation>
export type Erc20ImplementationReturn = FunctionReturn<typeof functions.erc20Implementation>

export type FeeReductionConfigParams = FunctionArguments<typeof functions.feeReductionConfig>
export type FeeReductionConfigReturn = FunctionReturn<typeof functions.feeReductionConfig>

export type GetAmountOutParams = FunctionArguments<typeof functions.getAmountOut>
export type GetAmountOutReturn = FunctionReturn<typeof functions.getAmountOut>

export type GetAmountOutForUserParams = FunctionArguments<typeof functions.getAmountOutForUser>
export type GetAmountOutForUserReturn = FunctionReturn<typeof functions.getAmountOutForUser>

export type GetApprovedParams = FunctionArguments<typeof functions.getApproved>
export type GetApprovedReturn = FunctionReturn<typeof functions.getApproved>

export type GetAvailableTokensParams = FunctionArguments<typeof functions.getAvailableTokens>
export type GetAvailableTokensReturn = FunctionReturn<typeof functions.getAvailableTokens>

export type GetEffectiveAmicaBalanceParams = FunctionArguments<typeof functions.getEffectiveAmicaBalance>
export type GetEffectiveAmicaBalanceReturn = FunctionReturn<typeof functions.getEffectiveAmicaBalance>

export type GetEffectiveFeePercentageParams = FunctionArguments<typeof functions.getEffectiveFeePercentage>
export type GetEffectiveFeePercentageReturn = FunctionReturn<typeof functions.getEffectiveFeePercentage>

export type GetMetadataParams = FunctionArguments<typeof functions.getMetadata>
export type GetMetadataReturn = FunctionReturn<typeof functions.getMetadata>

export type GetPersonaParams = FunctionArguments<typeof functions.getPersona>
export type GetPersonaReturn = FunctionReturn<typeof functions.getPersona>

export type GetTokenDistributionParams = FunctionArguments<typeof functions.getTokenDistribution>
export type GetTokenDistributionReturn = FunctionReturn<typeof functions.getTokenDistribution>

export type GetUserAgentDepositsParams = FunctionArguments<typeof functions.getUserAgentDeposits>
export type GetUserAgentDepositsReturn = FunctionReturn<typeof functions.getUserAgentDeposits>

export type GetUserFeeInfoParams = FunctionArguments<typeof functions.getUserFeeInfo>
export type GetUserFeeInfoReturn = FunctionReturn<typeof functions.getUserFeeInfo>

export type GetUserPurchasesParams = FunctionArguments<typeof functions.getUserPurchases>
export type GetUserPurchasesReturn = FunctionReturn<typeof functions.getUserPurchases>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type IsApprovedForAllParams = FunctionArguments<typeof functions.isApprovedForAll>
export type IsApprovedForAllReturn = FunctionReturn<typeof functions.isApprovedForAll>

export type NameParams = FunctionArguments<typeof functions.name>
export type NameReturn = FunctionReturn<typeof functions.name>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type OwnerOfParams = FunctionArguments<typeof functions.ownerOf>
export type OwnerOfReturn = FunctionReturn<typeof functions.ownerOf>

export type PairingConfigsParams = FunctionArguments<typeof functions.pairingConfigs>
export type PairingConfigsReturn = FunctionReturn<typeof functions.pairingConfigs>

export type PauseParams = FunctionArguments<typeof functions.pause>
export type PauseReturn = FunctionReturn<typeof functions.pause>

export type PausedParams = FunctionArguments<typeof functions.paused>
export type PausedReturn = FunctionReturn<typeof functions.paused>

export type PersonasParams = FunctionArguments<typeof functions.personas>
export type PersonasReturn = FunctionReturn<typeof functions.personas>

export type PreviewSwapWithFeeParams = FunctionArguments<typeof functions.previewSwapWithFee>
export type PreviewSwapWithFeeReturn = FunctionReturn<typeof functions.previewSwapWithFee>

export type PurchasesParams = FunctionArguments<typeof functions.purchases>
export type PurchasesReturn = FunctionReturn<typeof functions.purchases>

export type RenounceOwnershipParams = FunctionArguments<typeof functions.renounceOwnership>
export type RenounceOwnershipReturn = FunctionReturn<typeof functions.renounceOwnership>

export type SafeTransferFromParams_0 = FunctionArguments<typeof functions['safeTransferFrom(address,address,uint256)']>
export type SafeTransferFromReturn_0 = FunctionReturn<typeof functions['safeTransferFrom(address,address,uint256)']>

export type SafeTransferFromParams_1 = FunctionArguments<typeof functions['safeTransferFrom(address,address,uint256,bytes)']>
export type SafeTransferFromReturn_1 = FunctionReturn<typeof functions['safeTransferFrom(address,address,uint256,bytes)']>

export type SetApprovalForAllParams = FunctionArguments<typeof functions.setApprovalForAll>
export type SetApprovalForAllReturn = FunctionReturn<typeof functions.setApprovalForAll>

export type SetStakingRewardsParams = FunctionArguments<typeof functions.setStakingRewards>
export type SetStakingRewardsReturn = FunctionReturn<typeof functions.setStakingRewards>

export type SnapshotBlockParams = FunctionArguments<typeof functions.snapshotBlock>
export type SnapshotBlockReturn = FunctionReturn<typeof functions.snapshotBlock>

export type StakingRewardsParams = FunctionArguments<typeof functions.stakingRewards>
export type StakingRewardsReturn = FunctionReturn<typeof functions.stakingRewards>

export type SupportsInterfaceParams = FunctionArguments<typeof functions.supportsInterface>
export type SupportsInterfaceReturn = FunctionReturn<typeof functions.supportsInterface>

export type SwapExactTokensForTokensParams = FunctionArguments<typeof functions.swapExactTokensForTokens>
export type SwapExactTokensForTokensReturn = FunctionReturn<typeof functions.swapExactTokensForTokens>

export type SymbolParams = FunctionArguments<typeof functions.symbol>
export type SymbolReturn = FunctionReturn<typeof functions.symbol>

export type TokenURIParams = FunctionArguments<typeof functions.tokenURI>
export type TokenURIReturn = FunctionReturn<typeof functions.tokenURI>

export type TradingFeeConfigParams = FunctionArguments<typeof functions.tradingFeeConfig>
export type TradingFeeConfigReturn = FunctionReturn<typeof functions.tradingFeeConfig>

export type TransferFromParams = FunctionArguments<typeof functions.transferFrom>
export type TransferFromReturn = FunctionReturn<typeof functions.transferFrom>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type UniswapFactoryParams = FunctionArguments<typeof functions.uniswapFactory>
export type UniswapFactoryReturn = FunctionReturn<typeof functions.uniswapFactory>

export type UniswapRouterParams = FunctionArguments<typeof functions.uniswapRouter>
export type UniswapRouterReturn = FunctionReturn<typeof functions.uniswapRouter>

export type UnpauseParams = FunctionArguments<typeof functions.unpause>
export type UnpauseReturn = FunctionReturn<typeof functions.unpause>

export type UpdateAmicaSnapshotParams = FunctionArguments<typeof functions.updateAmicaSnapshot>
export type UpdateAmicaSnapshotReturn = FunctionReturn<typeof functions.updateAmicaSnapshot>

export type UpdateMetadataParams = FunctionArguments<typeof functions.updateMetadata>
export type UpdateMetadataReturn = FunctionReturn<typeof functions.updateMetadata>

export type UserSnapshotsParams = FunctionArguments<typeof functions.userSnapshots>
export type UserSnapshotsReturn = FunctionReturn<typeof functions.userSnapshots>

export type UserpurchasesParams = FunctionArguments<typeof functions.userpurchases>
export type UserpurchasesReturn = FunctionReturn<typeof functions.userpurchases>

export type WithdrawAgentTokensParams = FunctionArguments<typeof functions.withdrawAgentTokens>
export type WithdrawAgentTokensReturn = FunctionReturn<typeof functions.withdrawAgentTokens>

export type WithdrawTokensParams = FunctionArguments<typeof functions.withdrawTokens>
export type WithdrawTokensReturn = FunctionReturn<typeof functions.withdrawTokens>

