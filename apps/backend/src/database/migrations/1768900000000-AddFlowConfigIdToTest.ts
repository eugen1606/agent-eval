import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFlowConfigIdToTest1768900000000 implements MigrationInterface {
  name = 'AddFlowConfigIdToTest1768900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add flowConfigId column (nullable)
    await queryRunner.query(
      `ALTER TABLE "tests" ADD "flowConfigId" uuid`
    );

    // 2. Create FlowConfigs for existing tests with unique userId+flowId+basePath combinations
    // that don't already have a matching FlowConfig
    await queryRunner.query(`
      INSERT INTO "flow_configs" ("id", "userId", "name", "flowId", "basePath", "createdAt", "updatedAt")
      SELECT
        uuid_generate_v4(),
        t."userId",
        CONCAT('Auto: ', t."flowId"),
        t."flowId",
        t."basePath",
        NOW(),
        NOW()
      FROM (
        SELECT DISTINCT "userId", "flowId", "basePath"
        FROM "tests"
      ) t
      WHERE NOT EXISTS (
        SELECT 1 FROM "flow_configs" fc
        WHERE fc."userId" = t."userId"
        AND fc."flowId" = t."flowId"
        AND COALESCE(fc."basePath", '') = COALESCE(t."basePath", '')
      )
    `);

    // 3. Update tests with their matching flowConfigId
    await queryRunner.query(`
      UPDATE "tests" t
      SET "flowConfigId" = fc."id"
      FROM "flow_configs" fc
      WHERE fc."userId" = t."userId"
      AND fc."flowId" = t."flowId"
      AND COALESCE(fc."basePath", '') = COALESCE(t."basePath", '')
    `);

    // 4. Add foreign key constraint with SET NULL on delete
    await queryRunner.query(`
      ALTER TABLE "tests"
      ADD CONSTRAINT "FK_tests_flowConfigId"
      FOREIGN KEY ("flowConfigId")
      REFERENCES "flow_configs"("id")
      ON DELETE SET NULL
    `);

    // 5. Drop old columns
    await queryRunner.query(`ALTER TABLE "tests" DROP COLUMN "flowId"`);
    await queryRunner.query(`ALTER TABLE "tests" DROP COLUMN "basePath"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Re-add columns
    await queryRunner.query(
      `ALTER TABLE "tests" ADD "flowId" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "tests" ADD "basePath" character varying`
    );

    // 2. Copy data back from flowConfigs
    await queryRunner.query(`
      UPDATE "tests" t
      SET "flowId" = fc."flowId", "basePath" = fc."basePath"
      FROM "flow_configs" fc
      WHERE t."flowConfigId" = fc."id"
    `);

    // 3. Set default values for tests without flowConfig
    await queryRunner.query(`
      UPDATE "tests"
      SET "flowId" = 'unknown', "basePath" = 'https://example.com'
      WHERE "flowId" IS NULL
    `);

    // 4. Make columns NOT NULL
    await queryRunner.query(
      `ALTER TABLE "tests" ALTER COLUMN "flowId" SET NOT NULL`
    );
    await queryRunner.query(
      `ALTER TABLE "tests" ALTER COLUMN "basePath" SET NOT NULL`
    );

    // 5. Drop foreign key and column
    await queryRunner.query(
      `ALTER TABLE "tests" DROP CONSTRAINT "FK_tests_flowConfigId"`
    );
    await queryRunner.query(`ALTER TABLE "tests" DROP COLUMN "flowConfigId"`);
  }
}
