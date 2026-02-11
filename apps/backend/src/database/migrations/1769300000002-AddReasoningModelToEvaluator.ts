import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReasoningModelToEvaluator1769300000002 implements MigrationInterface {
  name = 'AddReasoningModelToEvaluator1769300000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "evaluators" ADD "reasoningModel" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluators" ADD "reasoningEffort" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "evaluators" DROP COLUMN "reasoningEffort"`,
    );
    await queryRunner.query(
      `ALTER TABLE "evaluators" DROP COLUMN "reasoningModel"`,
    );
  }
}
