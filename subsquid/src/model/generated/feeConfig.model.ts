import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BigIntColumn as BigIntColumn_, IntColumn as IntColumn_, DateTimeColumn as DateTimeColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class FeeConfig {
    constructor(props?: Partial<FeeConfig>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @BigIntColumn_({nullable: false})
    minAmicaForReduction!: bigint

    @BigIntColumn_({nullable: false})
    maxAmicaForReduction!: bigint

    @IntColumn_({nullable: false})
    baseFee!: number

    @IntColumn_({nullable: false})
    maxDiscountedFee!: number

    @DateTimeColumn_({nullable: false})
    lastUpdated!: Date
}
