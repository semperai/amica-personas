import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_, DateTimeColumn as DateTimeColumn_, IntColumn as IntColumn_, BooleanColumn as BooleanColumn_} from "@subsquid/typeorm-store"
import {UserStake} from "./userStake.model"

@Entity_()
export class StakeLock {
    constructor(props?: Partial<StakeLock>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => UserStake, {nullable: true})
    userStake!: UserStake

    @Index_()
    @BigIntColumn_({nullable: false})
    lockId!: bigint

    @BigIntColumn_({nullable: false})
    amount!: bigint

    @Index_()
    @DateTimeColumn_({nullable: false})
    unlockTime!: Date

    @IntColumn_({nullable: false})
    lockMultiplier!: number

    @DateTimeColumn_({nullable: false})
    createdAt!: Date

    @BigIntColumn_({nullable: false})
    createdAtBlock!: bigint

    @BooleanColumn_({nullable: false})
    isWithdrawn!: boolean
}
