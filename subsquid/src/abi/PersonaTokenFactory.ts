import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    AgentRewardsDistributed: event("0x43dfc6afc5678410c8a0b7a51de3aa33dd53309728c66238999c6a5a45fe704a", "AgentRewardsDistributed(uint256,address,uint256)", {"tokenId": indexed(p.uint256), "recipient": indexed(p.address), "personaTokens": p.uint256}),
    AgentTokenAssociated: event("0x998080a81a66962becc86e7ea090fbb3e8115c73382c333481914dd98a2f59d9", "AgentTokenAssociated(uint256,address)", {"tokenId": indexed(p.uint256), "agentToken": indexed(p.address)}),
    AgentTokensDeposited: event("0x635cc45e10ff7d1ca53f407194afa4f58f81638be81b3615362cbab3a10463dc", "AgentTokensDeposited(uint256,address,uint256,uint256)", {"tokenId": indexed(p.uint256), "depositor": indexed(p.address), "amount": p.uint256, "newTotal": p.uint256}),
    AgentTokensWithdrawn: event("0xa7e012f82f3c62431a985dc0bcaecebfcb983a90fba2f2dce8b6d4dbeab23acd", "AgentTokensWithdrawn(uint256,address,uint256,uint256)", {"tokenId": indexed(p.uint256), "depositor": indexed(p.address), "amount": p.uint256, "newTotal": p.uint256}),
    Approval: event("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925", "Approval(address,address,uint256)", {"owner": indexed(p.address), "approved": indexed(p.address), "tokenId": indexed(p.uint256)}),
    ApprovalForAll: event("0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31", "ApprovalForAll(address,address,bool)", {"owner": indexed(p.address), "operator": indexed(p.address), "approved": p.bool}),
    FeesCollected: event("0x70653dab468f4f1cf7db4eef874c3846af00f2f8aab126ad7c4addfb5b4d70c3", "FeesCollected(uint256,bytes32,uint256,uint256)", {"tokenId": indexed(p.uint256), "poolId": p.bytes32, "amount0": p.uint256, "amount1": p.uint256}),
    Graduated: event("0x36fe3c81d4c8d71005b5e7c8ea6075adfdf404e33c5f2759ad20bd56b98cce5b", "Graduated(uint256,bytes32,uint256,uint256)", {"tokenId": indexed(p.uint256), "poolId": indexed(p.bytes32), "totalDeposited": p.uint256, "tokensSold": p.uint256}),
    Initialized: event("0xc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d2", "Initialized(uint64)", {"version": p.uint64}),
    MetadataUpdated: event("0x9c06c04824dfb4ebf41804d51120c24a2ab63d6230efe7b7bc5a199f837dd3ad", "MetadataUpdated(uint256,bytes32)", {"tokenId": indexed(p.uint256), "key": indexed(p.bytes32)}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    PairingConfigUpdated: event("0x3ef415ddef109a4c74a41439b8ff2815fb076ddae4762ad6b0a116ba1f4d64db", "PairingConfigUpdated(address)", {"token": indexed(p.address)}),
    Paused: event("0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258", "Paused(address)", {"account": p.address}),
    PersonaCreated: event("0xeca9a2cd783b224eeed4c8c4784255a3e47caaf04a026d21349e579fc3cc2550", "PersonaCreated(uint256,bytes32,address)", {"tokenId": indexed(p.uint256), "domain": indexed(p.bytes32), "token": indexed(p.address)}),
    TokensClaimed: event("0x1599fb5c175bfa57874885a3dcee69bc6102dc0c0540ca4b0622d6663c3d8551", "TokensClaimed(uint256,address,uint256,uint256,uint256)", {"tokenId": indexed(p.uint256), "user": indexed(p.address), "purchasedAmount": p.uint256, "bonusAmount": p.uint256, "totalAmount": p.uint256}),
    TokensDistributed: event("0x1c64838894778f04d06880daeba52561418b6fefbc48e591824147c13cd18859", "TokensDistributed(uint256,uint256,uint256,uint256)", {"tokenId": indexed(p.uint256), "toAmica": p.uint256, "toLiquidity": p.uint256, "toAgentRewards": p.uint256}),
    TokensPurchased: event("0xe8d7e55108ae7ddb60173461d2950c7a8e22a7ac7f442825564fe84c8c6f9a38", "TokensPurchased(uint256,address,uint256,uint256)", {"tokenId": indexed(p.uint256), "buyer": indexed(p.address), "amountSpent": p.uint256, "tokensReceived": p.uint256}),
    TokensSold: event("0xb3b5018d26b7b3764106321edeb54ab6d90aee3598f78eae1da7a2ce084e9aa9", "TokensSold(uint256,address,uint256,uint256)", {"tokenId": indexed(p.uint256), "seller": indexed(p.address), "tokensSold": p.uint256, "amountReceived": p.uint256}),
    Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "Transfer(address,address,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "tokenId": indexed(p.uint256)}),
    Unpaused: event("0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa", "Unpaused(address)", {"account": p.address}),
    V4PoolCreated: event("0x858282f6efb86991a3c98091f65c0ff0f17b056c64d58ba284d7f1dd5e3e2bd2", "V4PoolCreated(uint256,bytes32,uint256)", {"tokenId": indexed(p.uint256), "poolId": indexed(p.bytes32), "liquidity": p.uint256}),
}

