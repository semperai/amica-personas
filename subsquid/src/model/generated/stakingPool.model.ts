import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_, OneToMany as OneToMany_} from "typeorm"
import * as marshal from "./marshal"
import {UserStake} from "./userStake.model"

@Entity_()
export class StakingPool {
    constructor(props?: Partial<StakingPool>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @Column_("int4", {nullable: false})
    poolId!: number

    @Index_()
    @Column_("text", {nullable: false})
    lpToken!: string

    @Column_("int4", {nullable: false})
    allocBasisPoints!: number

    @Column_("bool", {nullable: false})
    isAgentPool!: boolean

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: true})
    personaTokenId!: bigint | undefined | null

    @Column_("bool", {nullable: false})
    isActive!: boolean

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    totalStaked!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    accAmicaPerShare!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    lastRewardBlock!: bigint

    @Column_("timestamp with time zone", {nullable: false})
    createdAt!: Date

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    createdAtBlock!: bigint

    @OneToMany_(() => UserStake, e => e.pool)
    userStakes!: UserStake[]
}
