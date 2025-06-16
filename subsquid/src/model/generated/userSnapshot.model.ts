import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, BigIntColumn as BigIntColumn_, DateTimeColumn as DateTimeColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class UserSnapshot {
    constructor(props?: Partial<UserSnapshot>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_({unique: true})
    @StringColumn_({nullable: false})
    user!: string

    @BigIntColumn_({nullable: false})
    currentBalance!: bigint

    @BigIntColumn_({nullable: false})
    currentBlock!: bigint

    @BigIntColumn_({nullable: false})
    pendingBalance!: bigint

    @BigIntColumn_({nullable: false})
    pendingBlock!: bigint

    @DateTimeColumn_({nullable: false})
    lastUpdated!: Date
}
