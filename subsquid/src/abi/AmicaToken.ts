import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    Approval: event("0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925", "Approval(address,address,uint256)", {"owner": indexed(p.address), "spender": indexed(p.address), "value": p.uint256}),
    BridgeWrapperSet: event("0x3968d46c6547074f63e2859ae00dfb2d38e4901f91d2eccbf6ee7f71b7e8eeee", "BridgeWrapperSet(address)", {"wrapper": indexed(p.address)}),
    Initialized: event("0xc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d2", "Initialized(uint64)", {"version": p.uint64}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    TokensBurnedAndClaimed: event("0x20b12e46df204b330002c4b46ba4b4b34e2c5c83db88543362339f6efdef1d34", "TokensBurnedAndClaimed(address,uint256,address[],uint256[])", {"user": indexed(p.address), "amountBurned": p.uint256, "tokens": p.array(p.address), "amounts": p.array(p.uint256)}),
    TokensDeposited: event("0xcbc4a4091b012bb1329c38bbbb15455f5cac5aa3673da0a7f38cd61a4f495517", "TokensDeposited(address,address,uint256)", {"depositor": indexed(p.address), "token": indexed(p.address), "amount": p.uint256}),
    TokensRecovered: event("0x401f439d865a766757ec78675925bd67198d5e78805aa41691b34b5d6a6cbbe6", "TokensRecovered(address,address,uint256)", {"to": indexed(p.address), "token": indexed(p.address), "amount": p.uint256}),
    TokensWithdrawn: event("0x6352c5382c4a4578e712449ca65e83cdb392d045dfcf1cad9615189db2da244b", "TokensWithdrawn(address,uint256)", {"to": indexed(p.address), "amount": p.uint256}),
    Transfer: event("0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", "Transfer(address,address,uint256)", {"from": indexed(p.address), "to": indexed(p.address), "value": p.uint256}),
}

export const functions = {
    TOTAL_SUPPLY: viewFun("0x902d55a5", "TOTAL_SUPPLY()", {}, p.uint256),
    allowance: viewFun("0xdd62ed3e", "allowance(address,address)", {"owner": p.address, "spender": p.address}, p.uint256),
    approve: fun("0x095ea7b3", "approve(address,uint256)", {"spender": p.address, "value": p.uint256}, p.bool),
    balanceOf: viewFun("0x70a08231", "balanceOf(address)", {"account": p.address}, p.uint256),
    bridgeWrapper: viewFun("0x9ad026ac", "bridgeWrapper()", {}, p.address),
    burn: fun("0x42966c68", "burn(uint256)", {"value": p.uint256}, ),
    burnAndClaim: fun("0xb09acfed", "burnAndClaim(uint256,uint256[])", {"amountToBurn": p.uint256, "tokenIndexes": p.array(p.uint256)}, ),
    burnFrom: fun("0x79cc6790", "burnFrom(address,uint256)", {"account": p.address, "value": p.uint256}, ),
    circulatingSupply: viewFun("0x9358928b", "circulatingSupply()", {}, p.uint256),
    decimals: viewFun("0x313ce567", "decimals()", {}, p.uint8),
    deposit: fun("0x47e7ef24", "deposit(address,uint256)", {"token": p.address, "amount": p.uint256}, ),
    depositedBalances: viewFun("0x7d995311", "depositedBalances(address)", {"_0": p.address}, p.uint256),
    getDepositedTokens: viewFun("0x5e71430f", "getDepositedTokens()", {}, p.array(p.address)),
    initialize: fun("0xc4d66de8", "initialize(address)", {"initialOwner": p.address}, ),
    mint: fun("0x40c10f19", "mint(address,uint256)", {"to": p.address, "amount": p.uint256}, ),
    name: viewFun("0x06fdde03", "name()", {}, p.string),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    recoverToken: fun("0xfeaea586", "recoverToken(address,address)", {"token": p.address, "to": p.address}, ),
    renounceOwnership: fun("0x715018a6", "renounceOwnership()", {}, ),
    setBridgeWrapper: fun("0x11c06141", "setBridgeWrapper(address)", {"_bridgeWrapper": p.address}, ),
    symbol: viewFun("0x95d89b41", "symbol()", {}, p.string),
    tokenIndex: viewFun("0x427f91a6", "tokenIndex(address)", {"_0": p.address}, p.uint256),
    totalSupply: viewFun("0x18160ddd", "totalSupply()", {}, p.uint256),
    transfer: fun("0xa9059cbb", "transfer(address,uint256)", {"to": p.address, "value": p.uint256}, p.bool),
    transferFrom: fun("0x23b872dd", "transferFrom(address,address,uint256)", {"from": p.address, "to": p.address, "value": p.uint256}, p.bool),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    withdraw: fun("0xf3fef3a3", "withdraw(address,uint256)", {"to": p.address, "amount": p.uint256}, ),
}

export class Contract extends ContractBase {

    TOTAL_SUPPLY() {
        return this.eth_call(functions.TOTAL_SUPPLY, {})
    }

    allowance(owner: AllowanceParams["owner"], spender: AllowanceParams["spender"]) {
        return this.eth_call(functions.allowance, {owner, spender})
    }

    balanceOf(account: BalanceOfParams["account"]) {
        return this.eth_call(functions.balanceOf, {account})
    }

    bridgeWrapper() {
        return this.eth_call(functions.bridgeWrapper, {})
    }

