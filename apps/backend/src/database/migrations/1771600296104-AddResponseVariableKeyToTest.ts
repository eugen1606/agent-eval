import { MigrationInterface, QueryRunner } from "typeorm";

export class AddResponseVariableKeyToTest1771600296104 implements MigrationInterface {
    name = 'AddResponseVariableKeyToTest1771600296104'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tests" ADD "responseVariableKey" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tests" DROP COLUMN "responseVariableKey"`);
    }

}
