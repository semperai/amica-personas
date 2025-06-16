import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"
import {Persona} from "./persona.model"

@Entity_()
export class PersonaDailyStats {
    constructor(props?: Partial<PersonaDailyStats>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => Persona, {nullable: true})
    persona!: Persona

    @Index_()
    @Column_("timestamp with time zone", {nullable: false})
    date!: Date

    @Column_("int4", {nullable: false})
    trades!: number

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    volume!: bigint

    @Column_("int4", {nullable: false})
    uniqueTraders!: number
}
