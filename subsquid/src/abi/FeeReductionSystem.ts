import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    FeeReductionConfigUpdated: event("0xa97cff8a67653acc6e6e0ffc403903a5ec5c67d5fb405c19755df70b4ee7e0ec", "FeeReductionConfigUpdated(uint256,uint256,uint24,uint24)", {"minAmicaForReduction": p.uint256, "maxAmicaForReduction": p.uint256, "baseFee": p.uint24, "maxDiscountedFee": p.uint24}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    SnapshotActivated: event("0xb2b6d53b7f66b79967ddf8867d2d95e7812e49564cacd2f293eb910aea65c46a", "SnapshotActivated(address,uint256,uint256)", {"user": indexed(p.address), "activeBalance": p.uint256, "activationBlock": p.uint256}),
    SnapshotUpdated: event("0x749a895977946fbb427a7c3da0a86bf47a5d5a6046dcea26f5e23321fdb244be", "SnapshotUpdated(address,uint256,uint256)", {"user": indexed(p.address), "balance": p.uint256, "blockNumber": p.uint256}),
}

export const functions = {
    SNAPSHOT_DELAY: viewFun("0xabb95227", "SNAPSHOT_DELAY()", {}, p.uint256),
    amicaToken: viewFun("0xa04e401a", "amicaToken()", {}, p.address),
    configureFeeReduction: fun("0x7ed6f703", "configureFeeReduction(uint256,uint256,uint24,uint24)", {"minAmicaForReduction": p.uint256, "maxAmicaForReduction": p.uint256, "baseFee": p.uint24, "maxDiscountedFee": p.uint24}, ),
    factory: viewFun("0xc45a0155", "factory()", {}, p.address),
    feeReductionConfig: viewFun("0x1910a5e6", "feeReductionConfig()", {}, {"minAmicaForReduction": p.uint256, "maxAmicaForReduction": p.uint256, "baseFee": p.uint24, "maxDiscountedFee": p.uint24}),
    getBlocksUntilActive: viewFun("0x36a705fd", "getBlocksUntilActive(address)", {"user": p.address}, p.uint256),
    getEffectiveBalance: viewFun("0xe45aa098", "getEffectiveBalance(address)", {"user": p.address}, p.uint256),
    getFee: viewFun("0xb88c9148", "getFee(address)", {"user": p.address}, p.uint24),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    renounceOwnership: fun("0x715018a6", "renounceOwnership()", {}, ),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    updateSnapshot: fun("0x69240426", "updateSnapshot()", {}, ),
    userSnapshots: viewFun("0xc8a37bf1", "userSnapshots(address)", {"_0": p.address}, {"activeBalance": p.uint256, "activeBlock": p.uint256, "pendingBalance": p.uint256, "pendingBlock": p.uint256}),
}

export class Contract extends ContractBase {

    SNAPSHOT_DELAY() {
        return this.eth_call(functions.SNAPSHOT_DELAY, {})
    }

    amicaToken() {
        return this.eth_call(functions.amicaToken, {})
    }

    factory() {
        return this.eth_call(functions.factory, {})
    }

    feeReductionConfig() {
        return this.eth_call(functions.feeReductionConfig, {})
    }

    getBlocksUntilActive(user: GetBlocksUntilActiveParams["user"]) {
        return this.eth_call(functions.getBlocksUntilActive, {user})
    }

    getEffectiveBalance(user: GetEffectiveBalanceParams["user"]) {
        return this.eth_call(functions.getEffectiveBalance, {user})
    }

    getFee(user: GetFeeParams["user"]) {
        return this.eth_call(functions.getFee, {user})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    userSnapshots(_0: UserSnapshotsParams["_0"]) {
        return this.eth_call(functions.userSnapshots, {_0})
    }
}

/// Event types
export type FeeReductionConfigUpdatedEventArgs = EParams<typeof events.FeeReductionConfigUpdated>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type SnapshotActivatedEventArgs = EParams<typeof events.SnapshotActivated>
export type SnapshotUpdatedEventArgs = EParams<typeof events.SnapshotUpdated>

/// Function types
export type SNAPSHOT_DELAYParams = FunctionArguments<typeof functions.SNAPSHOT_DELAY>
export type SNAPSHOT_DELAYReturn = FunctionReturn<typeof functions.SNAPSHOT_DELAY>

export type AmicaTokenParams = FunctionArguments<typeof functions.amicaToken>
export type AmicaTokenReturn = FunctionReturn<typeof functions.amicaToken>

export type ConfigureFeeReductionParams = FunctionArguments<typeof functions.configureFeeReduction>
export type ConfigureFeeReductionReturn = FunctionReturn<typeof functions.configureFeeReduction>

export type FactoryParams = FunctionArguments<typeof functions.factory>
export type FactoryReturn = FunctionReturn<typeof functions.factory>

export type FeeReductionConfigParams = FunctionArguments<typeof functions.feeReductionConfig>
export type FeeReductionConfigReturn = FunctionReturn<typeof functions.feeReductionConfig>

export type GetBlocksUntilActiveParams = FunctionArguments<typeof functions.getBlocksUntilActive>
export type GetBlocksUntilActiveReturn = FunctionReturn<typeof functions.getBlocksUntilActive>

export type GetEffectiveBalanceParams = FunctionArguments<typeof functions.getEffectiveBalance>
export type GetEffectiveBalanceReturn = FunctionReturn<typeof functions.getEffectiveBalance>

export type GetFeeParams = FunctionArguments<typeof functions.getFee>
export type GetFeeReturn = FunctionReturn<typeof functions.getFee>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type RenounceOwnershipParams = FunctionArguments<typeof functions.renounceOwnership>
export type RenounceOwnershipReturn = FunctionReturn<typeof functions.renounceOwnership>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type UpdateSnapshotParams = FunctionArguments<typeof functions.updateSnapshot>
export type UpdateSnapshotReturn = FunctionReturn<typeof functions.updateSnapshot>

export type UserSnapshotsParams = FunctionArguments<typeof functions.userSnapshots>
export type UserSnapshotsReturn = FunctionReturn<typeof functions.userSnapshots>

