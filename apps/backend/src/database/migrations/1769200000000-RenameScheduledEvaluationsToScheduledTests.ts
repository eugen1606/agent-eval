import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameScheduledEvaluationsToScheduledTests1769200000000 implements MigrationInterface {
    name = 'RenameScheduledEvaluationsToScheduledTests1769200000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "scheduled_evaluations" RENAME TO "scheduled_tests"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "scheduled_tests" RENAME TO "scheduled_evaluations"`);
    }

}
