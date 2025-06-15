import * as p from '@subsquid/evm-codec'
import { event, fun, viewFun, indexed, ContractBase } from '@subsquid/evm-abi'
import type { EventParams as EParams, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi'

export const events = {
    Deposit: event("0x90890809c654f11d6e72a28fa60149770a0d11ec6c92319d6ceb2bb0a4ea1a15", "Deposit(address,uint256,uint256)", {"user": indexed(p.address), "poolId": indexed(p.uint256), "amount": p.uint256}),
    DepositLocked: event("0xaf371f6c2249ff29567a58317966ff76f384986ddbdd83922a2beeff54c68d19", "DepositLocked(address,uint256,uint256,uint256,uint256,uint256)", {"user": indexed(p.address), "poolId": indexed(p.uint256), "amount": p.uint256, "lockId": p.uint256, "unlockTime": p.uint256, "multiplier": p.uint256}),
    EmergencyExit: event("0xa4c9c75415df35968a558e9feb45cc3bdba07d1bf6ab989adead7488a720d2c1", "EmergencyExit(address,uint256,uint256)", {"user": indexed(p.address), "poolId": indexed(p.uint256), "amount": p.uint256}),
    EmergencyWithdraw: event("0x5fafa99d0643513820be26656b45130b01e1c03062e1266bf36f88cbd3bd9695", "EmergencyWithdraw(address,uint256)", {"token": indexed(p.address), "amount": p.uint256}),
    LockTierAdded: event("0x62fa294915146f3737d4da5c6c457317c64e81f20b763268e20ca9781f75ae4f", "LockTierAdded(uint256,uint256)", {"duration": p.uint256, "multiplier": p.uint256}),
    LockTierUpdated: event("0x543b8d23705bb826c3c1a9184c62f221ee06a4308a50023409fe53a8a75aedd7", "LockTierUpdated(uint256,uint256,uint256)", {"index": p.uint256, "duration": p.uint256, "multiplier": p.uint256}),
    OwnershipTransferred: event("0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0", "OwnershipTransferred(address,address)", {"previousOwner": indexed(p.address), "newOwner": indexed(p.address)}),
    PoolAdded: event("0x3304593749274d0d6b1823f7eb984f8cdd14e8a4847f1c830f70af8b55189bf4", "PoolAdded(uint256,address,uint256,bool)", {"poolId": indexed(p.uint256), "lpToken": indexed(p.address), "allocBasisPoints": p.uint256, "isAgentPool": p.bool}),
    PoolUpdated: event("0xec70f7b7f8beefa9ff0456053baafec83986e3915f156e2ed04b0acb57d7dd55", "PoolUpdated(uint256,uint256,bool)", {"poolId": indexed(p.uint256), "allocBasisPoints": p.uint256, "isActive": p.bool}),
    RewardPeriodUpdated: event("0x8dac4be85cb6508c2480ee75d110973601db7c7c414262229a5c01d37a427665", "RewardPeriodUpdated(uint256,uint256)", {"startBlock": p.uint256, "endBlock": p.uint256}),
    RewardRateUpdated: event("0x41d466ebd06fb97e7786086ac8b69b7eb7da798592036251291d34e9791cde01", "RewardRateUpdated(uint256)", {"amicaPerBlock": p.uint256}),
    RewardsClaimed: event("0xfc30cddea38e2bf4d6ea7d3f9ed3b6ad7f176419f4963bd81318067a4aee73fe", "RewardsClaimed(address,uint256)", {"user": indexed(p.address), "amount": p.uint256}),
    Withdraw: event("0xf279e6a1f5e320cca91135676d9cb6e44ca8a08c0b88342bcdb1144f6511b568", "Withdraw(address,uint256,uint256)", {"user": indexed(p.address), "poolId": indexed(p.uint256), "amount": p.uint256}),
    WithdrawLocked: event("0xafd05521e8f64c67ca9291b088626294a1cf1cd504a739ef8931569fecc5e732", "WithdrawLocked(address,uint256,uint256,uint256)", {"user": indexed(p.address), "poolId": indexed(p.uint256), "lockId": p.uint256, "amount": p.uint256}),
}

export const functions = {
    BASIS_POINTS: viewFun("0xe1f1c4a7", "BASIS_POINTS()", {}, p.uint256),
    MAX_LOCK_MULTIPLIER: viewFun("0xb0b91517", "MAX_LOCK_MULTIPLIER()", {}, p.uint256),
    PRECISION: viewFun("0xaaf5eb68", "PRECISION()", {}, p.uint256),
    addPool: fun("0x5e925981", "addPool(address,uint256,bool,uint256)", {"_lpToken": p.address, "_allocBasisPoints": p.uint256, "_isAgentPool": p.bool, "_personaTokenId": p.uint256}, ),
    amicaPerBlock: viewFun("0xe2d4967e", "amicaPerBlock()", {}, p.uint256),
    amicaToken: viewFun("0xa04e401a", "amicaToken()", {}, p.address),
    claimAll: fun("0xd1058e59", "claimAll()", {}, ),
    claimPool: fun("0x795d121c", "claimPool(uint256)", {"_poolId": p.uint256}, ),
    emergencyExitPool: fun("0x024c6090", "emergencyExitPool(uint256)", {"_poolId": p.uint256}, ),
    emergencyWithdraw: fun("0x95ccea67", "emergencyWithdraw(address,uint256)", {"_token": p.address, "_amount": p.uint256}, ),
    endBlock: viewFun("0x083c6323", "endBlock()", {}, p.uint256),
    estimatedTotalPendingRewards: viewFun("0xb60f71ff", "estimatedTotalPendingRewards(address)", {"_user": p.address}, p.uint256),
    getLockTier: viewFun("0xaff9f95f", "getLockTier(uint256)", {"_index": p.uint256}, {"duration": p.uint256, "multiplier": p.uint256}),
    getMultiplier: viewFun("0x8dbb1e3a", "getMultiplier(uint256,uint256)", {"_from": p.uint256, "_to": p.uint256}, p.uint256),
    getPoolAllocationPercentage: viewFun("0x9d75a656", "getPoolAllocationPercentage(uint256)", {"_poolId": p.uint256}, p.uint256),
    getPoolIdByLpToken: viewFun("0x25063e7a", "getPoolIdByLpToken(address)", {"_lpToken": p.address}, p.uint256),
    getPoolInfo: viewFun("0x2f380b35", "getPoolInfo(uint256)", {"_poolId": p.uint256}, {"lpToken": p.address, "allocBasisPoints": p.uint256, "totalStaked": p.uint256, "weightedTotal": p.uint256, "isActive": p.bool, "isAgentPool": p.bool}),
    getRemainingAllocation: viewFun("0x0949fd3f", "getRemainingAllocation()", {}, p.uint256),
    getUserActivePools: viewFun("0x1d579600", "getUserActivePools(address)", {"_user": p.address}, p.array(p.uint256)),
    getUserEffectiveStake: viewFun("0xa0318e4f", "getUserEffectiveStake(uint256,address)", {"_poolId": p.uint256, "_user": p.address}, p.uint256),
    getUserInfo: viewFun("0x1069f3b5", "getUserInfo(uint256,address)", {"_poolId": p.uint256, "_user": p.address}, {"flexibleAmount": p.uint256, "lockedAmount": p.uint256, "effectiveStake": p.uint256, "unclaimedRewards": p.uint256, "numberOfLocks": p.uint256}),
    getUserLocks: viewFun("0x019b99fe", "getUserLocks(uint256,address)", {"_poolId": p.uint256, "_user": p.address}, p.array(p.struct({"amount": p.uint256, "unlockTime": p.uint256, "lockMultiplier": p.uint256, "rewardDebt": p.uint256, "lockId": p.uint256}))),
    getUserTotalStaked: viewFun("0x7618ade5", "getUserTotalStaked(uint256,address)", {"_poolId": p.uint256, "_user": p.address}, p.uint256),
    lastMassUpdateBlock: viewFun("0xb9a31eec", "lastMassUpdateBlock()", {}, p.uint256),
    lockTiers: viewFun("0xb915a4fd", "lockTiers(uint256)", {"_0": p.uint256}, {"duration": p.uint256, "multiplier": p.uint256}),
    lockTiersLength: viewFun("0x4a9cdf57", "lockTiersLength()", {}, p.uint256),
    lpTokenToPoolId: viewFun("0x645e8d9b", "lpTokenToPoolId(address)", {"_0": p.address}, p.uint256),
    nextLockId: viewFun("0x6518a0b3", "nextLockId()", {}, p.uint256),
    owner: viewFun("0x8da5cb5b", "owner()", {}, p.address),
    pendingRewardsForPool: viewFun("0x9bea8c78", "pendingRewardsForPool(uint256,address)", {"_poolId": p.uint256, "_user": p.address}, p.uint256),
    personaFactory: viewFun("0xabfb5c8e", "personaFactory()", {}, p.address),
    poolInfo: viewFun("0x1526fe27", "poolInfo(uint256)", {"_0": p.uint256}, {"lpToken": p.address, "allocBasisPoints": p.uint256, "lastRewardBlock": p.uint256, "accAmicaPerShare": p.uint256, "totalStaked": p.uint256, "isAgentPool": p.bool, "personaTokenId": p.uint256, "isActive": p.bool}),
    poolLength: viewFun("0x081e3eda", "poolLength()", {}, p.uint256),
    poolWeightedTotal: viewFun("0x26eb6345", "poolWeightedTotal(uint256)", {"_0": p.uint256}, p.uint256),
    renounceOwnership: fun("0x715018a6", "renounceOwnership()", {}, ),
    setLockTier: fun("0xe94db7cf", "setLockTier(uint256,uint256,uint256)", {"index": p.uint256, "duration": p.uint256, "multiplier": p.uint256}, ),
    stake: fun("0x7b0472f0", "stake(uint256,uint256)", {"_poolId": p.uint256, "_amount": p.uint256}, ),
    stakeLocked: fun("0xe75734e1", "stakeLocked(uint256,uint256,uint256)", {"_poolId": p.uint256, "_amount": p.uint256, "_lockTierIndex": p.uint256}, ),
    startBlock: viewFun("0x48cd4cb1", "startBlock()", {}, p.uint256),
    totalAllocBasisPoints: viewFun("0x71bbafbb", "totalAllocBasisPoints()", {}, p.uint256),
    transferOwnership: fun("0xf2fde38b", "transferOwnership(address)", {"newOwner": p.address}, ),
    updatePool: fun("0x69ab3e32", "updatePool(uint256,uint256,bool)", {"_poolId": p.uint256, "_allocBasisPoints": p.uint256, "_isActive": p.bool}, ),
    updatePoolRewards: fun("0xadb82b31", "updatePoolRewards(uint256)", {"_poolId": p.uint256}, ),
    updateRewardPeriod: fun("0xfebbb13e", "updateRewardPeriod(uint256,uint256)", {"_startBlock": p.uint256, "_endBlock": p.uint256}, ),
    updateRewardRate: fun("0x9ef3a261", "updateRewardRate(uint256)", {"_amicaPerBlock": p.uint256}, ),
    userActivePools: viewFun("0x559b8e53", "userActivePools(address,uint256)", {"_0": p.address, "_1": p.uint256}, p.uint256),
    userHasStake: viewFun("0x7d8352f0", "userHasStake(address,uint256)", {"_0": p.address, "_1": p.uint256}, p.bool),
    userInfo: viewFun("0x93f1a40b", "userInfo(uint256,address)", {"_0": p.uint256, "_1": p.address}, {"amount": p.uint256, "rewardDebt": p.uint256, "unclaimedRewards": p.uint256, "lastClaimBlock": p.uint256}),
    userLastGlobalUpdate: viewFun("0x01ea9a91", "userLastGlobalUpdate(address)", {"_0": p.address}, p.uint256),
    userLockedAmount: viewFun("0x29c30e01", "userLockedAmount(uint256,address)", {"_0": p.uint256, "_1": p.address}, p.uint256),
    userLocks: viewFun("0x5720b54b", "userLocks(uint256,address,uint256)", {"_0": p.uint256, "_1": p.address, "_2": p.uint256}, {"amount": p.uint256, "unlockTime": p.uint256, "lockMultiplier": p.uint256, "rewardDebt": p.uint256, "lockId": p.uint256}),
    userTotalPendingRewards: viewFun("0x78672c0d", "userTotalPendingRewards(address)", {"_0": p.address}, p.uint256),
    userWeightedAmount: viewFun("0xd1cd0234", "userWeightedAmount(uint256,address)", {"_0": p.uint256, "_1": p.address}, p.uint256),
    withdraw: fun("0x441a3e70", "withdraw(uint256,uint256)", {"_poolId": p.uint256, "_amount": p.uint256}, ),
    withdrawLocked: fun("0x1f6cda29", "withdrawLocked(uint256,uint256)", {"_poolId": p.uint256, "_lockId": p.uint256}, ),
}

export class Contract extends ContractBase {

    BASIS_POINTS() {
        return this.eth_call(functions.BASIS_POINTS, {})
    }

    MAX_LOCK_MULTIPLIER() {
        return this.eth_call(functions.MAX_LOCK_MULTIPLIER, {})
    }

    PRECISION() {
        return this.eth_call(functions.PRECISION, {})
    }

    amicaPerBlock() {
        return this.eth_call(functions.amicaPerBlock, {})
    }

    amicaToken() {
        return this.eth_call(functions.amicaToken, {})
    }

    endBlock() {
        return this.eth_call(functions.endBlock, {})
    }

    estimatedTotalPendingRewards(_user: EstimatedTotalPendingRewardsParams["_user"]) {
        return this.eth_call(functions.estimatedTotalPendingRewards, {_user})
    }

    getLockTier(_index: GetLockTierParams["_index"]) {
        return this.eth_call(functions.getLockTier, {_index})
    }

    getMultiplier(_from: GetMultiplierParams["_from"], _to: GetMultiplierParams["_to"]) {
        return this.eth_call(functions.getMultiplier, {_from, _to})
    }

    getPoolAllocationPercentage(_poolId: GetPoolAllocationPercentageParams["_poolId"]) {
        return this.eth_call(functions.getPoolAllocationPercentage, {_poolId})
    }

    getPoolIdByLpToken(_lpToken: GetPoolIdByLpTokenParams["_lpToken"]) {
        return this.eth_call(functions.getPoolIdByLpToken, {_lpToken})
    }

    getPoolInfo(_poolId: GetPoolInfoParams["_poolId"]) {
        return this.eth_call(functions.getPoolInfo, {_poolId})
    }

    getRemainingAllocation() {
        return this.eth_call(functions.getRemainingAllocation, {})
    }

    getUserActivePools(_user: GetUserActivePoolsParams["_user"]) {
        return this.eth_call(functions.getUserActivePools, {_user})
    }

    getUserEffectiveStake(_poolId: GetUserEffectiveStakeParams["_poolId"], _user: GetUserEffectiveStakeParams["_user"]) {
        return this.eth_call(functions.getUserEffectiveStake, {_poolId, _user})
    }

    getUserInfo(_poolId: GetUserInfoParams["_poolId"], _user: GetUserInfoParams["_user"]) {
        return this.eth_call(functions.getUserInfo, {_poolId, _user})
    }

    getUserLocks(_poolId: GetUserLocksParams["_poolId"], _user: GetUserLocksParams["_user"]) {
        return this.eth_call(functions.getUserLocks, {_poolId, _user})
    }

    getUserTotalStaked(_poolId: GetUserTotalStakedParams["_poolId"], _user: GetUserTotalStakedParams["_user"]) {
        return this.eth_call(functions.getUserTotalStaked, {_poolId, _user})
    }

    lastMassUpdateBlock() {
        return this.eth_call(functions.lastMassUpdateBlock, {})
    }

    lockTiers(_0: LockTiersParams["_0"]) {
        return this.eth_call(functions.lockTiers, {_0})
    }

    lockTiersLength() {
        return this.eth_call(functions.lockTiersLength, {})
    }

    lpTokenToPoolId(_0: LpTokenToPoolIdParams["_0"]) {
        return this.eth_call(functions.lpTokenToPoolId, {_0})
    }

    nextLockId() {
        return this.eth_call(functions.nextLockId, {})
    }

    owner() {
        return this.eth_call(functions.owner, {})
    }

    pendingRewardsForPool(_poolId: PendingRewardsForPoolParams["_poolId"], _user: PendingRewardsForPoolParams["_user"]) {
        return this.eth_call(functions.pendingRewardsForPool, {_poolId, _user})
    }

    personaFactory() {
        return this.eth_call(functions.personaFactory, {})
    }

    poolInfo(_0: PoolInfoParams["_0"]) {
        return this.eth_call(functions.poolInfo, {_0})
    }

    poolLength() {
        return this.eth_call(functions.poolLength, {})
    }

    poolWeightedTotal(_0: PoolWeightedTotalParams["_0"]) {
        return this.eth_call(functions.poolWeightedTotal, {_0})
    }

    startBlock() {
        return this.eth_call(functions.startBlock, {})
    }

    totalAllocBasisPoints() {
        return this.eth_call(functions.totalAllocBasisPoints, {})
    }

    userActivePools(_0: UserActivePoolsParams["_0"], _1: UserActivePoolsParams["_1"]) {
        return this.eth_call(functions.userActivePools, {_0, _1})
    }

    userHasStake(_0: UserHasStakeParams["_0"], _1: UserHasStakeParams["_1"]) {
        return this.eth_call(functions.userHasStake, {_0, _1})
    }

    userInfo(_0: UserInfoParams["_0"], _1: UserInfoParams["_1"]) {
        return this.eth_call(functions.userInfo, {_0, _1})
    }

    userLastGlobalUpdate(_0: UserLastGlobalUpdateParams["_0"]) {
        return this.eth_call(functions.userLastGlobalUpdate, {_0})
    }

    userLockedAmount(_0: UserLockedAmountParams["_0"], _1: UserLockedAmountParams["_1"]) {
        return this.eth_call(functions.userLockedAmount, {_0, _1})
    }

    userLocks(_0: UserLocksParams["_0"], _1: UserLocksParams["_1"], _2: UserLocksParams["_2"]) {
        return this.eth_call(functions.userLocks, {_0, _1, _2})
    }

    userTotalPendingRewards(_0: UserTotalPendingRewardsParams["_0"]) {
        return this.eth_call(functions.userTotalPendingRewards, {_0})
    }

    userWeightedAmount(_0: UserWeightedAmountParams["_0"], _1: UserWeightedAmountParams["_1"]) {
        return this.eth_call(functions.userWeightedAmount, {_0, _1})
    }
}

/// Event types
export type DepositEventArgs = EParams<typeof events.Deposit>
export type DepositLockedEventArgs = EParams<typeof events.DepositLocked>
export type EmergencyExitEventArgs = EParams<typeof events.EmergencyExit>
export type EmergencyWithdrawEventArgs = EParams<typeof events.EmergencyWithdraw>
export type LockTierAddedEventArgs = EParams<typeof events.LockTierAdded>
export type LockTierUpdatedEventArgs = EParams<typeof events.LockTierUpdated>
export type OwnershipTransferredEventArgs = EParams<typeof events.OwnershipTransferred>
export type PoolAddedEventArgs = EParams<typeof events.PoolAdded>
export type PoolUpdatedEventArgs = EParams<typeof events.PoolUpdated>
export type RewardPeriodUpdatedEventArgs = EParams<typeof events.RewardPeriodUpdated>
export type RewardRateUpdatedEventArgs = EParams<typeof events.RewardRateUpdated>
export type RewardsClaimedEventArgs = EParams<typeof events.RewardsClaimed>
export type WithdrawEventArgs = EParams<typeof events.Withdraw>
export type WithdrawLockedEventArgs = EParams<typeof events.WithdrawLocked>

/// Function types
export type BASIS_POINTSParams = FunctionArguments<typeof functions.BASIS_POINTS>
export type BASIS_POINTSReturn = FunctionReturn<typeof functions.BASIS_POINTS>

export type MAX_LOCK_MULTIPLIERParams = FunctionArguments<typeof functions.MAX_LOCK_MULTIPLIER>
export type MAX_LOCK_MULTIPLIERReturn = FunctionReturn<typeof functions.MAX_LOCK_MULTIPLIER>

export type PRECISIONParams = FunctionArguments<typeof functions.PRECISION>
export type PRECISIONReturn = FunctionReturn<typeof functions.PRECISION>

export type AddPoolParams = FunctionArguments<typeof functions.addPool>
export type AddPoolReturn = FunctionReturn<typeof functions.addPool>

export type AmicaPerBlockParams = FunctionArguments<typeof functions.amicaPerBlock>
export type AmicaPerBlockReturn = FunctionReturn<typeof functions.amicaPerBlock>

export type AmicaTokenParams = FunctionArguments<typeof functions.amicaToken>
export type AmicaTokenReturn = FunctionReturn<typeof functions.amicaToken>

export type ClaimAllParams = FunctionArguments<typeof functions.claimAll>
export type ClaimAllReturn = FunctionReturn<typeof functions.claimAll>

export type ClaimPoolParams = FunctionArguments<typeof functions.claimPool>
export type ClaimPoolReturn = FunctionReturn<typeof functions.claimPool>

export type EmergencyExitPoolParams = FunctionArguments<typeof functions.emergencyExitPool>
export type EmergencyExitPoolReturn = FunctionReturn<typeof functions.emergencyExitPool>

export type EmergencyWithdrawParams = FunctionArguments<typeof functions.emergencyWithdraw>
export type EmergencyWithdrawReturn = FunctionReturn<typeof functions.emergencyWithdraw>

export type EndBlockParams = FunctionArguments<typeof functions.endBlock>
export type EndBlockReturn = FunctionReturn<typeof functions.endBlock>

export type EstimatedTotalPendingRewardsParams = FunctionArguments<typeof functions.estimatedTotalPendingRewards>
export type EstimatedTotalPendingRewardsReturn = FunctionReturn<typeof functions.estimatedTotalPendingRewards>

export type GetLockTierParams = FunctionArguments<typeof functions.getLockTier>
export type GetLockTierReturn = FunctionReturn<typeof functions.getLockTier>

export type GetMultiplierParams = FunctionArguments<typeof functions.getMultiplier>
export type GetMultiplierReturn = FunctionReturn<typeof functions.getMultiplier>

export type GetPoolAllocationPercentageParams = FunctionArguments<typeof functions.getPoolAllocationPercentage>
export type GetPoolAllocationPercentageReturn = FunctionReturn<typeof functions.getPoolAllocationPercentage>

export type GetPoolIdByLpTokenParams = FunctionArguments<typeof functions.getPoolIdByLpToken>
export type GetPoolIdByLpTokenReturn = FunctionReturn<typeof functions.getPoolIdByLpToken>

export type GetPoolInfoParams = FunctionArguments<typeof functions.getPoolInfo>
export type GetPoolInfoReturn = FunctionReturn<typeof functions.getPoolInfo>

export type GetRemainingAllocationParams = FunctionArguments<typeof functions.getRemainingAllocation>
export type GetRemainingAllocationReturn = FunctionReturn<typeof functions.getRemainingAllocation>

export type GetUserActivePoolsParams = FunctionArguments<typeof functions.getUserActivePools>
export type GetUserActivePoolsReturn = FunctionReturn<typeof functions.getUserActivePools>

export type GetUserEffectiveStakeParams = FunctionArguments<typeof functions.getUserEffectiveStake>
export type GetUserEffectiveStakeReturn = FunctionReturn<typeof functions.getUserEffectiveStake>

export type GetUserInfoParams = FunctionArguments<typeof functions.getUserInfo>
export type GetUserInfoReturn = FunctionReturn<typeof functions.getUserInfo>

export type GetUserLocksParams = FunctionArguments<typeof functions.getUserLocks>
export type GetUserLocksReturn = FunctionReturn<typeof functions.getUserLocks>

export type GetUserTotalStakedParams = FunctionArguments<typeof functions.getUserTotalStaked>
export type GetUserTotalStakedReturn = FunctionReturn<typeof functions.getUserTotalStaked>

export type LastMassUpdateBlockParams = FunctionArguments<typeof functions.lastMassUpdateBlock>
export type LastMassUpdateBlockReturn = FunctionReturn<typeof functions.lastMassUpdateBlock>

export type LockTiersParams = FunctionArguments<typeof functions.lockTiers>
export type LockTiersReturn = FunctionReturn<typeof functions.lockTiers>

export type LockTiersLengthParams = FunctionArguments<typeof functions.lockTiersLength>
export type LockTiersLengthReturn = FunctionReturn<typeof functions.lockTiersLength>

export type LpTokenToPoolIdParams = FunctionArguments<typeof functions.lpTokenToPoolId>
export type LpTokenToPoolIdReturn = FunctionReturn<typeof functions.lpTokenToPoolId>

export type NextLockIdParams = FunctionArguments<typeof functions.nextLockId>
export type NextLockIdReturn = FunctionReturn<typeof functions.nextLockId>

export type OwnerParams = FunctionArguments<typeof functions.owner>
export type OwnerReturn = FunctionReturn<typeof functions.owner>

export type PendingRewardsForPoolParams = FunctionArguments<typeof functions.pendingRewardsForPool>
export type PendingRewardsForPoolReturn = FunctionReturn<typeof functions.pendingRewardsForPool>

export type PersonaFactoryParams = FunctionArguments<typeof functions.personaFactory>
export type PersonaFactoryReturn = FunctionReturn<typeof functions.personaFactory>

export type PoolInfoParams = FunctionArguments<typeof functions.poolInfo>
export type PoolInfoReturn = FunctionReturn<typeof functions.poolInfo>

export type PoolLengthParams = FunctionArguments<typeof functions.poolLength>
export type PoolLengthReturn = FunctionReturn<typeof functions.poolLength>

export type PoolWeightedTotalParams = FunctionArguments<typeof functions.poolWeightedTotal>
export type PoolWeightedTotalReturn = FunctionReturn<typeof functions.poolWeightedTotal>

export type RenounceOwnershipParams = FunctionArguments<typeof functions.renounceOwnership>
export type RenounceOwnershipReturn = FunctionReturn<typeof functions.renounceOwnership>

export type SetLockTierParams = FunctionArguments<typeof functions.setLockTier>
export type SetLockTierReturn = FunctionReturn<typeof functions.setLockTier>

export type StakeParams = FunctionArguments<typeof functions.stake>
export type StakeReturn = FunctionReturn<typeof functions.stake>

export type StakeLockedParams = FunctionArguments<typeof functions.stakeLocked>
export type StakeLockedReturn = FunctionReturn<typeof functions.stakeLocked>

export type StartBlockParams = FunctionArguments<typeof functions.startBlock>
export type StartBlockReturn = FunctionReturn<typeof functions.startBlock>

export type TotalAllocBasisPointsParams = FunctionArguments<typeof functions.totalAllocBasisPoints>
export type TotalAllocBasisPointsReturn = FunctionReturn<typeof functions.totalAllocBasisPoints>

export type TransferOwnershipParams = FunctionArguments<typeof functions.transferOwnership>
export type TransferOwnershipReturn = FunctionReturn<typeof functions.transferOwnership>

export type UpdatePoolParams = FunctionArguments<typeof functions.updatePool>
export type UpdatePoolReturn = FunctionReturn<typeof functions.updatePool>

export type UpdatePoolRewardsParams = FunctionArguments<typeof functions.updatePoolRewards>
export type UpdatePoolRewardsReturn = FunctionReturn<typeof functions.updatePoolRewards>

export type UpdateRewardPeriodParams = FunctionArguments<typeof functions.updateRewardPeriod>
export type UpdateRewardPeriodReturn = FunctionReturn<typeof functions.updateRewardPeriod>

export type UpdateRewardRateParams = FunctionArguments<typeof functions.updateRewardRate>
export type UpdateRewardRateReturn = FunctionReturn<typeof functions.updateRewardRate>

export type UserActivePoolsParams = FunctionArguments<typeof functions.userActivePools>
export type UserActivePoolsReturn = FunctionReturn<typeof functions.userActivePools>

export type UserHasStakeParams = FunctionArguments<typeof functions.userHasStake>
export type UserHasStakeReturn = FunctionReturn<typeof functions.userHasStake>

export type UserInfoParams = FunctionArguments<typeof functions.userInfo>
export type UserInfoReturn = FunctionReturn<typeof functions.userInfo>

export type UserLastGlobalUpdateParams = FunctionArguments<typeof functions.userLastGlobalUpdate>
export type UserLastGlobalUpdateReturn = FunctionReturn<typeof functions.userLastGlobalUpdate>

export type UserLockedAmountParams = FunctionArguments<typeof functions.userLockedAmount>
export type UserLockedAmountReturn = FunctionReturn<typeof functions.userLockedAmount>

export type UserLocksParams = FunctionArguments<typeof functions.userLocks>
export type UserLocksReturn = FunctionReturn<typeof functions.userLocks>

export type UserTotalPendingRewardsParams = FunctionArguments<typeof functions.userTotalPendingRewards>
export type UserTotalPendingRewardsReturn = FunctionReturn<typeof functions.userTotalPendingRewards>

export type UserWeightedAmountParams = FunctionArguments<typeof functions.userWeightedAmount>
export type UserWeightedAmountReturn = FunctionReturn<typeof functions.userWeightedAmount>

export type WithdrawParams = FunctionArguments<typeof functions.withdraw>
export type WithdrawReturn = FunctionReturn<typeof functions.withdraw>

export type WithdrawLockedParams = FunctionArguments<typeof functions.withdrawLocked>
export type WithdrawLockedReturn = FunctionReturn<typeof functions.withdrawLocked>

