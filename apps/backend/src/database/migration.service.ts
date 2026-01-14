import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import {
  AccessToken,
  QuestionSet,
  FlowConfig,
} from './entities';

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    private authService: AuthService,
    @InjectRepository(AccessToken)
    private accessTokenRepository: Repository<AccessToken>,
    @InjectRepository(QuestionSet)
    private questionSetRepository: Repository<QuestionSet>,
    @InjectRepository(FlowConfig)
    private flowConfigRepository: Repository<FlowConfig>,
  ) {}

  async onModuleInit() {
    await this.migrateOrphanedData();
  }

  async migrateOrphanedData() {
    // Count records without userId using QueryBuilder
    const orphanedCounts = await Promise.all([
      this.accessTokenRepository.createQueryBuilder('t').where('t.userId IS NULL').getCount(),
      this.questionSetRepository.createQueryBuilder('t').where('t.userId IS NULL').getCount(),
      this.flowConfigRepository.createQueryBuilder('t').where('t.userId IS NULL').getCount(),
    ]);

    const totalOrphaned = orphanedCounts.reduce((a, b) => a + b, 0);

    this.logger.log(`Orphaned data check: AccessTokens=${orphanedCounts[0]}, QuestionSets=${orphanedCounts[1]}, FlowConfigs=${orphanedCounts[2]}`);

    if (totalOrphaned === 0) {
      this.logger.log('No orphaned data found, skipping migration');
      return;
    }

    this.logger.log(`Found ${totalOrphaned} orphaned records, creating admin user for migration...`);

    // Create admin user if doesn't exist
    const adminUser = await this.authService.ensureAdminUser();
    this.logger.log(`Admin user ready: ${adminUser.email} (${adminUser.id})`);

    // Update all records without userId to belong to admin using QueryBuilder
    const results = await Promise.all([
      this.accessTokenRepository.createQueryBuilder()
        .update(AccessToken)
        .set({ userId: adminUser.id })
        .where('userId IS NULL')
        .execute(),
      this.questionSetRepository.createQueryBuilder()
        .update(QuestionSet)
        .set({ userId: adminUser.id })
        .where('userId IS NULL')
        .execute(),
      this.flowConfigRepository.createQueryBuilder()
        .update(FlowConfig)
        .set({ userId: adminUser.id })
        .where('userId IS NULL')
        .execute(),
    ]);

    const totalMigrated = results.reduce((a, r) => a + (r.affected || 0), 0);
    this.logger.log(`Migration complete: ${totalMigrated} records assigned to admin user`);
  }
}
