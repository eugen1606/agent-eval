import { MigrationInterface, QueryRunner } from "typeorm";

export class AddQuestionSetIdToRun1768857182706 implements MigrationInterface {
    name = 'AddQuestionSetIdToRun1768857182706'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "runs" ADD "questionSetId" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "runs" DROP COLUMN "questionSetId"`);
    }

}
