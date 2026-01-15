import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CleanupService } from './cleanup.service';

@Controller('cleanup')
@UseGuards(JwtAuthGuard)
export class CleanupController {
  constructor(private readonly cleanupService: CleanupService) {}

  @Get('config')
  getConfig() {
    return this.cleanupService.getConfig();
  }

  @Get('preview')
  async previewCleanup() {
    return this.cleanupService.previewCleanup();
  }

  @Post('runs')
  async cleanupRuns() {
    const deletedCount = await this.cleanupService.cleanupOldRuns();
    return { deletedCount };
  }
}
