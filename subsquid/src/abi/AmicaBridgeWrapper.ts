import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    BridgeMetricsUpdated: event("0x94be0515a07bd4828d6e9855efd58993b8d50f4582212691069ca5abf8bf0d1b", "BridgeMetricsUpdated(uint256,uint256,uint256)", {"totalBridgedIn": p.uint256, "totalBridgedOut": p.uint256, "netBridged": p.uint256}),
    BridgeTokensUpdated: event("0xae1dd35fa7dd26822921d81f756962dc61a7b0d23595510cca367a86bfa21bcd", "BridgeTokensUpdated(address,address,address)", {"oldBridgedToken": indexed(p.address), "newBridgedToken": indexed(p.address), "newNativeToken": indexed(p.address)}),
    EmergencyWithdraw: event("0xf24ef89f38eadc1bde50701ad6e4d6d11a2dc24f7cf834a486991f3883328504", "EmergencyWithdraw(address,address,uint256)", {"token": indexed(p.address), "to": indexed(p.address), "amount": p.uint256}),
    Initialized: event("0xc7f505b2f371ae2175ee4913f4499e1f2633a7b5936321eed1cdaeb6115181d2", "Initialized(uint64)", {"version": p.uint64}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    Paused: event("0x62e78cea01bee320cd4e420270b5ea74000d11b0c9f74754ebdbfc544b05a258", "Paused(address)", {"account": p.address}),
    TokensUnwrapped: event("0xe91b82eebe716fe0b6197b2a7348d6c44cd9ea2369d8f41fe6c0dea9d914e297", "TokensUnwrapped(address,uint256)", {"user": indexed(p.address), "amount": p.uint256}),
    TokensWrapped: event("0x44f2df7a1faea25f02196385a10daa8bf7635c87d36cd5e78f4ac9e69fbd99b4", "TokensWrapped(address,uint256)", {"user": indexed(p.address), "amount": p.uint256}),
    Unpaused: event("0x5db9ee0a495bf2e6ff9c91a7834c1ba4fdd244a5e8aa4e537bd38aeae4b073aa", "Unpaused(address)", {"account": p.address}),
}

export const functions = {
    bridgedAmicaToken: viewFun("0xfc794661", "bridgedAmicaToken()", {}, p.address),
    bridgedBalance: viewFun("0xde399f76", "bridgedBalance()", {}, p.uint256),
    emergencyWithdraw: fun("0xe63ea408", "emergencyWithdraw(address,address,uint256)", {"token": p.address, "to": p.address, "amount": p.uint256}, ),
    initialize: fun("0xc0c53b8b", "initialize(address,address,address)", {"_bridgedAmicaToken": p.address, "_nativeAmicaToken": p.address, "_owner": p.address}, ),
    nativeAmicaToken: viewFun("0xa6e67678", "nativeAmicaToken()", {}, p.address),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    pause: fun("0x8456cb59", "pause()", {}, ),
    paused: viewFun("0x5c975abb", "paused()", {}, p.bool),
    renounceOwnership: fun("0x715018a6", "renounceOwnership()", {}, ),
    totalBridgedIn: viewFun("0x2bb42183", "totalBridgedIn()", {}, p.uint256),
    totalBridgedOut: viewFun("0xcd2e9866", "totalBridgedOut()", {}, p.uint256),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    unpause: fun("0x3f4ba83a", "unpause()", {}, ),
    unwrap: fun("0xde0e9a3e", "unwrap(uint256)", {"amount": p.uint256}, ),
    updateBridgeTokens: fun("0xec9a29f5", "updateBridgeTokens(address,address)", {"_bridgedAmicaToken": p.address, "_nativeAmicaToken": p.address}, ),
    wrap: fun("0xea598cb0", "wrap(uint256)", {"amount": p.uint256}, ),
}

export class Contract extends ContractBase {

    bridgedAmicaToken() {
        return this.eth_call(functions.bridgedAmicaToken, {})
    }

    bridgedBalance() {
        return this.eth_call(functions.bridgedBalance, {})
    }

    nativeAmicaToken() {
        return this.eth_call(functions.nativeAmicaToken, {})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    paused() {
        return this.eth_call(functions.paused, {})
    }

    totalBridgedIn() {
        return this.eth_call(functions.totalBridgedIn, {})
    }

    totalBridgedOut() {
        return this.eth_call(functions.totalBridgedOut, {})
    }
}

/// Event types
export type BridgeMetricsUpdatedEventArgs = EParams<typeof events.BridgeMetricsUpdated>
export type BridgeTokensUpdatedEventArgs = EParams<typeof events.BridgeTokensUpdated>
export type EmergencyWithdrawEventArgs = EParams<typeof events.EmergencyWithdraw>
export type InitializedEventArgs = EParams<typeof events.Initialized>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type PausedEventArgs = EParams<typeof events.Paused>
export type TokensUnwrappedEventArgs = EParams<typeof events.TokensUnwrapped>
export type TokensWrappedEventArgs = EParams<typeof events.TokensWrapped>
export type UnpausedEventArgs = EParams<typeof events.Unpaused>

/// Function types
export type BridgedAmicaTokenParams = FunctionArguments<typeof functions.bridgedAmicaToken>
export type BridgedAmicaTokenReturn = FunctionReturn<typeof functions.bridgedAmicaToken>

export type BridgedBalanceParams = FunctionArguments<typeof functions.bridgedBalance>
export type BridgedBalanceReturn = FunctionReturn<typeof functions.bridgedBalance>

export type EmergencyWithdrawParams = FunctionArguments<typeof functions.emergencyWithdraw>
export type EmergencyWithdrawReturn = FunctionReturn<typeof functions.emergencyWithdraw>

export type InitializeParams = FunctionArguments<typeof functions.initialize>
export type InitializeReturn = FunctionReturn<typeof functions.initialize>

export type NativeAmicaTokenParams = FunctionArguments<typeof functions.nativeAmicaToken>
export type NativeAmicaTokenReturn = FunctionReturn<typeof functions.nativeAmicaToken>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type PauseParams = FunctionArguments<typeof functions.pause>
export type PauseReturn = FunctionReturn<typeof functions.pause>

export type PausedParams = FunctionArguments<typeof functions.paused>
export type PausedReturn = FunctionReturn<typeof functions.paused>

export type RenounceOwnershipParams = FunctionArguments<typeof functions.renounceOwnership>
export type RenounceOwnershipReturn = FunctionReturn<typeof functions.renounceOwnership>

export type TotalBridgedInParams = FunctionArguments<typeof functions.totalBridgedIn>
export type TotalBridgedInReturn = FunctionReturn<typeof functions.totalBridgedIn>

export type TotalBridgedOutParams = FunctionArguments<typeof functions.totalBridgedOut>
export type TotalBridgedOutReturn = FunctionReturn<typeof functions.totalBridgedOut>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type UnpauseParams = FunctionArguments<typeof functions.unpause>
export type UnpauseReturn = FunctionReturn<typeof functions.unpause>

export type UnwrapParams = FunctionArguments<typeof functions.unwrap>
export type UnwrapReturn = FunctionReturn<typeof functions.unwrap>

export type UpdateBridgeTokensParams = FunctionArguments<typeof functions.updateBridgeTokens>
export type UpdateBridgeTokensReturn = FunctionReturn<typeof functions.updateBridgeTokens>

export type WrapParams = FunctionArguments<typeof functions.wrap>
export type WrapReturn = FunctionReturn<typeof functions.wrap>

