import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduledTestsService } from './scheduled-tests.service';

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name);
  private isProcessing = false;

  constructor(
    private readonly scheduledTestsService: ScheduledTestsService
  ) {}

  onModuleInit() {
    this.logger.log('Scheduler service initialized');
  }

  // Run every minute to check for due scheduled tests
  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledTests() {
    // Prevent concurrent processing
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Process one-time scheduled tests
      const pendingTests = await this.scheduledTestsService.findPendingDue();

      if (pendingTests.length > 0) {
        this.logger.log(`Found ${pendingTests.length} one-time scheduled test(s) to execute`);
      }

      for (const scheduled of pendingTests) {
        try {
          this.logger.log(`Executing one-time scheduled test: ${scheduled.id} (${scheduled.test?.name || 'unknown'})`);
          await this.scheduledTestsService.executeScheduledTest(scheduled.id);
        } catch (error) {
          this.logger.error(
            `Failed to execute scheduled test ${scheduled.id}:`,
            error
          );
        }
      }

      // Process cron-based scheduled tests
      const cronJobs = await this.scheduledTestsService.getCronJobsDue();

      if (cronJobs.length > 0) {
        this.logger.log(`Found ${cronJobs.length} cron scheduled test(s) to execute`);
      }

      for (const cronJob of cronJobs) {
        try {
          this.logger.log(`Executing cron scheduled test: ${cronJob.id} (${cronJob.test?.name || 'unknown'}) - ${cronJob.cronExpression}`);
          await this.scheduledTestsService.executeScheduledTest(cronJob.id);
        } catch (error) {
          this.logger.error(
            `Failed to execute cron scheduled test ${cronJob.id}:`,
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