export const functions = {
    agentDeposits: viewFun("0x13ee32be", "agentDeposits(uint256,address)", {"_0": p.uint256, "_1": p.address}, p.uint256),
    amicaToken: viewFun("0xa04e401a", "amicaToken()", {}, p.address),
    approve: fun("0x095ea7b3", "approve(address,uint256)", {"to": p.address, "tokenId": p.uint256}, ),
    balanceOf: viewFun("0x70a08231", "balanceOf(address)", {"owner": p.address}, p.uint256),
    baseTokenURI: viewFun("0xd547cfb7", "baseTokenURI()", {}, p.string),
    bondingBalances: viewFun("0x4b3eacf3", "bondingBalances(uint256,address)", {"_0": p.uint256, "_1": p.address}, p.uint256),
    bondingCurve: viewFun("0xeff1d50e", "bondingCurve()", {}, p.address),
    claimRewards: fun("0x0962ef79", "claimRewards(uint256)", {"tokenId": p.uint256}, ),
    collectFees: fun("0x51f3b4bd", "collectFees(uint256,address)", {"tokenId": p.uint256, "to": p.address}, {"amount0": p.uint256, "amount1": p.uint256}),
    configurePairingToken: fun("0x11d8c69b", "configurePairingToken(address,uint256,uint256,bool)", {"token": p.address, "mintCost": p.uint256, "pricingMultiplier": p.uint256, "enabled": p.bool}, ),
    createPersona: fun("0x2d8651ac", "createPersona(address,string,string,bytes32,uint256,address,uint256)", {"pairingToken": p.address, "name": p.string, "symbol": p.string, "domain": p.bytes32, "initialBuyAmount": p.uint256, "agentToken": p.address, "agentTokenThreshold": p.uint256}, p.uint256),
    depositAgentTokens: fun("0xc24f88e3", "depositAgentTokens(uint256,uint256)", {"tokenId": p.uint256, "amount": p.uint256}, ),
    domains: viewFun("0xc722f177", "domains(bytes32)", {"_0": p.bytes32}, p.uint256),
    dynamicFeeHook: viewFun("0x157e6464", "dynamicFeeHook()", {}, p.address),
    getApproved: viewFun("0x081812fc", "getApproved(uint256)", {"tokenId": p.uint256}, p.address),
    getClaimableRewards: viewFun("0xab60df90", "getClaimableRewards(uint256,address)", {"tokenId": p.uint256, "user": p.address}, {"purchasedAmount": p.uint256, "bonusAmount": p.uint256, "agentRewardAmount": p.uint256, "totalClaimable": p.uint256, "claimed": p.bool, "claimable": p.bool}),
    hasClaimedTokens: viewFun("0xbe78533f", "hasClaimedTokens(uint256,address)", {"_0": p.uint256, "_1": p.address}, p.bool),
    initialize: fun("0x35876476", "initialize(address,address,address,address,address,address,address)", {"amicaToken_": p.address, "poolManager_": p.address, "positionManager_": p.address, "permit2_": p.address, "dynamicFeeHook_": p.address, "personaTokenImplementation_": p.address, "bondingCurve_": p.address}, ),
    isApprovedForAll: viewFun("0xe985e9c5", "isApprovedForAll(address,address)", {"owner": p.address, "operator": p.address}, p.bool),
    isValidSubdomain: viewFun("0x61817c64", "isValidSubdomain(bytes32)", {"subdomain": p.bytes32}, p.bool),
    metadata: viewFun("0xa575f120", "metadata(uint256,bytes32)", {"_0": p.uint256, "_1": p.bytes32}, p.string),
    name: viewFun("0x06fdde03", "name()", {}, p.string),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    ownerOf: viewFun("0x6352211e", "ownerOf(uint256)", {"tokenId": p.uint256}, p.address),
    pairingConfigs: viewFun("0x2330cb31", "pairingConfigs(address)", {"_0": p.address}, {"enabled": p.bool, "mintCost": p.uint256, "pricingMultiplier": p.uint256}),
    pause: fun("0x8456cb59", "pause()", {}, ),
    paused: viewFun("0x5c975abb", "paused()", {}, p.bool),
    personaTokenImplementation: viewFun("0x77974f11", "personaTokenImplementation()", {}, p.address),
    personas: viewFun("0x40291e6a", "personas(uint256)", {"_0": p.uint256}, {"token": p.address, "pairToken": p.address, "agentToken": p.address, "graduationTimestamp": p.uint256, "agentTokenThreshold": p.uint256, "poolId": p.bytes32}),
    poolManager: viewFun("0xdc4c90d3", "poolManager()", {}, p.address),
    positionManager: viewFun("0x791b98bc", "positionManager()", {}, p.address),
    preGraduationStates: viewFun("0x8b40d243", "preGraduationStates(uint256)", {"_0": p.uint256}, {"totalPairingTokensCollected": p.uint256, "tokensPurchased": p.uint256, "totalAgentDeposited": p.uint256}),
    renounceOwnership: fun("0x715018a6", "renounceOwnership()", {}, ),
    'safeTransferFrom(address,address,uint256)': fun("0x42842e0e", "safeTransferFrom(address,address,uint256)", {"from": p.address, "to": p.address, "tokenId": p.uint256}, ),
    'safeTransferFrom(address,address,uint256,bytes)': fun("0xb88d4fde", "safeTransferFrom(address,address,uint256,bytes)", {"from": p.address, "to": p.address, "tokenId": p.uint256, "data": p.bytes}, ),
    setApprovalForAll: fun("0xa22cb465", "setApprovalForAll(address,bool)", {"operator": p.address, "approved": p.bool}, ),
    setBaseURI: fun("0x55f804b3", "setBaseURI(string)", {"newBaseURI": p.string}, ),
    supportsInterface: viewFun("0x01ffc9a7", "supportsInterface(bytes4)", {"interfaceId": p.bytes4}, p.bool),
    swapExactTokensForPairingTokens: fun("0x717e4742", "swapExactTokensForPairingTokens(uint256,uint256,uint256,address,uint256)", {"tokenId": p.uint256, "amountIn": p.uint256, "amountOutMin": p.uint256, "to": p.address, "deadline": p.uint256}, p.uint256),
    swapExactTokensForTokens: fun("0xa936da68", "swapExactTokensForTokens(uint256,uint256,uint256,address,uint256)", {"tokenId": p.uint256, "amountIn": p.uint256, "amountOutMin": p.uint256, "to": p.address, "deadline": p.uint256}, p.uint256),
    symbol: viewFun("0x95d89b41", "symbol()", {}, p.string),
    tokenByIndex: viewFun("0x4f6ccce7", "tokenByIndex(uint256)", {"index": p.uint256}, p.uint256),
    tokenOfOwnerByIndex: viewFun("0x2f745c59", "tokenOfOwnerByIndex(address,uint256)", {"owner": p.address, "index": p.uint256}, p.uint256),
    tokenURI: viewFun("0xc87b56dd", "tokenURI(uint256)", {"tokenId": p.uint256}, p.string),
    totalSupply: viewFun("0x18160ddd", "totalSupply()", {}, p.uint256),
    transferFrom: fun("0x23b872dd", "transferFrom(address,address,uint256)", {"from": p.address, "to": p.address, "tokenId": p.uint256}, ),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    unpause: fun("0x3f4ba83a", "unpause()", {}, ),
    updateMetadata: fun("0x498307ce", "updateMetadata(uint256,bytes32[],string[])", {"tokenId": p.uint256, "keys": p.array(p.bytes32), "values": p.array(p.string)}, ),
    withdrawAgentTokens: fun("0x8da9c676", "withdrawAgentTokens(uint256,uint256)", {"tokenId": p.uint256, "amount": p.uint256}, ),
}

