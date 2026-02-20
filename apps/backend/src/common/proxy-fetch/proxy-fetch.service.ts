import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProxyAgent } from 'undici';
import { readFileSync } from 'fs';
import { rootCertificates } from 'tls';

@Injectable()
export class ProxyFetchService implements OnModuleInit {
  private readonly logger = new Logger(ProxyFetchService.name);
  private proxyAgent: ProxyAgent | null = null;
  private noProxyList: string[] = [];

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const httpsProxy = this.configService.get<string>('HTTPS_PROXY');
    const httpProxy = this.configService.get<string>('HTTP_PROXY');
    const proxyUrl = httpsProxy || httpProxy;

    this.logger.debug(
      `Proxy env: HTTPS_PROXY=${JSON.stringify(httpsProxy)}, HTTP_PROXY=${JSON.stringify(httpProxy)}`
    );

    const noProxy = this.configService.get<string>('NO_PROXY') || '';

    if (proxyUrl) {
      const caCertPath = this.configService.get<string>('NODE_EXTRA_CA_CERTS');
      const requestTls: Record<string, unknown> = {};

      if (caCertPath) {
        try {
          const customCa = readFileSync(caCertPath, 'utf8');
          // Append custom CA to default root certificates (don't replace them)
          requestTls.ca = [...rootCertificates, customCa];
          this.logger.log(`Loaded custom CA certificate from ${caCertPath}`);
        } catch (err) {
          this.logger.error(`Failed to load CA certificate from ${caCertPath}: ${err}`);
        }
      }

      this.proxyAgent = new ProxyAgent({
        uri: proxyUrl,
        requestTls: Object.keys(requestTls).length > 0 ? requestTls : undefined,
      });
      this.noProxyList = noProxy
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
      this.logger.log(
        `Proxy configured: ${proxyUrl} (NO_PROXY: ${this.noProxyList.join(', ') || 'none'})`
      );
    } else {
      this.logger.debug('No proxy configured, using direct connections');
    }
  }

  async fetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
    const targetUrl = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    console.log(`[ProxyFetchService] fetch called: ${targetUrl}, proxyAgent=${!!this.proxyAgent}`);

    if (!this.proxyAgent) {
      this.logger.warn(`[fetch] No proxy agent, direct fetch to: ${targetUrl}`);
      try {
        return await fetch(url, init);
      } catch (error) {
        this.logger.error(
          `[fetch] Direct fetch failed for ${targetUrl}: ${(error as Error).message}`
        );
        throw error;
      }
    }

    if (this.shouldBypassProxy(targetUrl)) {
      this.logger.debug(`[fetch] Bypassing proxy for: ${targetUrl}`);
      try {
        return await fetch(url, init);
      } catch (error) {
        this.logger.error(
          `[fetch] Bypass fetch failed for ${targetUrl}: ${(error as Error).message}`
        );
        throw error;
      }
    }

    this.logger.debug(`[fetch] Using proxy for: ${targetUrl}`);
    try {
      return await fetch(url, {
        ...init,
        dispatcher: this.proxyAgent,
      } as RequestInit);
    } catch (error) {
      const cause = (error as Error & { cause?: Error }).cause;
      const causeCode = (cause as Error & { code?: string })?.code;
      this.logger.error(
        `[fetch] Proxy fetch failed for ${targetUrl}: ${(error as Error).message}` +
          (cause ? ` | Cause: ${cause.message}` : '') +
          (causeCode ? ` (${causeCode})` : '')
      );
      throw error;
    }
  }

  private shouldBypassProxy(url: string): boolean {
    if (this.noProxyList.length === 0) {
      return false;
    }

    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      return false;
    }

    for (const entry of this.noProxyList) {
      if (entry === '*') {
        return true;
      }

      if (hostname === entry) {
        return true;
      }

      // Support .domain.com suffix matching
      if (entry.startsWith('.') && hostname.endsWith(entry)) {
        return true;
      }

      // Support domain.com matching against sub.domain.com
      if (!entry.startsWith('.') && hostname.endsWith('.' + entry)) {
        return true;
      }
    }

    return false;
  }
}
