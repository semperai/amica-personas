import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_, OneToMany as OneToMany_} from "typeorm"
import * as marshal from "./marshal"
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
    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    tokenId!: bigint

    @Index_()
    @Column_("text", {nullable: false})
    creator!: string

    @Index_()
    @Column_("text", {nullable: false})
    owner!: string

    @Index_()
    @Column_("text", {nullable: false})
    name!: string

    @Index_()
    @Column_("text", {nullable: false})
    symbol!: string

    @Index_()
    @Column_("text", {nullable: false})
    erc20Token!: string

    @Index_()
    @Column_("text", {nullable: false})
    pairToken!: string

    @Column_("text", {nullable: true})
    agentToken!: string | undefined | null

    @Column_("bool", {nullable: false})
    pairCreated!: boolean

    @Column_("text", {nullable: true})
    pairAddress!: string | undefined | null

    @Column_("timestamp with time zone", {nullable: false})
    createdAt!: Date

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    createdAtBlock!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    totalDeposited!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    tokensSold!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    graduationThreshold!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    totalAgentDeposited!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    minAgentTokens!: bigint

    @OneToMany_(() => Trade, e => e.persona)
    trades!: Trade[]

    @OneToMany_(() => PersonaMetadata, e => e.persona)
    metadata!: PersonaMetadata[]

    @OneToMany_(() => AgentDeposit, e => e.persona)
    agentDeposits!: AgentDeposit[]
}
