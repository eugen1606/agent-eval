import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTags1769101722822 implements MigrationInterface {
    name = 'AddTags1769101722822'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tags" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid, "name" character varying NOT NULL, "color" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0daf7567fa18bf86b777c5a9d89" UNIQUE ("userId", "name"), CONSTRAINT "PK_e7dc17249a1148a1970748eda99" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "test_tags" ("testId" uuid NOT NULL, "tagId" uuid NOT NULL, CONSTRAINT "PK_42686c235c31165731a12981cc3" PRIMARY KEY ("testId", "tagId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2a09f3f0e0c2c20e58ed7c3969" ON "test_tags" ("testId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1961d0a09851528ac0c0896cfe" ON "test_tags" ("tagId") `);
        await queryRunner.query(`ALTER TABLE "tags" ADD CONSTRAINT "FK_92e67dc508c705dd66c94615576" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "test_tags" ADD CONSTRAINT "FK_2a09f3f0e0c2c20e58ed7c39697" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "test_tags" ADD CONSTRAINT "FK_1961d0a09851528ac0c0896cfe3" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "test_tags" DROP CONSTRAINT "FK_1961d0a09851528ac0c0896cfe3"`);
        await queryRunner.query(`ALTER TABLE "test_tags" DROP CONSTRAINT "FK_2a09f3f0e0c2c20e58ed7c39697"`);
        await queryRunner.query(`ALTER TABLE "tags" DROP CONSTRAINT "FK_92e67dc508c705dd66c94615576"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1961d0a09851528ac0c0896cfe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2a09f3f0e0c2c20e58ed7c3969"`);
        await queryRunner.query(`DROP TABLE "test_tags"`);
        await queryRunner.query(`DROP TABLE "tags"`);
    }

}
