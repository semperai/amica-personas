import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"

@Entity_()
export class UserSnapshot {
    constructor(props?: Partial<UserSnapshot>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_({unique: true})
    @Column_("text", {nullable: false})
    user!: string

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    currentBalance!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    currentBlock!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    pendingBalance!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    pendingBlock!: bigint

    @Column_("timestamp with time zone", {nullable: false})
    lastUpdated!: Date
}
