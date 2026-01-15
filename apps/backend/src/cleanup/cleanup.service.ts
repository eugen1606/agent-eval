import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Run } from '../database/entities/run.entity';

@Injectable()
export class CleanupService implements OnModuleInit {
  private readonly logger = new Logger(CleanupService.name);
  private isProcessing = false;
  private readonly retentionDays: number;
  private readonly enabled: boolean;

  constructor(
    @InjectRepository(Run)
    private readonly runRepository: Repository<Run>,
    private readonly configService: ConfigService
  ) {
    this.retentionDays = this.configService.get<number>('RUN_RETENTION_DAYS', 90);
    this.enabled = this.configService.get<string>('CLEANUP_ENABLED', 'false') === 'true';
  }

  onModuleInit() {
    this.logger.log(
      `Cleanup service initialized - enabled: ${this.enabled}, retention: ${this.retentionDays} days`
    );
  }

  // Run daily at 3 AM
  @Cron('0 3 * * *')
  async handleCleanup() {
    if (!this.enabled) {
      return;
    }

    if (this.isProcessing) {
      this.logger.warn('Cleanup already in progress, skipping');
      return;
    }

    this.isProcessing = true;

    try {
      const deletedCount = await this.cleanupOldRuns();
      if (deletedCount > 0) {
        this.logger.log(`Cleanup completed: deleted ${deletedCount} old run(s)`);
      }
    } catch (error) {
      this.logger.error('Cleanup failed:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async cleanupOldRuns(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    // Find runs to delete (completed before cutoff, not pending/running)
    const candidateRuns = await this.runRepository
      .createQueryBuilder('run')
      .select(['run.id'])
      .where('run.completedAt < :cutoffDate', { cutoffDate })
      .andWhere('run.status NOT IN (:...statuses)', { statuses: ['pending', 'running'] })
      .getMany();

    if (candidateRuns.length === 0) {
      return 0;
    }

    const ids = candidateRuns.map(r => r.id);
    const result = await this.runRepository
      .createQueryBuilder()
      .delete()
      .from(Run)
      .whereInIds(ids)
      .execute();

    return result.affected || 0;
  }

  getConfig() {
    return {
      enabled: this.enabled,
      retentionDays: this.retentionDays,
    };
  }

  async previewCleanup() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    const count = await this.runRepository
      .createQueryBuilder('run')
      .where('run.completedAt < :cutoffDate', { cutoffDate })
      .andWhere('run.status NOT IN (:...statuses)', { statuses: ['pending', 'running'] })
      .getCount();

    return {
      cutoffDate: cutoffDate.toISOString(),
      retentionDays: this.retentionDays,
      runsToDelete: count,
    };
  }
}
