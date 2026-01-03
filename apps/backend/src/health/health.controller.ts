import { Controller, Get, Post, HttpStatus, Res, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { HealthService } from './health.service';
import { ThrottlerStorageRedisService } from '../throttler/throttler-storage-redis.service';

@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly configService: ConfigService,
    private readonly throttlerStorage: ThrottlerStorageRedisService,
  ) {}

  @Get()
  getHealth() {
    return this.healthService.getHealth();
  }

  @Get('ready')
  async getReadiness(@Res() res: Response) {
    const status = await this.healthService.getReadiness();
    const httpStatus = status.status === 'healthy'
      ? HttpStatus.OK
      : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(httpStatus).json(status);
  }

  @Get('live')
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
}
