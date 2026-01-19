import { Injectable, OnModuleInit } from '@nestjs/common';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly register: client.Registry;

  // Custom metrics
  public readonly httpRequestDuration: client.Histogram<string>;
  public readonly httpRequestsTotal: client.Counter<string>;
  public readonly activeConnections: client.Gauge<string>;
  public readonly webhookDeliveries: client.Counter<string>;
  public readonly webhookRetries: client.Counter<string>;

  constructor() {
    // Create a new registry
    this.register = new client.Registry();

    // Add default labels
    this.register.setDefaultLabels({
      app: 'benchmark-backend',
    });

    // Collect default metrics (CPU, memory, event loop, etc.)
    client.collectDefaultMetrics({ register: this.register });

    // HTTP request duration histogram
    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });

    // HTTP requests total counter
    this.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });

    // Active connections gauge
    this.activeConnections = new client.Gauge({
      name: 'http_active_connections',
      help: 'Number of active HTTP connections',
      registers: [this.register],
    });

    // Webhook delivery counter
    this.webhookDeliveries = new client.Counter({
      name: 'webhook_deliveries_total',
      help: 'Total number of webhook delivery attempts',
      labelNames: ['status', 'webhook_id'],
      registers: [this.register],
    });

    // Webhook retry counter
    this.webhookRetries = new client.Counter({
      name: 'webhook_retries_total',
      help: 'Total number of webhook retries',
      labelNames: ['webhook_id'],
      registers: [this.register],
    });
  }

  onModuleInit() {
    // Metrics are initialized in constructor
  }

  /**
   * Get all metrics in Prometheus format.
   */
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  /**
   * Get content type for metrics response.
   */
  getContentType(): string {
    return this.register.contentType;
  }

  /**
   * Record HTTP request metrics.
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationMs: number,
  ): void {
    const labels = {
      method,
      route: this.normalizeRoute(route),
      status_code: statusCode.toString(),
    };

    this.httpRequestDuration.observe(labels, durationMs / 1000);
    this.httpRequestsTotal.inc(labels);
  }

  /**
   * Normalize route to avoid high cardinality from path parameters.
   */
  private normalizeRoute(route: string): string {
    // Replace UUIDs with :id
    return route
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        ':id',
      )
      .replace(/\/\d+/g, '/:id');
  }

  /**
   * Increment active connections.
   */
  incrementConnections(): void {
    this.activeConnections.inc();
  }

  /**
   * Decrement active connections.
   */
  decrementConnections(): void {
    this.activeConnections.dec();
  }

  /**
   * Record webhook delivery attempt.
   */
  recordWebhookDelivery(
    webhookId: string,
    success: boolean,
  ): void {
    this.webhookDeliveries.inc({
      status: success ? 'success' : 'failure',
      webhook_id: webhookId,
    });
  }

  /**
   * Record webhook retry.
   */
  recordWebhookRetry(webhookId: string): void {
    this.webhookRetries.inc({ webhook_id: webhookId });
  }
}
