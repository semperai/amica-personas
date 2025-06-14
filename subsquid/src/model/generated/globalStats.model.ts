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

    @BigIntColumn_({nullable: false})
    totalVolume24h!: bigint

    @BigIntColumn_({nullable: false})
    totalVolumeAllTime!: bigint

    @BigIntColumn_({nullable: false})
    totalBridgedVolume!: bigint

    @IntColumn_({nullable: false})
    totalChains!: number

    @DateTimeColumn_({nullable: false})
    lastUpdated!: Date
}
