import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_, DateTimeColumn as DateTimeColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {StakingPool} from "./stakingPool.model"
import {StakeLock} from "./stakeLock.model"

@Entity_()
export class UserStake {
    constructor(props?: Partial<UserStake>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => StakingPool, {nullable: true})
    pool!: StakingPool

    @Index_()
    @StringColumn_({nullable: false})
    user!: string

    @BigIntColumn_({nullable: false})
    flexibleAmount!: bigint

    @BigIntColumn_({nullable: false})
    lockedAmount!: bigint

    @BigIntColumn_({nullable: false})
    unclaimedRewards!: bigint

    @DateTimeColumn_({nullable: false})
    firstStakeAt!: Date

    @DateTimeColumn_({nullable: false})
    lastStakeAt!: Date

    @OneToMany_(() => StakeLock, e => e.userStake)
    locks!: StakeLock[]
}
