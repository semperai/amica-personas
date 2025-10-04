import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    Approval: event("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925", "Approval(address,address,uint256)", {"owner": indexed(p.address), "spender": indexed(p.address), "value": p.uint256}),
    Initialized: event("0xc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d2", "Initialized(uint64)", {"version": p.uint64}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    Paused: event("0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258", "Paused(address)", {"account": p.address}),
    TokenConfigured: event("0xeb022320d64fb88f594cd0b37fc220d3d43d351eaba21f49ae97e0a082cb860b", "TokenConfigured(address,bool,uint256,uint8)", {"token": indexed(p.address), "enabled": p.bool, "exchangeRate": p.uint256, "decimals": p.uint8}),
    TokenDeposited: event("0x080c225c8e9d9f966820ef915f5f555d575e9c3a188f1252d19e94aa2250f09d", "TokenDeposited(address,address,uint256,uint256)", {"user": indexed(p.address), "token": indexed(p.address), "amountDeposited": p.uint256, "amountMinted": p.uint256}),
    TokenWithdrawn: event("0x8210728e7c071f615b840ee026032693858fbcd5e5359e67e438c890f59e5620", "TokenWithdrawn(address,address,uint256)", {"token": indexed(p.address), "to": indexed(p.address), "amount": p.uint256}),
    Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "Transfer(address,address,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "value": p.uint256}),
    Unpaused: event("0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa", "Unpaused(address)", {"account": p.address}),
}

export const functions = {
    MAX_SUPPLY: viewFun("0x32cb6b0c", "MAX_SUPPLY()", {}, p.uint256),
    allowance: viewFun("0xdd62ed3e", "allowance(address,address)", {"owner": p.address, "spender": p.address}, p.uint256),
    approve: fun("0x095ea7b3", "approve(address,uint256)", {"spender": p.address, "value": p.uint256}, p.bool),
    balanceOf: viewFun("0x70a08231", "balanceOf(address)", {"account": p.address}, p.uint256),
    configureToken: fun("0xfde86590", "configureToken(address,bool,uint256,uint8)", {"token": p.address, "enabled": p.bool, "exchangeRate": p.uint256, "decimals": p.uint8}, ),
    configuredTokens: viewFun("0x7313f7a2", "configuredTokens(uint256)", {"_0": p.uint256}, p.address),
    decimals: viewFun("0x313ce567", "decimals()", {}, p.uint8),
    depositAndMint: fun("0xd3148fb6", "depositAndMint(address,uint256)", {"token": p.address, "amount": p.uint256}, ),
    getConfiguredTokens: viewFun("0xc9dc9a99", "getConfiguredTokens()", {}, p.array(p.address)),
    initialize: fun("0xc4d66de8", "initialize(address)", {"initialOwner": p.address}, ),
    name: viewFun("0x06fdde03", "name()", {}, p.string),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    pause: fun("0x8456cb59", "pause()", {}, ),
    paused: viewFun("0x5c975abb", "paused()", {}, p.bool),
    previewDepositAndMint: viewFun("0xc5ed6132", "previewDepositAndMint(address,uint256)", {"token": p.address, "amount": p.uint256}, p.uint256),
    remainingSupply: viewFun("0xda0239a6", "remainingSupply()", {}, p.uint256),
    renounceOwnership: fun("0x715018a6", "renounceOwnership()", {}, ),
    symbol: viewFun("0x95d89b41", "symbol()", {}, p.string),
    tokenConfigs: viewFun("0x1b69dc5f", "tokenConfigs(address)", {"_0": p.address}, {"enabled": p.bool, "exchangeRate": p.uint256, "decimals": p.uint8}),
    totalSupply: viewFun("0x18160ddd", "totalSupply()", {}, p.uint256),
    transfer: fun("0xa9059cbb", "transfer(address,uint256)", {"to": p.address, "value": p.uint256}, p.bool),
    transferFrom: fun("0x23b872dd", "transferFrom(address,address,uint256)", {"from": p.address, "to": p.address, "value": p.uint256}, p.bool),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    unpause: fun("0x3f4ba83a", "unpause()", {}, ),
    withdrawToken: fun("0x01e33667", "withdrawToken(address,address,uint256)", {"token": p.address, "to": p.address, "amount": p.uint256}, ),
}

export class Contract extends ContractBase {

    MAX_SUPPLY() {
        return this.eth_call(functions.MAX_SUPPLY, {})
    }

    allowance(owner: AllowanceParams["owner"], spender: AllowanceParams["spender"]) {
        return this.eth_call(functions.allowance, {owner, spender})
    }

    balanceOf(account: BalanceOfParams["account"]) {
        return this.eth_call(functions.balanceOf, {account})
    }

    configuredTokens(_0: ConfiguredTokensParams["_0"]) {
        return this.eth_call(functions.configuredTokens, {_0})
    }

    decimals() {
        return this.eth_call(functions.decimals, {})
    }

    getConfiguredTokens() {
        return this.eth_call(functions.getConfiguredTokens, {})
    }

