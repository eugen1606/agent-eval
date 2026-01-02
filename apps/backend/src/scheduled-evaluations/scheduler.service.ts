import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduledEvaluationsService } from './scheduled-evaluations.service';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private isProcessing = false;

  constructor(
    private readonly scheduledEvaluationsService: ScheduledEvaluationsService
  ) {}

  onModuleInit() {
    this.logger.log('Scheduler service initialized');
  }

  // Run every minute to check for due scheduled evaluations
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledEvaluations() {
    // Prevent concurrent processing
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Process one-time scheduled evaluations
      const pendingEvaluations = await this.scheduledEvaluationsService.findPendingDue();

      if (pendingEvaluations.length > 0) {
        this.logger.log(`Found ${pendingEvaluations.length} one-time evaluation(s) to execute`);
      }

      for (const scheduled of pendingEvaluations) {
        try {
          this.logger.log(`Executing one-time evaluation: ${scheduled.id} (${scheduled.name})`);
          await this.scheduledEvaluationsService.executeScheduledEvaluation(scheduled.id);
        } catch (error) {
          this.logger.error(
            `Failed to execute scheduled evaluation ${scheduled.id}:`,
            error
          );
        }
      }

      // Process cron-based scheduled evaluations
      const cronJobs = await this.scheduledEvaluationsService.getCronJobsDue();

      if (cronJobs.length > 0) {
        this.logger.log(`Found ${cronJobs.length} cron evaluation(s) to execute`);
      }

      for (const cronJob of cronJobs) {
        try {
          this.logger.log(`Executing cron evaluation: ${cronJob.id} (${cronJob.name}) - ${cronJob.cronExpression}`);
          await this.scheduledEvaluationsService.executeScheduledEvaluation(cronJob.id);
        } catch (error) {
          this.logger.error(
            `Failed to execute cron evaluation ${cronJob.id}:`,
            error
          );
        }
      }
    } catch (error) {
      this.logger.error('Error in scheduler:', error);
    } finally {
      this.isProcessing = false;
    }
  }
}
