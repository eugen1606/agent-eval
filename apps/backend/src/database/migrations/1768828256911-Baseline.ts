import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline migration - represents the initial database schema.
 * For existing databases, this migration will be recorded as "already run".
 * For new databases, this creates all tables from scratch.
 */
export class Baseline1768828256911 implements MigrationInterface {
  name = 'Baseline1768828256911';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query(
      `CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public`
    );

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "passwordHash" character varying NOT NULL,
        "displayName" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email")
      )
    `);

    // Create access_tokens table
    await queryRunner.query(`
      CREATE TABLE "access_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "name" character varying NOT NULL,
        "encryptedToken" text NOT NULL,
        "iv" text NOT NULL,
        "description" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_65140f59763ff994a0252488166" PRIMARY KEY ("id")
      )
    `);

    // Create question_sets table
    await queryRunner.query(`
      CREATE TABLE "question_sets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "name" character varying NOT NULL,
        "questions" jsonb NOT NULL,
        "description" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_5e8c0b0e72c1d38c6fb5d7a33d1" PRIMARY KEY ("id")
      )
    `);

    // Create webhooks table
    await queryRunner.query(`
      CREATE TABLE "webhooks" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "url" character varying NOT NULL,
        "description" character varying,
        "events" text NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "secret" character varying,
        "method" character varying NOT NULL DEFAULT 'POST',
        "headers" jsonb,
        "queryParams" jsonb,
        "bodyTemplate" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_9e8795cfc899ab7bdaa831e8527" PRIMARY KEY ("id")
      )
    `);

    // Create tests table
    await queryRunner.query(`
      CREATE TABLE "tests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "name" character varying NOT NULL,
        "description" character varying,
        "flowId" character varying NOT NULL,
        "basePath" character varying NOT NULL,
        "accessTokenId" uuid,
        "questionSetId" uuid,
        "webhookId" uuid,
        "multiStepEvaluation" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_4d67c12c2a15e8a6e1e9f4c5d1a" PRIMARY KEY ("id")
      )
    `);

    // Create runs table
    await queryRunner.query(`
      CREATE TABLE "runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "testId" uuid,
        "status" character varying NOT NULL DEFAULT 'pending',
        "results" jsonb NOT NULL DEFAULT '[]',
        "errorMessage" character varying,
        "totalQuestions" integer NOT NULL DEFAULT 0,
        "completedQuestions" integer NOT NULL DEFAULT 0,
        "startedAt" TIMESTAMP,
        "completedAt" TIMESTAMP,
        "isFullyEvaluated" boolean NOT NULL DEFAULT false,
        "evaluatedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_3c7f0ac3c0e2d0d8c1e1c3e5f2a" PRIMARY KEY ("id")
      )
    `);

    // Create scheduled_evaluations table
    await queryRunner.query(`
      CREATE TABLE "scheduled_evaluations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "testId" uuid,
        "name" character varying,
        "description" character varying,
        "accessTokenId" character varying,
        "flowConfigId" character varying,
        "questionSetId" character varying,
        "multiStepEvaluation" boolean DEFAULT false,
        "scheduleType" character varying NOT NULL DEFAULT 'once',
        "scheduledAt" TIMESTAMP,
        "cronExpression" character varying,
        "status" character varying NOT NULL DEFAULT 'pending',
        "lastRunAt" TIMESTAMP,
        "errorMessage" character varying,
        "resultRunId" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_2b1f9c6e3a4d5e7f8c9a0b1c2d3" PRIMARY KEY ("id")
      )
    `);

    // Create flow_configs table (legacy)
    await queryRunner.query(`
      CREATE TABLE "flow_configs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "name" character varying NOT NULL,
        "flowId" character varying NOT NULL,
        "basePath" character varying,
        "description" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_7a8f9c6e3b4d5e7f8c9a0b1c2d3" PRIMARY KEY ("id")
      )
    `);

    // Create evaluations table (legacy)
    await queryRunner.query(`
      CREATE TABLE "evaluations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "name" character varying NOT NULL,
        "finalOutput" jsonb NOT NULL,
        "flowExport" jsonb,
        "flowId" character varying,
        "description" character varying,
        "questionSetId" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_f683b433eba0e6dae7e19b29e29" PRIMARY KEY ("id")
      )
    `);

    // Create sessions table (legacy)
    await queryRunner.query(`
      CREATE TABLE "sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid,
        "flowName" character varying NOT NULL,
        "flowConfig" jsonb NOT NULL,
        "results" jsonb NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_3238ef96f18b355b671619111bc" PRIMARY KEY ("id")
      )
    `);

    // Create index on runs.completedAt
    await queryRunner.query(`
      CREATE INDEX "IDX_c262aaceae3f740eee361a8dbe" ON "runs" ("completedAt")
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "access_tokens"
      ADD CONSTRAINT "FK_343a101d109c86071f2b2fb43e7"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "question_sets"
      ADD CONSTRAINT "FK_e21adb103256228067f2a37c8df"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "tests"
      ADD CONSTRAINT "FK_9b4193834978a419a4d477940da"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "tests"
      ADD CONSTRAINT "FK_68168f981f0f8ea3da9fd2f0360"
      FOREIGN KEY ("accessTokenId") REFERENCES "access_tokens"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "tests"
      ADD CONSTRAINT "FK_a89f197b5ef9bb9291908107ce9"
      FOREIGN KEY ("questionSetId") REFERENCES "question_sets"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "tests"
      ADD CONSTRAINT "FK_17e0d3f805e3d39e984a3268030"
      FOREIGN KEY ("webhookId") REFERENCES "webhooks"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "runs"
      ADD CONSTRAINT "FK_336a74d21129fee621d57b01799"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "runs"
      ADD CONSTRAINT "FK_6ce02c665a2d1e120569701a7a5"
      FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "scheduled_evaluations"
      ADD CONSTRAINT "FK_9c4ba030feaa853c6aa7a7720bc"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "scheduled_evaluations"
      ADD CONSTRAINT "FK_ea6a9639a6baa2297abf7e38b54"
      FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "flow_configs"
      ADD CONSTRAINT "FK_b61ff171fae9c67b85a9b6bee72"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "evaluations"
      ADD CONSTRAINT "FK_f079d95b69f82262b74ee478825"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "sessions"
      ADD CONSTRAINT "FK_57de40bc620f456c7311aa3a1e6"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(
      `ALTER TABLE "sessions" DROP CONSTRAINT "FK_57de40bc620f456c7311aa3a1e6"`
    );
    await queryRunner.query(
      `ALTER TABLE "evaluations" DROP CONSTRAINT "FK_f079d95b69f82262b74ee478825"`
    );
    await queryRunner.query(
      `ALTER TABLE "flow_configs" DROP CONSTRAINT "FK_b61ff171fae9c67b85a9b6bee72"`
    );
    await queryRunner.query(
      `ALTER TABLE "scheduled_evaluations" DROP CONSTRAINT "FK_ea6a9639a6baa2297abf7e38b54"`
    );
    await queryRunner.query(
      `ALTER TABLE "scheduled_evaluations" DROP CONSTRAINT "FK_9c4ba030feaa853c6aa7a7720bc"`
    );
    await queryRunner.query(
      `ALTER TABLE "runs" DROP CONSTRAINT "FK_6ce02c665a2d1e120569701a7a5"`
    );
    await queryRunner.query(
      `ALTER TABLE "runs" DROP CONSTRAINT "FK_336a74d21129fee621d57b01799"`
    );
    await queryRunner.query(
      `ALTER TABLE "tests" DROP CONSTRAINT "FK_17e0d3f805e3d39e984a3268030"`
    );
    await queryRunner.query(
      `ALTER TABLE "tests" DROP CONSTRAINT "FK_a89f197b5ef9bb9291908107ce9"`
    );
    await queryRunner.query(
      `ALTER TABLE "tests" DROP CONSTRAINT "FK_68168f981f0f8ea3da9fd2f0360"`
    );
    await queryRunner.query(
      `ALTER TABLE "tests" DROP CONSTRAINT "FK_9b4193834978a419a4d477940da"`
    );
    await queryRunner.query(
      `ALTER TABLE "question_sets" DROP CONSTRAINT "FK_e21adb103256228067f2a37c8df"`
    );
    await queryRunner.query(
      `ALTER TABLE "access_tokens" DROP CONSTRAINT "FK_343a101d109c86071f2b2fb43e7"`
    );

    // Drop index
    await queryRunner.query(`DROP INDEX "IDX_c262aaceae3f740eee361a8dbe"`);

    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "sessions"`);
    await queryRunner.query(`DROP TABLE "evaluations"`);
    await queryRunner.query(`DROP TABLE "flow_configs"`);
    await queryRunner.query(`DROP TABLE "scheduled_evaluations"`);
    await queryRunner.query(`DROP TABLE "runs"`);
    await queryRunner.query(`DROP TABLE "tests"`);
    await queryRunner.query(`DROP TABLE "webhooks"`);
    await queryRunner.query(`DROP TABLE "question_sets"`);
    await queryRunner.query(`DROP TABLE "access_tokens"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