    circulatingSupply() {
        return this.eth_call(functions.circulatingSupply, {})
    }

    decimals() {
        return this.eth_call(functions.decimals, {})
    }

    depositedBalances(_0: DepositedBalancesParams["_0"]) {
        return this.eth_call(functions.depositedBalances, {_0})
    }

    getDepositedTokens() {
        return this.eth_call(functions.getDepositedTokens, {})
    }

    name() {
        return this.eth_call(functions.name, {})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    symbol() {
        return this.eth_call(functions.symbol, {})
    }

    tokenIndex(_0: TokenIndexParams["_0"]) {
        return this.eth_call(functions.tokenIndex, {_0})
    }

    totalSupply() {
        return this.eth_call(functions.totalSupply, {})
    }
}

/// Event types
export type ApprovalEventArgs = EParams<typeof events.Approval>
export type BridgeWrapperSetEventArgs = EParams<typeof events.BridgeWrapperSet>
export type InitializedEventArgs = EParams<typeof events.Initialized>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type TokensBurnedAndClaimedEventArgs = EParams<typeof events.TokensBurnedAndClaimed>
export type TokensDepositedEventArgs = EParams<typeof events.TokensDeposited>
export type TokensRecoveredEventArgs = EParams<typeof events.TokensRecovered>
export type TokensWithdrawnEventArgs = EParams<typeof events.TokensWithdrawn>
export type TransferEventArgs = EParams<typeof events.Transfer>

/// Function types
export type TOTAL_SUPPLYParams = FunctionArguments<typeof functions.TOTAL_SUPPLY>
export type TOTAL_SUPPLYReturn = FunctionReturn<typeof functions.TOTAL_SUPPLY>

export type AllowanceParams = FunctionArguments<typeof functions.allowance>
export type AllowanceReturn = FunctionReturn<typeof functions.allowance>

export type ApproveParams = FunctionArguments<typeof functions.approve>
export type ApproveReturn = FunctionReturn<typeof functions.approve>

export type BalanceOfParams = FunctionArguments<typeof functions.balanceOf>
export type BalanceOfReturn = FunctionReturn<typeof functions.balanceOf>

export type BridgeWrapperParams = FunctionArguments<typeof functions.bridgeWrapper>
export type BridgeWrapperReturn = FunctionReturn<typeof functions.bridgeWrapper>

export type BurnParams = FunctionArguments<typeof functions.burn>
export type BurnReturn = FunctionReturn<typeof functions.burn>

export type BurnAndClaimParams = FunctionArguments<typeof functions.burnAndClaim>
export type BurnAndClaimReturn = FunctionReturn<typeof functions.burnAndClaim>

export type BurnFromParams = FunctionArguments<typeof functions.burnFrom>
export type BurnFromReturn = FunctionReturn<typeof functions.burnFrom>

export type CirculatingSupplyParams = FunctionArguments<typeof functions.circulatingSupply>
export type CirculatingSupplyReturn = FunctionReturn<typeof functions.circulatingSupply>

export type DecimalsParams = FunctionArguments<typeof functions.decimals>
export type DecimalsReturn = FunctionReturn<typeof functions.decimals>

export type DepositParams = FunctionArguments<typeof functions.deposit>
export type DepositReturn = FunctionReturn<typeof functions.deposit>

export type DepositedBalancesParams = FunctionArguments<typeof functions.depositedBalances>
export type DepositedBalancesReturn = FunctionReturn<typeof functions.depositedBalances>

export type GetDepositedTokensParams = FunctionArguments<typeof functions.getDepositedTokens>
export type GetDepositedTokensReturn = FunctionReturn<typeof functions.getDepositedTokens>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type MintParams = FunctionArguments<typeof functions.mint>
export type MintReturn = FunctionReturn<typeof functions.mint>

export type NameParams = FunctionArguments<typeof functions.name>
export type NameReturn = FunctionReturn<typeof functions.name>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type RecoverTokenParams = FunctionArguments<typeof functions.recoverToken>
export type RecoverTokenReturn = FunctionReturn<typeof functions.recoverToken>

export type RenounceOwnershipParams = FunctionArguments<typeof functions.renounceOwnership>
export type RenounceOwnershipReturn = FunctionReturn<typeof functions.renounceOwnership>

export type SetBridgeWrapperParams = FunctionArguments<typeof functions.setBridgeWrapper>
export type SetBridgeWrapperReturn = FunctionReturn<typeof functions.setBridgeWrapper>

export type SymbolParams = FunctionArguments<typeof functions.symbol>
export type SymbolReturn = FunctionReturn<typeof functions.symbol>

export type TokenIndexParams = FunctionArguments<typeof functions.tokenIndex>
export type TokenIndexReturn = FunctionReturn<typeof functions.tokenIndex>

export type TotalSupplyParams = FunctionArguments<typeof functions.totalSupply>
export type TotalSupplyReturn = FunctionReturn<typeof functions.totalSupply>

export type TransferParams = FunctionArguments<typeof functions.transfer>
export type TransferReturn = FunctionReturn<typeof functions.transfer>

export type TransferFromParams = FunctionArguments<typeof functions.transferFrom>
export type TransferFromReturn = FunctionReturn<typeof functions.transferFrom>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type WithdrawParams = FunctionArguments<typeof functions.withdraw>
export type WithdrawReturn = FunctionReturn<typeof functions.withdraw>

