import { Injectable, ExecutionContext, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerException, ThrottlerRequest } from '@nestjs/throttler';
import { Response } from 'express';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  @Inject(ConfigService)
  private readonly configService: ConfigService;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip throttling if disabled or in test environment
    const isDisabled = this.configService.get<string>('THROTTLE_DISABLED', 'false') === 'true';
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const isTestEnv = nodeEnv === 'test' || nodeEnv === 'e2e';

    if (isDisabled || isTestEnv) {
      return true;
    }

    return super.canActivate(context);
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    // Use user ID if authenticated, otherwise use IP
    const user = req.user as { userId?: string } | undefined;
    if (user?.userId) {
      return user.userId;
    }

    // Fall back to IP address
    const ip = this.getIpFromRequest(req);
    return ip;
  }

  private getIpFromRequest(req: Record<string, unknown>): string {
    // Check for forwarded IP (behind proxy/load balancer)
    const forwarded = req.headers as Record<string, string | string[]>;
    const xForwardedFor = forwarded?.['x-forwarded-for'];

    if (xForwardedFor) {
      const ips = Array.isArray(xForwardedFor)
        ? xForwardedFor[0]
        : xForwardedFor.split(',')[0];
      return ips.trim();
    }

    // Direct IP
    return (req.ip as string) || 'unknown';
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: { limit: number; ttl: number; key: string; tracker: string; totalHits: number; timeToExpire: number; isBlocked: boolean; timeToBlockExpire: number },
  ): Promise<void> {
    // Add rate limit headers to the response before throwing
    const response = context.switchToHttp().getResponse<Response>();
    const { limit, totalHits, timeToExpire, isBlocked, timeToBlockExpire } = throttlerLimitDetail;

    this.setRateLimitHeaders(response, limit, totalHits, timeToExpire, isBlocked, timeToBlockExpire);

    throw new ThrottlerException('Too many requests. Please try again later.');
  }

  /**
   * Override handleRequest to add rate limit headers to all responses.
   */
  protected async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, limit, ttl, throttler, blockDuration, getTracker, generateKey } = requestProps;
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse<Response>();

    const tracker = await getTracker(request, context);
    const key = generateKey(context, tracker, throttler.name);

    const { totalHits, timeToExpire, isBlocked, timeToBlockExpire } =
      await this.storageService.increment(
        key,
        ttl,
        limit,
        blockDuration || 0,
        throttler.name,
      );

    // Set rate limit headers on all responses
    this.setRateLimitHeaders(response, limit, totalHits, timeToExpire, isBlocked, timeToBlockExpire);

    if (isBlocked || totalHits > limit) {
      await this.throwThrottlingException(context, {
        limit,
        ttl,
        key,
        tracker,
        totalHits,
        timeToExpire,
        isBlocked,
        timeToBlockExpire,
      });
    }

    return true;
  }

  /**
   * Set standard rate limit headers on the response.
   */
  private setRateLimitHeaders(
    response: Response,
    limit: number,
    totalHits: number,
    timeToExpire: number,
    isBlocked: boolean,
    timeToBlockExpire: number,
  ): void {
    // X-RateLimit-Limit: Maximum number of requests allowed
    response.setHeader('X-RateLimit-Limit', limit);

    // X-RateLimit-Remaining: Number of requests remaining
    const remaining = Math.max(0, limit - totalHits);
    response.setHeader('X-RateLimit-Remaining', remaining);

    // X-RateLimit-Reset: Unix timestamp when the rate limit resets
    const resetTime = Math.ceil((Date.now() + timeToExpire) / 1000);
    response.setHeader('X-RateLimit-Reset', resetTime);

    // Retry-After: Seconds until requests are allowed again (only when blocked)
    if (isBlocked || totalHits > limit) {
      const retryAfter = Math.ceil((isBlocked ? timeToBlockExpire : timeToExpire) / 1000);
      response.setHeader('Retry-After', retryAfter);
    }
  }
}
