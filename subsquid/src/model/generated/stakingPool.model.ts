import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, IntColumn as IntColumn_, Index as Index_, StringColumn as StringColumn_, BooleanColumn as BooleanColumn_, BigIntColumn as BigIntColumn_, DateTimeColumn as DateTimeColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {UserStake} from "./userStake.model"

@Entity_()
export class StakingPool {
    constructor(props?: Partial<StakingPool>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @IntColumn_({nullable: false})
    poolId!: number

    @Index_()
    @StringColumn_({nullable: false})
    lpToken!: string

    @IntColumn_({nullable: false})
    allocBasisPoints!: number

    @BooleanColumn_({nullable: false})
    isAgentPool!: boolean

    @BigIntColumn_({nullable: true})
    personaTokenId!: bigint | undefined | null

    @BooleanColumn_({nullable: false})
    isActive!: boolean

    @BigIntColumn_({nullable: false})
    totalStaked!: bigint

    @BigIntColumn_({nullable: false})
    accAmicaPerShare!: bigint

    @BigIntColumn_({nullable: false})
    lastRewardBlock!: bigint

    @DateTimeColumn_({nullable: false})
    createdAt!: Date

    @BigIntColumn_({nullable: false})
    createdAtBlock!: bigint

    @OneToMany_(() => UserStake, e => e.pool)
    userStakes!: UserStake[]
}
