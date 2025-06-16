import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"
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
    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    lockId!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    amount!: bigint

    @Index_()
    @Column_("timestamp with time zone", {nullable: false})
    unlockTime!: Date

    @Column_("int4", {nullable: false})
    lockMultiplier!: number

    @Column_("timestamp with time zone", {nullable: false})
    createdAt!: Date

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    createdAtBlock!: bigint

    @Column_("bool", {nullable: false})
    isWithdrawn!: boolean
}
