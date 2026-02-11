import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTypeToAccessToken1769300000000 implements MigrationInterface {
  name = 'AddTypeToAccessToken1769300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "access_tokens" ADD "type" character varying NOT NULL DEFAULT 'ai_studio'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "access_tokens" DROP COLUMN "type"`,
    );
  }
}
