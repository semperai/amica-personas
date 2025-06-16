import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, BooleanColumn as BooleanColumn_, BigIntColumn as BigIntColumn_, DateTimeColumn as DateTimeColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class PairingConfig {
    constructor(props?: Partial<PairingConfig>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_({unique: true})
    @StringColumn_({nullable: false})
    token!: string

    @BooleanColumn_({nullable: false})
    enabled!: boolean

    @BigIntColumn_({nullable: false})
    mintCost!: bigint

    @BigIntColumn_({nullable: false})
    graduationThreshold!: bigint

    @DateTimeColumn_({nullable: false})
    lastUpdated!: Date

    @BigIntColumn_({nullable: false})
    lastUpdatedBlock!: bigint
}
