import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_, DateTimeColumn as DateTimeColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class GlobalStats {
    constructor(props?: Partial<GlobalStats>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @IntColumn_({nullable: false})
    totalPersonas!: number

    @IntColumn_({nullable: false})
    totalTrades!: number

    @BigIntColumn_({nullable: false})
    totalVolume!: bigint

    @IntColumn_({nullable: false})
    totalStakingPools!: number

    @BigIntColumn_({nullable: false})
    totalStaked!: bigint

    @BigIntColumn_({nullable: false})
    totalBridgeVolume!: bigint

    @DateTimeColumn_({nullable: false})
    lastUpdated!: Date
}