export class Contract extends ContractBase {

    agentDeposits(_0: AgentDepositsParams["_0"], _1: AgentDepositsParams["_1"]) {
        return this.eth_call(functions.agentDeposits, {_0, _1})
    }

    amicaToken() {
        return this.eth_call(functions.amicaToken, {})
    }

    balanceOf(owner: BalanceOfParams["owner"]) {
        return this.eth_call(functions.balanceOf, {owner})
    }

    baseTokenURI() {
        return this.eth_call(functions.baseTokenURI, {})
    }

    bondingBalances(_0: BondingBalancesParams["_0"], _1: BondingBalancesParams["_1"]) {
        return this.eth_call(functions.bondingBalances, {_0, _1})
    }

    bondingCurve() {
        return this.eth_call(functions.bondingCurve, {})
    }

    domains(_0: DomainsParams["_0"]) {
        return this.eth_call(functions.domains, {_0})
    }

    dynamicFeeHook() {
        return this.eth_call(functions.dynamicFeeHook, {})
    }

    getApproved(tokenId: GetApprovedParams["tokenId"]) {
        return this.eth_call(functions.getApproved, {tokenId})
    }

    getClaimableRewards(tokenId: GetClaimableRewardsParams["tokenId"], user: GetClaimableRewardsParams["user"]) {
        return this.eth_call(functions.getClaimableRewards, {tokenId, user})
    }

