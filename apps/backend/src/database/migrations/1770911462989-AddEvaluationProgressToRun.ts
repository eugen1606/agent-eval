import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEvaluationProgressToRun1770911462989 implements MigrationInterface {
    name = 'AddEvaluationProgressToRun1770911462989'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "runs" ADD "evaluationInProgress" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "runs" ADD "evaluationTotal" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "runs" DROP COLUMN "evaluationTotal"`);
        await queryRunner.query(`ALTER TABLE "runs" DROP COLUMN "evaluationInProgress"`);
    }

}
