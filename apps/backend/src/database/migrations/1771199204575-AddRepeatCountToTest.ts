import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRepeatCountToTest1771199204575 implements MigrationInterface {
    name = 'AddRepeatCountToTest1771199204575'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tests" ADD "repeatCount" integer NOT NULL DEFAULT '1'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tests" DROP COLUMN "repeatCount"`);
    }

}
