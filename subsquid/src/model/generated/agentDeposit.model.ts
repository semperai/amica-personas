import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"
import {Persona} from "./persona.model"

@Entity_()
export class AgentDeposit {
    constructor(props?: Partial<AgentDeposit>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => Persona, {nullable: true})
    persona!: Persona

    @Index_()
    @Column_("text", {nullable: false})
    user!: string

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    amount!: bigint

    @Column_("timestamp with time zone", {nullable: false})
    timestamp!: Date

    @Column_("bool", {nullable: false})
    withdrawn!: boolean

    @Column_("bool", {nullable: false})
    rewardsClaimed!: boolean

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    block!: bigint

    @Index_()
    @Column_("text", {nullable: false})
    txHash!: string
}
