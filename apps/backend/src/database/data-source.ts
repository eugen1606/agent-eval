import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';
import * as migrations from './migrations';

// Load environment variables
config({ path: '.env' });
config({ path: '.env.local', override: true });

/**
 * TypeORM DataSource for CLI migrations.
 * Used by migration:generate, migration:run, migration:revert commands.
 */
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [path.join(__dirname, 'entities', '*.entity.{ts,js}')],
  migrations: Object.values(migrations),
  migrationsTableName: 'typeorm_migrations',
});
