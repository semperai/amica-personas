import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, StringColumn as StringColumn_, BigIntColumn as BigIntColumn_, BooleanColumn as BooleanColumn_, DateTimeColumn as DateTimeColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"
import {Persona} from "./persona.model"

@Entity_()
export class Trade {
    constructor(props?: Partial<Trade>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => Persona, {nullable: true})
    persona!: Persona

    @Index_()
    @StringColumn_({nullable: false})
    trader!: string

    @BigIntColumn_({nullable: false})
    amountIn!: bigint

    @BigIntColumn_({nullable: false})
    amountOut!: bigint

    @BigIntColumn_({nullable: false})
    feeAmount!: bigint

    @BooleanColumn_({nullable: false})
    isBuy!: boolean

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
}
