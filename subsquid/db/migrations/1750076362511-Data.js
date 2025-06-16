module.exports = class Data1750076362511 {
    name = 'Data1750076362511'

    async up(db) {
        await db.query(`CREATE TABLE "persona_transfer" ("id" character varying NOT NULL, "from" text NOT NULL, "to" text NOT NULL, "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, "block" numeric NOT NULL, "tx_hash" text NOT NULL, "chain_id" integer NOT NULL, "persona_id" character varying, CONSTRAINT "PK_a600a6e633fd36718ee71be627f" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_16376c22f76473e7f78a05f5e1" ON "persona_transfer" ("persona_id") `)
        await db.query(`CREATE INDEX "IDX_91963feccba260804b546b9608" ON "persona_transfer" ("from") `)
        await db.query(`CREATE INDEX "IDX_0821cfdb06432e110d14b22c91" ON "persona_transfer" ("to") `)
        await db.query(`CREATE INDEX "IDX_83b465855c571d49f9476e58d6" ON "persona_transfer" ("tx_hash") `)
        await db.query(`CREATE INDEX "IDX_764ef182ea35815dfe5c41ecba" ON "persona_transfer" ("chain_id") `)
        await db.query(`CREATE TABLE "token_withdrawal" ("id" character varying NOT NULL, "user" text NOT NULL, "amount" numeric NOT NULL, "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, "block" numeric NOT NULL, "tx_hash" text NOT NULL, "chain_id" integer NOT NULL, "persona_id" character varying, CONSTRAINT "PK_e39b26092b690a2093629b8470b" PRIMARY KEY ("id"))`)
        await db.query(`CREATE INDEX "IDX_b4b9e2a5bb0a85c5a41a6a4aef" ON "token_withdrawal" ("persona_id") `)
        await db.query(`CREATE INDEX "IDX_9d07c663bafb4506eb630db48a" ON "token_withdrawal" ("user") `)
        await db.query(`CREATE INDEX "IDX_ddbcd0bd35438a2e2973d5a059" ON "token_withdrawal" ("tx_hash") `)
        await db.query(`CREATE INDEX "IDX_c345cf3541bc9922ab3400bcb8" ON "token_withdrawal" ("chain_id") `)
        await db.query(`ALTER TABLE "trade" ADD "chain_id" integer NOT NULL`)
        await db.query(`ALTER TABLE "persona" ADD "chain_id" integer NOT NULL`)
        await db.query(`ALTER TABLE "bridge_activity" ADD "chain_id" integer NOT NULL`)
        await db.query(`CREATE INDEX "IDX_6fc0ef583e9721ba6af829ee15" ON "trade" ("chain_id") `)
        await db.query(`CREATE INDEX "IDX_aa932cde228166ec4ed1361dc8" ON "persona" ("chain_id") `)
        await db.query(`CREATE INDEX "IDX_7a8ec1061838d8d1dbed91e74d" ON "bridge_activity" ("chain_id") `)
        await db.query(`ALTER TABLE "persona_transfer" ADD CONSTRAINT "FK_16376c22f76473e7f78a05f5e10" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
        await db.query(`ALTER TABLE "token_withdrawal" ADD CONSTRAINT "FK_b4b9e2a5bb0a85c5a41a6a4aeff" FOREIGN KEY ("persona_id") REFERENCES "persona"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
    }

    async down(db) {
        await db.query(`DROP TABLE "persona_transfer"`)
        await db.query(`DROP INDEX "public"."IDX_16376c22f76473e7f78a05f5e1"`)
        await db.query(`DROP INDEX "public"."IDX_91963feccba260804b546b9608"`)
        await db.query(`DROP INDEX "public"."IDX_0821cfdb06432e110d14b22c91"`)
        await db.query(`DROP INDEX "public"."IDX_83b465855c571d49f9476e58d6"`)
        await db.query(`DROP INDEX "public"."IDX_764ef182ea35815dfe5c41ecba"`)
        await db.query(`DROP TABLE "token_withdrawal"`)
        await db.query(`DROP INDEX "public"."IDX_b4b9e2a5bb0a85c5a41a6a4aef"`)
        await db.query(`DROP INDEX "public"."IDX_9d07c663bafb4506eb630db48a"`)
        await db.query(`DROP INDEX "public"."IDX_ddbcd0bd35438a2e2973d5a059"`)
        await db.query(`DROP INDEX "public"."IDX_c345cf3541bc9922ab3400bcb8"`)
        await db.query(`ALTER TABLE "trade" DROP COLUMN "chain_id"`)
        await db.query(`ALTER TABLE "persona" DROP COLUMN "chain_id"`)
        await db.query(`ALTER TABLE "bridge_activity" DROP COLUMN "chain_id"`)
        await db.query(`DROP INDEX "public"."IDX_6fc0ef583e9721ba6af829ee15"`)
        await db.query(`DROP INDEX "public"."IDX_aa932cde228166ec4ed1361dc8"`)
        await db.query(`DROP INDEX "public"."IDX_7a8ec1061838d8d1dbed91e74d"`)
        await db.query(`ALTER TABLE "persona_transfer" DROP CONSTRAINT "FK_16376c22f76473e7f78a05f5e10"`)
        await db.query(`ALTER TABLE "token_withdrawal" DROP CONSTRAINT "FK_b4b9e2a5bb0a85c5a41a6a4aeff"`)
    }
}
