import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProxyAgent } from 'undici';

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
      // Validate the proxy URL before passing to ProxyAgent

      this.proxyAgent = new ProxyAgent(proxyUrl);
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
    if (!this.proxyAgent) {
      return fetch(url, init);
    }

    const targetUrl = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

    if (this.shouldBypassProxy(targetUrl)) {
      return fetch(url, init);
    }

    return fetch(url, {
      ...init,
      dispatcher: this.proxyAgent,
    } as RequestInit);
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
