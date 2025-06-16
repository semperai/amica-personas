import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, BigIntColumn as BigIntColumn_, Index as Index_, StringColumn as StringColumn_, BooleanColumn as BooleanColumn_, DateTimeColumn as DateTimeColumn_, OneToMany as OneToMany_} from "@subsquid/typeorm-store"
import {Trade} from "./trade.model"
import {PersonaMetadata} from "./personaMetadata.model"
import {AgentDeposit} from "./agentDeposit.model"

@Entity_()
export class Persona {
    constructor(props?: Partial<Persona>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @BigIntColumn_({nullable: false})
    tokenId!: bigint

    @Index_()
    @StringColumn_({nullable: false})
    creator!: string

    @Index_()
    @StringColumn_({nullable: false})
    owner!: string

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

    @StringColumn_({nullable: true})
    agentToken!: string | undefined | null

    @BooleanColumn_({nullable: false})
    pairCreated!: boolean

    @StringColumn_({nullable: true})
    pairAddress!: string | undefined | null

    @DateTimeColumn_({nullable: false})
    createdAt!: Date

    @BigIntColumn_({nullable: false})
    createdAtBlock!: bigint

    @BigIntColumn_({nullable: false})
    totalDeposited!: bigint

    @BigIntColumn_({nullable: false})
    tokensSold!: bigint

    @BigIntColumn_({nullable: false})
    graduationThreshold!: bigint

    @BigIntColumn_({nullable: false})
    totalAgentDeposited!: bigint

    @BigIntColumn_({nullable: false})
    minAgentTokens!: bigint

    @OneToMany_(() => Trade, e => e.persona)
    trades!: Trade[]

    @OneToMany_(() => PersonaMetadata, e => e.persona)
    metadata!: PersonaMetadata[]

    @OneToMany_(() => AgentDeposit, e => e.persona)
    agentDeposits!: AgentDeposit[]
}
