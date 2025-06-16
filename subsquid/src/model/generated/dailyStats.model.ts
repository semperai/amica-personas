import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"

@Entity_()
export class DailyStats {
    constructor(props?: Partial<DailyStats>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @Column_("timestamp with time zone", {nullable: false})
    date!: Date

    @Column_("int4", {nullable: false})
    newPersonas!: number

    @Column_("int4", {nullable: false})
    trades!: number

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    volume!: bigint

    @Column_("int4", {nullable: false})
    uniqueTraders!: number

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    bridgeVolume!: bigint
}
