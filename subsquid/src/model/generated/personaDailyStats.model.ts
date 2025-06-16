import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, DateTimeColumn as DateTimeColumn_, IntColumn as IntColumn_, BigIntColumn as BigIntColumn_} from "@subsquid/typeorm-store"
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
    @DateTimeColumn_({nullable: false})
    date!: Date

    @IntColumn_({nullable: false})
    trades!: number

    @IntColumn_({nullable: false})
    buyTrades!: number

    @IntColumn_({nullable: false})
    sellTrades!: number

    @BigIntColumn_({nullable: false})
    volume!: bigint

    @BigIntColumn_({nullable: false})
    buyVolume!: bigint

    @BigIntColumn_({nullable: false})
    sellVolume!: bigint

    @IntColumn_({nullable: false})
    uniqueTraders!: number
}
