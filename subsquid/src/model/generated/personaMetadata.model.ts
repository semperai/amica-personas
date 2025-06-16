import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"
import {Persona} from "./persona.model"

@Entity_()
export class PersonaMetadata {
    constructor(props?: Partial<PersonaMetadata>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => Persona, {nullable: true})
    persona!: Persona

    @Index_()
    @Column_("text", {nullable: false})
    key!: string

    @Column_("text", {nullable: false})
    value!: string

    @Column_("timestamp with time zone", {nullable: false})
    updatedAt!: Date

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    updatedAtBlock!: bigint
}
