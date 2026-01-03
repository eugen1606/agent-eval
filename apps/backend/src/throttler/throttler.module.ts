import { Global, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerStorageRedisService } from './throttler-storage-redis.service';

// Separate module for the storage provider to avoid circular dependency
@Global()
@Module({
  imports: [ConfigModule],
  providers: [ThrottlerStorageRedisService],
  exports: [ThrottlerStorageRedisService],
})
export class ThrottlerStorageModule {}

@Module({
  imports: [
    ThrottlerStorageModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule, ThrottlerStorageModule],
      inject: [ConfigService, ThrottlerStorageRedisService],
      useFactory: (config: ConfigService, storage: ThrottlerStorageRedisService) => {
        const isDisabled = config.get<string>('THROTTLE_DISABLED', 'false') === 'true';
        const nodeEnv = config.get<string>('NODE_ENV', 'development');
        const isTestEnv = nodeEnv === 'test' || nodeEnv === 'e2e';

        // Disable throttling in test environments or when explicitly disabled
        const shouldDisable = isDisabled || isTestEnv;

        return {
          throttlers: [
            {
              name: 'default',
              ttl: config.get<number>('THROTTLE_TTL', 60000), // Default: 1 minute
              // If disabled, set very high limit
              limit: shouldDisable ? 1000000 : config.get<number>('THROTTLE_LIMIT', 100),
            },
          ],
          storage,
        };
      },
    }),
  ],
  exports: [ThrottlerModule],
})
export class AppThrottlerModule {}
