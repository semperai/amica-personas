import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_, DateTimeColumn as DateTimeColumn_} from "@subsquid/typeorm-store"
import {Chain} from "./chain.model"

@Entity_()
export class AmicaTokenDeposit {
    constructor(props?: Partial<AmicaTokenDeposit>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => Chain, {nullable: true})
    chain!: Chain

    @Index_()
    @StringColumn_({nullable: false})
    depositor!: string

    @Index_()
    @StringColumn_({nullable: false})
    token!: string

    @BigIntColumn_({nullable: false})
    amount!: bigint

    @DateTimeColumn_({nullable: false})
    timestamp!: Date

    @BigIntColumn_({nullable: false})
    block!: bigint

    @Index_()
    @StringColumn_({nullable: false})
    txHash!: string
}
