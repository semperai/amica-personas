import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_, DateTimeColumn as DateTimeColumn_, BigIntColumn as BigIntColumn_, IntColumn as IntColumn_} from "@subsquid/typeorm-store"
import {Persona} from "./persona.model"

@Entity_()
export class DailyVolume {
    constructor(props?: Partial<DailyVolume>) {
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

    @BigIntColumn_({nullable: false})
    volume!: bigint

    @IntColumn_({nullable: false})
    trades!: number

    @IntColumn_({nullable: false})
    uniqueTraders!: number
}
