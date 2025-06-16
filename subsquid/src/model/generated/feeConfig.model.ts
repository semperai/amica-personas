import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_} from "typeorm"
import * as marshal from "./marshal"

@Entity_()
export class FeeConfig {
    constructor(props?: Partial<FeeConfig>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("int4", {nullable: false})
    feePercentage!: number

    @Column_("int4", {nullable: false})
    creatorShare!: number

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    minAmicaForReduction!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    maxAmicaForReduction!: bigint

    @Column_("int4", {nullable: false})
    minReductionMultiplier!: number

    @Column_("int4", {nullable: false})
    maxReductionMultiplier!: number

    @Column_("timestamp with time zone", {nullable: false})
    lastUpdated!: Date
}
