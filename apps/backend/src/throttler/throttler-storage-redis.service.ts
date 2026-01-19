import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class ThrottlerStorageRedisService implements ThrottlerStorage, OnModuleDestroy {
  private redis: Redis;
  private readonly logger = new Logger(ThrottlerStorageRedisService.name);
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6380';
    this.logger.log(`Connecting to Redis at ${redisUrl}`);

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        if (times > 3) {
          this.logger.warn('Redis connection failed after 3 retries, throttling disabled');
          return null;
        }
        return Math.min(times * 100, 1000);
      },
    });

    this.redis.on('connect', () => {
      this.isConnected = true;
      this.logger.log('Connected to Redis - rate limiting enabled');
    });

    this.redis.on('ready', () => {
      this.isConnected = true;
      this.logger.log('Redis ready for rate limiting');
    });

    this.redis.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      this.logger.warn('Redis connection closed');
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  /**
   * Check if Redis is connected and responsive.
   * Used by health check endpoint.
   */
  async checkHealth(): Promise<{ status: 'up' | 'down'; responseTime?: number; error?: string }> {
    if (!this.isConnected) {
      return { status: 'down', error: 'Not connected' };
    }

    const start = Date.now();
    try {
      await this.redis.ping();
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

  /**
   * Returns whether Redis is currently connected.
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  async clearAllThrottleKeys(): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      const keys = await this.redis.keys('throttle:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return keys.length;
    } catch (error) {
      this.logger.error(`Failed to clear throttle keys: ${error}`);
      return 0;
    }
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    // If Redis is not connected, allow the request (fail open)
    if (!this.isConnected) {
      return {
        totalHits: 0,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }

    try {
      const redisKey = `throttle:${throttlerName}:${key}`;
      const blockKey = `throttle:${throttlerName}:${key}:blocked`;

      // Check if blocked
      const blockedTtl = await this.redis.ttl(blockKey);
      if (blockedTtl > 0) {
        return {
          totalHits: limit + 1,
          timeToExpire: 0,
          isBlocked: true,
          timeToBlockExpire: blockedTtl * 1000,
        };
      }

      // Increment counter
      const multi = this.redis.multi();
      multi.incr(redisKey);
      multi.pttl(redisKey);

      const results = await multi.exec();
      if (!results) {
        throw new Error('Redis transaction failed');
      }

      const totalHits = results[0]?.[1] as number;
      let pttl = results[1]?.[1] as number;

      // Set expiry if this is a new key
      if (pttl === -1) {
        await this.redis.pexpire(redisKey, ttl);
        pttl = ttl;
      }

      // Check if we need to block
      const isBlocked = totalHits > limit;
      let timeToBlockExpire = 0;

      if (isBlocked && blockDuration > 0) {
        await this.redis.set(blockKey, '1', 'PX', blockDuration);
        timeToBlockExpire = blockDuration;
      }

      return {
        totalHits,
        timeToExpire: Math.max(0, pttl),
        isBlocked,
        timeToBlockExpire,
      };
    } catch (error) {
      this.logger.error(`Rate limit check failed: ${error}`);
      // Fail open - allow the request if Redis fails
      return {
        totalHits: 0,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }
}
