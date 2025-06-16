import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"

@Entity_()
export class StakingRewardClaim {
    constructor(props?: Partial<StakingRewardClaim>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @Column_("text", {nullable: false})
    user!: string

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    totalAmount!: bigint

    @Column_("timestamp with time zone", {nullable: false})
    timestamp!: Date

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    block!: bigint

    @Index_()
    @Column_("text", {nullable: false})
    txHash!: string
}
