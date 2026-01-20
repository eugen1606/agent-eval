import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dns from 'dns';
import { promisify } from 'util';

const dnsResolve4 = promisify(dns.resolve4);
const dnsResolve6 = promisify(dns.resolve6);

export interface UrlValidationOptions {
  /** Context for error messages (e.g., 'basePath', 'webhook URL') */
  context?: string;
  /** Skip DNS resolution check (use for input validation, not execution time) */
  skipDnsCheck?: boolean;
}

@Injectable()
export class UrlValidationService {
  private readonly logger = new Logger(UrlValidationService.name);
  private readonly isProduction: boolean;
  private readonly allowPrivateUrls: boolean;
  private readonly allowedDomains: string[];

  // Always blocked - cloud metadata endpoints (dangerous even in development)
  private readonly ALWAYS_BLOCKED_IPS: RegExp[] = [
    /^169\.254\./, // AWS/Azure/cloud metadata (link-local)
  ];

  private readonly ALWAYS_BLOCKED_HOSTNAMES: RegExp[] = [
    /^metadata\.google\.internal$/i,
    /^metadata\.goog$/i,
    /^169\.254\.169\.254$/,
  ];

  // Blocked in production only (or when ALLOW_PRIVATE_URLS=false)
  private readonly PRIVATE_IP_RANGES: RegExp[] = [
    /^127\./, // Loopback
    /^10\./, // Private Class A (10.0.0.0/8)
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private Class B (172.16.0.0/12)
    /^192\.168\./, // Private Class C (192.168.0.0/16)
    /^0\./, // Current network
    /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./, // Carrier-grade NAT (100.64.0.0/10)
    /^192\.0\.0\./, // IETF Protocol Assignments (192.0.0.0/24)
    /^192\.0\.2\./, // TEST-NET-1 (192.0.2.0/24)
    /^198\.51\.100\./, // TEST-NET-2 (198.51.100.0/24)
    /^203\.0\.113\./, // TEST-NET-3 (203.0.113.0/24)
    /^224\./, // Multicast (224.0.0.0/4)
    /^240\./, // Reserved (240.0.0.0/4)
    /^255\.255\.255\.255$/, // Broadcast
  ];

