declare const __APP_VERSION__: string | undefined;

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ThrottlerStorageRedisService } from '../throttler/throttler-storage-redis.service';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
}

export interface HealthCheck {
  status: 'up' | 'down';
  responseTime?: number;
  error?: string;
}

export interface ReadinessStatus extends HealthStatus {
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
  };
}

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();
  private readonly version =
    typeof __APP_VERSION__ !== 'undefined'
      ? __APP_VERSION__
      : process.env.npm_package_version || '0.0.0';

  constructor(
    private dataSource: DataSource,
    private throttlerStorage: ThrottlerStorageRedisService,
  ) {}

  getHealth(): HealthStatus {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: this.version,
    };
  }

  async getReadiness(): Promise<ReadinessStatus> {
    const [dbCheck, redisCheck] = await Promise.all([
      this.checkDatabase(),
      this.throttlerStorage.checkHealth(),
    ]);

    const allHealthy = dbCheck.status === 'up' && redisCheck.status === 'up';

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: this.version,
      checks: {
        database: dbCheck,
        redis: redisCheck,
      },
    };
  }

  getLiveness(): HealthStatus {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: this.version,
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return {
        status: 'up',
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async cleanupTestUsers(): Promise<number> {
    const result = await this.dataSource.query(
      `DELETE FROM "users" WHERE email LIKE '%@e2e-test.local'`
    );
    return result[1] || 0;
  }
}
