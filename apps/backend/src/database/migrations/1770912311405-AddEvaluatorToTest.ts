import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEvaluatorToTest1770912311405 implements MigrationInterface {
    name = 'AddEvaluatorToTest1770912311405'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tests" ADD "evaluatorId" uuid`);
        await queryRunner.query(`ALTER TABLE "tests" ADD CONSTRAINT "FK_7bd658ea8cbcbb4c1b2c3d97107" FOREIGN KEY ("evaluatorId") REFERENCES "evaluators"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tests" DROP CONSTRAINT "FK_7bd658ea8cbcbb4c1b2c3d97107"`);
        await queryRunner.query(`ALTER TABLE "tests" DROP COLUMN "evaluatorId"`);
    }

}
