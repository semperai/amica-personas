import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, BigIntColumn as BigIntColumn_, StringColumn as StringColumn_, BooleanColumn as BooleanColumn_, DateTimeColumn as DateTimeColumn_, IntColumn as IntColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {Chain} from "./chain.model"
import {Metadata} from "./metadata.model"
import {Trade} from "./trade.model"

@Entity_()
export class Persona {
    constructor(props?: Partial<Persona>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => Chain, {nullable: true})
    chain!: Chain

    @Index_()
    @BigIntColumn_({nullable: false})
    tokenId!: bigint

    @Index_()
    @StringColumn_({nullable: false})
    creator!: string

    @Index_()
    @StringColumn_({nullable: false})
    name!: string

    @Index_()
    @StringColumn_({nullable: false})
    symbol!: string

    @Index_()
    @StringColumn_({nullable: false})
    erc20Token!: string

    @Index_()
    @StringColumn_({nullable: false})
    pairToken!: string

    @BooleanColumn_({nullable: false})
    pairCreated!: boolean

    @StringColumn_({nullable: true})
    pairAddress!: string | undefined | null

    @DateTimeColumn_({nullable: false})
    createdAt!: Date

    @BigIntColumn_({nullable: false})
    createdAtBlock!: bigint

    @BigIntColumn_({nullable: false})
    totalVolume24h!: bigint

    @BigIntColumn_({nullable: false})
    totalVolumeAllTime!: bigint

    @IntColumn_({nullable: false})
    totalTrades24h!: number

    @IntColumn_({nullable: false})
    totalTradesAllTime!: number

    @IntColumn_({nullable: false})
    uniqueTraders24h!: number

    @IntColumn_({nullable: false})
    uniqueTradersAllTime!: number

    @BigIntColumn_({nullable: false})
    totalDeposited!: bigint

    @BigIntColumn_({nullable: false})
    tokensSold!: bigint

    @BigIntColumn_({nullable: false})
    graduationThreshold!: bigint

    @BooleanColumn_({nullable: false})
    isGraduated!: boolean

    @OneToMany_(() => Metadata, e => e.persona)
    metadata!: Metadata[]

    @OneToMany_(() => Trade, e => e.persona)
    trades!: Trade[]
}
