import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_, DateTimeColumn as DateTimeColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class FeeConfig {
    constructor(props?: Partial<FeeConfig>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @IntColumn_({nullable: false})
    feePercentage!: number

    @IntColumn_({nullable: false})
    creatorShare!: number

    @BigIntColumn_({nullable: false})
    minAmicaForReduction!: bigint

    @BigIntColumn_({nullable: false})
    maxAmicaForReduction!: bigint

    @IntColumn_({nullable: false})
    minReductionMultiplier!: number

    @IntColumn_({nullable: false})
    maxReductionMultiplier!: number

    @DateTimeColumn_({nullable: false})
    lastUpdated!: Date
}
