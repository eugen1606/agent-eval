import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEvaluatorTable1769300000001 implements MigrationInterface {
  name = 'CreateEvaluatorTable1769300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "evaluators" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "name" character varying NOT NULL,
        "description" character varying,
        "accessTokenId" uuid,
        "model" character varying NOT NULL,
        "systemPrompt" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_evaluators" PRIMARY KEY ("id"),
        CONSTRAINT "FK_evaluators_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_evaluators_accessTokenId" FOREIGN KEY ("accessTokenId") REFERENCES "access_tokens"("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "evaluators"`);
  }
}
