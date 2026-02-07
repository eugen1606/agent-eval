import { Controller, Get, Post, HttpStatus, Res, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { HealthService } from './health.service';
import { ThrottlerStorageRedisService } from '../throttler/throttler-storage-redis.service';

@ApiTags('health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly configService: ConfigService,
    private readonly throttlerStorage: ThrottlerStorageRedisService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is running' })
  getHealth() {
    return this.healthService.getHealth();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness check (database, Redis connectivity)' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  async getReadiness(@Res() res: Response) {
    const status = await this.healthService.getReadiness();
    const httpStatus = status.status === 'healthy'
      ? HttpStatus.OK
      : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(httpStatus).json(status);
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness check' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Post('clear-throttle')
  async clearThrottle() {
    // Only allow in non-production environments
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    if (nodeEnv === 'production') {
      throw new ForbiddenException('This endpoint is not available in production');
    }

    const clearedCount = await this.throttlerStorage.clearAllThrottleKeys();
    return { cleared: clearedCount };
  }

  @Post('cleanup-test-users')
  async cleanupTestUsers() {
    // Only allow in non-production environments
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    if (nodeEnv === 'production') {
      throw new ForbiddenException('This endpoint is not available in production');
    }

    const deletedCount = await this.healthService.cleanupTestUsers();
    return { deleted: deletedCount };
  }
}