  private readonly PRIVATE_IPV6_RANGES: RegExp[] = [
    /^::1$/, // Loopback
    /^fe80:/i, // Link-local
    /^fc00:/i, // Unique local (fc00::/7)
    /^fd[0-9a-f]{2}:/i, // Unique local (fd00::/8)
    /^::ffff:(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/i, // IPv4-mapped private
  ];

  private readonly PRIVATE_HOSTNAMES: RegExp[] = [
    /^localhost$/i,
    /^localhost\./i,
    /\.localhost$/i,
    /\.local$/i,
    /\.internal$/i,
    /\.localdomain$/i,
    /^host\.docker\.internal$/i,
    /^kubernetes\.default/i,
  ];

  constructor(private readonly configService: ConfigService) {
    this.isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    this.allowPrivateUrls =
      this.configService.get<string>('ALLOW_PRIVATE_URLS') === 'true' ||
      !this.isProduction;

    // Parse allowed domains from environment variable
    const allowedDomainsStr = this.configService.get<string>(
      'ALLOWED_URL_DOMAINS',
      '',
    );
    this.allowedDomains = allowedDomainsStr
      ? allowedDomainsStr
          .split(',')
          .map((d) => d.trim().toLowerCase())
          .filter((d) => d.length > 0)
      : [];

    this.logger.log(
      `URL validation initialized: production=${this.isProduction}, allowPrivateUrls=${this.allowPrivateUrls}, allowedDomains=${this.allowedDomains.length > 0 ? this.allowedDomains.join(', ') : 'none'}`,
    );
  }

  /**
   * Validates a URL for SSRF protection.
   * Call this at input time (controller) with skipDnsCheck=true for fast validation.
   * Call this at execution time (service) with skipDnsCheck=false to prevent DNS rebinding.
   */
  async validateUrl(
    url: string,
    options: UrlValidationOptions = {},
  ): Promise<void> {
    const { context = 'URL', skipDnsCheck = false } = options;

    if (!url || typeof url !== 'string') {
      throw new BadRequestException(`${context} is required`);
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new BadRequestException(`${context} has invalid format`);
    }

    // Check protocol
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new BadRequestException(
        `${context} must use HTTP or HTTPS protocol`,
      );
    }

    // In production, require HTTPS unless explicitly allowing private URLs
    if (
      this.isProduction &&
      !this.allowPrivateUrls &&
      parsedUrl.protocol !== 'https:'
    ) {
      throw new BadRequestException(`${context} must use HTTPS in production`);
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // Check if hostname is in the allowlist (if configured)
    if (this.allowedDomains.length > 0) {
      const isAllowed = this.allowedDomains.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      );
      if (isAllowed) {
        // Allowlisted domains bypass other checks (except cloud metadata)
        if (!this.isCloudMetadataHostname(hostname)) {
          this.logger.debug(`${context} allowed via allowlist: ${hostname}`);
          return;
        }
      }
    }

    // Always block cloud metadata endpoints
    if (this.isCloudMetadataHostname(hostname)) {
      this.logger.warn(`Blocked cloud metadata access attempt: ${url}`);
      throw new BadRequestException(
        `${context} cannot target cloud metadata endpoints`,
      );
    }

    // Check if hostname looks like an IP address
    const isIpAddress = this.isIpAddress(hostname);

    if (isIpAddress) {
      // Validate IP address directly
      this.validateIpAddress(hostname, context);
    } else {
      // Check blocked hostname patterns
      this.validateHostname(hostname, context);

      // DNS resolution check to prevent DNS rebinding attacks
      if (!skipDnsCheck) {
        await this.validateDnsResolution(hostname, context);
      }
    }
  }

  /**
   * Synchronous validation for basic checks (use in controllers).
   * Does NOT perform DNS resolution - use validateUrl() at execution time.
   */
  validateUrlSync(url: string, options: UrlValidationOptions = {}): void {
    const { context = 'URL' } = options;

    if (!url || typeof url !== 'string') {
      throw new BadRequestException(`${context} is required`);
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new BadRequestException(`${context} has invalid format`);
    }

    // Check protocol
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new BadRequestException(
        `${context} must use HTTP or HTTPS protocol`,
      );
    }

    // In production, require HTTPS unless explicitly allowing private URLs
    if (
      this.isProduction &&
      !this.allowPrivateUrls &&
      parsedUrl.protocol !== 'https:'
    ) {
      throw new BadRequestException(`${context} must use HTTPS in production`);
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // Check if hostname is in the allowlist (if configured)
    if (this.allowedDomains.length > 0) {
      const isAllowed = this.allowedDomains.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      );
      if (isAllowed && !this.isCloudMetadataHostname(hostname)) {
        return;
      }
    }

    // Always block cloud metadata endpoints
    if (this.isCloudMetadataHostname(hostname)) {
      this.logger.warn(`Blocked cloud metadata access attempt: ${url}`);
      throw new BadRequestException(
        `${context} cannot target cloud metadata endpoints`,
      );
    }

    const isIpAddress = this.isIpAddress(hostname);

