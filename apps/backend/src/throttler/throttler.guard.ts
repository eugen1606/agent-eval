import { Injectable, ExecutionContext, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';

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
  ): Promise<void> {
    throw new ThrottlerException('Too many requests. Please try again later.');
  }
}
