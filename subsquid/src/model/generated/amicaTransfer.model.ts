import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, BigIntColumn as BigIntColumn_, DateTimeColumn as DateTimeColumn_, IntColumn as IntColumn_, BooleanColumn as BooleanColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class AmicaTransfer {
    constructor(props?: Partial<AmicaTransfer>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @StringColumn_({nullable: false})
    from!: string

    @Index_()
    @StringColumn_({nullable: false})
    to!: string

    @BigIntColumn_({nullable: false})
    value!: bigint

    @DateTimeColumn_({nullable: false})
    timestamp!: Date

    @BigIntColumn_({nullable: false})
    block!: bigint

    @Index_()
    @StringColumn_({nullable: false})
    txHash!: string

    @Index_()
    @IntColumn_({nullable: false})
    chainId!: number

    @BooleanColumn_({nullable: false})
    isToFactory!: boolean

    @BooleanColumn_({nullable: false})
    isFromFactory!: boolean

    @BooleanColumn_({nullable: false})
    isToStaking!: boolean

    @BooleanColumn_({nullable: false})
    isFromStaking!: boolean

    @BooleanColumn_({nullable: false})
    isToBridge!: boolean

    @BooleanColumn_({nullable: false})
    isFromBridge!: boolean
}
