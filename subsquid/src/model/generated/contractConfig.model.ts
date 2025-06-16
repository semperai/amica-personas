import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, DateTimeColumn as DateTimeColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class ContractConfig {
    constructor(props?: Partial<ContractConfig>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @StringColumn_({nullable: false})
    personaFactory!: string

    @StringColumn_({nullable: true})
    stakingRewards!: string | undefined | null

    @StringColumn_({nullable: true})
    bridgeWrapper!: string | undefined | null

    @StringColumn_({nullable: false})
    amicaToken!: string

    @DateTimeColumn_({nullable: false})
    lastUpdated!: Date

    @BigIntColumn_({nullable: false})
    lastUpdatedBlock!: bigint
}
