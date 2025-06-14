import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, StringColumn as StringColumn_, Index as Index_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"

@Entity_()
export class Chain {
    constructor(props?: Partial<Chain>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @StringColumn_({nullable: false})
    name!: string

    @StringColumn_({nullable: false})
    amicaToken!: string

    @StringColumn_({nullable: false})
    factoryAddress!: string

    @StringColumn_({nullable: true})
    bridgeWrapperAddress!: string | undefined | null

    @IntColumn_({nullable: false})
    totalPersonas!: number

    @BigIntColumn_({nullable: false})
    totalVolume!: bigint
}