    hasClaimedTokens(_0: HasClaimedTokensParams["_0"], _1: HasClaimedTokensParams["_1"]) {
        return this.eth_call(functions.hasClaimedTokens, {_0, _1})
    }

    isApprovedForAll(owner: IsApprovedForAllParams["owner"], operator: IsApprovedForAllParams["operator"]) {
        return this.eth_call(functions.isApprovedForAll, {owner, operator})
    }

    isValidSubdomain(subdomain: IsValidSubdomainParams["subdomain"]) {
        return this.eth_call(functions.isValidSubdomain, {subdomain})
    }

    metadata(_0: MetadataParams["_0"], _1: MetadataParams["_1"]) {
        return this.eth_call(functions.metadata, {_0, _1})
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

    personaTokenImplementation() {
        return this.eth_call(functions.personaTokenImplementation, {})
    }

    personas(_0: PersonasParams["_0"]) {
        return this.eth_call(functions.personas, {_0})
    }

    poolManager() {
        return this.eth_call(functions.poolManager, {})
    }

    positionManager() {
        return this.eth_call(functions.positionManager, {})
    }

    preGraduationStates(_0: PreGraduationStatesParams["_0"]) {
        return this.eth_call(functions.preGraduationStates, {_0})
    }

    supportsInterface(interfaceId: SupportsInterfaceParams["interfaceId"]) {
        return this.eth_call(functions.supportsInterface, {interfaceId})
    }

    symbol() {
        return this.eth_call(functions.symbol, {})
    }

    tokenByIndex(index: TokenByIndexParams["index"]) {
        return this.eth_call(functions.tokenByIndex, {index})
    }

    tokenOfOwnerByIndex(owner: TokenOfOwnerByIndexParams["owner"], index: TokenOfOwnerByIndexParams["index"]) {
        return this.eth_call(functions.tokenOfOwnerByIndex, {owner, index})
    }

    tokenURI(tokenId: TokenURIParams["tokenId"]) {
        return this.eth_call(functions.tokenURI, {tokenId})
    }

    totalSupply() {
        return this.eth_call(functions.totalSupply, {})
    }
}

/// Event types
export type AgentRewardsDistributedEventArgs = EParams<typeof events.AgentRewardsDistributed>
export type AgentTokenAssociatedEventArgs = EParams<typeof events.AgentTokenAssociated>
export type AgentTokensDepositedEventArgs = EParams<typeof events.AgentTokensDeposited>
export type AgentTokensWithdrawnEventArgs = EParams<typeof events.AgentTokensWithdrawn>
export type ApprovalEventArgs = EParams<typeof events.Approval>
export type ApprovalForAllEventArgs = EParams<typeof events.ApprovalForAll>
export type FeesCollectedEventArgs = EParams<typeof events.FeesCollected>
export type GraduatedEventArgs = EParams<typeof events.Graduated>
export type InitializedEventArgs = EParams<typeof events.Initialized>
export type MetadataUpdatedEventArgs = EParams<typeof events.MetadataUpdated>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type PairingConfigUpdatedEventArgs = EParams<typeof events.PairingConfigUpdated>
export type PausedEventArgs = EParams<typeof events.Paused>
export type PersonaCreatedEventArgs = EParams<typeof events.PersonaCreated>
export type TokensClaimedEventArgs = EParams<typeof events.TokensClaimed>
export type TokensDistributedEventArgs = EParams<typeof events.TokensDistributed>
export type TokensPurchasedEventArgs = EParams<typeof events.TokensPurchased>
export type TokensSoldEventArgs = EParams<typeof events.TokensSold>
export type TransferEventArgs = EParams<typeof events.Transfer>
export type UnpausedEventArgs = EParams<typeof events.Unpaused>
export type V4PoolCreatedEventArgs = EParams<typeof events.V4PoolCreated>

/// Function types
export type AgentDepositsParams = FunctionArguments<typeof functions.agentDeposits>
export type AgentDepositsReturn = FunctionReturn<typeof functions.agentDeposits>

export type AmicaTokenParams = FunctionArguments<typeof functions.amicaToken>
export type AmicaTokenReturn = FunctionReturn<typeof functions.amicaToken>

export type ApproveParams = FunctionArguments<typeof functions.approve>
export type ApproveReturn = FunctionReturn<typeof functions.approve>

export type BalanceOfParams = FunctionArguments<typeof functions.balanceOf>
export type BalanceOfReturn = FunctionReturn<typeof functions.balanceOf>

export type BaseTokenURIParams = FunctionArguments<typeof functions.baseTokenURI>
export type BaseTokenURIReturn = FunctionReturn<typeof functions.baseTokenURI>

export type BondingBalancesParams = FunctionArguments<typeof functions.bondingBalances>
export type BondingBalancesReturn = FunctionReturn<typeof functions.bondingBalances>

export type BondingCurveParams = FunctionArguments<typeof functions.bondingCurve>
export type BondingCurveReturn = FunctionReturn<typeof functions.bondingCurve>

export type ClaimRewardsParams = FunctionArguments<typeof functions.claimRewards>
export type ClaimRewardsReturn = FunctionReturn<typeof functions.claimRewards>

export type CollectFeesParams = FunctionArguments<typeof functions.collectFees>
export type CollectFeesReturn = FunctionReturn<typeof functions.collectFees>

export type ConfigurePairingTokenParams = FunctionArguments<typeof functions.configurePairingToken>
export type ConfigurePairingTokenReturn = FunctionReturn<typeof functions.configurePairingToken>

export type CreatePersonaParams = FunctionArguments<typeof functions.createPersona>
export type CreatePersonaReturn = FunctionReturn<typeof functions.createPersona>

export type DepositAgentTokensParams = FunctionArguments<typeof functions.depositAgentTokens>
export type DepositAgentTokensReturn = FunctionReturn<typeof functions.depositAgentTokens>

export type DomainsParams = FunctionArguments<typeof functions.domains>
export type DomainsReturn = FunctionReturn<typeof functions.domains>

export type DynamicFeeHookParams = FunctionArguments<typeof functions.dynamicFeeHook>
export type DynamicFeeHookReturn = FunctionReturn<typeof functions.dynamicFeeHook>

export type GetApprovedParams = FunctionArguments<typeof functions.getApproved>
export type GetApprovedReturn = FunctionReturn<typeof functions.getApproved>

export type GetClaimableRewardsParams = FunctionArguments<typeof functions.getClaimableRewards>
export type GetClaimableRewardsReturn = FunctionReturn<typeof functions.getClaimableRewards>

export type HasClaimedTokensParams = FunctionArguments<typeof functions.hasClaimedTokens>
export type HasClaimedTokensReturn = FunctionReturn<typeof functions.hasClaimedTokens>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type IsApprovedForAllParams = FunctionArguments<typeof functions.isApprovedForAll>
export type IsApprovedForAllReturn = FunctionReturn<typeof functions.isApprovedForAll>

export type IsValidSubdomainParams = FunctionArguments<typeof functions.isValidSubdomain>
export type IsValidSubdomainReturn = FunctionReturn<typeof functions.isValidSubdomain>

export type MetadataParams = FunctionArguments<typeof functions.metadata>
export type MetadataReturn = FunctionReturn<typeof functions.metadata>

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

export type PersonaTokenImplementationParams = FunctionArguments<typeof functions.personaTokenImplementation>
export type PersonaTokenImplementationReturn = FunctionReturn<typeof functions.personaTokenImplementation>

export type PersonasParams = FunctionArguments<typeof functions.personas>
export type PersonasReturn = FunctionReturn<typeof functions.personas>

export type PoolManagerParams = FunctionArguments<typeof functions.poolManager>
export type PoolManagerReturn = FunctionReturn<typeof functions.poolManager>

export type PositionManagerParams = FunctionArguments<typeof functions.positionManager>
export type PositionManagerReturn = FunctionReturn<typeof functions.positionManager>

export type PreGraduationStatesParams = FunctionArguments<typeof functions.preGraduationStates>
export type PreGraduationStatesReturn = FunctionReturn<typeof functions.preGraduationStates>

export type RenounceOwnershipParams = FunctionArguments<typeof functions.renounceOwnership>
export type RenounceOwnershipReturn = FunctionReturn<typeof functions.renounceOwnership>

export type SafeTransferFromParams_0 = FunctionArguments<typeof functions['safeTransferFrom(address,address,uint256)']>
export type SafeTransferFromReturn_0 = FunctionReturn<typeof functions['safeTransferFrom(address,address,uint256)']>

export type SafeTransferFromParams_1 = FunctionArguments<typeof functions['safeTransferFrom(address,address,uint256,bytes)']>
export type SafeTransferFromReturn_1 = FunctionReturn<typeof functions['safeTransferFrom(address,address,uint256,bytes)']>

export type SetApprovalForAllParams = FunctionArguments<typeof functions.setApprovalForAll>
export type SetApprovalForAllReturn = FunctionReturn<typeof functions.setApprovalForAll>

export type SetBaseURIParams = FunctionArguments<typeof functions.setBaseURI>
export type SetBaseURIReturn = FunctionReturn<typeof functions.setBaseURI>

export type SupportsInterfaceParams = FunctionArguments<typeof functions.supportsInterface>
export type SupportsInterfaceReturn = FunctionReturn<typeof functions.supportsInterface>

export type SwapExactTokensForPairingTokensParams = FunctionArguments<typeof functions.swapExactTokensForPairingTokens>
export type SwapExactTokensForPairingTokensReturn = FunctionReturn<typeof functions.swapExactTokensForPairingTokens>

export type SwapExactTokensForTokensParams = FunctionArguments<typeof functions.swapExactTokensForTokens>
export type SwapExactTokensForTokensReturn = FunctionReturn<typeof functions.swapExactTokensForTokens>

export type SymbolParams = FunctionArguments<typeof functions.symbol>
export type SymbolReturn = FunctionReturn<typeof functions.symbol>

export type TokenByIndexParams = FunctionArguments<typeof functions.tokenByIndex>
export type TokenByIndexReturn = FunctionReturn<typeof functions.tokenByIndex>

export type TokenOfOwnerByIndexParams = FunctionArguments<typeof functions.tokenOfOwnerByIndex>
export type TokenOfOwnerByIndexReturn = FunctionReturn<typeof functions.tokenOfOwnerByIndex>

export type TokenURIParams = FunctionArguments<typeof functions.tokenURI>
export type TokenURIReturn = FunctionReturn<typeof functions.tokenURI>

export type TotalSupplyParams = FunctionArguments<typeof functions.totalSupply>
export type TotalSupplyReturn = FunctionReturn<typeof functions.totalSupply>

export type TransferFromParams = FunctionArguments<typeof functions.transferFrom>
export type TransferFromReturn = FunctionReturn<typeof functions.transferFrom>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type UnpauseParams = FunctionArguments<typeof functions.unpause>
export type UnpauseReturn = FunctionReturn<typeof functions.unpause>

export type UpdateMetadataParams = FunctionArguments<typeof functions.updateMetadata>
export type UpdateMetadataReturn = FunctionReturn<typeof functions.updateMetadata>

export type WithdrawAgentTokensParams = FunctionArguments<typeof functions.withdrawAgentTokens>
export type WithdrawAgentTokensReturn = FunctionReturn<typeof functions.withdrawAgentTokens>