    if (isIpAddress) {
      this.validateIpAddress(hostname, context);
    } else {
      this.validateHostname(hostname, context);
    }
  }

  private isCloudMetadataHostname(hostname: string): boolean {
    // Check IP-based cloud metadata
    if (this.ALWAYS_BLOCKED_IPS.some((pattern) => pattern.test(hostname))) {
      return true;
    }
    // Check hostname-based cloud metadata
    if (
      this.ALWAYS_BLOCKED_HOSTNAMES.some((pattern) => pattern.test(hostname))
    ) {
      return true;
    }
    return false;
  }

  private isIpAddress(hostname: string): boolean {
    // IPv4
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
      return true;
    }
    // IPv6 (including bracketed format)
    if (hostname.includes(':') || hostname.startsWith('[')) {
      return true;
    }
    return false;
  }

  private validateIpAddress(ip: string, context: string): void {
    // Remove brackets from IPv6
    const cleanIp = ip.replace(/^\[|\]$/g, '');

    // Always block cloud metadata IPs
    if (this.ALWAYS_BLOCKED_IPS.some((pattern) => pattern.test(cleanIp))) {
      throw new BadRequestException(
        `${context} cannot target cloud metadata endpoints`,
      );
    }

    // Check private ranges if not allowed
    if (!this.allowPrivateUrls) {
      // IPv4 private ranges
      if (this.PRIVATE_IP_RANGES.some((pattern) => pattern.test(cleanIp))) {
        throw new BadRequestException(
          `${context} cannot target private IP addresses`,
        );
      }

      // IPv6 private ranges
      if (this.PRIVATE_IPV6_RANGES.some((pattern) => pattern.test(cleanIp))) {
        throw new BadRequestException(
          `${context} cannot target private IP addresses`,
        );
      }
    }
  }

  private validateHostname(hostname: string, context: string): void {
    // Always block cloud metadata hostnames
    if (
      this.ALWAYS_BLOCKED_HOSTNAMES.some((pattern) => pattern.test(hostname))
    ) {
      throw new BadRequestException(
        `${context} cannot target cloud metadata endpoints`,
      );
    }

    // Check private hostnames if not allowed
    if (!this.allowPrivateUrls) {
      if (this.PRIVATE_HOSTNAMES.some((pattern) => pattern.test(hostname))) {
        throw new BadRequestException(
          `${context} cannot target private/internal hostnames`,
        );
      }
    }
  }

  private async validateDnsResolution(
    hostname: string,
    context: string,
  ): Promise<void> {
    try {
      // Try to resolve IPv4 addresses
      let ipv4Addresses: string[] = [];
      try {
        ipv4Addresses = await dnsResolve4(hostname);
      } catch {
        // No IPv4 addresses, continue to IPv6
      }

      // Try to resolve IPv6 addresses
      let ipv6Addresses: string[] = [];
      try {
        ipv6Addresses = await dnsResolve6(hostname);
      } catch {
        // No IPv6 addresses
      }

      const allAddresses = [...ipv4Addresses, ...ipv6Addresses];

      if (allAddresses.length === 0) {
        // If we can't resolve the hostname, we might be offline or it's invalid
        // Log warning but don't block (could be a temporary DNS issue)
        this.logger.warn(
          `Could not resolve hostname ${hostname} - proceeding with caution`,
        );
        return;
      }

      // Validate each resolved IP address
      for (const ip of allAddresses) {
        // Always block cloud metadata IPs
        if (this.ALWAYS_BLOCKED_IPS.some((pattern) => pattern.test(ip))) {
          this.logger.warn(
            `DNS rebinding attack detected: ${hostname} resolves to cloud metadata IP ${ip}`,
          );
          throw new BadRequestException(
            `${context} resolves to blocked IP address`,
          );
        }

        // Check private ranges if not allowed
        if (!this.allowPrivateUrls) {
          const isPrivateIpv4 = this.PRIVATE_IP_RANGES.some((pattern) =>
            pattern.test(ip),
          );
          const isPrivateIpv6 = this.PRIVATE_IPV6_RANGES.some((pattern) =>
            pattern.test(ip),
          );

          if (isPrivateIpv4 || isPrivateIpv6) {
            this.logger.warn(
              `DNS rebinding attack detected: ${hostname} resolves to private IP ${ip}`,
            );
            throw new BadRequestException(
              `${context} resolves to blocked IP address`,
            );
          }
        }
      }

      this.logger.debug(
        `DNS validation passed for ${hostname}: ${allAddresses.join(', ')}`,
      );
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      // For other DNS errors, log and allow (could be temporary issue)
      this.logger.warn(
        `DNS resolution error for ${hostname}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
