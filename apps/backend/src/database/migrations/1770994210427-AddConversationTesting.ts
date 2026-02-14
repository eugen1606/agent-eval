import { MigrationInterface, QueryRunner } from "typeorm";

export class AddConversationTesting1770994210427 implements MigrationInterface {
    name = 'AddConversationTesting1770994210427'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create personas table
        await queryRunner.query(`CREATE TABLE "personas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid, "name" character varying(255) NOT NULL, "description" text, "systemPrompt" text NOT NULL, "isTemplate" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c9e6c0a1f1386209c59407b7557" UNIQUE ("userId", "name"), CONSTRAINT "PK_714aa5d028f8f3e6645e971cecd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dfe5262968fb1d9bdd86f41ee4" ON "personas" ("userId") `);
        await queryRunner.query(`ALTER TABLE "personas" ADD CONSTRAINT "FK_dfe5262968fb1d9bdd86f41ee4f" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        // Create scenarios table
        await queryRunner.query(`CREATE TABLE "scenarios" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "testId" uuid NOT NULL, "personaId" uuid, "name" character varying(255) NOT NULL, "goal" text NOT NULL, "maxTurns" integer NOT NULL DEFAULT '30', "orderIndex" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a2af4912aab626639cca306b987" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5bb21fbcd5a426eb1608210831" ON "scenarios" ("testId") `);
        await queryRunner.query(`ALTER TABLE "scenarios" ADD CONSTRAINT "FK_5bb21fbcd5a426eb16082108316" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scenarios" ADD CONSTRAINT "FK_74caaa13198dbdb4eb7af4837f1" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        // Create conversations table
        await queryRunner.query(`CREATE TABLE "conversations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "runId" uuid NOT NULL, "scenarioId" uuid, "status" character varying NOT NULL DEFAULT 'running', "turns" jsonb NOT NULL DEFAULT '[]', "summary" text, "endReason" text, "goalAchieved" boolean, "humanEvaluation" character varying, "humanEvaluationNotes" text, "totalTurns" integer NOT NULL DEFAULT '0', "startedAt" TIMESTAMP, "completedAt" TIMESTAMP, CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_87015feda1726ec9503c80e14b" ON "conversations" ("runId") `);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_87015feda1726ec9503c80e14ba" FOREIGN KEY ("runId") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_34072427179dc81f2671679b782" FOREIGN KEY ("scenarioId") REFERENCES "scenarios"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        // Add conversation fields to tests table
        await queryRunner.query(`ALTER TABLE "tests" ADD "type" character varying NOT NULL DEFAULT 'qa'`);
        await queryRunner.query(`ALTER TABLE "tests" ADD "executionMode" character varying`);
        await queryRunner.query(`ALTER TABLE "tests" ADD "delayBetweenTurns" integer DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "tests" ADD "simulatedUserModel" character varying`);
        await queryRunner.query(`ALTER TABLE "tests" ADD "simulatedUserModelConfig" jsonb`);

        // Add conversation fields to runs table
        await queryRunner.query(`ALTER TABLE "runs" ADD "totalScenarios" integer`);
        await queryRunner.query(`ALTER TABLE "runs" ADD "completedScenarios" integer DEFAULT '0'`);

        // Seed template personas (userId = NULL, isTemplate = true)
        await queryRunner.query(`
            INSERT INTO "personas" ("name", "description", "systemPrompt", "isTemplate") VALUES
            (
                'Neutral',
                'A balanced, cooperative user who follows instructions clearly and provides straightforward responses.',
                'You are a typical customer interacting with a support agent. Be clear and direct in your communication. Follow a natural conversation flow - provide information when asked, ask reasonable follow-up questions, and respond appropriately to the agent''s guidance. Do not be overly positive or negative.',
                true
            ),
            (
                'Confused',
                'A user who struggles to understand technical concepts and needs extra clarification.',
                'You are a customer who is not very tech-savvy and gets confused easily. You often misunderstand technical terms and need things explained in simple language. You may provide incomplete or slightly wrong information because you don''t fully understand what''s being asked. Ask for clarification frequently and sometimes go off on tangents.',
                true
            ),
            (
                'Impatient',
                'A frustrated, time-pressed user who wants quick resolutions and gets annoyed by delays.',
                'You are a busy, impatient customer who wants their problem solved immediately. Express frustration if the process takes too long or requires too many steps. Push for quick solutions and escalation. You may interrupt with complaints about wait times or process complexity. You are not rude, but clearly annoyed and pressed for time.',
                true
            ),
            (
                'Verbose',
                'A talkative user who provides excessive detail and goes on tangents.',
                'You are a very talkative customer who provides way more information than necessary. You tell long stories about how the problem started, mention unrelated details, and go on tangents. You need to be gently guided back to the topic. Your messages are long and include unnecessary backstory. Despite being verbose, you are friendly and cooperative.',
                true
            ),
            (
                'Adversarial',
                'A challenging user who tests edge cases, provides contradictory information, and pushes boundaries.',
                'You are a difficult customer who tests the limits of the support system. You may provide contradictory information, change your story, ask unusual or edge-case questions, try to get unauthorized access or discounts, and generally push boundaries. You are not outright abusive, but you are challenging and unpredictable. Your goal is to see how well the agent handles difficult situations.',
                true
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove conversation fields from runs table
        await queryRunner.query(`ALTER TABLE "runs" DROP COLUMN "completedScenarios"`);
        await queryRunner.query(`ALTER TABLE "runs" DROP COLUMN "totalScenarios"`);

        // Remove conversation fields from tests table
        await queryRunner.query(`ALTER TABLE "tests" DROP COLUMN "simulatedUserModelConfig"`);
        await queryRunner.query(`ALTER TABLE "tests" DROP COLUMN "simulatedUserModel"`);
        await queryRunner.query(`ALTER TABLE "tests" DROP COLUMN "delayBetweenTurns"`);
        await queryRunner.query(`ALTER TABLE "tests" DROP COLUMN "executionMode"`);
        await queryRunner.query(`ALTER TABLE "tests" DROP COLUMN "type"`);

        // Drop conversations table
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_34072427179dc81f2671679b782"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_87015feda1726ec9503c80e14ba"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_87015feda1726ec9503c80e14b"`);
        await queryRunner.query(`DROP TABLE "conversations"`);

        // Drop scenarios table
        await queryRunner.query(`ALTER TABLE "scenarios" DROP CONSTRAINT "FK_74caaa13198dbdb4eb7af4837f1"`);
        await queryRunner.query(`ALTER TABLE "scenarios" DROP CONSTRAINT "FK_5bb21fbcd5a426eb16082108316"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5bb21fbcd5a426eb1608210831"`);
        await queryRunner.query(`DROP TABLE "scenarios"`);

        // Drop personas table
        await queryRunner.query(`ALTER TABLE "personas" DROP CONSTRAINT "FK_dfe5262968fb1d9bdd86f41ee4f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dfe5262968fb1d9bdd86f41ee4"`);
        await queryRunner.query(`DROP TABLE "personas"`);
    }

}
