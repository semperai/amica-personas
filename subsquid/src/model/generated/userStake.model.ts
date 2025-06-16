import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, OneToMany as OneToMany_} from "typeorm"
import * as marshal from "./marshal"
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
    @Column_("text", {nullable: false})
    user!: string

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    flexibleAmount!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    lockedAmount!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    unclaimedRewards!: bigint

    @Column_("timestamp with time zone", {nullable: false})
    firstStakeAt!: Date

    @Column_("timestamp with time zone", {nullable: false})
    lastStakeAt!: Date

    @OneToMany_(() => StakeLock, e => e.userStake)
    locks!: StakeLock[]
}
