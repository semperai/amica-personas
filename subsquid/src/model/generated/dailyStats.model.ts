import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, DateTimeColumn as DateTimeColumn_, Index as Index_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class DailyStats {
    constructor(props?: Partial<DailyStats>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @DateTimeColumn_({nullable: false})
    date!: Date

    @IntColumn_({nullable: false})
    newPersonas!: number

    @IntColumn_({nullable: false})
    trades!: number

    @BigIntColumn_({nullable: false})
    volume!: bigint

    @IntColumn_({nullable: false})
    uniqueTraders!: number

    @BigIntColumn_({nullable: false})
    bridgeVolume!: bigint
}
