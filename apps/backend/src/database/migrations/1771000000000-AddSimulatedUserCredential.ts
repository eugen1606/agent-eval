import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSimulatedUserCredential1771000000000 implements MigrationInterface {
  name = 'AddSimulatedUserCredential1771000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tests" ADD "simulatedUserAccessTokenId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" ADD "simulatedUserReasoningModel" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" ADD "simulatedUserReasoningEffort" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" ADD CONSTRAINT "FK_tests_simulatedUserAccessToken" FOREIGN KEY ("simulatedUserAccessTokenId") REFERENCES "access_tokens"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tests" DROP CONSTRAINT "FK_tests_simulatedUserAccessToken"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" DROP COLUMN "simulatedUserReasoningEffort"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" DROP COLUMN "simulatedUserReasoningModel"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tests" DROP COLUMN "simulatedUserAccessTokenId"`,
    );
  }
}