    name() {
        return this.eth_call(functions.name, {})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    paused() {
        return this.eth_call(functions.paused, {})
    }

    previewDepositAndMint(token: PreviewDepositAndMintParams["token"], amount: PreviewDepositAndMintParams["amount"]) {
        return this.eth_call(functions.previewDepositAndMint, {token, amount})
    }

    remainingSupply() {
        return this.eth_call(functions.remainingSupply, {})
    }

    symbol() {
        return this.eth_call(functions.symbol, {})
    }

    tokenConfigs(_0: TokenConfigsParams["_0"]) {
        return this.eth_call(functions.tokenConfigs, {_0})
    }

    totalSupply() {
        return this.eth_call(functions.totalSupply, {})
    }
}

/// Event types
export type ApprovalEventArgs = EParams<typeof events.Approval>
export type InitializedEventArgs = EParams<typeof events.Initialized>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type PausedEventArgs = EParams<typeof events.Paused>
export type TokenConfiguredEventArgs = EParams<typeof events.TokenConfigured>
export type TokenDepositedEventArgs = EParams<typeof events.TokenDeposited>
export type TokenWithdrawnEventArgs = EParams<typeof events.TokenWithdrawn>
export type TransferEventArgs = EParams<typeof events.Transfer>
export type UnpausedEventArgs = EParams<typeof events.Unpaused>

/// Function types
export type MAX_SUPPLYParams = FunctionArguments<typeof functions.MAX_SUPPLY>
export type MAX_SUPPLYReturn = FunctionReturn<typeof functions.MAX_SUPPLY>

export type AllowanceParams = FunctionArguments<typeof functions.allowance>
export type AllowanceReturn = FunctionReturn<typeof functions.allowance>

export type ApproveParams = FunctionArguments<typeof functions.approve>
export type ApproveReturn = FunctionReturn<typeof functions.approve>

export type BalanceOfParams = FunctionArguments<typeof functions.balanceOf>
export type BalanceOfReturn = FunctionReturn<typeof functions.balanceOf>

export type ConfigureTokenParams = FunctionArguments<typeof functions.configureToken>
export type ConfigureTokenReturn = FunctionReturn<typeof functions.configureToken>

export type ConfiguredTokensParams = FunctionArguments<typeof functions.configuredTokens>
export type ConfiguredTokensReturn = FunctionReturn<typeof functions.configuredTokens>

export type DecimalsParams = FunctionArguments<typeof functions.decimals>
export type DecimalsReturn = FunctionReturn<typeof functions.decimals>

export type DepositAndMintParams = FunctionArguments<typeof functions.depositAndMint>
export type DepositAndMintReturn = FunctionReturn<typeof functions.depositAndMint>

export type GetConfiguredTokensParams = FunctionArguments<typeof functions.getConfiguredTokens>
export type GetConfiguredTokensReturn = FunctionReturn<typeof functions.getConfiguredTokens>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type NameParams = FunctionArguments<typeof functions.name>
export type NameReturn = FunctionReturn<typeof functions.name>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type PauseParams = FunctionArguments<typeof functions.pause>
export type PauseReturn = FunctionReturn<typeof functions.pause>

export type PausedParams = FunctionArguments<typeof functions.paused>
export type PausedReturn = FunctionReturn<typeof functions.paused>

export type PreviewDepositAndMintParams = FunctionArguments<typeof functions.previewDepositAndMint>
export type PreviewDepositAndMintReturn = FunctionReturn<typeof functions.previewDepositAndMint>

export type RemainingSupplyParams = FunctionArguments<typeof functions.remainingSupply>
export type RemainingSupplyReturn = FunctionReturn<typeof functions.remainingSupply>

export type RenounceOwnershipParams = FunctionArguments<typeof functions.renounceOwnership>
export type RenounceOwnershipReturn = FunctionReturn<typeof functions.renounceOwnership>

export type SymbolParams = FunctionArguments<typeof functions.symbol>
export type SymbolReturn = FunctionReturn<typeof functions.symbol>

export type TokenConfigsParams = FunctionArguments<typeof functions.tokenConfigs>
export type TokenConfigsReturn = FunctionReturn<typeof functions.tokenConfigs>

export type TotalSupplyParams = FunctionArguments<typeof functions.totalSupply>
export type TotalSupplyReturn = FunctionReturn<typeof functions.totalSupply>

export type TransferParams = FunctionArguments<typeof functions.transfer>
export type TransferReturn = FunctionReturn<typeof functions.transfer>

export type TransferFromParams = FunctionArguments<typeof functions.transferFrom>
export type TransferFromReturn = FunctionReturn<typeof functions.transferFrom>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type UnpauseParams = FunctionArguments<typeof functions.unpause>
export type UnpauseReturn = FunctionReturn<typeof functions.unpause>

export type WithdrawTokenParams = FunctionArguments<typeof functions.withdrawToken>
export type WithdrawTokenReturn = FunctionReturn<typeof functions.withdrawToken>

